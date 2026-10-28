const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright'),assert=require('node:assert/strict'),P=require('./polyhedra'),S=require('./state');
const fixture=require('./fixtures/megaminx-2-solved.json');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROME_BIN||'/usr/bin/google-chrome',args:['--no-sandbox']});
 try{
  const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  const base=process.env.CUBE_URL||'http://127.0.0.1:18765/game/cube/';
  const s={...fixture,pieces:P.create('megaminx',2)};for(const move of fixture.moves.slice(0,-1))P.turn(s.pieces,'megaminx',2,...move);
  const before=S.encode(s);P.turn(s.pieces,'megaminx',2,...fixture.moves.at(-1));const solved=S.encode(s);
  await page.goto(base+'#cube='+solved);assert(await page.evaluate(()=>isSolved()&&cursor===0));
  await page.reload();assert(await page.evaluate(()=>isSolved()&&cursor===0));
  await page.evaluate(state=>{restore({...snapshot(),state,initial:state,elapsed:0,running:false,run:newRun()});beginRun();},before);
  assert(await page.evaluate(()=>!isSolved()&&currentRun.phase==='ready'));
  await page.evaluate(([axis,layer,dir])=>finishTurn({axis,layer,dir,commit:true,kind:'manual'}),fixture.moves.at(-1));
  assert(await page.evaluate(()=>isSolved()&&currentRun.phase==='solved'&&!running));
  const gear={puzzleType:'gear',order:3,pieces:P.create('gear',3)};P.turn(gear.pieces,'gear',3,0,0,1);
  await page.evaluate(state=>{restore({...snapshot(),state,initial:state,elapsed:0,running:false,run:newRun()});beginRun();},S.encode(gear));
  await page.evaluate(()=>finishTurn({axis:1,layer:0,dir:-1,commit:true,kind:'manual'}));
  assert(await page.evaluate(()=>isSolved()&&currentRun.phase==='solved'&&!running));
  await page.reload();assert(await page.evaluate(()=>puzzleType==='gear'&&isSolved()&&currentRun.phase==='solved'));
  assert.deepEqual(errors,[]);console.log('PASS compact solved-state import and live minx/gear completion');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
