import assert from 'node:assert/strict';
import { createServer, request as httpRequest } from 'node:http';
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
let proxyRequests=0,proxySockets=0;
const relay=createServer((req,res)=>{
  proxyRequests++;
  const upstream=httpRequest(apiBase+req.url,{method:req.method,headers:{...req.headers,host:new URL(apiBase).host}},response=>{
    res.writeHead(response.statusCode,response.headers);response.pipe(res);
  });
  upstream.on('error',()=>{res.writeHead(502);res.end();});req.pipe(upstream);
});
relay.on('upgrade',(req,socket,head)=>{
  const upstream=httpRequest(apiBase+req.url,{headers:{...req.headers,host:new URL(apiBase).host}});
  upstream.on('upgrade',(response,peer,peerHead)=>{
    proxySockets++;
    socket.write('HTTP/1.1 101 Switching Protocols\r\n'+Object.entries(response.headers).map(([k,v])=>k+': '+v).join('\r\n')+'\r\n\r\n');
    if(head.length)peer.write(head);if(peerHead.length)socket.write(peerHead);
    socket.pipe(peer);peer.pipe(socket);
    socket.on('error',()=>peer.destroy());peer.on('error',()=>socket.destroy());
    socket.on('close',()=>peer.destroy());peer.on('close',()=>socket.destroy());
  });
  upstream.on('response',()=>socket.destroy());upstream.on('error',()=>socket.destroy());upstream.end();
});
await new Promise(r=>relay.listen(0,'127.0.0.1',r));
const relayBase=`http://127.0.0.1:${relay.address().port}`;
const mime={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.wasm':'application/wasm','.json':'application/json'};
const server=createServer(async(req,res)=>{
  try{const path=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    if(path==='/portal/config.js'){res.setHeader('Content-Type','text/javascript');res.end(`export const config={apiBase:${JSON.stringify(apiBase)},routes:[{id:'direct',label:'直连',url:${JSON.stringify(apiBase)}},{id:'relay',label:'备用',url:${JSON.stringify(relayBase)}}],games:{}};`);return;}
    const file=resolve(root,'.'+(path.endsWith('/')?path+'index.html':path));if(!file.startsWith(root+sep))throw Error('invalid');
    res.setHeader('Content-Type',mime[extname(file)]||'application/octet-stream');res.end(await readFile(file));
  }catch{res.statusCode=404;res.end('Not found');}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const origin=`http://127.0.0.1:${server.address().port}`,password='portal test only password 12345';
const errors=[];
try{
  browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'/usr/bin/google-chrome',headless:true,args:['--no-sandbox']});
  const hostContext=await browser.newContext({viewport:{width:1280,height:800}}),guestContext=await browser.newContext({viewport:{width:390,height:844}});
  host=await hostContext.newPage();guest=await guestContext.newPage();
  for(const page of [host,guest]){page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>{errors.push('Unexpected native game dialog: '+d.message());d.dismiss();});}
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
  await host.goto(origin+'/game/quoridor/');await host.click('#network');await host.click('#createRoom');await host.waitForURL('**/portal/login.html?*');
  await host.selectOption('#portalRoute','relay');await host.fill('#password',password);await host.click('#login button[type=submit]');await host.waitForURL('**/game/quoridor/**');
  await host.waitForFunction(()=>document.querySelector('#networkStatus').textContent.includes('已连接'),{},{timeout:30000});
  await host.click('#network');await host.click('#inviteRoom');await host.waitForFunction(()=>document.querySelector('#shareLink').value.includes('invite='));
  const invite=await host.inputValue('#shareLink');await host.locator('[data-close=networkDialog]').click();
  assert.match(new URLSearchParams(new URL(invite).hash.slice(1)).get('invite'),/^p1\.relay\./);
  await guestContext.route(apiBase+'/**',route=>route.abort('failed'));

  await guest.goto(invite);await guest.waitForSelector('#joinRoom',{state:'visible'});assert.equal(await guest.locator('#createRoom').isVisible(),false);assert.equal(await guest.locator('#resumeRoom').isVisible(),false);await guest.click('#joinRoom');await guest.waitForFunction(()=>document.querySelector('#networkStatus').textContent.includes('已连接'));
  await host.waitForFunction(()=>!document.querySelector('#networkStatus').textContent.includes('等待对手'));
  assert.equal(new URL(await guest.evaluate(()=>online.ws.url)).host,new URL(relayBase).host);
  assert.equal(await guest.evaluate(base=>localStorage.getItem('portal.route:'+base),apiBase),null);
  await guest.reload();await guest.waitForFunction(()=>!!online?.ready);
  assert.equal(new URL(await guest.evaluate(()=>online.ws.url)).host,new URL(relayBase).host);
  await guestContext.unroute(apiBase+'/**');
  console.log('PASS invite follows host relay with direct route blocked; reload retains tab route without changing browser preference');

  const turn=await host.textContent('#turn'),active=turn.includes('玩家一')?host:guest;
  await active.locator('#board .cell.legal').first().click();
  for(const page of [host,guest])await page.waitForFunction(()=>document.querySelector('#ply').textContent==='第 2 手');
  const snapshot=page=>page.locator('#board').evaluate(el=>Array.from(el.querySelectorAll('.pawn')).map(p=>({class:p.className,cell:p.parentElement.getAttribute('aria-label')})));
  assert.deepEqual(await snapshot(host),await snapshot(guest));
  await host.evaluate(()=>online.reconnect());
  await host.waitForFunction(()=>document.querySelector('#networkStatus').textContent.includes('已连接'));
  assert.deepEqual(await snapshot(host),await snapshot(guest));
  console.log('PASS two browsers join, synchronize a legal move, and reconnect');
  assert.ok(proxyRequests>0);assert.ok(proxySockets>0);
  const routePage=await hostContext.newPage();await routePage.goto(origin+'/portal/');
  assert.equal(await routePage.inputValue('#portalRoute'),'relay');
  await routePage.selectOption('#portalRoute','direct');
  await host.waitForFunction(base=>online.ready&&new URL(online.ws.url).host===new URL(base).host,apiBase);
  assert.deepEqual(await snapshot(host),await snapshot(guest));
  assert.equal(new URL(await guest.evaluate(()=>online.ws.url)).host,new URL(relayBase).host);
  await routePage.selectOption('#portalRoute','relay');
  await host.waitForFunction(base=>online.ready&&new URL(online.ws.url).host===new URL(base).host,relayBase);
  assert.deepEqual(await snapshot(host),await snapshot(guest));
  await routePage.close();
  console.log('PASS relay login/signatures, mixed-route game, cross-tab route switching and replay');

  async function dismissEvent(page,title){
    await page.waitForFunction(expected=>document.querySelector('#eventDialog').open&&document.querySelector('#eventTitle').textContent.includes(expected),title);
    await page.click('#eventAccept');await page.waitForSelector('#eventDialog',{state:'hidden'});
  }
  await guest.click('#network');
  assert.equal(await guest.locator('#shareLink').isVisible(),false);
  assert.equal(await guest.locator('#copyInvite').isVisible(),false);
  assert.equal(await guest.locator('#inviteRoom').isVisible(),false);
  await guest.click('[data-close=networkDialog]');
  assert.equal(await host.inputValue('#shareLink'),''); // consumed invitations are never left on screen
  await host.click('#undo');await guest.waitForSelector('#proposal[open]');
  await guest.screenshot({path:resolve(output,'quoridor-request-mobile.png')});
  await guest.click('[data-close=proposal]');
  assert.equal(await guest.textContent('#ply'),'第 2 手');
  await guest.click('#reviewProposal');await guest.click('#rejectProposal');
  await dismissEvent(host,'请求被拒绝');
  assert.equal(await host.textContent('#ply'),'第 2 手');
  await host.click('#undo');await guest.waitForSelector('#acceptProposal',{state:'visible'});await guest.click('#acceptProposal');
  for(const page of [host,guest]){await page.waitForFunction(()=>document.querySelector('#ply').textContent==='第 1 手');await dismissEvent(page,'已悔棋');}
  await guest.click('#restart');await host.waitForSelector('#acceptProposal',{state:'visible'});await host.click('#acceptProposal');
  for(const page of [host,guest])await dismissEvent(page,'新棋局已开始');
  // Stored expiry is only a snapshot; WS activity can renew the authoritative grant.
  await guest.evaluate(async()=>{const {stored}=await import('/portal/sdk/storage.js');const value=await portal.credentials(online.id);await stored(portal.key(online.id),{...value,expires:Date.now()-1});});
  await guest.reload();await guest.waitForFunction(()=>document.querySelector('#networkStatus').textContent.includes('已连接'));
  assert.equal(await guest.locator('#proposal').isVisible(),false); // no historical request popups
  assert.deepEqual(await snapshot(host),await snapshot(guest));
  console.log('PASS custom request/result dialogs, refusal, close icon, and guest-only menu');
  await guest.click('#network');await guest.click('#leaveRoom');
  await guest.click('[data-close=eventDialog]'); // closing a confirmation must not leave
  assert(await guest.evaluate(()=>!!online?.ready));
  await guest.click('#network');await guest.click('#leaveRoom');await guest.click('#eventAccept');
  await guest.waitForFunction(()=>online===null);
  await host.waitForFunction(()=>document.querySelector('#eventDialog').open&&document.querySelector('#eventTitle').textContent.includes('对方已离开'));
  await host.screenshot({path:resolve(output,'quoridor-peer-left.png')});
  await guest.click('#network');await guest.click('#resumeRoom');
  await guest.waitForFunction(()=>!!online?.ready);
  await dismissEvent(host,'对方已重新连接');
  assert.deepEqual(await snapshot(host),await snapshot(guest));
  console.log('PASS explicit leave, peer-offline popup, room resume, and reconnect notification');
  const existingRoom=await host.evaluate(()=>online.id),beforeExpiry=await snapshot(host);
  const roomNS=await mf.getDurableObjectNamespace('ROOMS');
  await roomNS.get(roomNS.idFromName(existingRoom)).fetch('https://test/__expire-guest');
  await dismissEvent(guest,'连接已结束');assert.equal(await guest.evaluate(()=>online),null);
  assert.equal(await guest.locator('#createRoom').isVisible(),false);
  await host.waitForFunction(()=>!peerJoined);await dismissEvent(host,'对方已离开');
  await host.click('#network');await host.click('#inviteRoom');await host.waitForFunction(()=>document.querySelector('#shareLink').value.includes('invite='));
  const renewedInvite=await host.inputValue('#shareLink');await host.click('[data-close=networkDialog]');
  await guest.goto(renewedInvite);await guest.click('#joinRoom');await guest.waitForFunction(()=>!!online?.ready&&!!onlineModel);
  assert.equal(await guest.evaluate(()=>online.id),existingRoom);assert.deepEqual(await snapshot(guest),beforeExpiry);
  // Avoid letting a legitimate offline/rejoined notification obscure later controls.
  for(const page of [host,guest])await page.evaluate(()=>clearDialogs());
  console.log('PASS stale expiry snapshot, idle guest termination and fresh sharing into the same region');

  await host.screenshot({path:resolve(output,'quoridor-desktop.png')});await guest.screenshot({path:resolve(output,'quoridor-mobile.png')});
  const layout=await guest.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,board:document.querySelector('#board').getBoundingClientRect().toJSON()}));assert(layout.scroll<=layout.width+1);assert(layout.board.width>150);
  const strangerContext=await browser.newContext(),stranger=await strangerContext.newPage();await stranger.goto(renewedInvite);await stranger.click('#joinRoom');await stranger.waitForFunction(()=>document.querySelector('#networkMessage').textContent.includes('已被其他人'));await strangerContext.close();
  const before=await snapshot(guest);
  await host.evaluate(async()=>{await online.send({version:GAME_VERSION,roundId:onlineModel.roundId,base:onlineModel.revision,kind:'action',action:{type:'move',r:-999,c:1000}});});
  await guest.waitForFunction(()=>document.querySelector('#networkStatus').textContent.includes('本地校验'));
  assert.deepEqual(await snapshot(guest),before);
  assert.equal(await guest.locator('#board .cell.legal').count(),0);
  console.log('PASS illegal peer message is rejected locally and shown to player');
  const admin=await hostContext.newPage();admin.on('pageerror',e=>errors.push(e.message));admin.on('dialog',d=>d.accept());
  await admin.goto(origin+'/portal/');await admin.fill('#password',password);await admin.click('#login button');await admin.waitForSelector('#admin',{state:'visible'});await admin.waitForFunction(()=>document.querySelector('#rooms tbody tr, #rooms tr')!==null&&!document.querySelector('#rooms').textContent.includes('暂无房间'));
  await admin.screenshot({path:resolve(output,'portal-admin.png')});
  await admin.getByRole('button',{name:'关闭房间',exact:true}).click();await admin.waitForFunction(()=>document.querySelector('#rooms').textContent.includes('暂无房间'));
  for(const page of [host,guest]){
    await dismissEvent(page,'连接已结束');
    assert.equal(await page.evaluate(()=>online),null);
    assert.equal(await page.inputValue('#shareLink'),'');
    assert.equal(await page.evaluate(()=>sessionStorage.getItem('quoridor.online.room')),null);
  }
  await host.click('#network');await host.click('#createRoom');await host.waitForFunction(()=>!!online?.ready&&!!onlineModel);
  await host.click('#network');await host.click('#inviteRoom');await host.waitForFunction(()=>document.querySelector('#shareLink').value.includes('invite='));
  const secondInvite=await host.inputValue('#shareLink');assert.notEqual(secondInvite,invite);
  await host.click('#closeRoom');await host.click('[data-close=eventDialog]');assert(await host.evaluate(()=>!!online?.ready));
  await host.click('#network');await host.click('#closeRoom');await host.click('#eventAccept');
  await host.waitForFunction(()=>online===null);await host.waitForSelector('#eventDialog[open]');await host.click('#eventAccept');
  assert.equal(await host.inputValue('#shareLink'),'');
  await host.click('#network');assert(await host.locator('#createRoom').isEnabled());await host.click('#createRoom');await host.waitForFunction(()=>!!online?.ready&&!!onlineModel);
  await host.click('#network');await host.click('#inviteRoom');await host.waitForFunction(()=>document.querySelector('#shareLink').value.includes('invite='));
  assert.notEqual(await host.inputValue('#shareLink'),secondInvite);
  console.log('PASS remote and local room closure clear links, restore controls, and allow new invitations without reload');
  // Replacing the guest must release the seat and invalidate the displayed invitation.
  const thirdInvite=await host.inputValue('#shareLink');await host.click('[data-close=networkDialog]');
  await guest.goto(thirdInvite);await guest.click('#joinRoom');await guest.waitForFunction(()=>!!online?.ready);
  await host.waitForFunction(()=>peerJoined);
  await host.click('#network');await host.click('#resetGuest');await host.click('#eventAccept');
  await dismissEvent(guest,'连接已结束');
  await host.click('#network');assert(await host.locator('#inviteRoom').isEnabled());assert.equal(await host.inputValue('#shareLink'),'');
  await host.click('#inviteRoom');await host.waitForFunction(()=>document.querySelector('#shareLink').value.includes('invite='));
  assert.notEqual(await host.inputValue('#shareLink'),thirdInvite);
  console.log('PASS guest revocation clears guest UI and permits a fresh invitation');
  // Delay an invite HTTP response until after room closure: it must not restore a stale link.
  let releaseInvite,inviteFetched;
  const held=new Promise(r=>{releaseInvite=r;}),fetched=new Promise(r=>{inviteFetched=r;});
  await host.route('**/v1/rooms/*/invite',async route=>{const response=await route.fetch();inviteFetched();await held;await route.fulfill({response});});
  await host.click('#inviteRoom');await fetched;
  assert.equal(await host.locator('#inviteRoom').isEnabled(),false);
  await admin.click('#refresh');await admin.getByRole('button',{name:'关闭房间',exact:true}).click();
  await host.waitForFunction(()=>online===null);releaseInvite();
  await host.waitForFunction(()=>busyButtons.size===0);
  assert.equal(await host.inputValue('#shareLink'),'');
  await host.unroute('**/v1/rooms/*/invite');
  await dismissEvent(host,'连接已结束');
  await host.click('#network');assert(await host.locator('#createRoom').isEnabled());
  console.log('PASS delayed invitation response cannot overwrite a closed room');
  await admin.fill('#keyAlias','测试成员');await admin.click('#createKeyInvite button');await admin.waitForFunction(()=>document.querySelector('#keyInviteLink').value.includes('secret='));
  const registration=await admin.inputValue('#keyInviteLink');
  const memberContext=await browser.newContext(),member=await memberContext.newPage();member.on('pageerror',e=>errors.push(e.message));
  await member.route('**/v1/keys/register',async route=>{await route.fetch();await route.abort('failed');});
  await member.goto(registration);await member.fill('#keyPassword','personal key password for test');await member.fill('#keyRepeat','personal key password for test');await member.click('#register button');
  await member.waitForFunction(()=>document.querySelector('#status').classList.contains('error'));
  await member.unroute('**/v1/keys/register');await member.reload();
  await member.waitForSelector('#registered',{state:'visible'});assert.equal(new URL(member.url()).hash,'');
  const downloadEvent=member.waitForEvent('download');await member.click('#backup');const recoveryDownload=await downloadEvent;
  const recoveryPath=resolve(output,'personal-recovery.json');await recoveryDownload.saveAs(recoveryPath);
  const recovery=JSON.parse(await readFile(recoveryPath,'utf8'));assert.equal(recovery.seed,undefined);assert.equal(recovery.privateKey,undefined);assert.equal(recovery.type,'portal-personal-key');
  await member.goto(origin+'/game/quoridor/');await member.click('#network');await member.click('#createRoom');await member.waitForURL('**/portal/login.html?*');await member.waitForSelector('#keyLogin:enabled');await member.click('#keyLogin');
  await member.waitForURL('**/game/quoridor/**');await member.waitForFunction(()=>!!online?.ready&&!!onlineModel);
  await admin.click('#refreshKeys');await admin.waitForFunction(()=>document.querySelector('#keys').textContent.includes('创建房间 1 次'));
  await admin.locator('#keys input').fill('修改后的别名');await admin.getByRole('button',{name:'保存别名',exact:true}).click();await admin.waitForFunction(()=>document.querySelector('#keys input').value==='修改后的别名');
  await admin.screenshot({path:resolve(output,'portal-key-management.png')});
  const recoveryContext=await browser.newContext(),recovered=await recoveryContext.newPage();recovered.on('pageerror',e=>errors.push(e.message));
  await recovered.goto(origin+'/game/quoridor/');await recovered.click('#network');await recovered.click('#createRoom');await recovered.waitForURL('**/portal/login.html?*');await recovered.locator('#restore summary').click();
  await recovered.setInputFiles('#keyFile',recoveryPath);await recovered.fill('#keyPassword','personal key password for test');await recovered.click('#importKey button');
  await recovered.waitForURL('**/game/quoridor/**');await recovered.waitForFunction(()=>!!online?.ready&&!!onlineModel);
  const adminPage=await memberContext.newPage();await adminPage.goto(origin+'/portal/');assert.equal(await adminPage.locator('#admin').isVisible(),false);assert.equal(await adminPage.locator('#login').isVisible(),true);
  await admin.getByRole('button',{name:'撤销密钥',exact:true}).click();await admin.click('#acceptKeyRevoke');
  await member.waitForFunction(()=>online===null);await recovered.waitForFunction(()=>online===null);
  await admin.waitForFunction(()=>document.querySelector('#keys').textContent.includes('已撤销'));
  await memberContext.close();await recoveryContext.close();
  console.log('PASS five-minute key registration, ordinary-key login, recovery, alias/usage management, revocation, and no admin auto-login');
  const filePage=await hostContext.newPage();filePage.on('pageerror',e=>errors.push(e.message));await filePage.goto('file://'+root+'/game/quoridor/index.html');await filePage.locator('.cell.legal').first().click();assert.equal(await filePage.textContent('#ply'),'第 2 手');
  assert.deepEqual(errors,[]);console.log('PASS original file:// local play; no browser script errors');
}catch(e){console.error('Browser errors:',errors);if(host){console.error('Host URL:',host.url(),'UI:',await host.locator('body').innerText());await host.screenshot({path:resolve(output,'failure.png')});}throw e;}finally{await browser?.close();await mf?.dispose();await new Promise(r=>server.close(r));await new Promise(r=>relay.close(r));}
