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
const origin = `http://127.0.0.1:${server.address().port}`, errors = [], external = [];
let browser;
async function menu(page) { await page.locator('.menu summary').click(); await page.click('#network'); }
async function pairing(page, role) { await menu(page); await page.click('#nearbyRoom'); await page.click(`[data-action=${role}]`); }
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
const snapshot = page => page.evaluate(() => JSON.parse(JSON.stringify(state)));
async function dismiss(page) { if (await page.locator('#eventDialog').isVisible()) await page.click('#eventAccept'); }
try {
  browser = await chromium.launch({executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox']});
  const contexts = await Promise.all([browser.newContext({viewport:{width:390,height:844}}), browser.newContext({viewport:{width:390,height:844}})]);
  const pages = await Promise.all(contexts.map(c => c.newPage())), [host, guest] = pages;
  for (const page of pages) {
    page.setDefaultTimeout(20000); page.on('pageerror', e => errors.push(e.message));
    await page.route('**/*', route => {
      if (!route.request().url().startsWith(origin + '/')) { external.push(route.request().url()); return route.abort(); }
      return route.continue();
    });
    await page.goto(origin + '/game/tacta/');
  }
  await pairing(host, 'host'); await pairing(guest, 'join');
  await host.waitForSelector('.nearby-code:not([hidden]) canvas');
  await host.screenshot({path: resolve(output, 'nearby-pairing-mobile.png')});
  await transfer(host, guest); await transfer(guest, host);
  for (const page of pages) await page.waitForFunction(() => online?.ready && onlineModel && peerOnline);
  assert.deepEqual(await snapshot(host), await snapshot(guest));
  assert.equal(await host.evaluate(() => sessionStorage.getItem(activeRoomKey)), null);
  const pairType = await host.evaluate(async () => {
    const stats = await online.pc.getStats(); let selected;
    stats.forEach(s => { if (s.type === 'transport') selected = stats.get(s.selectedCandidatePairId); });
    return {config: online.pc.getConfiguration().iceServers, local: stats.get(selected.localCandidateId).candidateType, remote: stats.get(selected.remoteCandidateId).candidateType};
  });
  assert.deepEqual(pairType, {config: [], local: 'host', remote: 'host'});
  console.log('PASS multipart QR image decoding, two-browser WebRTC host-candidate connection, no server signaling');
  const active = (await host.evaluate(() => state.turn)) === 0 ? host : guest;
  await active.evaluate(async () => {
    for (const card of E.ends(state)) for (const flip of [false, true]) for (let rotation = 0; rotation < 360; rotation += 45) {
      const move = E.moves(state, card, rotation, flip)[0];
      if (move) { await sendGame({kind:'action',action:{id:card.id,rotation,flip,x:move.x,y:move.y}}); return; }
    }
    throw Error('No legal first move');
  });
  for (const page of pages) await page.waitForFunction(() => state.board.length === 2 && !online.pending);
  assert.deepEqual(await snapshot(host), await snapshot(guest));
  await host.evaluate(() => sendGame({kind:'propose',operation:'undo'}));
  await guest.waitForSelector('#acceptProposal', {state:'visible'}); await guest.click('#acceptProposal');
  for (const page of pages) { await page.waitForFunction(() => state.board.length === 1); await dismiss(page); }
  await guest.evaluate(() => online.reconnect());
  await guest.waitForFunction(() => online.ready); assert.deepEqual(await snapshot(host), await snapshot(guest));
  await menu(host);
  for (const id of ['createRoom','nearbyRoom','inviteRoom','resetGuest','closeRoom','loginAgain']) assert.equal(await host.locator('#' + id).isVisible(), false, id);
  await host.click('[data-close=networkDialog]');
  await host.screenshot({path:resolve(output,'nearby-game-mobile.png')});
  await host.evaluate(() => sendGame({kind:'propose',operation:'restart',nextRound:random(16),seed:42}));
  await guest.waitForSelector('#acceptProposal', {state:'visible'}); await guest.click('#acceptProposal');
  for (const page of pages) { await page.waitForFunction(() => !onlineModel.proposal && !online.pending); await dismiss(page); }
  assert.deepEqual(await snapshot(host), await snapshot(guest));
  console.log('PASS legal move, undo, restart, resync, and local-only room controls');
  await menu(host); await host.click('#leaveRoom'); await host.click('#eventAccept');
  for (const page of pages) await page.waitForFunction(() => online === null);
  await dismiss(guest);
  await pairing(host, 'host'); await host.waitForSelector('.nearby-code:not([hidden]) canvas'); await host.click('.nearby-close');
  assert.equal(await host.locator('#networkDialog').isVisible(), true);
  assert.equal(await host.locator('.nearby-pairing').count(), 0);
  assert.equal(await host.evaluate(() => sessionStorage.getItem(recentRoomKey)), null);
  await host.click('[data-close=networkDialog]');
  await pairing(host, 'host'); await pairing(guest, 'join');
  await guest.evaluate(() => { navigator.mediaDevices.getUserMedia = async () => { throw new DOMException('Denied', 'NotAllowedError'); }; });
  await guest.click('[data-action=camera]');
  await guest.waitForFunction(() => document.querySelector('.nearby-status').textContent.includes('未获相机权限'));
  async function cameraTransfer(from, to) {
    await from.waitForSelector('.nearby-code:not([hidden]) canvas');
    const images = await from.evaluate(() => {
      document.querySelector('[data-action=next]').click();
      const count = Number(document.querySelector('.nearby-page').textContent.match(/\/ (\d+)/)?.[1] || 1), result = [];
      for (let i = 0; i < count; i++) { result.push(document.querySelector('.nearby-code canvas').toDataURL()); document.querySelector('[data-action=next]').click(); }
      return result;
    });
    await to.evaluate(async images => {
      const canvas = document.createElement('canvas'); canvas.width = canvas.height = 600;
      const loaded = await Promise.all(images.map(async src => { const image = new Image(); image.src = src; await image.decode(); return image; }));
      let i = 0; const ctx = canvas.getContext('2d');
      const draw = () => { ctx.drawImage(loaded[i], 0, 0, 600, 600); i = (i + 1) % loaded.length; };
      draw(); window.fakeCameraTimer = setInterval(draw, 800);
      navigator.mediaDevices.getUserMedia = async () => window.fakeCameraStream = canvas.captureStream(10);
    }, images);
    await to.click('[data-action=camera]');
    await to.waitForFunction(() => window.fakeCameraStream?.getTracks().every(t => t.readyState === 'ended'));
    await to.evaluate(() => clearInterval(window.fakeCameraTimer));
  }
  await cameraTransfer(host, guest); await cameraTransfer(guest, host);
  for (const page of pages) await page.waitForFunction(() => online?.ready && onlineModel);
  assert.deepEqual(await snapshot(host), await snapshot(guest));
  await guest.reload();
  await host.waitForFunction(() => online && !online.ready);
  assert.equal(await host.evaluate(() => canAct()), false);
  assert.equal(await guest.evaluate(() => online), null);
  console.log('PASS camera permission denial, live video QR decoding, track release, and refresh disconnect');
  await pairing(guest, 'join');
  await guest.evaluate(() => {
    navigator.mediaDevices.getUserMedia = () => new Promise(resolve => { window.resolveCamera = resolve; });
  });
  await guest.click('[data-action=camera]'); await guest.click('.nearby-close');
  const released = await guest.evaluate(async () => {
    const canvas = document.createElement('canvas'), stream = canvas.captureStream(1);
    window.resolveCamera(stream); await new Promise(r => setTimeout(r, 50));
    return stream.getTracks().every(t => t.readyState === 'ended');
  });
  assert.equal(released, true);
  assert.deepEqual(errors, []); assert.deepEqual(external, []);
  console.log('PASS departure, cancellation, no Portal room persistence or external requests');
} finally { await browser?.close(); await new Promise(r => server.close(r)); }
