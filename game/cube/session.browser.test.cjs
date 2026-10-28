const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright'),assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROME_BIN||'/usr/bin/google-chrome',args:['--no-sandbox']});
 try{
 const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(process.env.CUBE_URL||'http://127.0.0.1:18765/game/cube/');assert.equal(await page.title(),'魔方');
 // Build a reproducible challenge, then finish it through ordinary turns.
 const initial=await page.evaluate(()=>{applyTurn(pieces,0,1,1);beginRun();return initialState;});
 assert(await page.evaluate(()=>currentRun.phase==='ready'&&!running&&elapsed===0));
 await page.evaluate(()=>{elapsed=12345;finishTurn({axis:0,layer:1,dir:-1,commit:true,kind:'manual'});});
 const completed=await page.evaluate(()=>structuredClone(records[0]));
 assert.deepEqual(Object.keys(completed).sort(),['elapsed','final','initial','savedAt']);assert.equal(completed.initial,initial);assert.equal(completed.elapsed,12345);assert.notEqual(completed.final,initial);
 assert(await page.evaluate(()=>isSolved()&&!running&&currentRun.phase==='solved'));
 await page.reload();assert(await page.evaluate(()=>isSolved()&&cursor===0&&moves.length===0));assert.deepEqual(await page.evaluate(()=>records[0]),completed);
 assert(await page.evaluate(()=>!('moves' in snapshot())&&!('cursor' in snapshot())));
 await page.locator('#menu').click();await page.locator('#history-open').click();
 await page.locator('.history-retry').first().click();
 assert.equal(await page.evaluate(()=>boardState()),initial);assert(await page.evaluate(()=>elapsed===0&&!running&&currentRun.phase==='ready'));
 assert(await page.evaluate(r=>records.some(x=>JSON.stringify(x)===JSON.stringify(r)),completed));
 await page.evaluate(()=>{elapsed=500;finishTurn({axis:0,layer:1,dir:-1,commit:true,kind:'manual'});});
 assert(await page.evaluate(()=>isSolved()&&records.length===2&&records[0].elapsed===500));
 await page.locator('#menu').click();await page.locator('#history-open').click();await page.locator('.history-item').last().click();
 assert.equal(await page.evaluate(()=>elapsed),12345);assert(await page.evaluate(()=>isSolved()&&cursor===0));
 // Reload and links restore the current position, never replay history.
 await page.evaluate(()=>finishTurn({axis:1,layer:1,dir:1,commit:true,kind:'manual'}));
 const state=await page.evaluate(()=>boardState()),url=await page.evaluate(()=>shareURL());
 await page.reload();assert.equal(await page.evaluate(()=>boardState()),state);assert.equal(await page.evaluate(()=>cursor),0);
 await page.goto('about:blank');await page.goto(url);assert.equal(await page.evaluate(()=>boardState()),state);assert.equal(await page.evaluate(()=>cursor),0);assert.equal(await page.title(),'魔方');
 // Start a manual timer from an imported state and retain that start on reload.
 await page.locator('#timer-control').click();await page.getByRole('button',{name:'开始',exact:true}).click();
 assert.equal(await page.evaluate(()=>initialState),state);await page.reload();assert.equal(await page.evaluate(()=>initialState),state);
 // Exercise settings save, discard, and the strict four-field record format.
 await page.locator('#menu').click();await page.locator('#size-x input[value="4"]').check();await page.locator('#close').click();await page.getByRole('button',{name:'是',exact:true}).click();await page.waitForFunction(()=>size[1]===4);
 assert(await page.evaluate(()=>records.every(r=>Object.keys(r).sort().join()==='elapsed,final,initial,savedAt')));
 await page.locator('#menu').click();await page.locator('#history-open').click();await page.setViewportSize({width:320,height:740});assert(await page.evaluate(()=>document.querySelector('#modal').scrollWidth<=document.querySelector('#modal').clientWidth));
 await page.screenshot({path:'/tmp/cube-history-rechallenge.png'});
 assert.deepEqual(errors,[]);console.log('PASS initial/final-only records, rechallenge, frozen results, timer, import/reload, settings, fixed title and 320px layout');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
