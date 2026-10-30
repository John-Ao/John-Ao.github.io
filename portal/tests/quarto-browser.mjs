import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { chromium } from 'playwright';
import { Miniflare } from 'miniflare';
import { build } from 'esbuild';
import { argon2id } from 'hash-wasm';
import { fromSeed } from '../crypto/keys.js';
import { unb64 } from '../shared/protocol.js';
const root=resolve(new URL('../../',import.meta.url).pathname), output=resolve(root,'portal/test-results');
await mkdir(output,{recursive:true});
let apiBase='',mf,browser,host,guest;
const mime={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.wasm':'application/wasm','.json':'application/json'};
const server=createServer(async(req,res)=>{
  try{const path=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    if(path==='/portal/config.js'){res.setHeader('Content-Type','text/javascript');res.end(`export const config={apiBase:${JSON.stringify(apiBase)},games:{}};`);return;}
    const file=resolve(root,'.'+(path.endsWith('/')?path+'index.html':path));if(!file.startsWith(root+sep))throw Error('invalid');
    res.setHeader('Content-Type',mime[extname(file)]||'application/octet-stream');res.end(await readFile(file));
  }catch{res.statusCode=404;res.end('Not found');}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const origin=`http://127.0.0.1:${server.address().port}`,password='portal test only password 12345';
const errors=[];
const watchdog=setTimeout(()=>{console.error('Browser test timed out');process.exit(1);},240000);
try{
  browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'/usr/bin/google-chrome',headless:true,args:['--no-sandbox']});
  const hostContext=await browser.newContext({viewport:{width:1280,height:800}}),guestContext=await browser.newContext({viewport:{width:390,height:844}});
  hostContext.setDefaultTimeout(15000);guestContext.setDefaultTimeout(15000);
  host=await hostContext.newPage();guest=await guestContext.newPage();
  for(const page of [host,guest]){page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>{errors.push('Unexpected native game dialog: '+d.message());d.dismiss();});}
  await hostContext.addInitScript(()=>{const Original=window.WebSocket;window.testSockets=[];window.WebSocket=class extends Original{constructor(...args){super(...args);window.testSockets.push(this);}};});
  await host.goto(origin+'/portal/setup.html');await host.fill('#password',password);await host.fill('#repeat',password);await host.click('button[type=submit]');
  await host.waitForFunction(()=>document.querySelector('#publicKey').value.length>0,{},{timeout:30000});
  const publicKey=await host.inputValue('#publicKey'),kdf=JSON.parse(await host.inputValue('#kdf'));
  const raw=await argon2id({password,salt:unb64(kdf.salt),iterations:3,parallelism:4,memorySize:65536,hashLength:32,outputType:'binary'});
  const material=await crypto.subtle.importKey('raw',raw,'HKDF',false,['deriveBits']);const seed=new Uint8Array(await crypto.subtle.deriveBits({name:'HKDF',hash:'SHA-256',salt:unb64(kdf.salt),info:new TextEncoder().encode('portal/master-ed25519/v1')},material,256));
  assert.equal((await fromSeed(seed)).publicKey,publicKey);raw.fill(0);seed.fill(0);assert.equal(await host.inputValue('#password'),'');
  console.log('PASS browser Argon2id/WASM and deterministic Ed25519');
  const bundle=await build({entryPoints:[resolve(root,'portal/worker/src/index.js')],bundle:true,format:'esm',write:false,
    plugins:[{name:'expire-guest-for-test',setup(build){build.onLoad({filter:/worker\/src\/room\.js$/},async args=>({loader:'js',contents:(await readFile(args.path,'utf8')).replace('  async fetch(request) {', `  async fetch(request) {
      if(new URL(request.url).pathname==='/__expire-guest'){
        const m=await this.meta();m.guestExpires=Date.now()-1;await this.persist(m);await this.alarm();return new Response('ok');
      }`)}));}}]});
  mf=new Miniflare({modules:true,script:bundle.outputFiles[0].text,compatibilityDate:'2025-03-01',port:0,bindings:{ALLOWED_ORIGINS:origin,ADMIN_PUBLIC_KEY:publicKey,KDF_CONFIG:JSON.stringify(kdf)},durableObjects:{REGISTRY:{className:'PortalRegistry',useSQLite:true},ROOMS:{className:'GameRoom',useSQLite:true}}});
  apiBase=(await mf.ready).origin;
  const connected=page=>page.waitForFunction(()=>document.body.classList.contains('online')&&document.querySelector('#networkStatus').textContent.includes('已连接'));
  const snapshot=page=>page.evaluate(()=>({cells:[...document.querySelectorAll('#board button')].map(b=>b.getAttribute('aria-label')),held:document.querySelector('.held')?.dataset.piece??null,status:document.querySelector('#status').textContent}));
  async function dismissEvent(page,title){await page.waitForFunction(expected=>document.querySelector('#eventDialog').open&&document.querySelector('#eventTitle').textContent.includes(expected),title);await page.click('#eventAccept');await page.waitForSelector('#eventDialog',{state:'hidden'});}
  async function openNetwork(page){await page.click('#network');await page.waitForSelector('#networkDialog[open]');}
  async function inviteHost(){await openNetwork(host);await host.click('#inviteRoom');await host.waitForFunction(()=>document.querySelector('#shareLink').value.includes('invite='));const value=await host.inputValue('#shareLink');await host.click('[data-close=networkDialog]');return value;}
  async function join(page,invite){await page.goto(invite);await page.waitForSelector('#joinRoom',{state:'visible'});assert.equal(await page.locator('#createRoom').isVisible(),false);assert.equal(await page.locator('#resumeRoom').isVisible(),false);await page.click('#joinRoom');await connected(page);}
  async function placed(count){for(const page of [host,guest])await page.waitForFunction(n=>document.querySelectorAll('#board svg').length===n,count);assert.deepEqual(await snapshot(host),await snapshot(guest));}
  // A real local save must survive login, network play and leaving the room.
  await host.goto(origin+'/game/quarto/');await host.click('[data-piece="15"]');await host.click('[data-point="15"]');
  const localSave=await host.evaluate(()=>localStorage.getItem('quarto-clover-v1')),localSnapshot=await snapshot(host);
  await openNetwork(host);await host.click('#createRoom');await host.waitForURL('**/portal/login.html?*');
  await host.fill('#password',password);await host.click('#login button[type=submit]');await host.waitForURL('**/game/quarto/**');await connected(host);
  assert.equal(await host.locator('.pool button:enabled').count(),0);
  const invite=await inviteHost();await join(guest,invite);
  await host.waitForSelector('.pool button:enabled');
  assert.equal(await guest.locator('.pool button:enabled').count(),0);
  await host.click('[data-piece="0"]');await guest.waitForSelector('.held[data-piece="0"]');
  assert.equal(await host.locator('#board button:enabled').count(),0);
  await guest.click('[data-point="0"]');await placed(1);
  assert.equal(await host.locator('.pool button:enabled').count(),0);
  await guest.click('[data-piece="1"]');await host.click('[data-point="1"]');await placed(2);
  await openNetwork(guest);for(const id of ['inviteRoom','shareLink','copyInvite','closeRoom','loginAgain'])assert.equal(await guest.locator('#'+id).isVisible(),false);await guest.click('[data-close=networkDialog]');
  assert.equal(await host.inputValue('#shareLink'),'');
  const roomId=await host.evaluate(()=>sessionStorage.getItem('quarto.online.room'));
  const roomNS=await mf.getDurableObjectNamespace('ROOMS'),room=roomNS.get(roomNS.idFromName(roomId));
  assert.equal((await (await room.fetch('https://test/info')).json()).seq,5);
  await openNetwork(host);await host.click('#syncRoom');await connected(host);await placed(2);
  console.log('PASS actual login, invitation permissions, choose/place turn handoff, no duplicate init, and replay');

  await host.click('#undo');await guest.waitForSelector('#proposal[open]');await guest.click('[data-close=proposal]');
  await placed(2);await guest.click('#reviewProposal');await guest.click('#rejectProposal');await dismissEvent(host,'请求被拒绝');await placed(2);
  await host.click('#undo');await guest.click('#acceptProposal');for(const page of [host,guest])await dismissEvent(page,'已悔棋');await placed(1);assert.equal((await snapshot(host)).held,'1');
  await host.click('[data-point="1"]');await placed(2);
  await guest.click('#reset');await host.click('#acceptProposal');for(const page of [host,guest])await dismissEvent(page,'新棋局已开始');await placed(0);
  // Finish a real round; the placing player then chooses for the other player.
  for(let i=0;i<4;i++){const chooser=i%2===0?host:guest,placer=i%2===0?guest:host;await chooser.click(`[data-piece="${i}"]`);await placer.click(`[data-point="${i}"]`);await placed(i+1);}
  for(const page of [host,guest]){await dismissEvent(page,'本局结束');assert.equal(await page.locator('.winning').count(),4);assert.match((await snapshot(page)).status,/玩家 1 获胜/);}
  await guest.reload();await connected(guest);assert.equal(await guest.locator('#eventDialog').isVisible(),false);await placed(4);
  assert.equal(await host.evaluate(()=>localStorage.getItem('quarto-clover-v1')),localSave);
  console.log('PASS negotiation refusal/acceptance, held-piece undo, restart, win synchronization, refresh and local save isolation');

  for(const [width,height] of [[390,844],[844,390],[320,568],[1440,900]]){await guest.setViewportSize({width,height});assert(await guest.evaluate(()=>document.documentElement.scrollWidth<=innerWidth&&document.documentElement.scrollHeight<=innerHeight));}
  await guest.setViewportSize({width:390,height:844});await guest.screenshot({path:resolve(output,'quarto-online-mobile.png')});await host.screenshot({path:resolve(output,'quarto-online-desktop.png')});
  await openNetwork(guest);await guest.click('#leaveRoom');await guest.keyboard.press('Escape');assert(await guest.locator('body').evaluate(e=>e.classList.contains('online')));
  await openNetwork(guest);await guest.click('#leaveRoom');await guest.click('#eventAccept');await guest.waitForFunction(()=>!document.body.classList.contains('online'));
  await guest.reload();assert.equal(await guest.locator('body').evaluate(e=>e.classList.contains('online')),false);
  await dismissEvent(host,'对方已离开');await openNetwork(guest);await guest.click('#resumeRoom');await connected(guest);await dismissEvent(host,'对方已重新连接');await placed(4);
  console.log('PASS mobile/landscape layout, Escape cancel, explicit leave/resume and presence notices');

  await openNetwork(host);await host.click('#resetGuest');await host.click('#eventAccept');await dismissEvent(guest,'连接已结束');
  assert.equal(await guest.evaluate(()=>sessionStorage.getItem('quarto.online.room')),null);
  await host.waitForFunction(()=>document.querySelector('#inviteRoom').disabled===false);
  const freshInvite=await inviteHost();await join(guest,freshInvite);await placed(4);
  // A delayed offline notice can occur during a slow browser; dismiss only that notice.
  for(const page of [host,guest])if(await page.locator('#eventDialog').isVisible())await page.click('#eventAccept');
  const strangerContext=await browser.newContext(),stranger=await strangerContext.newPage();await joinFailure();
  async function joinFailure(){await stranger.goto(freshInvite);await stranger.click('#joinRoom');await stranger.waitForFunction(()=>document.querySelector('#networkMessage').textContent.includes('已被其他人'));assert.equal(await stranger.locator('#createRoom').isVisible(),false);await strangerContext.close();}
  // Inject a malformed peer event via the captured test socket; normal UI always preflights.
  const before=await snapshot(guest);
  const info=await (await room.fetch('https://test/info')).json();
  await host.evaluate(seq=>{const ws=window.testSockets.findLast(s=>s.readyState===1);ws.send(JSON.stringify({type:'event',id:'invalid-peer-test-0001',expectedSeq:seq,payload:{version:'wrong-version',kind:'action'}}));},info.seq);
  for(const page of [host,guest])await dismissEvent(page,'对局已暂停');assert.deepEqual(await snapshot(guest),before);assert.equal(await guest.locator('.pool button:enabled,#board button:enabled').count(),0);
  console.log('PASS guest revocation/rejoin, reused invite rejection and invalid peer event freezes trusted state');

  await openNetwork(host);await host.click('#closeRoom');await host.click('#eventAccept');
  for(const page of [host,guest])await dismissEvent(page,'连接已结束');
  assert.deepEqual(await snapshot(host),localSnapshot);assert.equal(await host.inputValue('#shareLink'),'');
  await openNetwork(host);await host.click('#createRoom');await connected(host);const secondInvite=await inviteHost();assert.notEqual(secondInvite,invite);
  await join(guest,secondInvite);await placed(0);
  for(const page of [host,guest])if(await page.locator('#eventDialog').isVisible())await page.click('#eventAccept');
  // Same-document hash changes must show the new invite and preserve guest-only entry.
  await openNetwork(host);await host.click('#resetGuest');await host.click('#eventAccept');await dismissEvent(guest,'连接已结束');
  const thirdInvite=await inviteHost();await guest.goto(thirdInvite);await guest.waitForSelector('#joinRoom',{state:'visible'});assert.equal(await guest.locator('#createRoom').isVisible(),false);await guest.click('#joinRoom');await connected(guest);await placed(0);
  console.log('PASS closing restores local state and permits new room/invitation without reload; hash-only invitation re-entry');

  // Guests cannot call creator/admin operations even if they bypass the hidden controls.
  const denied=await guest.evaluate(async()=>{const {createPortal}=await import('/portal/sdk/client.js');const {api}=await import('/portal/sdk/auth.js');const client=createPortal({gameId:'quarto'}),id=sessionStorage.getItem('quarto.online.room'),credentials=await client.credentials(id);const results=[];for(const [path,body] of [['/v1/rooms',{roomId:'guest-forbidden-room-0001'}],[`/v1/rooms/${id}/close`,{}],['/v1/admin/rooms',{}]]){try{await api(path,body,credentials);results.push(200);}catch(e){results.push(e.status);}}return results;});
  assert.deepEqual(denied,[403,403,403]);
  const admin=await hostContext.newPage();admin.on('pageerror',e=>errors.push(e.message));admin.on('dialog',d=>d.accept());
  await admin.goto(origin+'/portal/');await admin.fill('#password',password);await admin.click('#login button');await admin.waitForSelector('#admin',{state:'visible'});
  await admin.fill('#keyAlias','Quarto 测试成员');await admin.click('#createKeyInvite button');await admin.waitForFunction(()=>document.querySelector('#keyInviteLink').value.includes('secret='));
  const registration=await admin.inputValue('#keyInviteLink'),memberContext=await browser.newContext(),member=await memberContext.newPage();member.on('pageerror',e=>errors.push(e.message));
  await member.goto(registration);await member.fill('#keyPassword','quarto personal test password');await member.fill('#keyRepeat','quarto personal test password');await member.click('#register button');await member.waitForSelector('#registered',{state:'visible'});
  await member.goto(origin+'/game/quarto/');await openNetwork(member);await member.click('#createRoom');await member.waitForURL('**/portal/login.html?*');await member.waitForSelector('#keyLogin:enabled');await member.click('#keyLogin');await member.waitForURL('**/game/quarto/**');await connected(member);
  await openNetwork(member);await member.click('#inviteRoom');await member.waitForFunction(()=>document.querySelector('#shareLink').value.includes('invite='));
  await member.click('[data-close=networkDialog]');await member.reload();await connected(member);assert.equal(await member.locator('#eventDialog').isVisible(),false);
  console.log('PASS ordinary personal-key login and room restore; guest cannot create, close, or administer rooms');

  // Keep an invitation response pending while its room is closed through the real API.
  let releaseInvite,inviteFetched;
  const heldResponse=new Promise(r=>releaseInvite=r),fetchedResponse=new Promise(r=>inviteFetched=r);
  await member.route('**/v1/rooms/*/invite',async route=>{const response=await route.fetch();inviteFetched();await heldResponse;await route.fulfill({response});});
  await openNetwork(member);await member.click('#inviteRoom');await fetchedResponse;
  assert.equal(await member.locator('#inviteRoom').isEnabled(),false);
  await member.evaluate(async()=>{const {createPortal}=await import('/portal/sdk/client.js');await createPortal({gameId:'quarto'}).roomAction(sessionStorage.getItem('quarto.online.room'),'close');});
  await member.waitForFunction(()=>!document.body.classList.contains('online'));releaseInvite();await member.waitForFunction(()=>document.querySelector('#createRoom').disabled===false);assert.equal(await member.inputValue('#shareLink'),'');await dismissEvent(member,'连接已结束');
  await openNetwork(member);await member.click('#createRoom');await connected(member);
  assert.equal(await member.inputValue('#shareLink'),'');await member.unroute('**/v1/rooms/*/invite');
  await memberContext.close();console.log('PASS late invitation response cannot resurrect a closed room or stale share link');
  assert.deepEqual(errors,[]);
}catch(e){console.error('Browser errors:',errors);if(host){console.error('Host URL:',host.url(),'UI:',await host.locator('body').innerText());await host.screenshot({path:resolve(output,'quarto-failure.png')});}if(guest)console.error('Guest UI:',await guest.locator('body').innerText());throw e;}finally{clearTimeout(watchdog);await browser?.close();await mf?.dispose();await new Promise(r=>server.close(r));}
