import assert from 'node:assert/strict';
import { levels, groups } from './catalog.mjs';
import { STORAGE_KEY } from './storage.mjs';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH || '/usr/bin/google-chrome',headless:true,args:['--no-sandbox']});
const url=`${process.env.GAMES_URL || 'http://127.0.0.1:18769'}/game/sokoban/`;
try {
  for(const width of [1280,390,320]) {
    const context=await browser.newContext({viewport:{width,height:900},isMobile:width<600,hasTouch:width<600});
    const page=await context.newPage(), errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    await page.goto(url);
    await page.locator('[data-index]').first().waitFor();
    assert.deepEqual(await page.locator('#group option').evaluateAll(options=>options.map(o=>o.value)),groups);
    const saved=()=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)),STORAGE_KEY);
    const initial=await saved();
    assert.equal(initial.current,levels[0].id);
    const dir=levels[0].solution[0];
    if(width<600)await page.locator(`[data-dir="${dir}"]`).tap();
    else await page.locator(`[data-dir="${dir}"]`).click();
    const changed=await saved();
    assert.notDeepEqual(changed,initial);
    await page.locator('#undo').click();
    assert.deepEqual(await saved(),initial);
    await page.locator('[data-index]').first().focus();
    await page.keyboard.press({U:'ArrowUp',D:'ArrowDown',L:'ArrowLeft',R:'ArrowRight'}[dir]);
    assert.deepEqual(await saved(),changed);
    await page.reload();
    assert.deepEqual(await saved(),changed);
    await page.locator('#reset').click();await page.locator('#cancel-reset').click();
    assert.deepEqual(await saved(),changed);
    await page.locator('#reset').click();await page.locator('#confirm-reset').click();
    assert.deepEqual(await saved(),initial);
    await page.locator('#help').click();
    assert.ok(await page.locator('#rules').evaluate(e=>e.open));
    await page.locator('#close-rules').click();
    await page.locator('#next').click();assert.equal(await page.locator('#level').inputValue(),'1');
    for(const group of groups) {
      await page.locator('#group').selectOption(group);
      const index=levels.findIndex(l=>l.group===group), level=levels[index];
      assert.equal(await page.locator('#level').inputValue(),String(index));
      for(const step of level.solution)await page.locator(`[data-dir="${step}"]`).click();
      assert.match(await page.locator('#status').textContent(),/已完成/);
      await page.reload();assert.match(await page.locator('#status').textContent(),/已完成/);
      await page.locator('#reset').click();await page.locator('#confirm-reset').click();
      const last=levels.findLastIndex(l=>l.group===group);
      await page.locator('#level').selectOption(String(last));
      assert.ok(await page.locator('#next').isDisabled());
    }
    const largest=levels.reduce((best,l,i)=>l.n>levels[best].n?i:best,0);
    await page.locator('#group').selectOption(levels[largest].group);
    await page.locator('#level').selectOption(String(largest));
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    await page.screenshot({path:`/tmp/sokoban-expanded-${width}.png`,fullPage:true});
    await page.locator('#zoom').click();
    assert.equal(await page.locator('#zoom').getAttribute('aria-pressed'),'true');
    if(width<600)assert.ok(await page.locator('.board-wrap').evaluate(e=>e.scrollWidth>e.clientWidth));
    await page.locator('#zoom').click();
    assert.deepEqual(errors,[]);
    await context.close();
    console.log(`${width}px: all collections, solutions, input, saves, reset, next, zoom passed`);
  }
  const context=await browser.newContext(), page=await context.newPage();
  await page.goto(url);
  const oldLevel=levels.find(l=>l.id==='microban-79');
  await page.evaluate(({key,l})=>{
    localStorage.removeItem(key);
    localStorage.setItem('sokoban-v1',JSON.stringify({current:60,60:{player:l.player,boxes:l.boxes,moves:0,pushes:0},0:{invalid:true}}));
  },{key:STORAGE_KEY,l:oldLevel});
  await page.reload();
  assert.equal(await page.locator('#level').inputValue(),String(levels.indexOf(oldLevel)));
  const migrated=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),STORAGE_KEY);
  assert.equal(migrated.current,'microban-79');assert.equal(migrated[0],undefined);
  await context.close();
  console.log('v1 classic save migration passed');
} finally {await browser.close();}
