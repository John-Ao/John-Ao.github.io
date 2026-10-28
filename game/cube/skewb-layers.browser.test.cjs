const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright'),assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROME_BIN||'/usr/bin/google-chrome',headless:true,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 try{
  const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(process.env.CUBE_URL||'http://127.0.0.1:18765/game/cube/');
  await page.locator('#menu').click();await page.locator('#puzzle-types input[value="skewb"]').check();
  await page.locator('#order-track input[value="3"]').check();await page.locator('#close').click();await page.waitForTimeout(80);if(await page.getByRole('button',{name:'否',exact:true}).isVisible())await page.getByRole('button',{name:'否',exact:true}).click();
  await page.waitForFunction(()=>!snap&&!animation);
  const swipe=await page.evaluate(()=>{
   render();const c=P.config(puzzleType,order),legal=P.legalMoves(pieces,puzzleType,order).map(([axis,layer])=>({axis,layer}));
   for(const face of polygons){
    const point=P.average(face.world),start=project(point),hit=hitTest(...start);if(!hit||hit.piece.id!==face.piece.id)continue;
    const candidates=skewbClickCandidates(hit,legal.filter(t=>P.selection(pieces,puzzleType,order,t.axis,t.layer).includes(hit.piece.id)),c);
    const candidate=candidates.find(t=>t.layer>0);if(!candidate)continue;
    const q=project(P.rotate(point,c.axes[candidate.axis],.001)),dx=q[0]-start[0],dy=q[1]-start[1],len=Math.hypot(dx,dy);if(len<.001)continue;
    return {start:[start[0],start[1]+canvas.getBoundingClientRect().top],delta:[dx/len*100,dy/len*100],...candidate};
   }
  });assert(swipe,'middle layer has a hittable sticker');
  await page.mouse.move(...swipe.start);await page.mouse.down();await page.mouse.move(swipe.start[0]+swipe.delta[0],swipe.start[1]+swipe.delta[1],{steps:10});await page.mouse.up();await page.waitForFunction(()=>!animation&&!drag);
  assert.deepEqual(await page.evaluate(()=>moves[0].slice(0,2)),[swipe.axis,swipe.layer]);assert.equal(await page.evaluate(()=>cursor),1);
  await page.locator('#undo').click();await page.waitForFunction(()=>!animation);assert(await page.evaluate(()=>isSolved()));
  await page.locator('#redo').click();await page.waitForFunction(()=>!animation);assert.equal(await page.evaluate(()=>cursor),1);
  const expected=await page.evaluate(()=>boardState()),shared=await page.evaluate(()=>shareURL());await page.reload();assert.equal(await page.evaluate(()=>cursor),0);assert.equal(await page.evaluate(()=>boardState()),expected);
  await page.goto('about:blank');await page.goto(shared);await page.waitForFunction(()=>!location.hash);assert.equal(await page.evaluate(()=>cursor),0);assert.equal(await page.evaluate(()=>boardState()),expected);
  assert.deepEqual(errors,[]);console.log('PASS skewb 3 browser: middle-layer drag, undo/redo, reload and share');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
