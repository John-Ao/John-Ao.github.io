const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright'),assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',headless:true,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 try{
 const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(process.env.CUBE_URL||'http://127.0.0.1:18765/game/cube/');
 const results=await page.evaluate(()=>{
  const before=JSON.stringify(snapshot()),result=[];records=[];
  for(const type of Object.keys(typeNames)){
   const s={puzzleType:type,order:type==='skewb'?2:3,size:[3,3,3],clockSize:[6,2]};s.pieces=type==='cuboid'?M.create(s.size):type==='clock'?ClockPuzzle.fresh(...s.clockSize):P.create(type,s.order);
   const r={initial:CubeState.encode(s),final:CubeState.encode(s),elapsed:0,savedAt:Date.now()+result.length};
   const target=document.createElement('canvas');target.width=target.height=128;drawHistoryThumbnail(target,r);const solved=target.toDataURL();
   if(type==='cuboid')M.turn(s.pieces,s.size,0,1,1);else if(type==='clock')ClockPuzzle.move(s.pieces,0,0,1);else P.turn(s.pieces,type,s.order,...P.legalMoves(s.pieces,type,s.order)[0],1);
   r.final=CubeState.encode(s);drawHistoryThumbnail(target,r);
   const changed=target.toDataURL(),pixels=target.getContext('2d').getImageData(0,0,128,128).data.filter((n,i)=>i%4===3&&n>0).length;
   drawHistoryThumbnail(target,{...r,final:r.initial});result.push({type,pixels,changed:changed!==solved,undo:target.toDataURL()===solved});records.push(r);
  }
  if(before!==JSON.stringify(snapshot()))throw Error('Preview changed current state');showRecords();return result;
 });
 for(const r of results){assert(r.pixels>150,r.type);assert(r.changed,`${r.type} reflects final state`);assert(r.undo,`${r.type} rebuilds initial state`);}
 await page.waitForFunction(()=>[...document.querySelectorAll('.history-thumbnail')].some(c=>c.getContext('2d').getImageData(0,0,128,128).data.some(n=>n)));
 await page.screenshot({path:'/tmp/cube-history-thumbnails.png'});
 await page.setViewportSize({width:320,height:740});assert(await page.evaluate(()=>document.querySelector('#modal').scrollWidth<=document.querySelector('#modal').clientWidth));
 await page.locator('.history-item').last().scrollIntoViewIfNeeded();await page.waitForTimeout(100);assert(await page.locator('.history-thumbnail').last().evaluate(c=>c.getContext('2d').getImageData(0,0,128,128).data.some(n=>n)));await page.screenshot({path:'/tmp/cube-history-clock-thumbnail.png'});
 assert.deepEqual(errors,[]);console.log('PASS: all puzzle types, initial/final-specific thumbnails, rectangular clock, no active-state mutation, lazy rendering and mobile layout');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
