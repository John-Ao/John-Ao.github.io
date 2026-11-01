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
const mime={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.wasm':'application/wasm','.json':'application/json','.svg':'image/svg+xml'};
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
  async function openNetwork(page){await page.click('#network');await page.waitForSelector('#networkDialog[open]');}
  async function dismiss(page){if(await page.locator('#eventDialog').isVisible())await page.click('#eventAccept');}
  await host.goto(origin+'/game/jaipur/');
  const localSave=await host.evaluate(()=>localStorage.getItem('jaipur-v2'));
  await openNetwork(host);await host.click('#createRoom');await host.waitForURL('**/portal/login.html?*');
  await host.fill('#password',password);await host.click('#login button[type=submit]');await host.waitForURL('**/game/jaipur/**');await connected(host);
  await openNetwork(host);await host.click('#inviteRoom');await host.waitForFunction(()=>document.querySelector('#shareLink').value.includes('invite='));
  const invite=await host.inputValue('#shareLink');await host.click('[data-close=networkDialog]');
  await guest.goto(invite);await guest.waitForSelector('#joinRoom',{state:'visible'});assert.equal(await guest.locator('#createRoom').isVisible(),false);await guest.click('#joinRoom');await connected(guest);
  await host.waitForFunction(()=>network.canAct()||!document.querySelector('#networkStatus').textContent.includes('等待对手'));
  const snapshot=page=>page.evaluate(()=>JSON.stringify(state));
  assert.equal(await snapshot(host),await snapshot(guest));
  for(const page of [host,guest]){
    assert.equal(await page.locator('[data-do=openHands]').count(),0);
    assert.equal(await page.locator('.work .hand .card').count(),await page.evaluate(()=>state.players[network.seat()].hand.length));
  }
  const active=await host.evaluate(()=>state.turn===0)?host:guest;
  await active.click('[data-mode=camels]');await active.click('[data-do=act]');
  for(const page of [host,guest])await page.waitForFunction(()=>state.history.events.length===1);
  assert.equal(await snapshot(host),await snapshot(guest));
  await guest.reload();await connected(guest);assert.equal(await snapshot(host),await snapshot(guest));
  await host.click('#undo');await guest.waitForSelector('#proposal[open]');await guest.click('#acceptProposal');
  for(const page of [host,guest]){await page.waitForFunction(()=>state.history.events.length===0);await page.waitForSelector('#eventDialog[open]');await dismiss(page);}
  assert.equal(await snapshot(host),await snapshot(guest));
  await host.click('#reset');await guest.waitForSelector('#proposal[open]');await guest.click('#rejectProposal');await host.waitForSelector('#eventDialog[open]');await dismiss(host);
  const before=await snapshot(host);await host.click('#reset');await guest.waitForSelector('#proposal[open]');await guest.click('#acceptProposal');
  for(const page of [host,guest]){await page.waitForSelector('#eventDialog[open]');await dismiss(page);}
  assert.notEqual(await snapshot(host),before);assert.equal(await snapshot(host),await snapshot(guest));
  // Drive a complete round through the real transport and negotiate the next deal.
  for(let step=0;step<600;step++){
    if(await host.evaluate(()=>state.ended))break;
    await new Promise(resolve=>setTimeout(resolve,400)); // Respect Portal's per-connection rate limit.
    const player=await host.evaluate(()=>state.turn===0)?host:guest;
    await player.evaluate(async step=>{
      const p=state.players[state.turn];
      const actions=[{type:'camels',market:[],hand:[],camels:0},...state.market.map((_,i)=>({type:'take',market:[i],hand:[],camels:0})),...J.TYPES.map(t=>({type:'sell',market:[],hand:p.hand.flatMap((x,i)=>x===t?[i]:[]),camels:0}))];
      const valid=actions.filter(a=>{try{J.act(state,a);return true;}catch{return false;}});
      await Promise.race([network.sendAction(valid[step%valid.length]),new Promise((_,reject)=>setTimeout(()=>reject(Error('action confirmation timed out')),10000))]);
    },step);
    for(const page of [host,guest])await page.waitForFunction(n=>state.history.events.length===n,step+1);
  }
  assert.equal(await host.evaluate(()=>state.ended),true);assert.equal(await snapshot(host),await snapshot(guest));
  await host.click('[data-do=next]');await guest.waitForSelector('#proposal[open]');await guest.click('#acceptProposal');
  for(const page of [host,guest]){await page.waitForFunction(()=>state.previousRounds.length===1&&!state.ended);await page.waitForSelector('#eventDialog[open]');await dismiss(page);}
  assert.equal(await snapshot(host),await snapshot(guest));
  assert.equal(await host.evaluate(()=>localStorage.getItem('jaipur-v2')),localSave);
  assert.equal(await guest.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await guest.screenshot({path:resolve(output,'jaipur-mobile.png'),fullPage:true});
  await openNetwork(guest);assert.equal(await guest.locator('#inviteControls').isVisible(),false);await guest.click('#leaveRoom');await guest.click('#eventAccept');await guest.waitForFunction(()=>!network.isOnline());
  await openNetwork(guest);await guest.click('#resumeRoom');await connected(guest);assert.equal(await snapshot(host),await snapshot(guest));
  await openNetwork(host);await host.click('#closeRoom');await host.click('#eventAccept');await host.waitForFunction(()=>!network.isOnline());
  assert.equal(await host.evaluate(()=>localStorage.getItem('jaipur-v2')),localSave);
  await host.waitForSelector('#eventDialog[open]');await dismiss(host);await openNetwork(host);await host.click('#createRoom');await connected(host);
  assert.deepEqual(errors,[]);console.log('PASS Jaipur login, invite, two-seat hands, action, replay, undo/restart negotiation, mobile, leave/resume, local save and close/recreate');
}catch(e){console.error('Browser errors:',errors);if(host){console.error('Host URL:',host.url(),'UI:',await host.locator('body').innerText());await host.screenshot({path:resolve(output,'jaipur-failure.png')});}if(guest)console.error('Guest UI:',await guest.locator('body').innerText());throw e;}finally{clearTimeout(watchdog);await browser?.close();await mf?.dispose();await new Promise(r=>server.close(r));}
