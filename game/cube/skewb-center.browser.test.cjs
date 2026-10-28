const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright'),assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROME_BIN||'/usr/bin/google-chrome',headless:true,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 try{
  const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(process.env.CUBE_URL||'http://127.0.0.1:18765/game/cube/');
  await page.locator('#menu').click();await page.locator('#puzzle-types input[value="skewb"]').check();
  await page.locator('#order-track input[value="2"]').check();await page.locator('#close').click();await page.waitForTimeout(80);if(await page.getByRole('button',{name:'否',exact:true}).isVisible())await page.getByRole('button',{name:'否',exact:true}).click();
  await page.waitForFunction(()=>!snap&&!animation);
  const swipe=await page.evaluate(()=>{
   render();const c=P.config(puzzleType,order);
   for(const face of polygons){
    if(face.piece.faces.filter(f=>f.color>=0).length!==1)continue;
    const normal=face.normal,fixed=normal.findIndex(x=>Math.abs(x)>.9),u=(fixed+1)%3,v=(fixed+2)%3;
    for(const su of [-1,1])for(const sv of [-1,1]){
     const point=normal.slice();point[u]=-.04*su;point[v]=-.04*sv;
     const start=project(point),hit=hitTest(...start);if(!hit||hit.piece.id!==face.piece.id)continue;
     const axis=c.axes.findIndex(n=>Math.sign(n[fixed])===Math.sign(normal[fixed])&&Math.sign(n[u])===su&&Math.sign(n[v])===sv);
     const radial=P.norm(P.sub(c.axes[axis].map(Math.sign),normal)),tangent=P.norm(P.cross(c.axes[axis],normal));
     const origin=project(normal),finish=project(normal.map((x,i)=>x+.2*(.41421356237*radial[i]+tangent[i])));
     const dx=finish[0]-origin[0],dy=finish[1]-origin[1],length=Math.hypot(dx,dy);
     return {start:[start[0],start[1]+canvas.getBoundingClientRect().top],delta:[dx/length*120,dy/length*120],axis,layer:0};
    }
   }
  });assert(swipe,'center has a hittable sticker');
  await page.mouse.move(...swipe.start);await page.mouse.down();await page.mouse.move(swipe.start[0]+swipe.delta[0],swipe.start[1]+swipe.delta[1],{steps:10});await page.mouse.up();await page.waitForFunction(()=>!animation&&!drag);
  assert.deepEqual(await page.evaluate(()=>moves[0].slice(0,2)),[swipe.axis,swipe.layer]);assert.equal(await page.evaluate(()=>cursor),1);assert.equal(await page.evaluate(()=>moves[0][2]),1);
  await page.locator('#undo').click();await page.waitForFunction(()=>!animation);assert(await page.evaluate(()=>isSolved()));
  await page.locator('#redo').click();await page.waitForFunction(()=>!animation);assert.equal(await page.evaluate(()=>cursor),1);
  const shared=await page.evaluate(()=>shareURL());await page.reload();assert.equal(await page.evaluate(()=>cursor),1);assert.equal(await page.evaluate(()=>moves[0][1]),swipe.layer);
  await page.goto('about:blank');await page.goto(shared);await page.waitForFunction(()=>!location.hash);assert.equal(await page.evaluate(()=>cursor),1);assert.equal(await page.evaluate(()=>moves[0][1]),swipe.layer);
  assert.deepEqual(errors,[]);console.log('PASS skewb 2 browser: cross-region center drag, undo/redo, reload and share');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
