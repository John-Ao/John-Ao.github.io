const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROME_BIN||'/usr/bin/google-chrome',headless:true,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(process.env.CUBE_URL||'http://127.0.0.1:18765/game/cube/');
 for(const type of ['pyraminx','octahedron','megaminx','icosahedron','skewb','sq1','cuboid']){
  await page.locator('#menu').click();await page.locator(`#puzzle-types input[value="${type}"]`).check();await page.locator('#close').click();await page.waitForTimeout(300);
  const count=['octahedron','megaminx','icosahedron'].includes(type)?2:4;assert.equal(await page.locator('#align-options button').count(),count);
  for(let mode=1;mode<count;mode++){
   await page.locator(`#align-options button[data-mode="${mode}"]`).click();await page.waitForTimeout(300);
   assert(await page.evaluate(()=>{
    const rows=camera;return rows.every(r=>Math.abs(M.dot(r,r)-1)<1e-6)&&Math.abs(M.dot(M.cross(rows[0],rows[1]),rows[2])-1)<1e-6;
   }));
   if(type==='pyraminx')assert.equal(await page.evaluate(()=>P.config(puzzleType,order).normals.filter(n=>P.dot(n,camera[2])>1e-6).length),mode);
   else if(count===2)assert(await page.evaluate(()=>P.config(puzzleType,order).normals.some(n=>P.dot(n,camera[2])>1-1e-6)));
   await page.mouse.move(25,190);await page.mouse.down();await page.mouse.move(70,235,{steps:6});await page.mouse.up();await page.waitForTimeout(300);
   assert(await page.evaluate(()=>alignmentCandidates(align).some(c=>c.every((r,i)=>M.dot(r,camera[i])>1-1e-6))));
  }
  if(type==='pyraminx'){
   const icons=await page.locator('#align-options button').evaluateAll(bs=>bs.map(b=>b.innerHTML));assert.equal(new Set(icons).size,4);
  }
  if(process.env.CUBE_SCREENSHOTS&&['pyraminx','octahedron','megaminx','icosahedron'].includes(type))await page.screenshot({path:`/tmp/cube-align-${type}.png`});
  await page.locator('#align-options button[data-mode="0"]').click();
  await page.mouse.move(25,190);await page.mouse.down();await page.mouse.move(80,230,{steps:6});await page.mouse.up();const free=await page.evaluate(()=>JSON.stringify(camera));await page.waitForTimeout(300);assert.equal(await page.evaluate(()=>JSON.stringify(camera)),free);
  await page.reload();assert.equal(await page.evaluate(()=>align),0);assert.equal(await page.locator('#align-options button').count(),count);
  if(count===2){
   await page.evaluate(()=>{align=3;save();});await page.reload();await page.waitForTimeout(300);assert.equal(await page.evaluate(()=>align),1);assert(await page.evaluate(()=>P.config(puzzleType,order).normals.some(n=>P.dot(n,camera[2])>1-1e-6)));
   await page.locator('#help').click();assert.equal(await page.locator('.help-align').textContent(),'角度对齐选项');await page.keyboard.press('Escape');
  }
 }
 assert.deepEqual(errors,[]);await browser.close();console.log('PASS: per-type options/icons, tetrahedron 1/2/3 visible faces, face-normal alignment, orbit snapping, disabled snapping, reload and type-specific alignment.');
})().catch(e=>{console.error(e);process.exit(1);});
