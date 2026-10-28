const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright'),assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',headless:true,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(process.env.CUBE_URL||'http://127.0.0.1:18765/game/cube/');
 await page.locator('#menu').click();await page.locator('input[value="clock"][name="puzzle-type"]').check();
 assert(await page.locator('#clock-dimensions').isVisible());assert.equal(await page.locator('#clock-length input').count(),5);assert(!await page.locator('#order-row').isVisible());await page.locator('#close').click();
 await page.waitForFunction(()=>document.querySelectorAll('#clock-boards .pointer').length===18);
 const initial=await page.evaluate(()=>JSON.stringify(pieces));await page.locator('.pin').first().click();
 const arc=page.locator('.arc-control').first();await arc.focus();await page.keyboard.press('ArrowRight');assert.equal(await page.evaluate(()=>cursor),2);
 const changed=await page.evaluate(()=>JSON.stringify(pieces));assert.notEqual(changed,initial);
 await page.locator('#undo').click();await page.locator('#undo').click();assert.equal(await page.evaluate(()=>JSON.stringify(pieces)),initial);
 await page.locator('#redo').click();await page.locator('#redo').click();assert.equal(await page.evaluate(()=>JSON.stringify(pieces)),changed);

 // A real arc drag commits 30-degree steps and releases its pointer capture.
 const center=await page.locator('.board').first().evaluate(el=>{const r=el.getBoundingClientRect();return {x:r.left+r.width*58/316,y:r.top+r.height*58/316,r:r.width*44/316};});
 await page.mouse.move(center.x+center.r*Math.cos(200*Math.PI/180),center.y+center.r*Math.sin(200*Math.PI/180));await page.mouse.down();
 for(let a=205;a<=240;a+=5)await page.mouse.move(center.x+center.r*Math.cos(a*Math.PI/180),center.y+center.r*Math.sin(a*Math.PI/180));await page.mouse.up();
 assert.equal(await page.evaluate(()=>clockDrag),null);assert(await page.evaluate(()=>cursor>2));
 await page.locator('#undo').click();assert.equal(await page.evaluate(()=>JSON.stringify(pieces)),changed);
 const url=await page.evaluate(()=>shareURL());await page.reload();assert.equal(await page.evaluate(()=>JSON.stringify(pieces)),changed);await page.goto('about:blank');await page.goto(url);assert.equal(await page.evaluate(()=>JSON.stringify(pieces)),changed);
 for(const [w,h] of [[2,6],[6,2],[6,6]]){
  await page.locator('#menu').click();await page.locator(`#clock-length input[value="${w}"]`).check();await page.locator(`#clock-width input[value="${h}"]`).check();await page.locator('#close').click();await page.waitForTimeout(80);if(await page.getByRole('button',{name:'否',exact:true}).isVisible())await page.getByRole('button',{name:'否',exact:true}).click();await page.waitForFunction(n=>document.querySelectorAll('.pointer').length===n,w*h*2);
  assert.deepEqual(await page.evaluate(()=>clockSize),[w,h]);assert.equal(await page.locator('.pin').count(),(w-1)*(h-1)*2);
  await page.locator('#shuffle').click();await page.getByRole('button',{name:'确认',exact:true}).click();assert(!await page.evaluate(()=>isSolved()));
  await page.locator('#reset').click();await page.getByRole('button',{name:'确认',exact:true}).click();assert(await page.evaluate(()=>isSolved()));
 }
 await page.locator('#menu').click();await page.locator('#clock-interaction').selectOption('buttons');await page.locator('#close').click();await page.waitForFunction(()=>document.querySelectorAll('.arc-button').length===16);await page.locator('.arc-button').first().click();assert.equal(await page.evaluate(()=>cursor),1);
 await page.setViewportSize({width:320,height:740});await page.screenshot({path:'/tmp/cube-clock.png'});
 assert(await page.evaluate(()=>[...document.querySelectorAll('.clock-face')].every(el=>{const r=el.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight;})));
 await page.locator('#menu').click();assert(await page.evaluate(()=>document.querySelector('#modal').scrollWidth<=document.querySelector('#modal').clientWidth));await page.locator('input[value="cuboid"][name="puzzle-type"]').check();await page.locator('#close').click();await page.getByRole('button',{name:'否',exact:true}).click();await page.waitForFunction(()=>puzzleType==='cuboid');assert(await page.locator('#puzzle').isVisible());assert(!await page.locator('#clock-boards').isVisible());
 assert.deepEqual(errors,[]);await browser.close();console.log('PASS: clock type, dimensions, pins, keyboard/buttons, undo/redo, persistence/share, scramble/reset, mobile layout and switching back');
})().catch(e=>{console.error(e);process.exit(1);});
