'use strict';
const M=Pentafish,$=id=>document.getElementById(id),canvas=$('puzzle'),gl=canvas.getContext('webgl',{antialias:true,alpha:true});
const S=PentafishSession,clock=new S.Stopwatch();
const INPUT_MODE_KEY='pentafish.input-mode.v1';
let inputMode='gestures',autoCenter=true,angleAlign=true;
const VIEW_OPTIONS_KEY='pentafish.view-options.v1';
const STORAGE_KEY='pentafish.sessions.v1',THEME_KEY='pentafish.theme.v1';
let records=[],currentRun=null,saveTimer=null,toastTimer=null,storageWarning=false;
const SCRAMBLE_STEPS=60, SCRAMBLE_TURN_MS=40, MANUAL_TURN_MS=230, QUEUED_TURN_MS=90;
const colors=['#f3f0e9','#6c97de','#f1db54','#efaa65','#a5d878','#59ac7e','#8b6ac3','#ed5557','#71d5e4','#b4b8c1','#ec71bc','#dce876'];

let shape='irregular',pieces=M.create(shape),history=[],selected=null,animation=null,queue=[],polygons=[],width=1,height=1,zoom=1;
let undoSteps=[],redoSteps=[],viewStepStart=null,viewStepAction=null;
function copyView(){return {camera:camera.map(row=>row.slice()),selected};}
function recordStep(step){undoSteps.push(step);redoSteps=[];updateUndoControls();}
function updateUndoControls(){
 const busy=!!animation||!!queue.length||!!viewAnimation||!!dragPreview;
 $('undo').disabled=busy||!undoSteps.length;$('redo').disabled=busy||!redoSteps.length;
}
function stopViewAnimation(){
 if(viewStepAction)viewStepAction.after=copyView();
 viewStepAction=null;viewAnimation=null;
}
function beginViewStep(){if(angleAlign&&!viewStepStart)viewStepStart=copyView();}
function recordViewStep(target){
 if(!viewStepStart)return;
 const before=viewStepStart;viewStepStart=null;
 if(before.camera.flat().every((v,i)=>Math.abs(v-target.flat()[i])<1e-7))return;
 const after={camera:target.map(row=>row.slice()),selected:autoCenter?frontFace().axis:selected};
 const action={type:'view',before,after};recordStep(action);viewStepAction=action;
}
function clearSteps(){undoSteps=[];redoSteps=[];viewStepStart=null;viewStepAction=null;}
function replayStep(redo){
 if(animation||queue.length||viewAnimation||dragPreview||pointers.size)return;
 const from=redo?redoSteps:undoSteps,to=redo?undoSteps:redoSteps,step=from.at(-1);
 if(!step)return;
 if(step.type==='turn'){
  const dir=redo?step.dir:-step.dir;
  if(!M.turn(pieces,step.axis,dir))return;
  history.push([step.axis,dir]);selected=step.axis;updateAutoCenter();
  if(M.isSolved(pieces,shape)){clock.stop();currentRun.status='solved';}
  else{currentRun.status='running';clock.start();}
 }else{
  const state=redo?step.after:step.before;
  selected=state.selected;animateView(state.camera.map(row=>row.slice()));
 }
 from.pop();to.push(step);update();save();
}
$('undo').onclick=()=>replayStep(false);$('redo').onclick=()=>replayStep(true);
// Center blocks belong to exactly one turning layer; edges and corners do not.
const initialLayers=M.axes.map((_,i)=>new Set(M.layer(pieces,i)));
const centerIds=initialLayers.map((layer,i)=>[...layer].find(id=>initialLayers.every((other,j)=>i===j||!other.has(id))));
let camera,dirty=true,viewAnimation=null;
function home(){camera=[[1,0,0],[0,1,0],[0,0,1]].map(v=>M.rotate(M.rotate(M.rotate(v,[1,0,0],-.16),[0,1,0],.10),[0,0,1],-Math.PI/5));zoom=1;dirty=true;}
home();
function view(v){return camera.map(row=>M.dot(row,v));}
function project(v){const q=view(v),s=Math.min(width,height)*.34*zoom;return [width/2+q[0]*s,height/2-q[1]*s,q[2]];}
function orbit(dx,dy){
 stopViewAnimation();beginViewStep();
 // Rotate the camera basis about its own screen axes, in the opposite sense
 // to the object: a front-facing point then follows the finger in both axes.
 const up=camera[1];camera=camera.map(v=>M.rotate(v,up,-dx*.006));
 const right=camera[0];camera=camera.map(v=>M.rotate(v,right,-dy*.006));dirty=true;updateAutoCenter();scheduleSave();
}
// Depth testing is necessary: average-depth painter sorting breaks on long slanted pieces.
if(!gl){$('status').textContent='无法启动 3D 显示，请使用支持 WebGL 的浏览器';document.querySelectorAll('button,select').forEach(el=>el.disabled=true);throw new Error('WebGL unavailable');}
function shader(type,source){const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s;}
const program=gl.createProgram();
gl.attachShader(program,shader(gl.VERTEX_SHADER,'attribute vec3 position; attribute vec3 color; varying vec3 tint; void main(){gl_Position=vec4(position,1.);tint=color;}'));
gl.attachShader(program,shader(gl.FRAGMENT_SHADER,'precision mediump float; varying vec3 tint; uniform float brightness; void main(){gl_FragColor=vec4(tint*brightness,1.);}'));
gl.bindAttribLocation(program,0,'position');gl.bindAttribLocation(program,1,'color');gl.linkProgram(program);gl.useProgram(program);
const buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
for(const [name,offset] of [['position',0],['color',12]]){const loc=gl.getAttribLocation(program,name);gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,3,gl.FLOAT,false,24,offset);}
// A separate mask outlines the selected face or the full turning layer.
// Taking its screen-space silhouette excludes sticker seams and shared edges.
const maskTexture=gl.createTexture(),maskFramebuffer=gl.createFramebuffer();
gl.bindTexture(gl.TEXTURE_2D,maskTexture);
gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);
gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);
gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);
gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
gl.bindFramebuffer(gl.FRAMEBUFFER,maskFramebuffer);
gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,maskTexture,0);
gl.bindFramebuffer(gl.FRAMEBUFFER,null);
const outlineProgram=gl.createProgram();
gl.attachShader(outlineProgram,shader(gl.VERTEX_SHADER,'attribute vec2 position; varying vec2 uv; void main(){uv=position*.5+.5;gl_Position=vec4(position,0.,1.);}'));
gl.attachShader(outlineProgram,shader(gl.FRAGMENT_SHADER,`precision mediump float;
 varying vec2 uv; uniform sampler2D mask; uniform vec2 pixel; uniform float dim;
 void main(){
  if(texture2D(mask,uv).a>.5)discard;
  float inner=0.,band=0.,outer=0.;
  // Three concentric strokes, measured in CSS pixels, remain legible over
  // both bright stickers and dark gaps without changing the selected area.
  for(int i=0;i<12;i++){
   float angle=float(i)*.5235987756;
   vec2 ray=vec2(cos(angle),sin(angle))*pixel;
   inner=max(inner,texture2D(mask,uv+ray*1.3).a);
   band=max(band,texture2D(mask,uv+ray*4.5).a);
   outer=max(outer,texture2D(mask,uv+ray*6.).a);
  }
  if(max(max(inner,band),outer)<.5)discard;
  vec3 gold=mix(vec3(1.,.73,.08),vec3(.64,.50,.16),dim);
  vec3 rim=mix(vec3(1.,.98,.85),vec3(.80,.75,.55),dim);
  gl_FragColor=vec4(inner>.5?rim:band>.5?gold:vec3(.055,.075,.065),1.);
 }`));
gl.bindAttribLocation(outlineProgram,0,'position');gl.linkProgram(outlineProgram);
const outlineBuffer=gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER,outlineBuffer);
gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);
function bindMain(){
 gl.useProgram(program);gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
 gl.enableVertexAttribArray(0);gl.enableVertexAttribArray(1);
 gl.vertexAttribPointer(0,3,gl.FLOAT,false,24,0);gl.vertexAttribPointer(1,3,gl.FLOAT,false,24,12);
}
bindMain();
function resize(){const r=canvas.getBoundingClientRect();width=r.width;height=r.height;const d=Math.min(devicePixelRatio||1,2);canvas.width=Math.round(width*d);canvas.height=Math.round(height*d);gl.viewport(0,0,canvas.width,canvas.height);gl.bindTexture(gl.TEXTURE_2D,maskTexture);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,canvas.width,canvas.height,0,gl.RGBA,gl.UNSIGNED_BYTE,null);dirty=true;}
new ResizeObserver(resize).observe(canvas);
function draw(time){requestAnimationFrame(draw);if(!dirty&&!animation&&!viewAnimation)return;dirty=false;
 advanceViewAnimation(time);
 let theta=dragPreview?.angle||0;
 if(animation){
  const t=Math.min(1,(time-animation.start)/animation.duration);theta=(animation.fromAngle||0)+(animation.dir*M.step-(animation.fromAngle||0))*(t*t*(3-2*t));
  if(t===1){
   const completed=animation;M.turn(pieces,completed.axis,completed.dir);
   history.push([completed.axis,completed.dir]);
   if(completed.record&&completed.duration!==SCRAMBLE_TURN_MS)recordStep({type:'turn',axis:completed.axis,dir:completed.dir});
   animation=null;theta=0;
   if(queue.length)startTurn(...queue.shift());
   else if(completed.duration!==SCRAMBLE_TURN_MS&&M.isSolved(pieces,shape)){
    clock.stop();currentRun.status='solved';toast('已还原 · '+timeText(clock.elapsed()));
   }
   if(!animation)settleView();
   update();save();
  }
 }

 updateUndoControls();
 const moving=animation||dragPreview;
 const dim=document.body.dataset.theme==='dim';
 gl.uniform1f(gl.getUniformLocation(program,'brightness'),dim?.38:document.body.dataset.theme==='night'?.78:1);
 gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.enable(gl.DEPTH_TEST);polygons=[];
 const vertices=[];
 function push(p,color,projected=false){const q=projected?p:project(p);vertices.push(q[0]/width*2-1,1-q[1]/height*2,-q[2]/5,...color);}
 function polygon(ps,color,projected=false){for(let i=1;i<ps.length-1;i++){push(ps[0],color,projected);push(ps[i],color,projected);push(ps[i+1],color,projected);}}
 for(const piece of pieces)for(const face of piece.faces){const ps=face.points.map(v=>moving?.ids.has(piece.id)?M.rotate(v,M.axes[moving.axis],theta):v);const normal=M.norm(M.cross(M.sub(ps[1],ps[0]),M.sub(ps[2],ps[0])));if(view(normal)[2]<=.00001)continue;
 const screen=ps.map(project);polygons.push({points:ps,screen,normal,color:face.color,z:M.average(screen)[2],piece:piece.id});
 polygon(ps,[.11,.13,.15]);if(face.color<0)continue;
 const inset=M.insetProjected(screen,1.6).map(p=>[p[0],p[1],p[2]+.0001]);
 const n=view(normal),light=.78+.22*Math.max(0,M.dot(n,M.norm([-.3,.6,1]))),color=colors[face.color].slice(1).match(/../g).map(v=>parseInt(v,16)/255*light);polygon(inset,color,true);}
 polygons.sort((a,b)=>a.z-b.z);
 gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(vertices),gl.DYNAMIC_DRAW);gl.drawArrays(gl.TRIANGLES,0,vertices.length/6);
 // A fixed point on the turn axis is invariant under layer rotations and shell changes.
 const anchor=selected===null?null:M.axes[selected];
 const controls=$('face-controls');controls.hidden=!anchor||view(anchor)[2]<=.05;
 if(selected!==null){
  vertices.length=0;
  if(inputMode==='gestures'){
   if(shape==='regular'){
    // Keep the face perimeter stable while adjacent layers animate.
    if(view(anchor)[2]>.00001)polygon(regularFaces[selected].points,[1,1,1]);
   }else{
    // In the irregular shell, follow the surface containing the selected
    // center, rather than including the side surfaces of its turning layer.
    const center=polygons.filter(f=>f.piece===centerIds[selected]&&f.color>=0)
     .sort((a,b)=>M.dot(b.normal,anchor)-M.dot(a.normal,anchor))[0];
    if(center){
     const depth=M.dot(center.normal,center.points[0]);
     for(const f of polygons)if(f.color>=0&&M.dot(f.normal,center.normal)>1-1e-6&&
      f.points.every(p=>Math.abs(M.dot(center.normal,p)-depth)<1e-6))polygon(f.points,[1,1,1]);
    }
   }
  }else{
   const layerIds=animation?.axis===selected?animation.ids:new Set(M.layer(pieces,selected)||[]);
   for(const f of polygons)if(layerIds.has(f.piece))polygon(f.points,[1,1,1]);
  }
  gl.bindFramebuffer(gl.FRAMEBUFFER,maskFramebuffer);gl.clear(gl.COLOR_BUFFER_BIT);
  gl.disable(gl.DEPTH_TEST);
  gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(vertices),gl.DYNAMIC_DRAW);gl.drawArrays(gl.TRIANGLES,0,vertices.length/6);
  gl.bindFramebuffer(gl.FRAMEBUFFER,null);
  gl.useProgram(outlineProgram);gl.bindBuffer(gl.ARRAY_BUFFER,outlineBuffer);
  gl.disableVertexAttribArray(1);gl.vertexAttribPointer(0,2,gl.FLOAT,false,8,0);
  gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,maskTexture);
  gl.uniform1i(gl.getUniformLocation(outlineProgram,'mask'),0);
  gl.uniform2f(gl.getUniformLocation(outlineProgram,'pixel'),1/width,1/height);
  gl.uniform1f(gl.getUniformLocation(outlineProgram,'dim'),dim?1:0);
  gl.drawArrays(gl.TRIANGLES,0,6);bindMain();gl.enable(gl.DEPTH_TEST);
 }
 if(anchor){
  const p=project(anchor);
  controls.style.left=`${inputMode==='gestures'?p[0]:Math.max(84,Math.min(width-84,p[0]))}px`;
  controls.style.top=`${inputMode==='gestures'?p[1]:Math.max(84,Math.min(height-12,p[1]))}px`;
 }

}
requestAnimationFrame(draw);
function update(message){
 for(const id of ['shuffle','regular','irregular','menu'])$(id).disabled=!!animation||!!queue.length;
 updateUndoControls();
 $('status').textContent=message||(history.length?`已转动 ${history.length} 步`:'已复原');dirty=true;
}
function startTurn(axis,dir,record=true,duration=MANUAL_TURN_MS){
 if(axis===null)return false;
 if(typeof dragPreview!=='undefined'&&dragPreview)return false;
 if(animation){
  queue.push([axis,dir,record,duration===MANUAL_TURN_MS?QUEUED_TURN_MS:duration]);
  if(animation.duration>QUEUED_TURN_MS){
   const now=performance.now(),progress=Math.min(1,(now-animation.start)/animation.duration);
   animation.duration=QUEUED_TURN_MS;animation.start=now-progress*QUEUED_TURN_MS;
  }
  save();return true;
 }
 const ids=M.layer(pieces,axis);
 if(!ids?.length){queue=[];update('这一层被跨切面块阻挡');return false;}
 if(duration!==SCRAMBLE_TURN_MS){
  if(currentRun.status==='solved'){save();newRun('running');}
  currentRun.status='running';clock.start();
 }
 animation={axis,dir,record,duration,ids:new Set(ids),start:performance.now()};selected=axis;update('转动中');save();return true;
}
function select(i){selected=i;updateAutoCenter();dirty=true;save();}
$('cw').onclick=()=>startTurn(selected,-1);$('ccw').onclick=()=>startTurn(selected,1);
$('reset').onclick=()=>confirmAction('复原魔方','确定复原魔方？当前局面和撤销记录将被清空。','复原',()=>{
 clearSteps();stopViewAnimation();clearPreview();gesture=null;save();animation=null;queue=[];history=[];pieces=M.create(shape);selected=null;settleView();newRun('idle');update();save();tick();
});
function setShape(next){
 if(animation||queue.length||dragPreview||shape===next)return;
 pieces=M.reshape(pieces,next);shape=next;settleView();
 $('regular').setAttribute('aria-pressed',shape==='regular');
 $('irregular').setAttribute('aria-pressed',shape==='irregular');
 update();save();
}
$('regular').onclick=()=>setShape('regular');
$('irregular').onclick=()=>setShape('irregular');
$('shuffle').onclick=()=>{if(animation||dragPreview)return;confirmAction('打乱魔方','确定打乱魔方？将重新打乱并清空撤销记录。','打乱',()=>{if(animation||dragPreview)return;clearSteps();stopViewAnimation();save();newRun('ready');tick();let previous=-1;for(let i=0;i<SCRAMBLE_STEPS;i++){let a;do{a=Math.floor(Math.random()*12);}while(a===previous);previous=a;queue.push([a,Math.random()<.5?-1:1,true,SCRAMBLE_TURN_MS]);}startTurn(...queue.shift());});};
function inside(p,vs){let hit=false;for(let i=0,j=vs.length-1;i<vs.length;j=i++){const a=vs[i],b=vs[j];if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])hit=!hit;}return hit;}
function pick(p){let nearest=null,depth=-Infinity;const s=Math.min(width,height)*.34*zoom,x=(p[0]-width/2)/s,y=(height/2-p[1])/s;
 for(const f of polygons){if(!inside(p,f.screen))continue;const n=view(f.normal),v=view(f.points[0]),z=(M.dot(n,v)-n[0]*x-n[1]*y)/n[2];if(z<=depth)continue;depth=z;nearest=f;}
 if(!nearest||nearest.color<0)return null;const axis=centerIds.indexOf(nearest.piece);return axis<0?null:axis;}

// The regular shell stays fixed after every complete turn, even when scrambled.
const regularFaces=M.shell(M.axes);
// Resolve the frontmost rendered surface, including dark seams and side faces.
function visiblePiece(p){
 let piece=null,depth=-Infinity;
 for(const f of polygons){
  if(!inside(p,f.screen))continue;
  const [a,b,c]=f.screen,n=M.cross(M.sub(b,a),M.sub(c,a));
  if(Math.abs(n[2])<1e-9)continue;
  const z=a[2]-(n[0]*(p[0]-a[0])+n[1]*(p[1]-a[1]))/n[2];
  if(z>depth){depth=z;piece=f.piece;}
 }
 return piece;
}
function boundaryPiece(p){
 if(inputMode!=='gestures'||selected===null)return null;
 const piece=visiblePiece(p);
 return piece!==centerIds[selected]&&(M.layer(pieces,selected)||[]).includes(piece)?piece:null;
}
// Match the selected surface even when turning is temporarily unavailable.
function onSelectedFace(p){
 if(inputMode!=='gestures'||selected===null)return false;
 if(boundaryPiece(p)!==null)return true;
 const anchor=M.axes[selected];
 if(shape==='regular')return view(anchor)[2]>.00001&&inside(p,regularFaces[selected].points.map(project));
 const center=polygons.filter(f=>f.piece===centerIds[selected]&&f.color>=0)
  .sort((a,b)=>M.dot(b.normal,anchor)-M.dot(a.normal,anchor))[0];
 if(!center)return false;
 const depth=M.dot(center.normal,center.points[0]);
 return polygons.some(f=>f.color>=0&&M.dot(f.normal,center.normal)>1-1e-6&&
  f.points.every(v=>Math.abs(M.dot(center.normal,v)-depth)<1e-6)&&inside(p,f.screen));
}
function edgeCandidates(p){
 if(inputMode!=='gestures'||shape!=='regular'||selected===null||animation||queue.length||view(M.axes[selected])[2]<=.05)return [];
 const face=regularFaces[selected],screen=face.points.map(project),piece=boundaryPiece(p);
 if(piece===null&&!inside(p,screen))return [];
 const candidates=[];
 for(let i=0;i<face.points.length;i++){
  const a=face.points[i],b=face.points[(i+1)%face.points.length],u=screen[i],v=screen[(i+1)%screen.length];
  const dx=v[0]-u[0],dy=v[1]-u[1],length=Math.hypot(dx,dy);
  if(length<1)continue;
  const distance=Math.abs(dx*(p[1]-u[1])-dy*(p[0]-u[0]))/length;
  const axis=M.axes.findIndex((n,j)=>j!==selected&&Math.abs(M.dot(n,a)-1)<1e-6&&Math.abs(M.dot(n,b)-1)<1e-6);
  if(axis<0)continue;
  // Extend the edge/corner band inward by 15% for easier starts near seams.
  // Keep it inside the selected face; center-block gestures retain priority.
  const region=[],n=M.axes[axis],hitDepth=M.regularDepth-(1-M.regularDepth)*.15;
  for(let j=0;j<face.points.length;j++){
   const from=face.points[j],to=face.points[(j+1)%face.points.length];
   const df=M.dot(n,from)-hitDepth,dt=M.dot(n,to)-hitDepth;
   if(df>=0)region.push(from);
   if((df>=0)!==(dt>=0))region.push(M.add(from,M.mul(M.sub(to,from),df/(df-dt))));
  }
  if(piece!==null?!(M.layer(pieces,axis)||[]).includes(piece):!inside(p,region.map(project)))continue;
  const velocity=view(M.cross(M.axes[axis],M.average([a,b])));
  candidates.push({axis,distance,tangent:[dx/length,dy/length],velocity:[velocity[0],-velocity[1]]});
 }
 return candidates.sort((a,b)=>a.distance-b.distance);
}
function edgeTurn(candidates,dx,dy){
 const length=Math.hypot(dx,dy);
 if(length<12)return null;
 const edge=candidates.find(e=>Math.abs(dx*e.tangent[0]+dy*e.tangent[1])>=length*.88);
 return edge?{axis:edge.axis,dir:dx*edge.velocity[0]+dy*edge.velocity[1]>0?1:-1}:null;
}

function centerTurn(axis,start,dx,dy){
 const center=project(M.axes[axis]),rx=start[0]-center[0],ry=start[1]-center[1];
 const sweep=rx*dy-ry*dx;
 // A stroke through the axis has no angular direction; use its dominant
 // screen direction so a swipe starting at the exact center still works.
 const clockwise=Math.abs(sweep)>Math.hypot(dx,dy)*3?sweep>0:Math.abs(dx)>=Math.abs(dy)?dx>0:dy>0;
 return {axis,dir:clockwise?-1:1};
}

const pointers=new Map();let gesture=null,pinch=null,dragPreview=null;
function previewTurn(dx,dy){
 if(!gesture.direction){
  const length=Math.hypot(dx,dy);
  gesture.direction=[dx/length,dy/length];
  gesture.initialDir=gesture.turn.dir;
 }
 const travel=dx*gesture.direction[0]+dy*gesture.direction[1];
 const angle=Math.max(-M.step,Math.min(M.step,travel/90*M.step*gesture.initialDir));
 dragPreview={axis:gesture.turn.axis,ids:dragPreview?.ids||new Set(M.layer(pieces,gesture.turn.axis)||[]),angle};
 gesture.turn.dir=angle<0?-1:1;dirty=true;
}
function clearPreview(){dragPreview=null;dirty=true;}

function pos(e){const r=canvas.getBoundingClientRect();return [e.clientX-r.left,e.clientY-r.top];}
function pair(){const [a,b]=[...pointers.values()];return {distance:Math.hypot(a[0]-b[0],a[1]-b[1]),center:[(a[0]+b[0])/2,(a[1]+b[1])/2]};}
canvas.onpointerdown=e=>{if(e.button!==0)return;stopViewAnimation();canvas.setPointerCapture(e.pointerId);const p=pos(e);pointers.set(e.pointerId,p);if(pointers.size===1){gesture={start:p,last:p,moved:false,multi:false,blockOrbit:onSelectedFace(p),edges:edgeCandidates(p),center:inputMode==='gestures'&&!animation&&!queue.length?pick(p):null,turn:null,orbit:false,selected};}else{gesture.multi=true;gesture.blockOrbit ||= onSelectedFace(p);clearPreview();pinch=pair();}};
canvas.onpointermove=e=>{if(!pointers.has(e.pointerId))return;const p=pos(e);pointers.set(e.pointerId,p);if(pointers.size>=2){const q=pair();if(pinch){zoom=Math.max(.55,Math.min(1.8,zoom*q.distance/Math.max(1,pinch.distance)));if(!gesture.blockOrbit)orbit(q.center[0]-pinch.center[0],q.center[1]-pinch.center[1]);}pinch=q;dirty=true;return;}if(!gesture||gesture.multi)return;
 const dx=p[0]-gesture.start[0],dy=p[1]-gesture.start[1],distance=Math.hypot(dx,dy);
 if(distance>7)gesture.moved=true;
 if(gesture.turn){previewTurn(dx,dy);return;}
 if(!gesture.orbit&&gesture.center!==null){
  if(distance<12)return;
  gesture.turn=centerTurn(gesture.center,gesture.start,dx,dy);previewTurn(dx,dy);return;
 }
 if(!gesture.orbit&&gesture.edges.length){
  if(distance<12)return;
  gesture.turn=edgeTurn(gesture.edges,dx,dy);
  if(gesture.turn){previewTurn(dx,dy);return;}
 }
 if(gesture.moved&&!gesture.blockOrbit){gesture.orbit=true;orbit(p[0]-gesture.last[0],p[1]-gesture.last[1]);}gesture.last=p;};
function release(e,cancel=false){if(!pointers.has(e.pointerId))return;const p=pos(e);pointers.delete(e.pointerId);
 if(!cancel&&gesture&&!gesture.multi){
  if(gesture.turn){
   previewTurn(p[0]-gesture.start[0],p[1]-gesture.start[1]);
   const angle=dragPreview.angle;clearPreview();
   if(Math.abs(angle)>M.step*7/90){
    if(startTurn(gesture.turn.axis,gesture.turn.dir)&&animation){
     animation.fromAngle=angle;
     animation.duration=Math.max(60,MANUAL_TURN_MS*(1-Math.abs(angle)/M.step));
    }
    select(gesture.center!==null?gesture.turn.axis:gesture.selected);
   }
  }
  else if(!gesture.moved&&!animation)select(pick(p));
 }
 if(cancel)clearPreview();
 if(!pointers.size){const movedView=gesture?.orbit||(gesture?.multi&&!gesture.blockOrbit);clearPreview();gesture=null;pinch=null;if(movedView)settleView();save();}}
canvas.onpointerup=e=>release(e);canvas.onpointercancel=e=>release(e,true);canvas.onlostpointercapture=e=>release(e,true);
canvas.addEventListener('wheel',e=>{e.preventDefault();zoom=Math.max(.55,Math.min(1.8,zoom*Math.exp(-e.deltaY*.001)));dirty=true;scheduleSave();},{passive:false});
function captureGameKey(e){
 if(e.isComposing||e.ctrlKey||e.metaKey||e.altKey||$('modal').open||
    e.target?.closest?.('input,textarea,select,[contenteditable]:not([contenteditable="false"]),[role="textbox"]'))return;
 const key=e.key.toLowerCase();
 const directions={arrowleft:[-12,0],arrowright:[12,0],arrowup:[0,-12],arrowdown:[0,12]};
 if(!directions[key]&&key!=='a'&&key!=='d')return;
 // Capture before focused controls receive either event. Do not move focus.
 e.preventDefault();e.stopImmediatePropagation();
 if(e.type!=='keydown'){if(directions[key])settleView();return;}
 if(directions[key])orbit(...directions[key]);
 else startTurn(selected,key==='a'?1:-1);
}
window.addEventListener('keydown',captureGameKey,{capture:true,passive:false});
window.addEventListener('keyup',captureGameKey,{capture:true,passive:false});

function timeText(ms){const n=Math.floor(ms/1000);return `${String(Math.floor(n/60)).padStart(2,'0')}:${String(n%60).padStart(2,'0')}.${String(Math.floor(ms%1000)).padStart(3,'0')}`;}
function tick(){const [main,fraction]=timeText(clock.elapsed()).split('.');$('timer').textContent=main;$('ms').textContent='.'+fraction;}
function toast(message){$('toast').textContent=message;$('toast').classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('visible'),3200);}
function newRun(status){clock.reset();currentRun={id:globalThis.crypto?.randomUUID?.()||`${Date.now()}-${Math.random()}`,created:Date.now(),status};}
function snapshot(){
 const waiting=[...(animation?[[animation.axis,animation.dir,true,animation.duration]]:[]),...queue];
 const pending=waiting.map(([a,d])=>[a,d]);
 const fastCount=waiting.filter(move=>move[3]===SCRAMBLE_TURN_MS).length;
 return {v:1,shape,moves:S.encodeMoves(history),pending:S.encodeMoves(pending),fast:fastCount>0,fastCount,elapsed:clock.elapsed(),status:currentRun.status,camera:camera.map(v=>v.slice()),zoom,selected};
}
function remember(){
 if(!currentRun)return;
 const record={...snapshot(),id:currentRun.id,created:currentRun.created,updated:Date.now()};
 const index=records.findIndex(r=>r.id===record.id);if(index>=0)records.splice(index,1);
 records.unshift(record);records=records.slice(0,100);
}
function persist(){
 clearTimeout(saveTimer);saveTimer=null;remember();
 try{localStorage.setItem(STORAGE_KEY,JSON.stringify({v:1,current:currentRun.id,records}));}
 catch{if(!storageWarning){toast('本地存储不可用或已满，请在历史记录中导出备份');storageWarning=true;}}
}
function scheduleSave(){if(!currentRun)return;clearTimeout(saveTimer);saveTimer=setTimeout(persist,180);}
function save(){remember();scheduleSave();}
function restore(raw,{fresh=false}={}){
 const state=S.validate(raw);
 const restored=M.fromMoves(state.shape,S.decodeMoves(state.moves));
 clearSteps();animation=null;queue=[];shape=state.shape;pieces=restored;history=S.decodeMoves(state.moves);
 viewAnimation=null;camera=state.camera;zoom=state.zoom;selected=state.selected;
 if(fresh)newRun(state.status);else currentRun={id:raw.id,created:raw.created,status:state.status};
 clock.reset(state.elapsed);if(state.status==='running')clock.start();
 $('regular').setAttribute('aria-pressed',shape==='regular');$('irregular').setAttribute('aria-pressed',shape==='irregular');
 queue=S.decodeMoves(state.pending).map(([a,d],i)=>[a,d,true,i<state.fastCount?SCRAMBLE_TURN_MS:state.pending.length>1?QUEUED_TURN_MS:MANUAL_TURN_MS]);
 if(queue.length)startTurn(...queue.shift());else settleView();update();tick();save();
}
function applyTheme(value){
 document.body.dataset.theme=value;dirty=true;
 const label=value==='day'?'切换至夜间模式':'切换至日间模式';$('theme').setAttribute('aria-label',label);$('theme').title=label;$('theme').setAttribute('aria-pressed',value!=='day');
$('dim').setAttribute('aria-pressed',value==='dim');
 document.querySelector('meta[name="theme-color"]').content=getComputedStyle(document.body).getPropertyValue('--bg').trim();
 try{localStorage.setItem(THEME_KEY,value);}catch{}
}
$('theme').onclick=()=>applyTheme(document.body.dataset.theme==='day'?'night':'day');
$('dim').onclick=()=>applyTheme(document.body.dataset.theme==='dim'?'night':'dim');
function setInputMode(mode){
 inputMode=mode==='gestures'?'gestures':'buttons';dirty=true;
 $('input-mode').setAttribute('aria-pressed',inputMode==='gestures');
 $('face-controls').hidden=selected===null||view(M.axes[selected])[2]<=.05;
 $('cw').hidden=$('ccw').hidden=inputMode==='gestures';
 canvas.setAttribute('aria-label',inputMode==='gestures'?'五魔方；滑动中心块旋转面，选中面后沿边滑动旋转相邻层，其他位置拖动调整视角。':'五魔方；拖动调整视角，点击中心块选择面，使用悬浮箭头旋转。');
 try{localStorage.setItem(INPUT_MODE_KEY,inputMode);}catch{}
}
$('input-mode').onclick=()=>setInputMode(inputMode==='gestures'?'buttons':'gestures');
// Use the actual center surface in the irregular shell, including its pose.
function facingFaces(){
 return M.axes.map((axis,i)=>{
  if(shape==='regular')return {axis:i,normal:axis,points:regularFaces[i].points};
  const block=pieces.find(p=>p.id===centerIds[i]);
  const surfaces=block.faces.filter(f=>f.color>=0).map(f=>({axis:i,points:f.points,
   normal:M.norm(M.cross(M.sub(f.points[1],f.points[0]),M.sub(f.points[2],f.points[0])))}));
  return surfaces.sort((a,b)=>M.dot(b.normal,axis)-M.dot(a.normal,axis))[0];
 }).filter(Boolean);
}
function frontFace(){return facingFaces().sort((a,b)=>view(b.normal)[2]-view(a.normal)[2])[0];}
function updateAutoCenter(){
 if(!autoCenter||animation||dragPreview)return;
 const face=frontFace();
 if(face&&selected!==face.axis){selected=face.axis;dirty=true;scheduleSave();}
}
function animateView(target){
 const from=camera.map(row=>row.slice()),cross=M.cross(from[2],target[2]);
 const tilt=Math.acos(Math.max(-1,Math.min(1,M.dot(from[2],target[2]))));
 const axis=Math.hypot(...cross)>1e-8?M.norm(cross):from[0];
 const alignedUp=M.rotate(from[1],axis,tilt);
 const roll=Math.atan2(M.dot(target[2],M.cross(alignedUp,target[1])),M.dot(alignedUp,target[1]));
 if(tilt<1e-7&&Math.abs(roll)<1e-7){camera=target;viewAnimation=null;dirty=true;return;}
 viewAnimation={from,target,axis,tilt,roll,start:performance.now(),duration:280};dirty=true;
}
function advanceViewAnimation(time){
 if(!viewAnimation)return;
 const a=viewAnimation,t=Math.max(0,Math.min(1,(time-a.start)/a.duration)),ease=t*t*(3-2*t);
 camera=t===1?a.target:a.from.map(row=>M.rotate(M.rotate(row,a.axis,a.tilt*ease),a.target[2],a.roll*ease));
 if(t===1){viewAnimation=null;viewStepAction=null;scheduleSave();}
 updateAutoCenter();dirty=true;
}
function settleView(){
 if(animation||dragPreview)return;
 if(angleAlign){
  const face=frontFace();
  if(face){
   const center=M.average(face.points),normal=face.normal;
   // Pick the edge closest to screen-up, minimizing the roll needed.
   const ups=face.points.map((p,i)=>{
    const next=face.points[(i+1)%face.points.length],midpoint=M.average([p,next]);
    const outward=M.norm(M.cross(M.sub(next,p),normal));
    return M.dot(outward,M.sub(midpoint,center))>=0?outward:M.mul(outward,-1);
   });
   const up=ups.sort((a,b)=>M.dot(b,camera[1])-M.dot(a,camera[1]))[0];
   const right=M.norm(M.cross(up,normal));
   const target=[right,M.norm(M.cross(normal,right)),normal.slice()];
   recordViewStep(target);animateView(target);
  }
 }
 updateAutoCenter();scheduleSave();
}
function updateViewOptions(){
 for(const [id,on,label] of [['auto-center',autoCenter,'自动切换中心点'],['angle-align',angleAlign,'角度对齐']]){
  $(id).setAttribute('aria-pressed',on);
 }
 try{localStorage.setItem(VIEW_OPTIONS_KEY,JSON.stringify({autoCenter,angleAlign}));}catch{}
}
$('auto-center').onclick=()=>{autoCenter=!autoCenter;updateViewOptions();updateAutoCenter();save();};
$('angle-align').onclick=()=>{angleAlign=!angleAlign;if(!angleAlign){stopViewAnimation();viewStepStart=null;}else beginViewStep();updateViewOptions();settleView();save();};
function openDialog(title,menu=false){
 $('dialog-title').textContent=title;$('menu-panel').hidden=!menu;$('dialog-content').hidden=menu;
 if(!menu)$('dialog-content').replaceChildren();
 if(!$('modal').open){clock.pause('modal');$('modal').showModal();save();}
 return $('dialog-content');
}
function showTimer(){
 const box=openDialog('计时');tick();
 paragraph(box,timeText(clock.elapsed()));
 const actions=document.createElement('div');actions.className='dialog-actions';
 if(!clock.running&&clock.elapsed()===0){
  actions.append(button('开始',()=>{currentRun.status='running';clock.start();closeDialog();tick();save();}));
 }else{
  actions.append(button('清零',()=>{
   const confirmBox=openDialog('清零计时');paragraph(confirmBox,'确定将计时清零？魔方局面保持不变。');
   const confirmActions=document.createElement('div');confirmActions.className='dialog-actions';
   const cancel=button('取消',showTimer);
   confirmActions.append(cancel,button('清零',()=>{
    clock.reset();currentRun.status=history.length?'ready':'idle';tick();save();showTimer();
   }));confirmBox.append(confirmActions);cancel.focus();
  }));
 }
 box.append(actions);
}
$('timer-control').onclick=showTimer;
function confirmAction(title,message,label,action){
 const box=openDialog(title);paragraph(box,message);
 const actions=document.createElement('div');actions.className='dialog-actions';
 const cancel=button('取消',closeDialog);
 const confirm=button(label,()=>{confirm.disabled=true;closeDialog();action();});
 actions.append(cancel,confirm);box.append(actions);cancel.focus();
}
function closeDialog(){$('modal').close();}
$('modal').onclose=()=>{clock.resume('modal');save();};
let dialogOutsidePress=false;
function outsideDialog(e){
 const r=$('modal').getBoundingClientRect();
 return e.target===$('modal')&&(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom);
}
$('modal').addEventListener('pointerdown',e=>{dialogOutsidePress=outsideDialog(e);});
$('modal').addEventListener('click',e=>{
 if(dialogOutsidePress&&outsideDialog(e))closeDialog();
 dialogOutsidePress=false;
});
$('modal').addEventListener('pointercancel',()=>{dialogOutsidePress=false;});
$('close').onclick=closeDialog;
$('menu').onclick=()=>{$('fullscreen').setAttribute('aria-pressed',!!document.fullscreenElement);openDialog('菜单',true);};
document.addEventListener('fullscreenchange',()=>$('fullscreen').setAttribute('aria-pressed',!!document.fullscreenElement));
$('fullscreen').onclick=async()=>{
 try{if(document.fullscreenElement)await document.exitFullscreen();else if(document.documentElement.requestFullscreen)await document.documentElement.requestFullscreen();else throw Error();closeDialog();}
 catch{toast('此浏览器不支持全屏，可使用“添加到主屏幕”');}
};
function button(label,action){const b=document.createElement('button');b.textContent=label;b.onclick=action;return b;}
function paragraph(parent,text){const p=document.createElement('p');p.textContent=text;parent.append(p);return p;}
function share(){
 persist();const box=openDialog('分享局面');
 const url=new URL(location.href);url.hash='p='+S.encode(snapshot());
 paragraph(box,'链接包含当前局面、形态、视角和累计用时。');
 const line=document.createElement('div');line.className='link-box';const input=document.createElement('input');input.readOnly=true;input.value=url.href;input.setAttribute('aria-label','分享链接');input.onclick=()=>input.select();
 line.append(input,button('复制',async()=>{try{await navigator.clipboard.writeText(url.href);toast('链接已复制');}catch{input.select();toast('请长按或按 Ctrl+C 复制链接');}}));box.append(line);
 if(navigator.share)box.append(button('系统分享',async()=>{try{await navigator.share({title:'五魔方',url:url.href});}catch(e){if(e.name!=='AbortError')toast('无法打开系统分享，请复制链接');}}));
 if(location.protocol==='file:')paragraph(box,'跨设备分享需使用静态网站地址。');
}
$('share').onclick=share;
function showRecords(){
 persist();const box=openDialog('历史记录');
 const actions=document.createElement('div');actions.className='dialog-actions';
 actions.append(button('导出 JSON',()=>{
  persist();const blob=new Blob([JSON.stringify({v:1,records},null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='megaminx-history.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
 }),button('导入 JSON',()=>$('import-file').click()));box.append(actions);
 paragraph(box,`${records.length} 条记录 · 保存在当前浏览器，最多保留 100 条`);
 const list=document.createElement('div');list.className='history-list';
 for(const r of [...records].sort((a,b)=>b.updated-a.updated)){
  const item=button('',()=>{persist();restore(r);closeDialog();toast('已恢复历史局面');});item.className='history-item';
  const title=document.createElement('span');title.textContent=`${r.shape==='regular'?'常规':'异形'} · ${{idle:'未开始',ready:'待开始',running:'进行中',solved:'已还原'}[r.status]}${r.id===currentRun.id?' · 当前':''}`;
  const time=document.createElement('span');time.textContent=timeText(r.elapsed);
  const date=document.createElement('small');date.textContent=new Date(r.created).toLocaleString('zh-CN',{hour12:false});item.append(title,time,date);list.append(item);
 }
 box.append(list);
}
$('history-open').onclick=showRecords;
$('import-file').onchange=async e=>{
 const file=e.target.files[0];e.target.value='';if(!file)return;
 try{
  if(file.size>8*1024*1024)throw Error('文件不能超过 8 MB');const raw=JSON.parse(await file.text());
  if(raw.v!==1||!Array.isArray(raw.records)||raw.records.length>100)throw Error('历史记录格式不正确或超过 100 条');
  const incoming=raw.records.map(S.validateRecord);if(new Set(incoming.map(r=>r.id)).size!==incoming.length)throw Error('记录编号重复');
  persist();const map=new Map(records.map(r=>[r.id,r]));for(const r of incoming)if(r.id!==currentRun.id&&(!map.has(r.id)||map.get(r.id).updated<r.updated))map.set(r.id,r);
  records=[...map.values()].sort((a,b)=>b.updated-a.updated).slice(0,100);persist();showRecords();toast('历史记录已导入');
 }catch(e){toast('导入失败：'+e.message);}
};
function fromHash(){
 if(!location.hash.startsWith('#p='))return false;
 try{
  const state=S.decode(location.hash.slice(3));if(currentRun)persist();restore(state,{fresh:true});
  globalThis.history.replaceState(null,'',location.pathname+location.search);toast('已载入分享局面');return true;
 }catch(e){toast('分享链接无效：'+e.message);return false;}
}
function initialize(){
 let current=null,theme='day',savedInputMode='gestures';
 try{
  savedInputMode=localStorage.getItem(INPUT_MODE_KEY)||'gestures';
  const options=JSON.parse(localStorage.getItem(VIEW_OPTIONS_KEY)||'{}');
  autoCenter=options?.autoCenter!==false;angleAlign=options?.angleAlign!==false;
  const savedTheme=localStorage.getItem(THEME_KEY);if(['day','night','dim'].includes(savedTheme))theme=savedTheme;
  const stored=JSON.parse(localStorage.getItem(STORAGE_KEY)||'null');
  if(stored?.v===1&&Array.isArray(stored.records)){
   records=stored.records.slice(0,100).flatMap(raw=>{try{return [S.validateRecord(raw)];}catch{return [];}});current=stored.current;
  }
 }catch{toast('本地记录无法读取');}
 setInputMode(savedInputMode);updateViewOptions();applyTheme(theme);
 if(document.hidden)clock.pause('hidden');
 if(fromHash())return;
 const saved=records.find(r=>r.id===current);
 if(saved){try{restore(saved);return;}catch{toast('上次局面无法恢复');}}
 newRun('idle');settleView();tick();save();
}
window.addEventListener('hashchange',fromHash);
document.addEventListener('visibilitychange',()=>{
 if(document.hidden){clock.pause('hidden');persist();}else clock.resume('hidden');
});
window.addEventListener('pagehide',()=>{clock.pause('pagehide');persist();});
window.addEventListener('pageshow',()=>clock.resume('pagehide'));
window.addEventListener('beforeunload',persist);
setInterval(tick,50);setInterval(()=>{if(clock.running)save();},1000);
initialize();
