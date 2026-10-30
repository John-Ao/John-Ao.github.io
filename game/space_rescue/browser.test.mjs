import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),levels=require('./levels.js');
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.env.GAMES_URL||'http://127.0.0.1:18769';
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'/usr/bin/google-chrome',headless:true,args:['--no-sandbox']});
for(const viewport of [{width:1280,height:850},{width:390,height:844}]){
 const page=await browser.newPage({viewport});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base+'/game/space_rescue/');
 assert.equal(await page.locator('#level option').count(),60);
 assert.equal(await page.locator('#level optgroup').count(),9);
 for(const index of [12,30,59]){
  await page.selectOption('#level',String(index));
  assert.equal(await page.locator('#par').innerText(),`最短 ${levels[index].par} 步`);
  // Complete new levels using actual player controls and the independently verified path.
  for(const [piece,direction]of levels[index].solution){
   if(piece)await page.locator('#robotchoices button').nth(piece-1).click();
   await page.locator(`.pad[data-player="${piece?1:0}"] button`).nth(direction).click();
  }
  assert(await page.locator('#success').isVisible());
  assert.equal(await page.locator('#moves').innerText(),String(levels[index].par));
  await page.reload();assert.equal(await page.locator('#level').inputValue(),String(index));
  assert(await page.locator('#success').isVisible());
 }
 await page.locator('#next').click();assert.equal(await page.locator('#level').inputValue(),'0');
 await page.selectOption('#level','59');await page.locator('#hint').click();
 assert((await page.locator('#status').innerText()).includes('至少还需 9 步'));
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await page.screenshot({path:`/tmp/space-rescue-levels-${viewport.width}.png`,fullPage:true});
 // Existing polyomino catalog has 105 stored IDs; its picker exposes 93 curated puzzles.
 await page.goto(base+'/game/polyomino/');await page.locator('#menu').click();await page.locator('#levels').click();
 assert.equal(await page.locator('[data-level]').count(),93);
 await page.locator('[data-level]').last().scrollIntoViewIfNeeded();
 assert(await page.locator('[data-level]').last().isVisible());
 await page.screenshot({path:`/tmp/polyomino-picker-${viewport.width}.png`,fullPage:true});
 await page.locator('[data-level]').last().click();
 await page.getByRole('button',{name:'确认',exact:true}).click();
 assert(!(await page.locator('#modal').isVisible()));
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 assert.deepEqual(errors,[]);await page.close();
}
await browser.close();console.log('PASS: desktop/mobile new puzzle play, restore, hints, 60-level picker and 93-level polyomino picker.');
