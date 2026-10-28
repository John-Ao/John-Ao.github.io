const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright'),assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROME_BIN||'/usr/bin/google-chrome',args:['--no-sandbox']});
 const page=await browser.newPage({viewport:{width:600,height:800}});
 await page.goto(process.env.CUBE_URL||'http://127.0.0.1:18765/game/cube/');
 for(const n of [3,4,5,6]){
  await page.evaluate(n=>{puzzleType='octahedron';order=n;reset();syncTypeUI();render();},n);
  await page.waitForFunction(()=>!snap&&!animation);await page.evaluate(()=>render());
  const swipe=await page.evaluate(()=>{
   const config=P.config(puzzleType,order),layer=1;
   for(const face of polygons){
    const point=P.average(face.world),start=project(point),hit=hitTest(...start);
    if(!hit||hit.piece.id!==face.piece.id)continue;
    for(let axis=0;axis<(order%2?4:8);axis++){
     if(Math.abs(P.dot(config.axes[axis],hit.normal))>.99||!P.selection(pieces,puzzleType,order,axis,layer).includes(hit.piece.id))continue;
     const direction=P.cross(config.axes[axis],hit.normal),end=project(point.map((x,i)=>x+direction[i]*.01)),dx=end[0]-start[0],dy=end[1]-start[1],len=Math.hypot(dx,dy);
     if(len<.01)continue;
     const old=drag,x=dx/len*180,y=dy/len*180;drag={hit,track:{x,y,xx:x*x,xy:x*y,yy:y*y}};updatePolyDrag();const picked=drag.turn;drag=old;
     if(!picked||picked.layer!==layer||Math.abs(picked.angle)<=turnStep(picked.axis)*.16)continue;
     return {start:[start[0],start[1]+canvas.getBoundingClientRect().top],delta:[x,y],layer};
    }
   }
  });
  assert(swipe,'central layer is touchable');
  await page.mouse.move(...swipe.start);await page.mouse.down();await page.mouse.move(swipe.start[0]+swipe.delta[0],swipe.start[1]+swipe.delta[1],{steps:12});await page.mouse.up();
  await page.waitForFunction(()=>cursor===1&&!animation);
  assert.equal(await page.evaluate(()=>moves[0][1]),swipe.layer);
  const expected=await page.evaluate(()=>boardState()),lastMove=await page.evaluate(()=>moves.at(-1)),shared=await page.evaluate(()=>shareURL());
  await page.locator('#undo').click();await page.waitForFunction(()=>!animation&&cursor===0);assert(await page.evaluate(()=>isSolved()));
  await page.locator('#redo').click();await page.waitForFunction(()=>!animation&&cursor===1);
  await page.reload();assert.equal(await page.evaluate(()=>boardState()),expected);assert.equal(await page.evaluate(()=>cursor),0);
  await page.goto(shared);await page.waitForFunction(()=>!location.hash);assert.equal(await page.evaluate(()=>boardState()),expected);assert.equal(await page.evaluate(()=>cursor),0);
  await page.evaluate(([axis,layer,dir])=>finishTurn({axis,layer,dir:-dir,commit:true,kind:'manual'}),lastMove);assert(await page.evaluate(()=>isSolved()));

 }
 await browser.close();console.log('PASS octahedron 3–6: real middle-layer drag, reload, share and undo');
})().catch(e=>{console.error(e);process.exit(1)});
