const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright'),assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',headless:true,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 try{
 const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(process.env.CUBE_URL||'http://127.0.0.1:18765/game/cube/');
 const results=await page.evaluate(()=>{
  const before=JSON.stringify(snapshot()),result=[];records=[];
  for(const type of Object.keys(typeNames)){
   const r={...snapshot(),puzzleType:type,order:type==='skewb'?2:3,moves:[],cursor:0,run:newRun(),created:Date.now(),updated:Date.now()};r.run.recorded=true;r.id=r.run.id;
   const target=document.createElement('canvas');target.width=target.height=128;drawHistoryThumbnail(target,r);const solved=target.toDataURL();
   if(type==='cuboid')r.moves=[[0,1,1]];else if(type==='clock')r.moves=[[0,0,1]];else r.moves=[P.legalMoves(P.create(type,r.order),type,r.order)[0].concat(1)];r.cursor=1;drawHistoryThumbnail(target,r);
   const changed=target.toDataURL(),pixels=target.getContext('2d').getImageData(0,0,128,128).data.filter((n,i)=>i%4===3&&n>0).length;
   r.cursor=0;drawHistoryThumbnail(target,r);result.push({type,pixels,changed:changed!==solved,undo:target.toDataURL()===solved});r.cursor=1;records.push(r);
  }
  const rectangular={...records.find(r=>r.puzzleType==='clock'),clockSize:[6,2]};const target=document.createElement('canvas');target.width=target.height=128;drawHistoryThumbnail(target,rectangular);
  if(before!==JSON.stringify(snapshot()))throw Error('Preview changed current state');showRecords();return result;
 });
 for(const r of results){assert(r.pixels>150,r.type);assert(r.changed,`${r.type} reflects moves`);assert(r.undo,`${r.type} respects cursor`);}
 await page.waitForFunction(()=>[...document.querySelectorAll('.history-thumbnail')].some(c=>c.getContext('2d').getImageData(0,0,128,128).data.some(n=>n)));
 await page.screenshot({path:'/tmp/cube-history-thumbnails.png'});
 await page.setViewportSize({width:320,height:740});assert(await page.evaluate(()=>document.querySelector('#modal').scrollWidth<=document.querySelector('#modal').clientWidth));
 await page.locator('.history-item').last().scrollIntoViewIfNeeded();await page.waitForTimeout(100);assert(await page.locator('.history-thumbnail').last().evaluate(c=>c.getContext('2d').getImageData(0,0,128,128).data.some(n=>n)));await page.screenshot({path:'/tmp/cube-history-clock-thumbnail.png'});
 assert.deepEqual(errors,[]);console.log('PASS: all nine types, state/cursor-specific thumbnails, rectangular clock, no active-state mutation, lazy rendering and mobile layout');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
