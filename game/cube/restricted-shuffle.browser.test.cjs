const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright'),assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROME_BIN||'/usr/bin/google-chrome',args:['--no-sandbox']});
 try{
 const page=await browser.newPage({viewport:{width:600,height:800}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(process.env.CUBE_URL||'http://127.0.0.1:18765/game/cube/');
 const original=await page.evaluate(()=>boardState());
 await page.locator('#shuffle').click();assert.deepEqual(await page.locator('#dialog-content button').allTextContents(),['打乱','受限打乱','取消']);
 await page.locator('#dialog-content').getByRole('button',{name:'取消',exact:true}).click();assert.equal(await page.evaluate(()=>boardState()),original);
 const record=async()=>{await page.locator('#shuffle').click();await page.getByRole('button',{name:'受限打乱',exact:true}).click();};
 await record();assert(await page.locator('#shuffle-recorder').isVisible());assert.equal(await page.locator('#shuffle-recorder p').textContent(),'请录入许可的打乱步骤');assert(await page.locator('#record-finish').isDisabled());
 const start=await page.evaluate(()=>{camera=pose(1);render();const p=project([1,1,1.5]),r=canvas.getBoundingClientRect();return [p[0]+r.left,p[1]+r.top];});
 await page.mouse.move(...start);await page.mouse.down();await page.mouse.move(start[0]-150,start[1],{steps:10});await page.mouse.up();await page.waitForFunction(()=>!animation&&shuffleRecording.operations.length===1);
 const move=await page.evaluate(()=>shuffleRecording.operations[0]);assert.notEqual(await page.evaluate(()=>boardState()),original);assert.equal(await page.evaluate(()=>records.length),0);
 // A, B, A → undo A keeps the earlier A; undo B excludes B entirely.
 const other=[(move[0]+1)%3,1,1];
 await page.evaluate(([b,a])=>{for(const [axis,layer,dir] of [b,a])finishTurn({axis,layer,dir,commit:true,kind:'manual'});},[other,move]);
 await page.locator('#undo').click();await page.waitForFunction(()=>!animation&&shuffleRecording.operations.length===2);assert.equal(await page.locator('#record-count').textContent(),'2 种操作');
 await page.locator('#undo').click();await page.waitForFunction(()=>!animation&&shuffleRecording.operations.length===1);assert.equal(await page.locator('#record-count').textContent(),'1 种操作');
 assert(await page.locator('#redo').isDisabled());
 await page.screenshot({path:'/tmp/cube-recording.png'});
 await page.locator('#record-finish').click();await page.waitForFunction(()=>!shuffling,{},{timeout:120000});
 assert(await page.locator('#shuffle-recorder').isHidden());
 assert(await page.evaluate(allowed=>moves.length===997&&moves.every(m=>m.join()===allowed.join())&&currentRun.phase==='ready'&&elapsed===0&&!running,move));
 const challenge=await page.evaluate(()=>boardState());assert.equal(await page.evaluate(()=>initialState),challenge);
 // Cancelled recording restores the board, undo stack, timing and history.
 const saved=await page.evaluate(()=>({state:boardState(),cursor,records:JSON.stringify(records),initial:initialState,elapsed}));
 await record();await page.evaluate(()=>finishTurn({axis:0,layer:1,dir:-1,commit:true,kind:'manual'}));await page.locator('#record-cancel').click();
 assert.deepEqual(await page.evaluate(()=>({state:boardState(),cursor,records:JSON.stringify(records),initial:initialState,elapsed})),saved);
 // Undoing every recorded move restores the original board and leaves no candidates.
 await record();await page.evaluate(()=>finishTurn({axis:0,layer:1,dir:1,commit:true,kind:'manual'}));await page.locator('#undo').click();await page.waitForFunction(()=>!animation);assert(await page.locator('#record-finish').isDisabled());assert.equal(await page.evaluate(()=>boardState()),challenge);await page.locator('#record-cancel').click();
 // Single-operation sets also work for linked gears and clock wheels.
 for(const type of ['gear','clock']){
  await page.evaluate(type=>{puzzleType=type;order=3;reset();},type);
  await record();await page.evaluate(()=>finishTurn({axis:0,layer:0,dir:-1,commit:true,kind:'manual'}));await page.locator('#record-finish').click();await page.waitForFunction(()=>!shuffling,{},{timeout:120000});
  assert(await page.evaluate(()=>moves.length===997&&moves.every(m=>m.join()==='0,0,-1')&&initialState===boardState()));
 }
 assert.deepEqual(errors,[]);console.log('PASS shuffle choices, real recording gesture, undo/removal/duplicates, allowed-only scramble, cancellation, timer/history isolation, gear and clock');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
