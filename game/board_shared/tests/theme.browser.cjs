/* Run against the repository root served over HTTP:
 * NODE_PATH=/path/to/playwright/node_modules node game/board_shared/tests/theme.browser.cjs
 * Optional: BASE_URL, BROWSER_PATH, SCREENSHOT_DIR.
 */
const {chromium} = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const base = process.env.BASE_URL || 'http://127.0.0.1:18769/';
const games = ['7_wonders_duel','frosthaven','gloomhaven','hive','keep_talking_and_nobody_explodes','monopoly','onitama','radlands','schotten_totten','sky_team','slay_the_spire','sleeping_gods','space_rescue','spirit_island','targi','toy_battle'];
const themeKey = 'board-game-theme';
const url = name => new URL(`game/${name}/`, base).href;
async function start(page, name) {
  const click = selector => page.locator(selector).click();
  if (name === '7_wonders_duel') {
    await page.locator('#mode-pan').uncheck(); await page.locator('#mode-agora').uncheck();
    await page.locator('#mode-preset').check();
    await page.getByRole('button', {name:'玩家 1 首先选奇迹'}).click();
  }
  if (name === 'frosthaven') for (const action of ['create','prepare','start','reveal']) await click(`[data-do="${action}"]`);
  if (name === 'gloomhaven') await page.getByRole('button', {name:'开始合作场景', exact:true}).click();
  if (name === 'keep_talking_and_nobody_explodes') await click('#start');
  if (name === 'radlands') {await click('[data-act="restart:revised:starter"]'); await click('[data-act="ready"]');}
  if (name === 'schotten_totten') {await click('#confirm-new'); await click('#reveal');}
  if (name === 'toy_battle') await click('#readyBtn');
  if (name === 'spirit_island') await click('[data-tool="start"]');
}
async function savedGame(page) {
  return page.evaluate(key => Object.fromEntries(Object.keys(localStorage).filter(k => k !== key).sort().map(k => [k,localStorage.getItem(k)])), themeKey);
}
(async () => {
  const browser = await chromium.launch({executablePath:process.env.BROWSER_PATH || '/usr/bin/google-chrome', args:['--no-sandbox']});
  try {
    for (const name of games) {
      const context = await browser.newContext({viewport:{width:1366,height:768}, colorScheme:'light'});
      const page = await context.newPage(), errors=[];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(url(name)); await start(page,name);
      const saved = await savedGame(page);
      for (const theme of ['light','dark']) {
        if (await page.locator('html').getAttribute('data-theme') !== theme) {
          const toggle = page.locator('[data-theme-toggle]:visible').first();
          await toggle.focus(); await page.keyboard.press('Enter');
        }
        assert.equal(await page.locator('html').getAttribute('data-theme'),theme);
        assert.deepEqual(await savedGame(page),saved,`${name}: switching must not change game saves`);
        for (const [width,height] of [[1366,768],[1920,1080],[390,844]]) {
          await page.setViewportSize({width,height});
          assert.equal(await page.evaluate(() => document.documentElement.scrollWidth),width,`${name}/${theme}: horizontal overflow`);
        }
        await page.setViewportSize({width:1366,height:768});
        if (process.env.SCREENSHOT_DIR) {
          fs.mkdirSync(process.env.SCREENSHOT_DIR,{recursive:true});
          await page.screenshot({path:path.join(process.env.SCREENSHOT_DIR,`${name}-${theme}.png`)});
        }
      }
      await page.reload();
      assert.equal(await page.locator('html').getAttribute('data-theme'),'dark',`${name}: reload preference`);
      assert.deepEqual(errors,[],`${name}: browser errors`);
      await context.close(); console.log(`PASS ${name}: both themes, 3 viewports, keyboard toggle, save isolation, reload`);
    }
    const context = await browser.newContext({colorScheme:'dark'});
    const page = await context.newPage();
    await page.goto(url('hive'));
    assert.equal(await page.locator('html').getAttribute('data-theme'),'dark');
    await page.emulateMedia({colorScheme:'light'});
    await page.waitForFunction(() => document.documentElement.dataset.theme === 'light');
    const other = await context.newPage(); await other.emulateMedia({colorScheme:'light'}); await other.goto(url('onitama'));
    assert.equal(await other.locator('html').getAttribute('data-theme'),'light');
    await page.locator('[data-theme-toggle]').click();
    await other.waitForFunction(() => document.documentElement.dataset.theme === 'dark');
    await page.emulateMedia({colorScheme:'dark'}); await page.emulateMedia({colorScheme:'light'});
    assert.equal(await page.locator('html').getAttribute('data-theme'),'dark','explicit preference wins over system');
    // Rebuilding a game toolbar must not duplicate or remove its theme control.
    await other.goto(url('slay_the_spire'));
    await other.getByRole('button',{name:'地图',exact:true}).click();
    assert.equal(await other.locator('.bar [data-theme-toggle]').count(),1);
    await context.close();
    const blocked = await browser.newContext({colorScheme:'light'});
    const fallback = await blocked.newPage();
    await fallback.addInitScript(() => {
      Storage.prototype.getItem = Storage.prototype.setItem = () => {throw new DOMException('Blocked','SecurityError');};
    });
    await fallback.goto(url('hive')); await fallback.locator('[data-theme-toggle]').click();
    assert.equal(await fallback.locator('html').getAttribute('data-theme'),'dark','session-only fallback');
    await blocked.close();
    console.log('PASS system preference, cross-tab synchronization, dynamic toolbar, blocked storage');
  } finally {await browser.close();}
})().catch(error => {console.error(error); process.exitCode=1;});
