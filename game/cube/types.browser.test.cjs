const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROME_BIN||'/usr/bin/google-chrome',headless:true,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(process.env.CUBE_URL||'http://127.0.0.1:18765/game/cube/');
 for(const [type,targetOrder] of [['pyraminx',5],['skewb',2],['skewb',3],['skewb',4],['skewb',5],['skewb',6],['skewb',7],['megaminx',2],['megaminx',4],['megaminx',6],['megaminx',5],['sq1',3],['gear',3],['helicopter',3],['mixup',3],['octahedron',3],['octahedron',4],['octahedron',6],['octahedron',5],['icosahedron',3],['icosahedron',4],['icosahedron',6],['icosahedron',5],['cuboid',3]]){
  await page.locator('#menu').click();await page.locator(`#puzzle-types input[value="${type}"]`).check();
  assert.equal(await page.evaluate(()=>menuDraft.puzzleType),type);
  assert.equal(await page.locator('.dimensions').isVisible(),type==='cuboid');
  assert.equal(await page.locator('#order-row').isVisible(),!['cuboid','sq1','gear','helicopter','mixup'].includes(type));
  assert.equal(await page.locator('#dimensions').isVisible(),!['sq1','gear','helicopter','mixup'].includes(type));
  assert(await page.evaluate(()=>document.querySelector('#modal').scrollWidth<=document.querySelector('#modal').clientWidth),`${type} menu fits`);
  if(!['cuboid','sq1','gear','helicopter','mixup'].includes(type)){
   await page.locator(`#order-track input[value="${targetOrder}"]`).check();await page.locator('#close').click();await page.waitForTimeout(80);if(await page.getByRole('button',{name:'否',exact:true}).isVisible())await page.getByRole('button',{name:'否',exact:true}).click();assert.equal(await page.evaluate(()=>order),targetOrder);
  }else {await page.locator('#close').click();await page.waitForTimeout(80);}
  assert.equal(await page.evaluate(()=>puzzleType),type);
  if(type==='cuboid')continue;
  await page.waitForFunction(()=>!snap&&!animation);
  const swipe=await page.evaluate(()=>{
   render();const config=P.config(puzzleType,order);
   for(const face of polygons){const point=P.average(face.world),start=project(point),hit=hitTest(...start);if(!hit||hit.piece.id!==face.piece.id)continue;
    const legal=P.legalMoves(pieces,puzzleType,order);
    const allowed=puzzleType==='skewb'?skewbClickCandidates(hit,legal.filter(([axis,layer])=>P.selection(pieces,puzzleType,order,axis,layer).includes(hit.piece.id)).map(([axis,layer])=>({axis,layer})),config):null;
    for(const [axis,layer] of legal){
     if(allowed&&!allowed.some(c=>c.axis===axis&&c.layer===layer))continue;
     if(!P.selection(pieces,puzzleType,order,axis,layer).includes(hit.piece.id))continue;
     const end=project(puzzleType==='gear'?GearCube.preview(hit.piece,point,axis,.01):P.rotate(point,config.axes[axis],.01)),dx=end[0]-start[0],dy=end[1]-start[1],len=Math.hypot(dx,dy);if(len<.2)continue;
     const oldDrag=drag,x=dx/len*180,y=dy/len*180;
     drag={hit,track:{x,y,xx:x*x,xy:x*y,yy:y*y}};updatePolyDrag();const picked=drag.turn;drag=oldDrag;
     if(!picked||Math.abs(picked.angle)<=turnStep(picked.axis)*.16)continue;
     return {start:[start[0],start[1]+canvas.getBoundingClientRect().top],delta:[x,y]};
    }
   }
  });assert(swipe,`${type} has a touchable rotating piece`);
  await page.mouse.move(...swipe.start);await page.mouse.down();await page.mouse.move(swipe.start[0]+swipe.delta[0],swipe.start[1]+swipe.delta[1],{steps:10});await page.mouse.up();await page.waitForFunction(()=>!animation&&!drag);
  assert.equal(await page.evaluate(()=>cursor),1,`${type} swipe commits a turn`);
  await page.locator('#undo').click();await page.waitForFunction(()=>!animation);assert(await page.evaluate(()=>isSolved()));
  await page.locator('#redo').click();await page.waitForFunction(()=>!animation);
  const expected=await page.evaluate(()=>boardState()),shared=await page.evaluate(()=>shareURL());await page.reload();assert.equal(await page.evaluate(()=>puzzleType),type);assert.equal(await page.evaluate(()=>boardState()),expected);assert.equal(await page.evaluate(()=>cursor),0);
  await page.goto('about:blank');await page.goto(shared);await page.waitForFunction(()=>!location.hash);assert.equal(await page.evaluate(()=>puzzleType),type);assert.equal(await page.evaluate(()=>boardState()),expected);assert.equal(await page.evaluate(()=>cursor),0);assert.equal(await page.title(),'魔方');
  await page.locator('#shuffle').click();await page.locator('#dialog-content').getByRole('button',{name:'打乱',exact:true}).click();await page.waitForFunction(()=>!shuffling,{},{timeout:120000});assert.equal(await page.evaluate(()=>cursor),997);assert.equal(await page.evaluate(()=>gl.getError()),0);
  await page.locator('#reset').click();await page.getByRole('button',{name:'确认',exact:true}).click();assert(await page.evaluate(()=>isSolved()));
  if(process.env.CUBE_SCREENSHOTS)await page.screenshot({path:`/tmp/cube-${type}-${targetOrder}.png`});
 }
 await page.setViewportSize({width:320,height:740});await page.locator('#menu').click();assert(await page.evaluate(()=>document.querySelector('#modal').scrollWidth<=document.querySelector('#modal').clientWidth));
 if(process.env.CUBE_SCREENSHOTS)await page.screenshot({path:'/tmp/cube-menu.png'});
 assert.deepEqual(errors,[]);await browser.close();console.log('PASS: all type menus, order changes, real gestures, undo/redo, reload, share, scramble/reset, 320px layout; no browser errors.');
})().catch(e=>{console.error(e);process.exit(1);});
