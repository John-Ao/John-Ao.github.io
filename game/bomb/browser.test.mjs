import assert from 'node:assert/strict';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = (process.env.BOMB_URL || 'http://localhost:1886').replace(/\/$/, '');
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox'] });
const errors = [];
async function watch(page) {
  page.on('pageerror', e => errors.push(e.message));
  page.on('response', r => { if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`); });
  await page.route('**/*', route => {
    if (new URL(route.request().url()).origin !== new URL(base).origin) {
      errors.push(`Unexpected external dependency: ${route.request().url()}`);
      return route.abort();
    }
    return route.continue();
  });
}
async function clickStage(page, x, y) {
  const b = await page.locator('#stage').boundingBox();
  await page.mouse.click(b.x + x * b.width, b.y + y * b.height, { delay: 120 });
  await page.waitForTimeout(400);
}
async function enterGame(page, n, twoPlayer = false) {
  await page.goto(`${base}/game/bomb/?version=${n}`);
  await page.waitForFunction(() => !document.querySelector('#pause').disabled);
  await page.waitForTimeout(2400);
  // Headless Chrome uses a software GPU. Trigger and dismiss Ruffle's one-time
  // mouseover warning before exercising game controls (also in touch emulation).
  await page.locator('ruffle-player #container').dispatchEvent('mouseover');
  const warning = page.locator('ruffle-player #hardware-acceleration-modal .close-modal');
  if (await warning.isVisible()) await warning.click();
  const start = { 1: [.82, .65], 2: [.85, .30], 3: [.51, .58] }[n];
  await clickStage(page, ...start);
  if (n === 1) {
    await clickStage(page, .82, twoPlayer ? .79 : .60);
    await clickStage(page, .82, .54);
    await page.keyboard.press('Space', { delay: 100 });
    if (twoPlayer) await page.keyboard.press('Enter', { delay: 100 });
  } else {
    if (twoPlayer) await clickStage(page, n === 2 ? .46 : .48, .48);
    await clickStage(page, n === 2 ? .68 : .83, .94);
    if (n === 2) {
      await page.keyboard.press('Space', { delay: 100 });
      if (twoPlayer) await page.keyboard.press('Enter', { delay: 100 });
    }
    await clickStage(page, n === 2 ? .68 : .83, .94);
  }
  await page.waitForTimeout(1600);
}
try {
  for (let n = 1; n <= 3; n++) {
    const page = await browser.newPage({ viewport: { width: 850, height: 700 } });
    await watch(page);
    await enterGame(page, n);
    assert.equal(await page.evaluate(() => document.querySelector('ruffle-player').ruffle().metadata.isActionScript3), n !== 1);
    const before = await page.locator('#stage').screenshot();
    await page.keyboard.down('ArrowRight');
    await page.waitForTimeout(250);
    await page.keyboard.up('ArrowRight');
    await page.keyboard.press('Space', { delay: 120 });
    const after = await page.locator('#stage').screenshot({ path: `/tmp/bomb${n}-verified-game.png` });
    assert.notDeepEqual(before, after, `bomb${n} renders live gameplay`);
    await page.locator('#pause').click();
    assert.equal(await page.evaluate(() => document.querySelector('ruffle-player').ruffle().suspended), true);
    await page.waitForTimeout(200);
    const paused = await page.locator('#stage').screenshot();
    await page.waitForTimeout(350);
    assert.deepEqual(paused, await page.locator('#stage').screenshot(), 'paused frame is stable');
    await page.locator('#pause').click();
    await page.locator('#sound').click();
    assert.equal(await page.evaluate(() => document.querySelector('ruffle-player').ruffle().volume), 0);
    await page.locator('#sound').click();
    assert.equal(await page.evaluate(() => document.querySelector('ruffle-player').ruffle().volume), 1);
    await page.locator('#help').click();
    assert.equal(await page.locator('#instructions').isVisible(), true);
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !document.querySelector('ruffle-player').ruffle().suspended);
    await page.locator('#restart').click();
    await page.getByRole('button', { name: '继续游戏', exact: true }).click();
    await page.waitForFunction(() => !document.querySelector('ruffle-player').ruffle().suspended);
    await page.locator('#fullscreen').click();
    assert.equal(await page.evaluate(() => document.fullscreenElement?.id), 'game');
    await page.locator('#fullscreen').click();
    await page.close();
    console.log(`bomb${n}: live canvas, keyboard input, pause, sound, help, cancel restart, fullscreen passed`);
  }
  const picker = await browser.newPage(); await watch(picker);
  await picker.goto(`${base}/game/bomb/`);
  await picker.waitForFunction(() => !document.querySelector('#pause').disabled);
  await picker.locator('#version').selectOption('2');
  await picker.locator('#confirm-version button[value="cancel"]').click();
  await picker.waitForFunction(() => !document.querySelector('ruffle-player').ruffle().suspended);
  assert.equal(await picker.locator('#version').inputValue(), '1');
  assert.equal(new URL(picker.url()).search, '');
  for (const version of ['2', '3', '1']) {
    await picker.locator('#version').selectOption(version);
    await picker.locator('#confirm-version button[value="switch"]').click();
    await picker.waitForURL(`**/game/bomb/?version=${version}`);
    await picker.waitForFunction(() => !document.querySelector('#pause').disabled);
    assert.equal(await picker.locator('#version').inputValue(), version);
    assert.equal(await picker.evaluate(() => document.querySelector('ruffle-player').ruffle().metadata.isActionScript3), version !== '1');
    assert.match(await picker.locator('#two-player').textContent(), version === '1' ? /1P 方向键/ : /1P WASD/);
  }
  await picker.reload();
  await picker.waitForFunction(() => !document.querySelector('#pause').disabled);
  assert.equal(await picker.locator('#version').inputValue(), '1');
  await picker.close();
  console.log('Version selector: cancellation, 1→2→3→1, matching controls and reload passed');
  // Touch gestures must deliver both keydown and keyup, including pointer cancellation.
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const phone = await context.newPage(); await watch(phone);
  await enterGame(phone, 1);
  const touchBefore = await phone.locator('#stage').screenshot();
  await phone.evaluate(() => {
    window.receivedKeys = [];
    for (const type of ['keydown', 'keyup']) document.addEventListener(type, e => window.receivedKeys.push(`${type}:${e.code}`));
  });
  const down = phone.locator('[data-key="ArrowDown"]');
  const downBox = await down.boundingBox();
  await phone.mouse.move(downBox.x + 24, downBox.y + 22);
  await phone.mouse.down();
  await phone.waitForTimeout(300);
  await down.dispatchEvent('pointercancel', { pointerId: 1, pointerType: 'mouse', bubbles: true });
  await phone.mouse.up();
  await phone.locator('[data-key="Space"]').tap();
  assert.deepEqual(await phone.evaluate(() => window.receivedKeys), ['keydown:ArrowDown', 'keyup:ArrowDown', 'keydown:Space', 'keyup:Space']);
  assert.equal(await phone.locator('.held').count(), 0);
  assert.notDeepEqual(touchBefore, await phone.locator('#stage').screenshot(), 'touch input changes the game frame');
  for (const [width, height] of [[390,844],[320,568],[844,390]]) {
    await phone.setViewportSize({ width, height });
    assert(await phone.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    for (const selector of ['#stage','#controls','#touch']) {
      const rect = await phone.locator(selector).boundingBox();
      assert(rect.y >= 0 && rect.y + rect.height <= height + 1, `${selector} fits ${width}x${height}`);
    }
    await phone.screenshot({ path: `/tmp/bomb-mobile-${width}.png` });
  }
  await context.close();
  // A missing SWF must display an actionable error instead of an endless spinner.
  const broken = await browser.newPage();
  await broken.route('**/assets/bomb1.swf', route => route.fulfill({ status: 404, body: 'missing' }));
  await broken.goto(`${base}/game/bomb/`);
  await broken.getByRole('status').filter({ hasText: '游戏加载失败' }).waitFor();
  await broken.close();
  const home = await browser.newPage(); await home.goto(`${base}/#game`);
  await home.getByRole('tab', { name: '休闲对战', exact: true }).click();
  assert.equal(await home.locator('a[href="/game/bomb/"]').count(), 1);
  await home.close();
  assert.deepEqual(errors, []);
  console.log('Touch controls, cancellation, 3 phone layouts, missing-resource fallback, home links and local-only dependencies passed');
} finally { await browser.close(); }
