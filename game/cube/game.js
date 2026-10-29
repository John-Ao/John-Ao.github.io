'use strict';
const M=Cuboid,$=id=>document.getElementById(id),canvas=$('puzzle'),gl=canvas.getContext('webgl',{antialias:true,alpha:true});
const P=PolyPuzzle,STICKER_INSET=1.6,SHUFFLE_STEPS=997;
let puzzleType='cuboid',order=3;
const typeNames={cuboid:'长方体魔方',pyraminx:'金字塔魔方',skewb:'斜转魔方',megaminx:'五魔方',sq1:'SQ-1',octahedron:'八面体魔方',icosahedron:'二十面体魔方',gear:'齿轮魔方',clock:'魔表',helicopter:'直升机魔方',mixup:'混元魔方'};
function createPuzzle(){return puzzleType==='clock'?ClockPuzzle.fresh(...clockSize):puzzleType==='cuboid'?M.create(size):P.create(puzzleType,order);}
function turnStep(axis,layer=0){return puzzleType==='cuboid'?M.step(size,axis):P.step(puzzleType,order,axis,layer);}
function applyTurn(target,axis,layer,dir){if(puzzleType==='clock')ClockPuzzle.move(target,axis,layer,dir);else if(puzzleType==='cuboid')M.turn(target,size,axis,layer,dir);else P.turn(target,puzzleType,order,axis,layer,dir);}
function isSolved(){return puzzleType==='clock'?ClockPuzzle.solved(pieces):puzzleType==='cuboid'?M.solved(pieces):P.solved(pieces,puzzleType,order);}
const KEY='cube.session',colors=['#f1d64e','#f3f1e9','#548bd4','#549d70','#ef9142','#df4e55','#a979ce','#55c4c4','#eaa6c3','#b1cb67','#927454','#a1b8de','#d84fa3','#258880','#8b67dd','#f4b947','#abc5ec','#a24636','#b9d4a0','#e8b49a'];
let clockSize=[3,3],clockPrefs={mode:'drag',layout:'auto'},menuDraft=null;
let currentRun=newRun(),records=loadRecords();
let size=[3,3,3],pieces=M.create(size),moves=[],initialState=null,cursor=0,align=3,zoom=1,theme='day',dim=false;
let camera=pose(3),width=1,height=1,scale=1,polygons=[],dirty=true,drag=null,animation=null,snap=null;
let elapsed=0,running=false,lastTick=performance.now(),saveAt=0,toastTimer;
const pointers=new Map();
let pinch=null,shuffleRecording=null,shuffling=false;
function pose(mode){
 const yaw=mode===3?Math.PI/4:0,pitch=mode===3?Math.atan(1/Math.sqrt(2)):mode===2?Math.atan(.5):0;
 return M.axes.map(v=>M.rotate(M.rotate(v,0,-pitch),1,yaw));
}
function multiply(a,b){return a.map(row=>[0,1,2].map(j=>row.reduce((sum,x,k)=>sum+x*b[k][j],0)));}
function view(v){return camera.map(row=>M.dot(row,v));}
function cameraDistance(){return (puzzleType==='cuboid'?Math.hypot(...size):5)*1.8;}
function project(v){const q=view(v),perspective=cameraDistance()/(cameraDistance()-q[2]);return [width/2+q[0]*scale*perspective,height/2-q[1]*scale*perspective,q[2]];}
function toast(message){$('toast').textContent=message;$('toast').classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('visible'),2400);$('status').textContent=message;}
function busy(){return shuffling||!!animation||!!drag||!!pinch||!!clockDrag;}
function controls(){
 $('undo').disabled=busy()||(shuffleRecording?shuffleRecording.operations.length===0:cursor===0);
 $('redo').disabled=!!shuffleRecording||busy()||cursor===moves.length;
 for(const id of ['menu','shuffle','reset','timer-control'])$(id).disabled=!!shuffleRecording||shuffling;
 $('record-finish').disabled=busy()||!shuffleRecording?.operations.length;
 if(shuffleRecording)$('record-count').textContent=`${new Set(shuffleRecording.operations.map(m=>m.join())).size} 种操作`;
}
function boardState(){return CubeState.encode({puzzleType,order,size,clockSize,pieces});}
function snapshot(){return structuredClone({state:boardState(),initial:initialState,clockPrefs,camera,align,zoom,theme,dim,elapsed,running,run:currentRun});}
function save(){
 if(shuffleRecording||shuffling)return;
 rememberRun();
 try{localStorage.setItem(KEY,JSON.stringify(snapshot()));localStorage.setItem(HISTORY_KEY,JSON.stringify(records));}catch{toast('无法保存进度：浏览器存储不可用');}
}
function restore(shared){
 try{
  const s=shared||JSON.parse(localStorage.getItem(KEY));if(!s)return;
  const board=CubeState.decode(s.state),initial=CubeState.decode(s.initial);
  if(board.puzzleType!==initial.puzzleType||board.order!==initial.order||board.size.join()!==initial.size.join()||board.clockSize.join()!==initial.clockSize.join()||!validRun(s.run))throw Error();
  if(!['drag','buttons'].includes(s.clockPrefs?.mode)||!['auto','horizontal','vertical'].includes(s.clockPrefs?.layout)||
   ![0,1,2,3].includes(s.align)||!['day','night'].includes(s.theme)||typeof s.dim!=='boolean'||typeof s.running!=='boolean'||
   !Number.isFinite(s.elapsed)||s.elapsed<0||!Number.isFinite(s.zoom)||s.zoom<.55||s.zoom>1.8||
   !Array.isArray(s.camera)||s.camera.length!==3||!s.camera.every(r=>Array.isArray(r)&&r.length===3&&r.every(Number.isFinite)&&Math.abs(M.dot(r,r)-1)<.001)||
   Math.abs(M.dot(M.cross(s.camera[0],s.camera[1]),s.camera[2])-1)>.001)throw Error();
  puzzleType=board.puzzleType;order=board.order;size=board.size;clockSize=board.clockSize;pieces=board.pieces;initialState=s.initial;moves=[];cursor=0;
  clockPrefs=s.clockPrefs;camera=s.camera;align=s.align;zoom=s.zoom;theme=s.theme;dim=s.dim;elapsed=s.elapsed;
  currentRun=structuredClone(s.run);running=currentRun.phase==='running'&&s.running;
  if(currentRun.phase==='running'&&isSolved())completeRun();
  return true;
 }catch{toast(shared?'状态无效，已保留当前局面':'存档无效，已使用新魔方');}
}
initialState=boardState();restore();
if(location.hash.startsWith('#cube=')){
 try{const state=location.hash.slice(6);CubeState.decode(state);restore({...snapshot(),state,initial:state,elapsed:0,running:false,run:newRun()});}
 catch{toast('分享链接无效，已保留本地局面');}
 save();history.replaceState(null,'',location.pathname+location.search);
}
window.addEventListener('hashchange',()=>{if(location.hash.startsWith('#cube='))location.reload();});
function shareURL(){const url=new URL(location.href);url.hash='cube='+boardState();return url.href;}

if(!gl){$('status').textContent='浏览器不支持 WebGL';throw Error('WebGL unavailable');}
function shader(type,source){const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s;}
const program=gl.createProgram();
gl.attachShader(program,shader(gl.VERTEX_SHADER,'attribute vec3 position;attribute vec3 color;varying vec3 tint;void main(){gl_Position=vec4(position,1.);tint=color;}'));
gl.attachShader(program,shader(gl.FRAGMENT_SHADER,'precision mediump float;varying vec3 tint;void main(){gl_FragColor=vec4(tint,1.);}'));
gl.linkProgram(program);gl.useProgram(program);
const buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
for(const [name,offset]of [['position',0],['color',12]]){const loc=gl.getAttribLocation(program,name);gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,3,gl.FLOAT,false,24,offset);}
gl.enable(gl.DEPTH_TEST);
function resize(){const r=canvas.getBoundingClientRect(),dpr=Math.min(devicePixelRatio||1,2);width=r.width;height=r.height;canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);gl.viewport(0,0,canvas.width,canvas.height);dirty=true;}
new ResizeObserver(resize).observe(canvas);
function rgb(hex){return [1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255);}
function render(){
 if(puzzleType==='clock'){renderClock();dirty=false;return;}
 scale=Math.min(width,height)*.72/(puzzleType==='cuboid'?Math.hypot(...size):puzzleType==='pyraminx'?5:3.5)*zoom;
 gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
 if(puzzleType!=='cuboid'){renderPoly();dirty=false;return;}
 const data=[];polygons=[];
 const turn=animation||drag?.turn;
 for(const piece of pieces){
  const active=turn&&M.inLayer(piece,turn.axis,turn.layer),rot=v=>active?M.rotate(v,turn.axis,turn.angle):v;
  for(let axis=0;axis<3;axis++)for(const sign of [-1,1]){
   const normal=M.axes[axis].map(n=>n*sign),n=rot(normal);
   const center=rot(piece.p.map((p,i)=>p+normal[i]*.5));
   if(M.dot(n,camera[2].map((v,i)=>v*cameraDistance()-center[i]))<.00001)continue;
   const u=M.axes[(axis+1)%3],v=M.axes[(axis+2)%3];
   const face=(half,depth)=>[[-1,-1],[1,-1],[1,1],[-1,1]].map(([a,b])=>rot(piece.p.map((p,i)=>p+normal[i]*depth+u[i]*a*half+v[i]*b*half)));
   const body=face(.5,.5),sticker=piece.stickers.find(s=>M.dot(s.n,normal)>.99);
   const light=(.78+.22*Math.max(0,M.dot(camera[2],n)))*(dim?.42:1);
   function polygon(screen,color,bias=0){const tint=color.map(c=>c*light);for(let j=1;j<screen.length-1;j++)for(const i of [0,j,j+1])data.push((screen[i][0]/width)*2-1,1-screen[i][1]/height*2,1-2*cameraDistance()/(4*(cameraDistance()-screen[i][2]))-bias,...tint);}
   const screen=body.map(project);polygon(screen,[.055,.062,.07]);
   if(sticker)polygon(P.insetFace(body,STICKER_INSET/scale).map(project),rgb(colors[P.stickerColorIndex('cuboid',sticker.color)]),.0005);
   polygons.push({screen,world:body,piece,normal});
  }
 }
 gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(data),gl.DYNAMIC_DRAW);gl.drawArrays(gl.TRIANGLES,0,data.length/6);dirty=false;
}
function hitTest(x,y){
 if(puzzleType!=='cuboid')return hitPoly(x,y);
 // Ray-cast the unbroken outer shell, so a press on a sticker seam also turns a layer.
 const sx=(x-width/2)/scale,sy=-(y-height/2)/scale;
 const distance=cameraDistance(),origin=camera[2].map(n=>n*distance);
 const direction=[0,1,2].map(i=>camera[0][i]*sx/distance+camera[1][i]*sy/distance-camera[2][i]);
 let near=-Infinity,far=Infinity,axis=-1,sign=1;
 for(let a=0;a<3;a++){
  const half=size[a]/2;
  if(Math.abs(direction[a])<1e-9){if(Math.abs(origin[a])>half)return null;continue;}
  const t1=(-half-origin[a])/direction[a],t2=(half-origin[a])/direction[a];
  if(Math.min(t1,t2)>near){near=Math.min(t1,t2);axis=a;sign=t1<t2?-1:1;}
  far=Math.min(far,Math.max(t1,t2));if(near>far)return null;
 }
 if(axis<0||far<0)return null;
 const point=origin.map((v,i)=>v+near*direction[i]);
 const position=point.map((v,i)=>Math.max(0,Math.min(size[i]-1,Math.floor(v+size[i]/2)))-(size[i]-1)/2);
 const piece=pieces.find(p=>p.p.every((v,i)=>Math.abs(v-position[i])<1e-6));
 return {piece,point,normal:M.axes[axis].map(n=>n*sign)};
}
function snapView(){
 if(puzzleType==='clock'||!align)return;
 let best=null,score=-Infinity;
 for(const candidate of alignmentCandidates(align)){
  const s=candidate.reduce((sum,row,i)=>sum+M.dot(row,camera[i]),0);
  if(s>score){score=s;best=candidate;}
 }
 snap={from:camera.map(r=>r.slice()),to:best,start:performance.now()};dirty=true;
}
function normalize(v){const length=Math.hypot(...v);return v.map(n=>n/length);}
function dragRadiansPerPixel(axis,layer=0){return turnStep(axis,layer)/(2*Math.max(70,Math.min(width,height)*.22));}
function dragTurnAngle(axis,distance,layer=0){
 const angle=distance*dragRadiansPerPixel(axis,layer);
 const limit=turnStep(axis,layer);
 return Math.max(-limit,Math.min(limit,angle));
}
function releaseVelocity(d){
 const samples=d.velocitySamples||[],last=samples.at(-1);
 if(!last||!d.turn)return 0;
 const first=samples.find(s=>s.time>=last.time-80);
 if(!first||last.time<=first.time)return 0;
 const pixels=((last.x-first.x)*d.turn.tangent[0]+(last.y-first.y)*d.turn.tangent[1])/(last.time-first.time);
 return pixels*dragRadiansPerPixel(d.turn.axis,d.turn.layer);
}
function turnAnimationAngle(a,t){
 const delta=a.to-a.from;
 if(Math.abs(delta)<1e-9)return a.to;
 const impulse=(a.velocity||0)*a.duration;
 // Preserve the release derivative, but dissipate fast flicks early so they
 // cannot overshoot the target. Both terms finish with zero velocity.
 const decay=Math.max(2,2*Math.abs(impulse)/Math.max(Math.abs(delta),.001));
 const coast=impulse/(decay+1);
 return a.from+coast*(1-(1-t)**(decay+1))+(delta-coast)*t*t*(3-2*t);
}
function animateTurn(axis,layer,dir,from=0,commit=true,kind='manual',velocity=0){
 if(puzzleType==='clock'){finishTurn({axis,layer,dir,commit,kind});return;}
 const step=turnStep(axis,layer),to=commit?step*dir:0,remaining=Math.abs(to-from);
 if(remaining<1e-9){finishTurn({axis,layer,dir,commit,kind});return;}
 const duration=matchMedia('(prefers-reduced-motion: reduce)').matches?0:180*Math.min(1,Math.sqrt(remaining/step));
 animation={axis,layer,dir,angle:from,from,to,velocity,start:performance.now(),duration,commit,kind};controls();dirty=true;
}
function finishTurn(a){
 if(a.commit){
  applyTurn(pieces,a.axis,a.layer,a.dir);
  if(shuffleRecording){
   if(a.kind==='record-undo')shuffleRecording.operations.pop();
   else if(a.kind==='manual')shuffleRecording.operations.push([a.axis,a.layer,a.dir]);
   animation=null;controls();dirty=true;return;
  }
  if(a.kind==='manual'){moves=moves.slice(0,cursor);moves.push([a.axis,a.layer,a.dir]);cursor++;}
  if(a.kind==='undo')cursor--;if(a.kind==='redo')cursor++;
  if(puzzleType!=='clock'||a.axis!==2)advanceRun();
 }
 animation=null;controls();save();dirty=true;
}
function localPoint(e){const r=canvas.getBoundingClientRect();return [e.clientX-r.left,e.clientY-r.top];}
canvas.addEventListener('pointerdown',e=>{
 if(e.button!==0&&e.pointerType==='mouse')return;
 pointers.set(e.pointerId,localPoint(e));canvas.setPointerCapture(e.pointerId);
 if(pointers.size>1){cancelDrag();snap=null;if(pointers.size===2&&!$('modal').open)startPinch();return;}
 if(animation||shuffling||$('modal').open)return;
 snap=null;if(dirty)render();const [x,y]=localPoint(e);
 drag={id:e.pointerId,x,y,lastX:x,lastY:y,hit:hitTest(x,y),turn:null,track:M.createTrajectory(),velocitySamples:[{x,y,time:e.timeStamp}],moved:false};controls();
});
function startPinch(){
 const [a,b]=[...pointers.values()];
 pinch={distance:Math.max(1,Math.hypot(b[0]-a[0],b[1]-a[1])),angle:Math.atan2(b[1]-a[1],b[0]-a[0]),zoom,camera:camera.map(r=>r.slice())};controls();
}
canvas.addEventListener('pointermove',e=>{
 if(pointers.has(e.pointerId))pointers.set(e.pointerId,localPoint(e));
 if(pinch){
  const [a,b]=[...pointers.values()];if(!b)return;
  zoom=Math.max(.55,Math.min(1.8,pinch.zoom*Math.hypot(b[0]-a[0],b[1]-a[1])/pinch.distance));
  const angle=Math.atan2(b[1]-a[1],b[0]-a[0])-pinch.angle,c=Math.cos(angle),s=Math.sin(angle),[r,u,f]=pinch.camera;
  camera=[r.map((v,i)=>v*c+u[i]*s),u.map((v,i)=>v*c-r[i]*s),f.slice()];dirty=true;return;
 }
 if(!drag||drag.id!==e.pointerId||pointers.size!==1)return;
 const [x,y]=localPoint(e),dx=x-drag.x,dy=y-drag.y;
 if(!drag.hit){
  const mx=x-drag.lastX,my=y-drag.lastY;
  // Rotating the camera rows in screen coordinates preserves an orthonormal basis.
  const yaw=mx*.007,pitch=my*.007;
  const r0=camera[0],r1=camera[1],r2=camera[2];
  camera=[r0.map((v,i)=>v*Math.cos(yaw)+r2[i]*Math.sin(yaw)),r1,r2.map((v,i)=>v*Math.cos(yaw)-r0[i]*Math.sin(yaw))];
  const u=camera[1],f=camera[2];camera[1]=u.map((v,i)=>v*Math.cos(pitch)-f[i]*Math.sin(pitch));camera[2]=f.map((v,i)=>v*Math.cos(pitch)+u[i]*Math.sin(pitch));
  drag.lastX=x;drag.lastY=y;drag.moved ||= Math.hypot(dx,dy)>3;dirty=true;return;
 }
 updatePuzzleDrag(e);
});
function updatePuzzleDrag(e){
 const samples=e.getCoalescedEvents?.()||[];
 for(const sample of [...samples,e]){
  const [x,y]=localPoint(sample);M.extendTrajectory(drag.track,x-drag.x,y-drag.y);
  const history=drag.velocitySamples??=[];
  if(!history.length||sample.timeStamp>history.at(-1).time)history.push({x,y,time:sample.timeStamp});
  while(history.length>2&&history[0].time<sample.timeStamp-100)history.shift();
 }
 if(puzzleType!=='cuboid'){updatePolyDrag();return;}
 const faceCenter=drag.hit.piece.p.map((v,i)=>v+drag.hit.normal[i]*.5);
 const choice=M.matchTrajectory(faceCenter,drag.hit.normal,camera,drag.track,cameraDistance(),drag.turn?.axis);
 drag.turn=choice?{...choice,layer:drag.hit.piece.p[choice.axis],angle:0}:null;
 if(drag.turn){
  const t=drag.turn,distance=drag.track.x*t.tangent[0]+drag.track.y*t.tangent[1];
  t.angle=dragTurnAngle(t.axis,distance);
 }
 dirty=true;
}
function cancelDrag(){cancelClockDrag();if(drag?.turn){const t=drag.turn;animateTurn(t.axis,t.layer,1,t.angle,false);}drag=null;controls();dirty=true;}
function release(e,cancelled){
 pointers.delete(e.pointerId);if(pinch){if(pointers.size>=2)startPinch();else{pinch=null;save();controls();}return;}if(!drag||drag.id!==e.pointerId)return;
 if(cancelled){cancelDrag();return;}
 if(drag.hit&&e.type==='pointerup')updatePuzzleDrag(e);
 const d=drag;drag=null;
 if(d.turn){const t=d.turn,step=turnStep(t.axis,t.layer),amounts=puzzleType==='helicopter'?P.turnStops(pieces,puzzleType,order,t.axis,t.layer).filter(n=>n*(t.angle<0?-1:1)>0):[t.angle<0?-1:1];
  const amount=amounts.reduce((best,n)=>Math.abs(t.angle/step-n)<Math.abs(t.angle/step-best)?n:best);
  animateTurn(t.axis,t.layer,amount,t.angle,Math.abs(t.angle)>step*.16,'manual',releaseVelocity(d));
 }
 else if(!d.hit&&d.moved){snapView();save();}
 controls();
}
canvas.addEventListener('pointerup',e=>release(e,false));canvas.addEventListener('pointercancel',e=>release(e,true));canvas.addEventListener('lostpointercapture',e=>{if(pointers.has(e.pointerId))release(e,true);});
canvas.addEventListener('wheel',e=>{e.preventDefault();if(busy())return;zoom=Math.max(.55,Math.min(1.8,zoom*Math.exp(-e.deltaY*.001)));dirty=true;save();},{passive:false});
$('undo').onclick=()=>{if(busy())return;if(shuffleRecording){const move=shuffleRecording.operations.at(-1);if(move)animateTurn(move[0],move[1],-move[2],0,true,'record-undo');return;}if(!cursor)return;const [a,l,d]=moves[cursor-1];animateTurn(a,l,-d,0,true,'undo');};
$('redo').onclick=()=>{if(busy()||cursor===moves.length)return;const [a,l,d]=moves[cursor];animateTurn(a,l,d,0,true,'redo');};
function themeUpdate(){document.body.dataset.theme=dim?'dim':theme;$('theme').setAttribute('aria-label',theme==='day'?'切换至夜间模式':'切换至日间模式');$('theme').title=$('theme').getAttribute('aria-label');$('theme').setAttribute('aria-pressed',String(theme==='night'));$('dim').setAttribute('aria-pressed',String(dim));dirty=true;}
$('theme').onclick=()=>{theme=theme==='day'?'night':'day';dim=false;themeUpdate();save();};
$('dim').onclick=()=>{dim=!dim;themeUpdate();save();};
$('fullscreen').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch{toast('当前浏览器无法进入全屏');}};
document.addEventListener('fullscreenchange',()=>$('fullscreen').setAttribute('aria-pressed',String(!!document.fullscreenElement)));
function openDialog(title,content){cancelDrag();$('dialog-title').textContent=title;$('menu-panel').hidden=!!content;$('dialog-content').hidden=!content;$('dialog-content').replaceChildren();if(content)$('dialog-content').append(content);$('modal').showModal();}
$('share').onclick=()=>{
 const box=document.createElement('div');box.className='link-box';
 const input=document.createElement('input');input.readOnly=true;input.value=shareURL();input.setAttribute('aria-label','分享链接');
 const button=document.createElement('button');button.textContent='复制链接';
 button.onclick=async()=>{try{await navigator.clipboard.writeText(input.value);toast('链接已复制');}catch{input.focus();input.select();toast('请手动复制链接');}};
 input.onclick=()=>input.select();box.append(input,button);openDialog('分享当前局面',box);
};
$('menu').onclick=()=>{if(animation)return;menuDraft=settingsSnapshot();syncSizes();openDialog('菜单');};
$('close').onclick=()=>$('modal').close();
$('modal').addEventListener('click',e=>{if(e.target===$('modal')){const r=$('modal').getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)$('modal').close();}});
$('modal').addEventListener('close',()=>{lastTick=performance.now();if(menuDraft)finishMenuChanges();save();});
function confirmAction(title,message,action){
 const box=document.createElement('div'),p=document.createElement('p'),buttons=document.createElement('div');p.textContent=message;buttons.className='dialog-actions';
 for(const [label,fn]of [['取消',()=>$('modal').close()],['确认',()=>{action();$('modal').close();}]]){const b=document.createElement('button');b.textContent=label;b.onclick=fn;buttons.append(b);}
 box.append(p,buttons);openDialog(title,box);
}
function reset(next=size){currentRun=newRun();size=next.slice();pieces=createPuzzle();moves=[];initialState=boardState();cursor=0;animation=null;drag=null;elapsed=0;running=false;controls();dirty=true;syncSizes();save();}
$('reset').onclick=()=>{if(!busy())confirmAction('复原','复原当前魔方？',()=>{pieces=createPuzzle();moves=[];cursor=0;completeRun();controls();dirty=true;save();});};
async function performShuffle(allowed=null){
 save();reset();shuffling=true;controls();$('shuffle-progress').hidden=false;
 $('shuffle-progress').textContent=`正在打乱 0 / ${SHUFFLE_STEPS}`;
 // Scramble a lightweight geometric model; rebuild display meshes once.
 // Selection needs only unique vertices (or gear positions), not triangles.
 const work=puzzleType==='clock'?structuredClone(pieces):pieces.map(p=>{
  const copy={...p,frame:p.frame.map(v=>v.slice())};
  if(p.p)copy.p=p.p.slice();if(p.anchor)copy.anchor=p.anchor.slice();
  if(p.stickers)copy.stickers=[];
  if(p.faces){const vertices=new Map();if(puzzleType!=='gear')for(const f of p.faces.filter(f=>puzzleType!=='mixup'||f.color>=0))for(const v of f.points)vertices.set(v.map(x=>Math.round(x*1e8)).join(),v.slice());copy.faces=vertices.size?[{color:puzzleType==='mixup'?0:-1,points:[...vertices.values()]}]:[];}
  return copy;
 });
 let previous='',blocked=false,nextYield=performance.now()+12;
 const pairs=puzzleType==='cuboid'?M.axes.flatMap((_,axis)=>Array.from({length:size[axis]},(_,j)=>[axis,j-(size[axis]-1)/2])):
  puzzleType==='clock'?[...pieces.pins.map((_,i)=>[2,i]),...[0,1].flatMap(a=>[0,1,2,3].map(l=>[a,l]))]:
  P.config(puzzleType,order).axes.flatMap((_,a)=>Array.from({length:P.layerCount(puzzleType,order)},(_,l)=>[a,l]));
 const candidates=allowed||pairs.flatMap(([a,l])=>(puzzleType==='helicopter'?P.turnAmounts(puzzleType):[1]).flatMap(n=>[[a,l,n],[a,l,-n]]));
 function pick(pool){
  pool=pool.slice();while(pool.length){const i=Math.floor(Math.random()*pool.length),move=pool.splice(i,1)[0];
   if(['cuboid','clock'].includes(puzzleType)||P.selection(work,puzzleType,order,move[0],move[1]))return move;
  }
 }
 try{
  for(let i=0;i<SHUFFLE_STEPS;i++){
   const alternatives=candidates.filter(m=>m.slice(0,2).join()!==previous),move=pick(alternatives)||pick(candidates);
   if(!move){blocked=true;break;}
   applyTurn(work,...move);moves.push(move.slice());previous=move.slice(0,2).join();
   if(performance.now()>=nextYield){$('shuffle-progress').textContent=`正在打乱 ${i+1} / ${SHUFFLE_STEPS}`;dirty=true;await new Promise(requestAnimationFrame);nextYield=performance.now()+12;}
  }
  pieces=CubeState.decode(CubeState.encode({puzzleType,order,size,clockSize,pieces:work})).pieces;
 }finally{shuffling=false;$('shuffle-progress').hidden=true;}
 cursor=moves.length;controls();dirty=true;beginRun();
 if(blocked)toast(`许可操作已被阻挡，完成 ${moves.length} 步`);
 else if(isSolved())toast(`已完成 ${SHUFFLE_STEPS} 步，局面回到复原状态`);
}

function beginShuffleRecording(){
 save();shuffleRecording={snapshot:snapshot(),moves:structuredClone(moves),cursor,operations:[]};running=false;menuDraft=null;
 $('modal').close();$('shuffle-recorder').hidden=false;controls();canvas.focus();
}
function leaveShuffleRecording(){
 const recording=shuffleRecording;cancelClockDrag();shuffleRecording=null;animation=null;drag=null;
 restore({...recording.snapshot,run:newRun(),running:false});currentRun=recording.snapshot.run;running=recording.snapshot.running;
 moves=recording.moves;cursor=recording.cursor;lastTick=performance.now();$('shuffle-recorder').hidden=true;controls();dirty=true;
 return recording.operations;
}
$('record-finish').onclick=()=>{
 if(busy()||!shuffleRecording?.operations.length)return;
 const operations=leaveShuffleRecording(),allowed=[...new Map(operations.map(m=>[m.join(),m])).values()];
 performShuffle(allowed);
};
$('record-cancel').onclick=()=>{if(!shuffleRecording)return;leaveShuffleRecording();save();};
$('shuffle').onclick=()=>{
 if(busy()||shuffleRecording)return;
 const box=document.createElement('div');box.className='dialog-actions';
 for(const [label,action] of [['打乱',()=>{performShuffle();$('modal').close();}],['受限打乱',beginShuffleRecording],['取消',()=>$('modal').close()]]){
  const button=document.createElement('button');button.textContent=label;button.onclick=action;box.append(button);
 }
 openDialog('打乱',box);
};
// Menu X/Y/Z mean height/width/depth; geometry remains right/up/front.
const dimensionAxes=[1,0,2];
function syncSizes(){syncTypeUI();['x','y','z'].forEach((a,i)=>{const value=(menuDraft?.size||size)[dimensionAxes[i]],group=$('size-'+a);group.querySelector(`input[value="${value}"]`).checked=true;group.style.setProperty('--index',value-1);});}
for(const a of ['x','y','z'])$('size-'+a).addEventListener('change',e=>{$('size-'+a).style.setProperty('--index',Number(e.target.value)-1);if(menuDraft)menuDraft.size[dimensionAxes[['x','y','z'].indexOf(a)]]=Number(e.target.value);});
syncSizes();
$('dimensions').onsubmit=e=>e.preventDefault();
$('history-open').onclick=showRecords;
function cubeIcon(mode){
 const basis=pose(mode===0?3:mode),vertices=[];for(const x of [-1,1])for(const y of [-1,1])for(const z of [-1,1])vertices.push([x,y,z]);
 let paths='';vertices.forEach((v,i)=>vertices.forEach((w,j)=>{if(j<=i||v.filter((n,k)=>n!==w[k]).length!==1)return;
 const fixed=[0,1,2].filter(k=>v[k]===w[k]);const visible=fixed.some(k=>basis[2][k]*v[k]>.0001);if(!visible)return;
 const p=a=>[24+M.dot(basis[0],a)*12,24-M.dot(basis[1],a)*12];const a=p(v),b=p(w);paths+=`<path d="M${a.join(' ')}L${b.join(' ')}"/>`;
 }));
 return `<svg viewBox="0 0 48 48" aria-hidden="true">${paths}${mode===0?'<path d="M6 42L42 6" stroke-width="3"/>':''}</svg>`;
}
$('timer-control').onclick=()=>{if(busy())return;const box=document.createElement('div');box.className='dialog-actions';
 const toggle=document.createElement('button');toggle.textContent=running?'暂停':currentRun.phase==='running'?'继续':'开始';
 toggle.onclick=()=>{if(currentRun.phase==='running')running=!running;else{if(currentRun.phase!=='ready'){save();currentRun=newRun();initialState=boardState();elapsed=0;}currentRun.phase='running';currentRun.recorded=true;running=true;}lastTick=performance.now();$('modal').close();save();};
 const clear=document.createElement('button');clear.textContent='清零';clear.onclick=()=>{save();currentRun=newRun();initialState=boardState();elapsed=0;running=false;$('modal').close();save();};box.append(toggle,clear);openDialog('计时',box);
};
function layoutHelp(){
 for(const note of $('help-overlay').querySelectorAll('[data-for]')){
  const target=$(note.dataset.for).getBoundingClientRect();
  Object.assign(note.style,{left:target.left+'px',top:target.top+'px',width:target.width+'px',height:target.height+'px'});
 }
}
$('help').onclick=()=>{cancelDrag();pinch=null;pointers.clear();snap=null;controls();$('help-overlay').showModal();layoutHelp();$('help-overlay').focus();};
$('help-overlay').onclick=e=>{e.stopPropagation();$('help-overlay').close();};
$('help-overlay').addEventListener('close',()=>{lastTick=performance.now();$('help').focus();});
window.addEventListener('resize',()=>{if($('help-overlay').open)layoutHelp();});
document.addEventListener('visibilitychange',()=>{if(document.hidden){cancelDrag();pinch=null;pointers.clear();controls();save();}lastTick=performance.now();});
window.addEventListener('pagehide',save);
function frame(now){
 if(running&&!document.hidden&&!$('modal').open&&!$('help-overlay').open)elapsed+=now-lastTick;lastTick=now;
 const ms=Math.floor(elapsed);$('timer').textContent=String(Math.floor(ms/60000)).padStart(2,'0')+':'+String(Math.floor(ms/1000)%60).padStart(2,'0');$('ms').textContent='.'+String(ms%1000).padStart(3,'0');
 if(animation){const a=animation,t=a.duration?Math.min(1,(now-a.start)/a.duration):1;a.angle=turnAnimationAngle(a,t);dirty=true;if(t===1)finishTurn(a);}
 if(snap){const t=Math.min(1,(now-snap.start)/240),e=t*t*(3-2*t),rows=snap.from.map((r,i)=>r.map((v,j)=>v+(snap.to[i][j]-v)*e));camera=[normalize(rows[0]),null,null];camera[2]=normalize(M.cross(camera[0],rows[1]));camera[1]=M.cross(camera[2],camera[0]);dirty=true;if(t===1){camera=snap.to;snap=null;save();}}
 if(dirty)render();if(now-saveAt>2000){saveAt=now;if(running)save();}requestAnimationFrame(frame);
}
themeUpdate();controls();resize();requestAnimationFrame(frame);
