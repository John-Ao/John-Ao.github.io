const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict');
(async()=>{
const browser=await chromium.launch({executablePath:process.env.CHROME_BIN||'/usr/bin/google-chrome',headless:true,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:900,height:800}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.goto(process.env.CUBE_URL||'http://127.0.0.1:18765/game/cube/');await page.waitForTimeout(250);

assert.equal(await page.evaluate(()=>gl.getError()),0);
const initial=await page.evaluate(()=>JSON.stringify(camera));
// Hit the center of a front sticker; rightward drag must turn Y, never orbit.
const pt=await page.evaluate(()=>{const p=pieces.find(p=>p.p.join(',')==='0,0,1');const q=project([0,0,1.5]);return [q[0],q[1]+canvas.getBoundingClientRect().top];});
await page.mouse.move(...pt);await page.mouse.down();await page.mouse.move(pt[0]+110,pt[1],{steps:8});await page.mouse.up();await page.waitForTimeout(260);
assert.equal(await page.evaluate(()=>cursor),1);assert.equal(await page.evaluate(()=>moves[0][0]),1);assert.equal(await page.evaluate(()=>JSON.stringify(camera)),initial);
await page.locator('#undo').click();await page.waitForTimeout(260);assert(await page.evaluate(()=>M.solved(pieces)));
await page.locator('#redo').click();await page.waitForTimeout(260);assert.equal(await page.evaluate(()=>cursor),1);
await page.reload();await page.waitForTimeout(200);assert.equal(await page.evaluate(()=>cursor),1);
await page.locator('#align-options button').nth(0).click();await page.mouse.move(40,200);await page.mouse.down();await page.mouse.move(160,245,{steps:8});await page.mouse.up();await page.waitForTimeout(300);assert.notEqual(await page.evaluate(()=>JSON.stringify(camera)),initial);
for(let i=0;i<4;i++){await page.locator('#align-options button').nth(i).click();await page.waitForTimeout(280);assert.equal(await page.evaluate(()=>align),i);}
await page.locator('#menu').click();await page.locator('#size-x input[value="2"]').check();await page.locator('#size-y input[value="3"]').check();await page.locator('#size-z input[value="4"]').check();await page.locator('#dimensions button[type=submit]').click();await page.getByRole('button',{name:'确认',exact:true}).click();assert.deepEqual(await page.evaluate(()=>size),[2,3,4]);
await page.evaluate(()=>{camera=pose(1);dirty=true;});await page.waitForTimeout(50);
const rect=await page.evaluate(()=>{const p=project([-.5,0,2]);return [p[0],p[1]+canvas.getBoundingClientRect().top];});
await page.mouse.move(...rect);await page.mouse.down();await page.mouse.move(rect[0]+110,rect[1],{steps:8});await page.mouse.up();await page.waitForTimeout(250);assert.equal(await page.evaluate(()=>cursor),1);assert.equal(await page.evaluate(()=>M.step(size,moves[0][0])),Math.PI);
await page.setViewportSize({width:390,height:844});await page.waitForTimeout(100);
await page.locator('#menu').click();assert(await page.evaluate(()=>document.documentElement.scrollWidth===innerWidth));
await page.locator('#close').click();
// Seams are part of the puzzle, and a cancelled gesture leaves both state and view unchanged.
await page.evaluate(()=>{reset([3,3,3]);camera=pose(1);dirty=true;});await page.waitForTimeout(50);
assert(await page.evaluate(()=>{const p=project([.5,0,1.5]);return !!hitTest(p[0],p[1]);}));
const cancelPoint=await page.evaluate(()=>{const q=project([0,0,1.5]);return [q[0],q[1]+canvas.getBoundingClientRect().top];});
await page.mouse.move(...cancelPoint);await page.mouse.down();await page.mouse.move(cancelPoint[0]+80,cancelPoint[1],{steps:5});
await page.evaluate(()=>canvas.dispatchEvent(new PointerEvent('pointercancel',{pointerId:drag.id,bubbles:true})));await page.mouse.up();await page.waitForTimeout(250);
assert.equal(await page.evaluate(()=>cursor),0);assert(await page.evaluate(()=>M.solved(pieces)));
assert(await page.evaluate(()=>{
 for(let x=1;x<=5;x++)for(let y=1;y<=5;y++)for(let z=1;z<=5;z++){
  reset([x,y,z]);camera=pose(3);render();
  for(const piece of pieces)for(const sticker of piece.stickers){
   const point=piece.p.map((v,i)=>v+sticker.n[i]*.5);
   if(M.dot(sticker.n,camera[2].map((v,i)=>v*cameraDistance()-point[i]))<=0)continue;
   const screen=project(point),hit=hitTest(screen[0],screen[1]);
   if(!hit||hit.piece.id!==piece.id||Math.hypot(...hit.point.map((v,i)=>v-point[i]))>1e-6)return false;
  }
 }
 reset([3,3,3]);camera=pose(1);render();
 const near=project([1,0,1]),far=project([1,0,-1]);
 return near[0]-width/2>far[0]-width/2;
}));
// A short wrong-way start must not lock the layer before the main stroke.
const trajectoryStart=await page.evaluate(()=>{reset([3,3,3]);camera=pose(1);render();const q=project([0,0,1.5]);return [q[0],q[1]+canvas.getBoundingClientRect().top];});
await page.mouse.move(...trajectoryStart);await page.mouse.down();
await page.mouse.move(trajectoryStart[0]+10,trajectoryStart[1],{steps:2});
assert.equal(await page.evaluate(()=>drag.turn.axis),1);
await page.mouse.move(trajectoryStart[0]+10,trajectoryStart[1]+110,{steps:12});
assert.equal(await page.evaluate(()=>drag.turn.axis),0);
await page.mouse.up();await page.waitForTimeout(250);
assert.equal(await page.evaluate(()=>moves.at(-1)[0]),0);
assert.equal(await page.evaluate(()=>cursor),1);
// On the lower front row in three-face view, left is diagonally up-left.
const diagonal=await page.evaluate(()=>{
 reset([3,3,3]);camera=pose(3);render();
 const a=project([1,-1,1.5]),b=project([0,-1,1.5]),length=Math.hypot(b[0]-a[0],b[1]-a[1]),top=canvas.getBoundingClientRect().top;
 return {start:[a[0],a[1]+top],end:[a[0]+(b[0]-a[0])/length*90,a[1]+top+(b[1]-a[1])/length*90]};
});
assert(diagonal.end[0]<diagonal.start[0]&&diagonal.end[1]<diagonal.start[1]);
await page.mouse.move(...diagonal.start);await page.mouse.down();await page.mouse.move(...diagonal.end,{steps:12});
assert.equal(await page.evaluate(()=>drag.turn.axis),1);
await page.mouse.up();await page.waitForTimeout(250);
assert.deepEqual(await page.evaluate(()=>moves.at(-1)),[1,-1,-1]);
// Maximum dimensions remain usable on a narrow mobile screen.
await page.setViewportSize({width:320,height:740});
await page.locator('#menu').click();
for(const a of ['x','y','z'])await page.locator(`#size-${a} input[value="9"]`).check();
assert(await page.evaluate(()=>document.querySelector('.dimensions').scrollWidth<=document.querySelector('.dimensions').clientWidth));
await page.locator('#dimensions button[type=submit]').click();await page.getByRole('button',{name:'确认',exact:true}).click();
assert.deepEqual(await page.evaluate(()=>size),[9,9,9]);
await page.evaluate(()=>{M.turn(pieces,size,0,4,1);moves=[[0,4,1]];cursor=1;save();});
const shared=await page.evaluate(()=>({url:shareURL(),state:JSON.stringify(pieces)}));
await page.locator('#menu').click();await page.locator('#share').click();
assert.equal(await page.getByLabel('分享链接',{exact:true}).inputValue(),shared.url);
await page.goto('about:blank');await page.goto(shared.url);await page.waitForTimeout(250);
assert.equal(await page.evaluate(()=>JSON.stringify(pieces)),shared.state);
assert.equal(await page.evaluate(()=>running),false);
await page.locator('#undo').click();await page.waitForTimeout(260);await page.reload();await page.waitForTimeout(200);
assert.equal(await page.evaluate(()=>cursor),0);
await page.evaluate(()=>{reset([3,3,3]);camera=pose(1);zoom=1;render();});
const touch=await page.context().newCDPSession(page);
const center=await page.evaluate(()=>{const r=canvas.getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2};});
const send=(type,points)=>touch.send('Input.dispatchTouchEvent',{type,touchPoints:points.map(([x,y],id)=>({x,y,id}))});
await send('touchStart',[[center.x,center.y]]);
await send('touchMove',[[center.x+35,center.y]]);
await send('touchStart',[[center.x+35,center.y],[center.x-35,center.y]]);
await send('touchMove',[[center.x,center.y+55],[center.x,center.y-55]]);
await send('touchEnd',[]);await page.waitForTimeout(350);
assert.equal(await page.evaluate(()=>cursor),0);
assert(await page.evaluate(()=>zoom>1.5));
assert(await page.evaluate(()=>Math.abs(camera[0][1])>.99&&Math.abs(camera[2][2]-1)<1e-6));
assert(await page.evaluate(()=>!drag&&!pinch&&pointers.size===0));
await page.reload();await page.waitForTimeout(200);
assert(await page.evaluate(()=>zoom>1.5&&Math.abs(camera[0][1])>.99));
// Help is modal, pauses the clock, and follows viewport changes.
for(const viewport of [{width:390,height:844},{width:320,height:568},{width:900,height:800},{width:844,height:390}]){
 await page.setViewportSize(viewport);await page.locator('#help').click();
 assert(await page.locator('#help-overlay').evaluate(el=>el.open));
 assert.equal(await page.locator('#help-arrows g path').count(),8);
 assert(await page.locator('#help-overlay').evaluate(el=>el.scrollWidth===el.clientWidth&&el.scrollHeight===el.clientHeight));
 await page.evaluate(()=>{running=true;elapsed=1000;});await page.waitForTimeout(100);
 assert.equal(await page.evaluate(()=>elapsed),1000);
 await page.keyboard.press('Escape');assert.equal(await page.locator('#help-overlay').evaluate(el=>el.open),false);
 assert(await page.locator('#help').evaluate(el=>el===document.activeElement));
 await page.evaluate(()=>{running=false;});
}
await page.locator('#help').click();await page.locator('#help-close').click();
assert.equal(await page.locator('#help-overlay').evaluate(el=>el.open),false);
assert.deepEqual(errors,[]);console.log('PASS: WebGL render, piece gesture, blank orbit, undo/redo, reload, 4 alignment modes, dimensions form, 180-degree gesture, mobile layout; no browser errors.');await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
