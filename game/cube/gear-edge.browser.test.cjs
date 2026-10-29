const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright'),assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROME_BIN||'/usr/bin/google-chrome',args:['--no-sandbox']});
 const page=await browser.newPage({viewport:{width:600,height:800}});
 await page.goto(process.env.CUBE_URL||'http://127.0.0.1:18765/game/cube/');
 await page.locator('#menu').click();await page.locator('#puzzle-types input[value="gear"]').check();await page.locator('#close').click();
 await page.waitForFunction(()=>puzzleType==='gear');
 const swipe=await page.evaluate(()=>{
  render();
  for(const face of polygons){
   if(face.piece.kind!=='gear')continue;
   const point=P.average(face.world),screen=project(point),hit=hitTest(...screen);
   if(!hit||hit.piece.id!==face.piece.id)continue;
   for(const axis of GearCube.dragAxes(hit.piece,hit.normal)){
    if(!P.selection(pieces,'gear',3,axis,0).includes(hit.piece.id))continue;
    const end=project(GearCube.preview(hit.piece,point,axis,.01)),dx=end[0]-screen[0],dy=end[1]-screen[1],len=Math.hypot(dx,dy);
    if(len<.1)continue;
    return {start:[screen[0],screen[1]+canvas.getBoundingClientRect().top],delta:[dx/len*180,dy/len*180],normal:hit.normal,id:hit.piece.id,home:hit.piece.p.slice()};
   }
  }
 });
 assert(swipe);
 await page.mouse.move(...swipe.start);await page.mouse.down();await page.mouse.move(swipe.start[0]+swipe.delta[0],swipe.start[1]+swipe.delta[1],{steps:12});
 const preview=await page.evaluate(()=>({angle:drag.turn.angle,cursor}));
 assert(Math.abs(preview.angle)>Math.PI/2,'dragging can pass 90 degrees');
 assert(Math.abs(Math.abs(preview.angle)-180/(2*132)*Math.PI)<.02,'the same rotation requires twice the drag distance');
 assert.equal(preview.cursor,0,'dragging does not commit a move');
 await page.mouse.up();
 const completion=await page.evaluate(()=>animation&&({from:animation.from,to:animation.to,commit:animation.commit,duration:animation.duration}));
 assert(completion?.commit);
 assert(completion.duration>0&&completion.duration<=180);
 assert.equal(completion.from,preview.angle);
 assert.equal(Math.abs(completion.to),Math.PI,'release completes the full gear half turn');
 await page.waitForFunction(()=>cursor===1&&!animation);
 const result=await page.evaluate(id=>({axis:moves[0][0],position:pieces.find(p=>p.id===id).p}),swipe.id);
 assert.equal(swipe.home[Math.floor(result.axis/2)]*(result.axis%2?-1:1),1);
 assert(Math.abs(swipe.normal[Math.floor(result.axis/2)])<.9,'must not turn the touched face');
 assert.notDeepEqual(result.position,swipe.home);
 await page.locator('#undo').click();await page.waitForFunction(()=>!animation&&cursor===0);assert(await page.evaluate(()=>isSolved()));
 await browser.close();console.log('PASS actual edge gesture selects an outer layer, moves the edge, and undo restores it');
})().catch(e=>{console.error(e);process.exit(1)});
