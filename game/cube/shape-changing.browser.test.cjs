const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright'),assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROME_BIN||'/usr/bin/google-chrome',headless:true,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 try{
 const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(process.env.CUBE_URL||'http://127.0.0.1:18765/game/cube/');
 for(const type of ['helicopter','mixup']){
  await page.locator('#menu').click();await page.locator(`#puzzle-types input[value="${type}"]`).check();
  assert(!(await page.locator('#dimensions').isVisible()));await page.locator('#close').click();
  if(await page.getByRole('button',{name:'否',exact:true}).isVisible())await page.getByRole('button',{name:'否',exact:true}).click();
  await page.waitForFunction(type=>puzzleType===type&&!snap,type);
  for(const fraction of type==='helicopter'?[Math.acos(1/3)/Math.PI,1-Math.acos(1/3)/Math.PI,1]:[1]){
   const original=await page.evaluate(()=>boardState());
   const swipe=await page.evaluate(({type,fraction})=>{
    render();const c=P.config(type,3),layer=type==='mixup'?1:0;
    for(const face of polygons){const point=P.average(face.world),start=project(point),hit=hitTest(...start);if(!hit||hit.piece.id!==face.piece.id)continue;
     for(const [axis,l] of P.legalMoves(pieces,type,3)){
      if(l!==layer||!P.selection(pieces,type,3,axis,l).includes(hit.piece.id))continue;
      const end=project(P.rotate(point,c.axes[axis],.01)),dx=end[0]-start[0],dy=end[1]-start[1],length=Math.hypot(dx,dy);if(length<.2)continue;
      const distance=turnStep(axis,l)*fraction/dragRadiansPerPixel(axis,l),x=dx/length*distance,y=dy/length*distance,old=drag;
      drag={hit,track:{x,y,xx:x*x,xy:x*y,yy:y*y}};updatePolyDrag();const picked=drag.turn;drag=old;
      if(!picked||picked.axis!==axis||picked.layer!==layer)continue;
      const copy=structuredClone(pieces),dir=(picked.angle<0?-1:1)*fraction;
      P.turn(copy,type,3,axis,l,dir);
      return {start:[start[0],start[1]+canvas.getBoundingClientRect().top],delta:[x,y],axis,layer,dir,angle:picked.angle,expected:CubeState.encode({puzzleType:type,order:3,pieces:copy})};
     }
    }
   },{type,fraction});assert(swipe,`${type} has a usable special-turn gesture`);
   await page.mouse.move(...swipe.start);await page.mouse.down();await page.mouse.move(swipe.start[0]+swipe.delta[0],swipe.start[1]+swipe.delta[1],{steps:10});
   const preview=await page.evaluate(()=>drag?.turn);assert(preview);assert.equal(preview.layer,swipe.layer);assert(Math.abs(preview.angle-swipe.angle)<1e-6);
   await page.mouse.up();await page.waitForFunction(()=>!animation&&!drag);
   const move=await page.evaluate(()=>moves.at(-1));assert.equal(move[0],swipe.axis);assert.equal(move[1],swipe.layer);assert(Math.abs(move[2]-swipe.dir)<1e-9);
   // Compare geometry rather than byte equality, since equivalent pointer arithmetic can differ by ULPs.
   assert(await page.evaluate(expected=>{const other=CubeState.decode(expected).pieces;return pieces.every((p,i)=>p.frame.every((r,j)=>r.every((v,k)=>Math.abs(v-other[i].frame[j][k])<1e-6)));},swipe.expected));
   assert(!(await page.evaluate(()=>isSolved())));
   await page.screenshot({path:`/tmp/cube-${type}-${fraction.toFixed(2)}.png`});
   await page.locator('#undo').click();await page.waitForFunction(()=>!animation);assert(await page.evaluate(()=>isSolved()));
   await page.locator('#redo').click();await page.waitForFunction(()=>!animation);assert(!(await page.evaluate(()=>isSolved())));
   const saved=await page.evaluate(()=>boardState()),shared=await page.evaluate(()=>shareURL());await page.reload();assert.equal(await page.evaluate(()=>boardState()),saved);
   await page.goto(shared);await page.waitForFunction(()=>!location.hash);assert.equal(await page.evaluate(()=>puzzleType),type);assert.equal(await page.evaluate(()=>boardState()),saved);
   assert(await page.evaluate(()=>P.legalMoves(pieces,puzzleType,order).length>0));
   await page.evaluate(original=>{restore({...snapshot(),state:original,initial:original,run:newRun(),running:false});syncSizes();dirty=true;},original);
  }
  if(type==='helicopter'){
   const original=await page.evaluate(()=>boardState());
   await page.evaluate(()=>{
    const j=P.turnAmounts(puzzleType)[0];
    finishTurn({axis:0,layer:0,dir:j,commit:true,kind:'manual'});
    drag={id:999,hit:{},turn:{axis:0,layer:0,angle:Math.PI*(1-2*j)}};
    release({pointerId:999,type:'test'},false);
   });
   await page.waitForFunction(()=>!animation);
   assert(await page.evaluate(()=>Math.abs(moves.at(-1)[2]-(1-2*P.turnAmounts(puzzleType)[0]))<1e-9));
   await page.locator('#undo').click();await page.waitForFunction(()=>!animation);
   await page.locator('#undo').click();await page.waitForFunction(()=>!animation);
   assert(await page.evaluate(()=>isSolved()));
   await page.evaluate(original=>{restore({...snapshot(),state:original,initial:original,run:newRun(),running:false});syncSizes();dirty=true;},original);
  }
  await page.evaluate(()=>performShuffle());assert.equal(await page.evaluate(()=>moves.length),997);assert(!(await page.evaluate(()=>isSolved())));
  const state=await page.evaluate(()=>boardState());await page.reload();assert.equal(await page.evaluate(()=>boardState()),state);
  await page.locator('#reset').click();await page.getByRole('button',{name:'确认',exact:true}).click();assert(await page.evaluate(()=>isSolved()));
  await page.locator('#shuffle').click();await page.getByRole('button',{name:'受限打乱',exact:true}).click();
  const allowed=await page.evaluate(()=>{const move=[0,puzzleType==='mixup'?1:0,puzzleType==='mixup'?1:P.turnAmounts(puzzleType)[0]];finishTurn({axis:move[0],layer:move[1],dir:move[2],commit:true,kind:'manual'});return move;});
  await page.locator('#record-finish').click();await page.waitForFunction(()=>!shuffling);
  assert(await page.evaluate(allowed=>moves.length===997&&moves.every(m=>m.join()===allowed.join())&&initialState===boardState(),allowed));
  await page.locator('#reset').click();await page.getByRole('button',{name:'确认',exact:true}).click();
 }
 await page.setViewportSize({width:320,height:740});await page.locator('#menu').click();
 assert(await page.evaluate(()=>document.querySelector('#modal').scrollWidth<=document.querySelector('#modal').clientWidth));
 for(const type of ['helicopter','mixup']){const box=await page.locator(`#puzzle-types input[value="${type}"]`).boundingBox();assert(box.width>=40&&box.height>=44);}
 await page.screenshot({path:'/tmp/cube-new-types-menu.png'});
 assert.deepEqual(errors,[]);console.log('PASS helicopter jumbling and Mixup 45° gestures, undo/redo, share/reload, 997-step scramble/reset and mobile menu');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
