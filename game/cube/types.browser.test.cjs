const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROME_BIN||'/usr/bin/google-chrome',headless:true,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(process.env.CUBE_URL||'http://127.0.0.1:18765/game/cube/');
 for(const type of ['pyraminx','skewb','megaminx','sq1','octahedron','icosahedron','cuboid']){
  await page.locator('#menu').click();await page.locator(`#puzzle-types input[value="${type}"]`).check();
  assert.equal(await page.evaluate(()=>puzzleType),type);
  assert.equal(await page.locator('.dimensions').isVisible(),type==='cuboid');
  assert.equal(await page.locator('#order-row').isVisible(),!['cuboid','sq1'].includes(type));
  assert.equal(await page.locator('#dimensions').isVisible(),type!=='sq1');
  assert(await page.evaluate(()=>document.querySelector('#modal').scrollWidth<=document.querySelector('#modal').clientWidth),`${type} menu fits`);
  if(!['cuboid','sq1'].includes(type)){
   await page.locator('#order-track input[value="5"]').check();await page.locator('#dimensions button').click();await page.getByRole('button',{name:'确认',exact:true}).click();assert.equal(await page.evaluate(()=>order),5);
  }else await page.locator('#close').click();
  if(type==='cuboid')continue;
  await page.waitForTimeout(100);
  const swipe=await page.evaluate(()=>{
   render();const config=P.config(puzzleType,order);
   for(const face of polygons){const point=P.average(face.world),start=project(point),hit=hitTest(...start);if(!hit||hit.piece.id!==face.piece.id)continue;
    for(const [axis,layer] of P.legalMoves(pieces,puzzleType,order)){
     if(!P.selection(pieces,puzzleType,order,axis,layer).includes(hit.piece.id))continue;
     const end=project(P.rotate(point,config.axes[axis],.01)),dx=end[0]-start[0],dy=end[1]-start[1],len=Math.hypot(dx,dy);if(len<.2)continue;
     return {start:[start[0],start[1]+canvas.getBoundingClientRect().top],delta:[dx/len*100,dy/len*100]};
    }
   }
  });assert(swipe,`${type} has a touchable rotating piece`);
  await page.mouse.move(...swipe.start);await page.mouse.down();await page.mouse.move(swipe.start[0]+swipe.delta[0],swipe.start[1]+swipe.delta[1],{steps:10});await page.mouse.up();await page.waitForTimeout(260);
  assert.equal(await page.evaluate(()=>cursor),1,`${type} swipe commits a turn`);
  await page.locator('#undo').click();await page.waitForTimeout(260);assert(await page.evaluate(()=>isSolved()));
  await page.locator('#redo').click();await page.waitForTimeout(260);
  const shared=await page.evaluate(()=>shareURL());await page.reload();assert.equal(await page.evaluate(()=>puzzleType),type);assert.equal(await page.evaluate(()=>cursor),1);
  await page.goto('about:blank');await page.goto(shared);await page.waitForFunction(()=>!location.hash);assert.equal(await page.evaluate(()=>puzzleType),type);assert.equal(await page.evaluate(()=>cursor),1);
  await page.locator('#shuffle').click();await page.getByRole('button',{name:'确认',exact:true}).click();assert.equal(await page.evaluate(()=>cursor),60);assert.equal(await page.evaluate(()=>gl.getError()),0);
  await page.locator('#reset').click();await page.getByRole('button',{name:'确认',exact:true}).click();assert(await page.evaluate(()=>isSolved()));
  if(process.env.CUBE_SCREENSHOTS)await page.screenshot({path:`/tmp/cube-${type}.png`});
 }
 await page.setViewportSize({width:320,height:740});await page.locator('#menu').click();assert(await page.evaluate(()=>document.querySelector('#modal').scrollWidth<=document.querySelector('#modal').clientWidth));
 if(process.env.CUBE_SCREENSHOTS)await page.screenshot({path:'/tmp/cube-menu.png'});
 assert.deepEqual(errors,[]);await browser.close();console.log('PASS: all type menus, order changes, real gestures, undo/redo, reload, share, scramble/reset, 320px layout; no browser errors.');
})().catch(e=>{console.error(e);process.exit(1);});
