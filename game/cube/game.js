'use strict';
const M=Cuboid,$=id=>document.getElementById(id),canvas=$('puzzle'),gl=canvas.getContext('webgl',{antialias:true,alpha:true});
const P=PolyPuzzle,STICKER_INSET=1.6;
let puzzleType='cuboid',order=3;
const typeNames={cuboid:'长方体魔方',pyraminx:'金字塔魔方',skewb:'斜转魔方',megaminx:'五魔方',sq1:'SQ-1',octahedron:'八面体魔方',icosahedron:'二十面体魔方',gear:'齿轮魔方'};
function createPuzzle(){return puzzleType==='cuboid'?M.create(size):P.create(puzzleType,order);}
function turnStep(axis){return puzzleType==='cuboid'?M.step(size,axis):P.step(puzzleType,order,axis);}
function applyTurn(target,axis,layer,dir){if(puzzleType==='cuboid')M.turn(target,size,axis,layer,dir);else P.turn(target,puzzleType,order,axis,layer,dir);}
function isSolved(){return puzzleType==='cuboid'?M.solved(pieces):P.solved(pieces,puzzleType,order);}
const KEY='cuboid.session.v1',colors=['#f1d64e','#f3f1e9','#548bd4','#549d70','#ef9142','#df4e55','#a979ce','#55c4c4','#eaa6c3','#b1cb67','#927454','#a1b8de','#d84fa3','#258880','#8b67dd','#f4b947','#abc5ec','#a24636','#b9d4a0','#e8b49a'];
let size=[3,3,3],pieces=M.create(size),moves=[],cursor=0,align=3,zoom=1,theme='day',dim=false;
let camera=pose(3),width=1,height=1,scale=1,polygons=[],dirty=true,drag=null,animation=null,snap=null;
let elapsed=0,running=false,lastTick=performance.now(),saveAt=0,toastTimer;
const pointers=new Map();
let pinch=null;
function pose(mode){
 const yaw=mode===3?Math.PI/4:0,pitch=mode===3?Math.atan(1/Math.sqrt(2)):mode===2?Math.atan(.5):0;
 return M.axes.map(v=>M.rotate(M.rotate(v,0,-pitch),1,yaw));
}
function multiply(a,b){return a.map(row=>[0,1,2].map(j=>row.reduce((sum,x,k)=>sum+x*b[k][j],0)));}
function view(v){return camera.map(row=>M.dot(row,v));}
function cameraDistance(){return (puzzleType==='cuboid'?Math.hypot(...size):5)*1.8;}
function project(v){const q=view(v),perspective=cameraDistance()/(cameraDistance()-q[2]);return [width/2+q[0]*scale*perspective,height/2-q[1]*scale*perspective,q[2]];}
function toast(message){$('toast').textContent=message;$('toast').classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('visible'),2400);$('status').textContent=message;}
function busy(){return !!animation||!!drag||!!pinch;}
function controls(){ $('undo').disabled=busy()||cursor===0;$('redo').disabled=busy()||cursor===moves.length; }
function save(){
 try{localStorage.setItem(KEY,JSON.stringify({geometryVersion:3,pyraminxLayers:true,puzzleType,order,size,moves,cursor,camera,align,zoom,theme,dim,elapsed,running}));}catch{toast('无法保存进度：浏览器存储不可用');}
}
function restore(shared){
 try{
  const s=shared||JSON.parse(localStorage.getItem(KEY));if(!s)return;
  if(!M.validSize(s.size)||!Array.isArray(s.moves)||s.moves.length>100000||!Number.isInteger(s.cursor)||s.cursor<0||s.cursor>s.moves.length)throw Error();
  const nextType=s.puzzleType||'cuboid',legacySkewb=nextType==='skewb'&&(s.geometryVersion??1)<3,nextOrder=legacySkewb?(s.order??3)-1:(s.order??3);
  if(nextType!=='cuboid'&&!P.valid(nextType,nextOrder))throw Error();
  if((s.geometryVersion??1)>3)throw Error();
  if(legacySkewb&&nextOrder>2&&s.moves.length){
   if(shared){toast('旧版高阶斜转分享包含过顶点切割，无法载入新模型');return;}
   localStorage.setItem(KEY+'.skewb-vertex-cut-backup',JSON.stringify(s));
   s.moves=[];s.cursor=0;s.elapsed=0;s.running=false;
   toast('斜转已取消过顶点切割，旧局面已备份并复原');
  }
  if(nextType==='icosahedron'&&(s.geometryVersion??1)<2&&s.moves.length){
   if(shared){toast('旧版二十面体分享使用转面规则，无法载入转角模型');return;}
   localStorage.setItem(KEY+'.icosahedron-face-backup',JSON.stringify(s));
   s.moves=[];s.cursor=0;s.elapsed=0;s.running=false;
   toast('二十面体已更新为转角，旧转面局面已备份并复原');
  }
  // Legacy pyramid moves rotated every slice between the cut and the tip.
  // Expand them into disjoint slices to preserve the saved position and redo.
  if(nextType==='pyraminx'&&!s.pyraminxLayers){
   const expanded=[];let expandedCursor=0;
   s.moves.forEach((move,i)=>{
    if(!Array.isArray(move)||move.length!==3)throw Error();
    const [a,l,d]=move;
    if(!Number.isInteger(a)||a<0||a>=4||!Number.isInteger(l)||l<0||l>=nextOrder-1||![-1,1].includes(d))throw Error();
    for(let slice=l;slice<nextOrder-1;slice++)expanded.push([a,slice,d]);
    if(i<s.cursor)expandedCursor=expanded.length;
   });
   s.moves=expanded;s.cursor=expandedCursor;
  }
  const restored=nextType==='cuboid'?M.create(s.size):P.create(nextType,nextOrder);
  const replay=(a,l,d)=>{if(nextType==='cuboid')M.turn(restored,s.size,a,l,d);else P.turn(restored,nextType,nextOrder,a,l,d);};
  for(const move of s.moves){if(!Array.isArray(move)||move.length!==3)throw Error();replay(...move);}
  for(let i=s.moves.length-1;i>=s.cursor;i--){const [a,l,d]=s.moves[i];replay(a,l,-d);}
  puzzleType=nextType;order=nextOrder;size=s.size;pieces=restored;moves=s.moves;cursor=s.cursor;
  if(Array.isArray(s.camera)&&s.camera.length===3&&s.camera.every(r=>Array.isArray(r)&&r.length===3&&r.every(Number.isFinite)&&Math.abs(M.dot(r,r)-1)<.001)&&Math.abs(M.dot(M.cross(s.camera[0],s.camera[1]),s.camera[2])-1)<.001)camera=s.camera;
  if([0,1,2,3].includes(s.align))align=s.align;
  if(Number.isFinite(s.zoom))zoom=Math.max(.55,Math.min(1.8,s.zoom));
  theme=s.theme==='night'?'night':'day';dim=s.dim===true;elapsed=Number.isFinite(s.elapsed)?Math.max(0,s.elapsed):0;running=s.running===true;
 }catch{toast(shared?'分享链接无效，已保留本地局面':'存档无效，已使用新魔方');}
}
restore();
if(location.hash.startsWith('#cube=')){
 try{const shared=JSON.parse(decodeURIComponent(location.hash.slice(6)));if(shared.v!==1)throw Error();restore({...shared,theme,dim,running:false});}
 catch{toast('分享链接无效，已保留本地局面');}
 // Consume the import once so reload restores subsequent local progress.
 save();
 history.replaceState(null,'',location.pathname+location.search);
}
window.addEventListener('hashchange',()=>{if(location.hash.startsWith('#cube='))location.reload();});
function shareURL(){const url=new URL(location.href);url.hash='cube='+encodeURIComponent(JSON.stringify({v:1,geometryVersion:3,pyraminxLayers:true,puzzleType,order,size,moves,cursor,camera,align,zoom,elapsed}));return url.href;}

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
   if(sticker)polygon(P.insetFace(body,STICKER_INSET/scale).map(project),rgb(colors[sticker.color]),.0005);
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
 if(!align)return;
 let best=null,score=-Infinity;
 for(const candidate of alignmentCandidates(align)){
  const s=candidate.reduce((sum,row,i)=>sum+M.dot(row,camera[i]),0);
  if(s>score){score=s;best=candidate;}
 }
 snap={from:camera.map(r=>r.slice()),to:best,start:performance.now()};dirty=true;
}
function normalize(v){const length=Math.hypot(...v);return v.map(n=>n/length);}
function animateTurn(axis,layer,dir,from=0,commit=true,kind='manual'){
 const to=commit?turnStep(axis)*dir:0;
 animation={axis,layer,dir,angle:from,from,to,start:performance.now(),duration:matchMedia('(prefers-reduced-motion: reduce)').matches?0:180,commit,kind};controls();dirty=true;
}
function finishTurn(a){
 if(a.commit){
  applyTurn(pieces,a.axis,a.layer,a.dir);
  if(a.kind==='manual'){moves=moves.slice(0,cursor);moves.push([a.axis,a.layer,a.dir]);cursor++;running=true;}
  if(a.kind==='undo')cursor--;if(a.kind==='redo')cursor++;
  if(isSolved()){running=false;if(a.kind==='manual')toast('已还原');}
 }
 animation=null;controls();save();dirty=true;
}
function localPoint(e){const r=canvas.getBoundingClientRect();return [e.clientX-r.left,e.clientY-r.top];}
canvas.addEventListener('pointerdown',e=>{
 if(e.button!==0&&e.pointerType==='mouse')return;
 pointers.set(e.pointerId,localPoint(e));canvas.setPointerCapture(e.pointerId);
 if(pointers.size>1){cancelDrag();snap=null;if(pointers.size===2&&!$('modal').open)startPinch();return;}
 if(animation||$('modal').open)return;
 snap=null;if(dirty)render();const [x,y]=localPoint(e);
 drag={id:e.pointerId,x,y,lastX:x,lastY:y,hit:hitTest(x,y),turn:null,track:M.createTrajectory(),moved:false};controls();
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
 }
 if(puzzleType!=='cuboid'){updatePolyDrag();return;}
 const faceCenter=drag.hit.piece.p.map((v,i)=>v+drag.hit.normal[i]*.5);
 const choice=M.matchTrajectory(faceCenter,drag.hit.normal,camera,drag.track,cameraDistance(),drag.turn?.axis);
 drag.turn=choice?{...choice,layer:drag.hit.piece.p[choice.axis],angle:0}:null;
 if(drag.turn){
  const t=drag.turn,distance=drag.track.x*t.tangent[0]+drag.track.y*t.tangent[1];
  t.angle=Math.max(-1,Math.min(1,distance/Math.max(70,Math.min(width,height)*.22)))*turnStep(t.axis);
 }
 dirty=true;
}
function cancelDrag(){if(drag?.turn){const t=drag.turn;animateTurn(t.axis,t.layer,1,t.angle,false);}drag=null;controls();dirty=true;}
function release(e,cancelled){
 pointers.delete(e.pointerId);if(pinch){if(pointers.size>=2)startPinch();else{pinch=null;save();controls();}return;}if(!drag||drag.id!==e.pointerId)return;
 if(cancelled){cancelDrag();return;}
 if(drag.hit&&e.type==='pointerup')updatePuzzleDrag(e);
 const d=drag;drag=null;
 if(d.turn){const t=d.turn;animateTurn(t.axis,t.layer,t.angle<0?-1:1,t.angle,Math.abs(t.angle)>turnStep(t.axis)*.16);}
 else if(!d.hit&&d.moved){snapView();save();}
 controls();
}
canvas.addEventListener('pointerup',e=>release(e,false));canvas.addEventListener('pointercancel',e=>release(e,true));canvas.addEventListener('lostpointercapture',e=>{if(pointers.has(e.pointerId))release(e,true);});
canvas.addEventListener('wheel',e=>{e.preventDefault();if(busy())return;zoom=Math.max(.55,Math.min(1.8,zoom*Math.exp(-e.deltaY*.001)));dirty=true;save();},{passive:false});
$('undo').onclick=()=>{if(busy()||!cursor)return;const [a,l,d]=moves[cursor-1];animateTurn(a,l,-d,0,true,'undo');};
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
$('menu').onclick=()=>{if(animation)return;syncSizes();openDialog('菜单');};
$('close').onclick=()=>$('modal').close();
$('modal').addEventListener('click',e=>{if(e.target===$('modal')){const r=$('modal').getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)$('modal').close();}});
$('modal').addEventListener('close',()=>{lastTick=performance.now();save();});
function confirmAction(title,message,action){
 const box=document.createElement('div'),p=document.createElement('p'),buttons=document.createElement('div');p.textContent=message;buttons.className='dialog-actions';
 for(const [label,fn]of [['取消',()=>$('modal').close()],['确认',()=>{action();$('modal').close();}]]){const b=document.createElement('button');b.textContent=label;b.onclick=fn;buttons.append(b);}
 box.append(p,buttons);openDialog(title,box);
}
function reset(next=size){size=next.slice();pieces=createPuzzle();moves=[];cursor=0;animation=null;drag=null;elapsed=0;running=false;controls();dirty=true;syncSizes();save();}
$('reset').onclick=()=>{if(!busy())confirmAction('复原','复原当前魔方并清零计时？',()=>reset());};
$('shuffle').onclick=()=>{if(busy())return;confirmAction('打乱','打乱当前魔方并清零计时？',()=>{
 reset();
 if(puzzleType!=='cuboid'){let previous='';for(let i=0;i<60;i++){let choices=P.legalMoves(pieces,puzzleType,order).filter(m=>m.join()!==previous);if(!choices.length)choices=P.legalMoves(pieces,puzzleType,order);const [a,l]=choices[Math.floor(Math.random()*choices.length)],d=Math.random()<.5?-1:1;applyTurn(pieces,a,l,d);moves.push([a,l,d]);previous=[a,l].join();}cursor=moves.length;controls();dirty=true;save();return;}
 let previous=-1;
 for(let i=0;i<60;i++){let axis;do{axis=Math.floor(Math.random()*3);}while(axis===previous);previous=axis;const layer=Math.floor(Math.random()*size[axis])-(size[axis]-1)/2,dir=Math.random()<.5?-1:1;M.turn(pieces,size,axis,layer,dir);moves.push([axis,layer,dir]);}
 cursor=moves.length;controls();dirty=true;save();
 });};
function syncSizes(){syncTypeUI();['x','y','z'].forEach((a,i)=>{const group=$('size-'+a);group.querySelector(`input[value="${size[i]}"]`).checked=true;group.style.setProperty('--index',size[i]-1);});}
for(const a of ['x','y','z'])$('size-'+a).addEventListener('change',e=>{$('size-'+a).style.setProperty('--index',Number(e.target.value)-1);});
syncSizes();
$('dimensions').onsubmit=e=>{e.preventDefault();if(puzzleType!=='cuboid'){const next=Number($('order-track').querySelector('input:checked').value);confirmAction('应用阶数',`将${typeNames[puzzleType]}设为 ${next} 阶并复原？`,()=>{order=next;reset();});return;}const next=['x','y','z'].map(a=>Number($('size-'+a).querySelector('input:checked').value));if(M.validSize(next))confirmAction('应用尺寸',`将魔方设为 ${next.join(' × ')} 并复原？`,()=>reset(next));};
function cubeIcon(mode){
 const basis=pose(mode===0?3:mode),vertices=[];for(const x of [-1,1])for(const y of [-1,1])for(const z of [-1,1])vertices.push([x,y,z]);
 let paths='';vertices.forEach((v,i)=>vertices.forEach((w,j)=>{if(j<=i||v.filter((n,k)=>n!==w[k]).length!==1)return;
 const fixed=[0,1,2].filter(k=>v[k]===w[k]);const visible=fixed.some(k=>basis[2][k]*v[k]>.0001);if(!visible)return;
 const p=a=>[24+M.dot(basis[0],a)*12,24-M.dot(basis[1],a)*12];const a=p(v),b=p(w);paths+=`<path d="M${a.join(' ')}L${b.join(' ')}"/>`;
 }));
 return `<svg viewBox="0 0 48 48" aria-hidden="true">${paths}${mode===0?'<path d="M6 42L42 6" stroke-width="3"/>':''}</svg>`;
}
$('timer-control').onclick=()=>{if(busy())return;const box=document.createElement('div');box.className='dialog-actions';for(const label of [running?'暂停':'开始','清零']){const b=document.createElement('button');b.textContent=label;b.onclick=()=>{if(label==='清零'){elapsed=0;running=false;}else running=!running;$('modal').close();save();};box.append(b);}openDialog('计时',box);};
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
 if(animation){const a=animation,t=a.duration?Math.min(1,(now-a.start)/a.duration):1;a.angle=a.from+(a.to-a.from)*(1-(1-t)**3);dirty=true;if(t===1)finishTurn(a);}
 if(snap){const t=Math.min(1,(now-snap.start)/240),e=t*t*(3-2*t),rows=snap.from.map((r,i)=>r.map((v,j)=>v+(snap.to[i][j]-v)*e));camera=[normalize(rows[0]),null,null];camera[2]=normalize(M.cross(camera[0],rows[1]));camera[1]=M.cross(camera[2],camera[0]);dirty=true;if(t===1){camera=snap.to;snap=null;save();}}
 if(dirty)render();if(now-saveAt>2000){saveAt=now;if(running)save();}requestAnimationFrame(frame);
}
themeUpdate();controls();resize();requestAnimationFrame(frame);
