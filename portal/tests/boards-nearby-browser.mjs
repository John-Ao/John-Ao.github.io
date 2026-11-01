import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile, mkdir} from 'node:fs/promises';
import {resolve, extname, sep} from 'node:path';
import {chromium} from 'playwright';
const root = resolve(new URL('../../', import.meta.url).pathname), output = resolve(root, 'portal/test-results');
await mkdir(output, {recursive: true});
const mime = {'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css'};
const server = createServer(async (req, res) => {
  try {
    const path = new URL(req.url, 'http://localhost').pathname;
    const file = resolve(root, '.' + (path.endsWith('/') ? path + 'index.html' : path));
    if (!file.startsWith(root + sep)) throw Error('invalid');
    res.setHeader('Content-Type', mime[extname(file)] || 'application/octet-stream'); res.end(await readFile(file));
  } catch { res.statusCode = 404; res.end(); }
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const origin = `http://127.0.0.1:${server.address().port}`, errors = [];
let browser;
async function menu(page) { await page.evaluate(()=>document.querySelectorAll('dialog[open]').forEach(d=>d.close())); await page.locator('#board-network [data-net=menu], #network').click(); }
async function pairing(page, role) { await menu(page); await page.locator('#board-network [data-net=nearby], #nearbyRoom').click(); await page.click(`[data-action=${role}]`); }
async function transfer(from, to) {
  await from.waitForSelector('.nearby-code:not([hidden]) canvas');
  const files = await from.evaluate(async () => {
    const canvas = document.querySelector('.nearby-code canvas');
    document.querySelector('[data-action=next]').click(); // Pause auto rotation.
    const count = Number(document.querySelector('.nearby-page').textContent.match(/\/ (\d+)/)?.[1] || 1), result = [];
    for (let i = 0; i < count; i++) {
      result.push(canvas.toDataURL().split(',')[1]); document.querySelector('[data-action=next]').click();
    }
    return result;
  });
  await to.locator('.nearby-file input').setInputFiles(files.map((data, i) => ({name: `code-${i}.png`, mimeType: 'image/png', buffer: Buffer.from(data, 'base64')})));
}

const ids=['lost_cities','toy_battle','schotten_totten','7_wonders_duel','radlands','jaipur'];
async function snapshot(p,id){return p.evaluate(id=>id==='lost_cities'?document.querySelector('#routes').textContent:JSON.stringify(id==='radlands'?game.s:id==='7_wonders_duel'?state:s),id);}
try {
 browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'/usr/bin/google-chrome',headless:true,args:['--no-sandbox']});
 for(const id of ids){
  const contexts=await Promise.all([browser.newContext({viewport:{width:1280,height:900}}),browser.newContext({viewport:{width:390,height:844}})]);
  const [host,guest]=await Promise.all(contexts.map(c=>c.newPage()));
  for(const p of [host,guest]){p.setDefaultTimeout(15000);p.on('pageerror',e=>errors.push(id+': '+e.message));p.on('dialog',d=>d.accept());await p.route('**/*',r=>r.request().url().startsWith(origin+'/')?r.continue():r.abort());await p.goto(origin+'/game/'+id+'/');}
  const saveBefore=await host.evaluate(()=>JSON.stringify({...localStorage}));
  await pairing(host,'host');await pairing(guest,'join');await transfer(host,guest);await transfer(guest,host);
  await host.waitForFunction(()=>/已连接/.test(document.querySelector('#board-network [data-net=status], #networkStatus')?.textContent||''));
  await guest.waitForFunction(()=>/已连接/.test(document.querySelector('#board-network [data-net=status], #networkStatus')?.textContent||''));
  await host.waitForTimeout(250);
  console.log(id,'connected');
  for(const p of [host,guest])await p.evaluate(()=>document.querySelectorAll('dialog[open]').forEach(d=>d.close()));
  if(id==='lost_cities'){await host.locator('#hand button').first().click();await host.click('#expedition');await host.click('#draw');await guest.waitForSelector('#hand button');assert.equal(await host.locator('#hand button').count(),0);}
  if(id==='toy_battle'){const turn=await host.evaluate(()=>s.turn),p=[host,guest][turn];await p.click('#drawBtn');await [host,guest][1-turn].waitForSelector('#hand button');assert.equal(await p.locator('#hand button').count(),0);}
  if(id==='schotten_totten'){await host.locator('#hand [data-card]').first().click();await host.locator('[data-stone="0"]').click();await host.click('#draw-clan');await guest.waitForSelector('#hand [data-card]');assert.equal(await host.locator('#hand [data-card]').count(),0);}
  if(id==='7_wonders_duel'){await host.locator('.draft button').first().click();await host.locator('#dialog button.primary').click();await guest.waitForFunction(()=>state.step===1);assert.equal(await guest.evaluate(()=>state.step),await host.evaluate(()=>state.step));await host.evaluate(()=>showPlots());assert.equal(await host.locator('#dialog[open]').count(),0);}
  if(id==='radlands'){assert.equal(await guest.locator('[data-act^="draft:"]').count(),0);await host.locator('[data-act^="draft:"]').nth(0).click();await host.locator('[data-act^="draft:"]').nth(1).click();await host.locator('[data-act^="draft:"]').nth(2).click();await host.click('[data-act="confirmDraft"]');await guest.waitForSelector('[data-act^="draft:"]');assert.equal(await host.locator('[data-act^="draft:"]').count(),0);}
  if(id==='jaipur'){
   const turn=await host.evaluate(()=>state.turn),p=[host,guest][turn];
   await p.click('[data-mode=camels]');await p.click('[data-do=act]');
   await [host,guest][1-turn].waitForFunction(turn=>state.turn!==turn,turn);
   assert.deepEqual(await host.evaluate(()=>state),await guest.evaluate(()=>state));
   await menu(host);assert.equal(await host.locator('#inviteRoom').isVisible(),false);
  }
  if(id!=='jaipur'){
   if(id!=='lost_cities')assert.equal(await snapshot(host,id),await snapshot(guest,id));
   await menu(host);await host.click('[data-net=undo]');await guest.waitForSelector('[data-net=accept]');await guest.click('[data-net=accept]');await host.waitForTimeout(150);
   await menu(host);await host.click('[data-net=restart]');await guest.waitForSelector('[data-net=accept]');await guest.click('[data-net=accept]');await host.waitForTimeout(150);
   await menu(host);await host.click('[data-net=sync]');await host.waitForTimeout(150);
   assert.equal(await host.evaluate(()=>JSON.stringify({...localStorage})),saveBefore);
   await host.screenshot({path:resolve(output,id+'-network.png')});
   await guest.evaluate(()=>document.querySelectorAll('dialog[open]').forEach(d=>d.close()));
   await guest.screenshot({path:resolve(output,id+'-network-mobile.png')});
   await host.click('[data-net=leave]');await host.waitForFunction(()=>!document.querySelector('[data-net=status]').textContent);
  }
  assert.deepEqual(errors,[]);console.log('PASS',id,'real QR/WebRTC, actions, privacy and lifecycle');
  await Promise.all(contexts.map(c=>c.close()));
 }
}finally{await browser?.close();await new Promise(r=>server.close(r));}
