const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright'),assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROME_BIN||'/usr/bin/google-chrome',args:['--no-sandbox']});
 const page=await browser.newPage({viewport:{width:600,height:800}});
 await page.goto(process.env.CUBE_URL||'http://127.0.0.1:18765/game/cube/');
 for(const n of [3,4,5,6]){
  await page.evaluate(n=>{puzzleType='octahedron';order=n;reset();syncTypeUI();render();},n);
  const swipe=await page.evaluate(()=>{
   const config=P.config(puzzleType,order),layer=config.cuts.length;
   for(const face of polygons){
    const point=P.average(face.world),start=project(point),hit=hitTest(...start);
    if(!hit||hit.piece.id!==face.piece.id)continue;
    for(let axis=0;axis<(order%2?4:8);axis++){
     if(Math.abs(P.dot(config.axes[axis],hit.normal))>.99||!P.selection(pieces,puzzleType,order,axis,layer).includes(hit.piece.id))continue;
     const direction=P.cross(config.axes[axis],hit.normal),end=project(point.map((x,i)=>x+direction[i]*.01)),dx=end[0]-start[0],dy=end[1]-start[1],len=Math.hypot(dx,dy);
     if(len<.01)continue;
     return {start:[start[0],start[1]+canvas.getBoundingClientRect().top],delta:[dx/len*130,dy/len*130],layer};
    }
   }
  });
  assert(swipe,'central layer is touchable');
  await page.mouse.move(...swipe.start);await page.mouse.down();await page.mouse.move(swipe.start[0]+swipe.delta[0],swipe.start[1]+swipe.delta[1],{steps:12});await page.mouse.up();
  await page.waitForFunction(()=>cursor===1&&!animation);
  assert.equal(await page.evaluate(()=>moves[0][1]),swipe.layer);
  const shared=await page.evaluate(()=>shareURL());await page.reload();assert.equal(await page.evaluate(()=>moves[0][1]),swipe.layer);
  await page.goto(shared);await page.waitForFunction(()=>!location.hash);assert.equal(await page.evaluate(()=>cursor),1);
  await page.locator('#undo').click();await page.waitForFunction(()=>!animation&&cursor===0);assert(await page.evaluate(()=>isSolved()));
 }
 await browser.close();console.log('PASS octahedron 3–6: real middle-layer drag, reload, share and undo');
})().catch(e=>{console.error(e);process.exit(1)});
