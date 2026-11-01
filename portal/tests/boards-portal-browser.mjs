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
const watchdog=setTimeout(()=>{console.error('Browser test timed out');process.exit(1);},180000);
try{
  browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'/usr/bin/google-chrome',headless:true,args:['--no-sandbox']});
  const hostContext=await browser.newContext({viewport:{width:1280,height:800}}),guestContext=await browser.newContext({viewport:{width:390,height:844}});
  hostContext.setDefaultTimeout(15000);guestContext.setDefaultTimeout(15000);
  host=await hostContext.newPage();guest=await guestContext.newPage();
  for(const page of [host,guest]){page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());}
  await host.goto(origin+'/portal/setup.html');await host.fill('#password',password);await host.fill('#repeat',password);await host.click('button[type=submit]');
  await host.waitForFunction(()=>document.querySelector('#publicKey').value.length>0,{},{timeout:30000});
  const publicKey=await host.inputValue('#publicKey'),kdf=JSON.parse(await host.inputValue('#kdf'));
  const raw=await argon2id({password,salt:unb64(kdf.salt),iterations:3,parallelism:4,memorySize:65536,hashLength:32,outputType:'binary'});
  const material=await crypto.subtle.importKey('raw',raw,'HKDF',false,['deriveBits']);const seed=new Uint8Array(await crypto.subtle.deriveBits({name:'HKDF',hash:'SHA-256',salt:unb64(kdf.salt),info:new TextEncoder().encode('portal/master-ed25519/v1')},material,256));
  assert.equal((await fromSeed(seed)).publicKey,publicKey);raw.fill(0);seed.fill(0);assert.equal(await host.inputValue('#password'),'');
  console.log('PASS browser Argon2id/WASM and deterministic Ed25519');
  const bundle=await build({entryPoints:[resolve(root,'portal/worker/src/index.js')],bundle:true,format:'esm',write:false});
  mf=new Miniflare({modules:true,script:bundle.outputFiles[0].text,compatibilityDate:'2025-03-01',port:0,bindings:{ALLOWED_ORIGINS:origin,ADMIN_PUBLIC_KEY:publicKey,KDF_CONFIG:JSON.stringify(kdf)},durableObjects:{REGISTRY:{className:'PortalRegistry',useSQLite:true},ROOMS:{className:'GameRoom',useSQLite:true}}});
  apiBase=(await mf.ready).origin;

  const ids=['lost_cities','toy_battle','schotten_totten','7_wonders_duel','radlands'];
  const menu=async p=>{await p.evaluate(()=>document.querySelectorAll('dialog[open]').forEach(d=>d.close()));await p.click('[data-net=menu]');};
  for(const id of ids){
    await host.goto(origin+'/game/'+id+'/');await menu(host);await host.click('[data-net=create]');
    await host.waitForURL('**/portal/login.html?*');
    if(await host.locator('#password').isVisible())await host.fill('#password',password);
    await host.click('#login button[type=submit]');await host.waitForURL('**/game/'+id+'/**');
    await host.waitForFunction(()=>document.querySelector('[data-net=status]')?.textContent.includes('已连接'));
    await menu(host);await host.click('[data-net=invite]');await host.waitForFunction(()=>document.querySelector('[data-net=share]').value.includes('invite='));
    const invite=await host.inputValue('[data-net=share]');await host.click('[data-net=close]');
    await guest.goto(invite);await guest.click('[data-net=join]');await guest.waitForFunction(()=>document.querySelector('[data-net=status]').textContent.includes('已连接'));
    await host.waitForFunction(()=>!document.querySelector('[data-net=status]').textContent.includes('等待对手'));
    for(const p of [host,guest])await p.evaluate(()=>document.querySelectorAll('dialog[open]').forEach(d=>d.close()));
    if(id==='lost_cities'){await host.locator('#hand button').first().click();await host.click('#expedition');await host.click('#draw');await guest.waitForSelector('#hand button');}
    if(id==='toy_battle'){const turn=await host.evaluate(()=>s.turn);await [host,guest][turn].click('#drawBtn');await [host,guest][1-turn].waitForSelector('#hand button');}
    if(id==='schotten_totten'){await host.locator('#hand [data-card]').first().click();await host.locator('[data-stone="0"]').click();await host.click('#draw-clan');await guest.waitForSelector('#hand [data-card]');}
    if(id==='7_wonders_duel'){await host.locator('.draft button').first().click();await host.locator('#dialog button.primary').click();await guest.waitForFunction(()=>state.step===1);}
    if(id==='radlands'){for(let i=0;i<3;i++)await host.locator('[data-act^="draft:"]').nth(i).click();await host.click('[data-act="confirmDraft"]');await guest.waitForSelector('[data-act^="draft:"]');}
    await guest.reload();await guest.waitForFunction(()=>document.querySelector('[data-net=status]')?.textContent.includes('已连接'));
    if(id==='7_wonders_duel')assert.equal(await guest.evaluate(()=>state.step),1);
    if(id==='radlands')assert.equal(await guest.evaluate(()=>game.s.draft),1);
    if(id==='schotten_totten')assert.equal(await guest.evaluate(()=>s.player),1);
    await menu(host);await host.click('[data-net=undo]');await guest.waitForSelector('[data-net=accept]');await guest.click('[data-net=accept]');
    await host.waitForFunction(()=>!document.querySelector('[data-net=status]').textContent.includes('协商请求'));
    await menu(host);await host.click('[data-net=leave]');await host.reload();
    await host.waitForSelector('[data-net=menu]');await menu(host);
    assert.equal(await host.locator('[data-net=status]').textContent(),'');
    await host.click('[data-net=resume]');await host.waitForFunction(()=>document.querySelector('[data-net=status]').textContent.includes('已连接'));
    await menu(host);await host.click('[data-net=closeRoom]');await host.waitForFunction(()=>!document.querySelector('[data-net=status]').textContent);
    console.log('PASS Portal',id,'login, invitation, action, reload, undo, close');
  }
  assert.deepEqual(errors,[]);
}finally{clearTimeout(watchdog);await browser?.close();await mf?.dispose();await new Promise(r=>server.close(r));}
