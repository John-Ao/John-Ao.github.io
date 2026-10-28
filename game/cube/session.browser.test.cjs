const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright'),assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',headless:true,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(process.env.CUBE_URL||'http://127.0.0.1:18765/game/cube/');
 const turn=()=>page.evaluate(()=>finishTurn({axis:0,layer:1,dir:1,commit:true,kind:'manual'}));
 const close=async()=>{await page.locator('#close').click();await page.waitForTimeout(60);};
 await turn();assert.equal(await page.evaluate(()=>running),false);assert.equal(await page.evaluate(()=>records.length),0);
 const before=await page.evaluate(()=>JSON.stringify(pieces));
 await page.locator('#menu').click();await page.locator('#size-x input[value="4"]').check();assert.equal(await page.locator('#dimensions button').count(),0);assert.equal(await page.evaluate(()=>JSON.stringify(pieces)),before);assert.deepEqual(await page.evaluate(()=>size),[3,3,3]);
 await close();assert.equal(await page.locator('#dialog-content p').textContent(),'是否保存当前状态');assert.deepEqual(await page.evaluate(()=>size),[3,3,3]);await page.getByRole('button',{name:'是',exact:true}).click();await page.waitForFunction(()=>size[1]===4);
 assert(await page.evaluate(()=>records.length===1&&records[0].favorite));assert.equal(await page.evaluate(()=>JSON.stringify(records[0].size)),'[3,3,3]');
 await page.locator('#menu').click();await page.locator('#history-open').click();await page.locator('.history-item').first().click();await page.waitForFunction(()=>size[1]===3);assert.equal(await page.evaluate(()=>JSON.stringify(pieces)),before);
 // Changed then reverted settings do not prompt or reset.
 await page.locator('#menu').click();await page.locator('#size-x input[value="4"]').check();await page.locator('#size-x input[value="3"]').check();await close();assert(!await page.locator('#modal').isVisible());assert.equal(await page.evaluate(()=>JSON.stringify(pieces)),before);
 // Esc closes the menu and follows the same pending-settings flow.
 await page.locator('#menu').click();await page.locator('input[name="puzzle-type"][value="clock"]').check();assert.equal(await page.evaluate(()=>puzzleType),'cuboid');await page.keyboard.press('Escape');await page.getByRole('button',{name:'否',exact:true}).click();await page.waitForFunction(()=>puzzleType==='clock');
 await page.locator('#shuffle').click();await page.getByRole('button',{name:'确认',exact:true}).click();
 assert.deepEqual(await page.evaluate(()=>[currentRun.phase,running,elapsed,records.length]),['ready',false,0,2]);
 await page.locator('.pin').first().click();assert.equal(await page.evaluate(()=>running),false);
 await page.locator('.arc-control').first().focus();await page.keyboard.press('ArrowRight');await page.waitForTimeout(100);assert(await page.evaluate(()=>running&&elapsed>0));
 const id=await page.evaluate(()=>currentRun.id);await page.reload();assert.equal(await page.evaluate(()=>currentRun.id),id);assert.equal(await page.evaluate(()=>currentRun.phase),'running');
 // Undo the entire sequence to solve; only the first solve ends the run.
 await page.evaluate(()=>{while(cursor){const [axis,layer,dir]=moves[cursor-1];finishTurn({axis,layer,dir:-dir,commit:true,kind:'undo'});}});
 assert(await page.evaluate(()=>isSolved()&&!running&&currentRun.phase==='solved'));
 const completed=await page.evaluate(()=>JSON.stringify(records.find(r=>r.id===currentRun.id))),time=await page.evaluate(()=>elapsed);
 await page.locator('.arc-control').first().focus();await page.keyboard.press('ArrowRight');await page.keyboard.press('ArrowLeft');await page.waitForTimeout(100);assert.equal(await page.evaluate(()=>elapsed),time);assert.equal(await page.evaluate(()=>JSON.stringify(records.find(r=>r.id===currentRun.id))),completed);
 await page.locator('#shuffle').click();await page.getByRole('button',{name:'确认',exact:true}).click();assert(await page.evaluate(()=>records.length===3&&elapsed===0&&!running&&currentRun.phase==='ready'));
 await page.locator('#menu').click();await page.locator('#clock-length input[value="6"]').check();await page.locator('#clock-width input[value="2"]').check();assert.deepEqual(await page.evaluate(()=>clockSize),[3,3]);await close();await page.getByRole('button',{name:'是',exact:true}).click();await page.waitForFunction(()=>clockSize[0]===6);assert(await page.evaluate(()=>records[0].favorite&&records[0].clockSize[0]===3));
 await page.locator('#menu').click();await page.locator('#history-open').click();await page.screenshot({path:'/tmp/cube-history.png'});await page.locator('.history-star').first().click();await close();await page.reload();assert.equal(await page.evaluate(()=>records.length),3);

 // User-started timing also latches after its first solve.
 await page.locator('#timer-control').click();await page.getByRole('button',{name:'开始',exact:true}).click();await page.waitForTimeout(100);
 assert(await page.evaluate(()=>running&&currentRun.phase==='running'));
 await page.locator('.arc-control').first().focus();await page.keyboard.press('ArrowRight');await page.keyboard.press('ArrowLeft');
 assert(await page.evaluate(()=>!running&&currentRun.phase==='solved'));
 const manualTime=await page.evaluate(()=>elapsed),manualRecord=await page.evaluate(()=>JSON.stringify(records.find(r=>r.id===currentRun.id)));
 await page.locator('.arc-control').first().focus();await page.keyboard.press('ArrowRight');await page.keyboard.press('ArrowLeft');await page.waitForTimeout(100);
 assert.equal(await page.evaluate(()=>elapsed),manualTime);assert.equal(await page.evaluate(()=>JSON.stringify(records.find(r=>r.id===currentRun.id))),manualRecord);
 await page.reload();await page.locator('.arc-control').first().focus();await page.keyboard.press('ArrowRight');assert.equal(await page.evaluate(()=>running),false);assert.equal(await page.evaluate(()=>elapsed),manualTime);
 assert.deepEqual(errors,[]);await browser.close();console.log('PASS: staged settings, yes/no and Esc, favorites/recovery, idle/ready/running/solved timing, frozen completion, manual timing, reload and new rounds');
})().catch(e=>{console.error(e);process.exit(1);});
