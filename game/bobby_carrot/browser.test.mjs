const {chromium}=await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
import assert from 'node:assert/strict';
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH || '/usr/bin/google-chrome',headless:true,args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:1280,height:900}});const errors=[];page.on('pageerror',e=>errors.push(String(e)));page.on('response',r=>{if(r.status()>=400)errors.push(r.url());});
await page.goto(process.env.BOBBY_URL || 'http://127.0.0.1:1877/game/bobby_carrot/');await page.waitForFunction(()=>!document.querySelector('#levels').disabled);
await page.locator('canvas#game').focus();for(const d of '03033311113000033111120001'){await page.keyboard.press(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'][d]);await page.waitForTimeout(230);}await page.locator('#result:not([hidden])').waitFor();assert.equal(await page.locator('#result-title').textContent(),'本关完成');await page.locator('#continue').click();await page.waitForFunction(()=>document.querySelector('#levels').textContent.includes('2 /'));
await page.locator('#menu-button').click();await page.locator('#mode').selectOption('normal');await page.waitForFunction(()=>!document.querySelector('#levels').disabled);await page.locator('canvas#game').focus();for(const d of '222011220031333000222222111'){await page.keyboard.press(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'][d]);await page.waitForTimeout(230);}await page.locator('#result:not([hidden])').waitFor();assert.equal(await page.locator('#result-title').textContent(),'本关完成');
await page.reload();await page.waitForFunction(()=>!document.querySelector('#levels').disabled);await page.locator('#menu-button').click();await page.locator('#levels').click();assert.equal(await page.locator('#level-grid button').count(),30);assert.match(await page.locator('#level-grid button').first().textContent(),/✓/);await page.locator('#picker [data-close]').click();
await page.locator('#menu-button').click();await page.locator('#sound').click();await page.waitForTimeout(100);await page.locator('#sound').click();await page.locator('#menu [data-close]').click();
for(const [width,height]of [[390,844],[320,568],[844,390]]){await page.setViewportSize({width,height});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));}
const mobile=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
const phone=await mobile.newPage();phone.on('pageerror',e=>errors.push(String(e)));await phone.goto(process.env.BOBBY_URL || 'http://127.0.0.1:1877/game/bobby_carrot/');await phone.waitForFunction(()=>!document.querySelector('#levels').disabled);
await phone.locator('[data-dir="0"]').tap();await phone.waitForTimeout(250);
const storage=await phone.evaluate(()=>JSON.parse(localStorage.getItem('bobby-carrot-original-v1')));assert.deepEqual(storage.games.egg01,[0]);
await phone.reload();await phone.waitForFunction(()=>!document.querySelector('#levels').disabled);assert.equal(await phone.locator('#turns').textContent(),'转向 1');
await phone.locator('#menu-button').tap();await phone.locator('#overview').tap();assert.equal(await phone.locator('#game').getAttribute('width'),'128');
await phone.locator('#menu-button').tap();await phone.locator('#help').tap();assert.ok(await phone.locator('#rules').isVisible());await phone.locator('#rules [data-close]').tap();
await phone.screenshot({path:'/tmp/bobby-carrot-mobile.png'});
assert.deepEqual(errors,[]);console.log('Desktop keyboard: both original opening levels completed. 30-level selector, persistence, audio, 3 responsive sizes: passed.');await browser.close();
