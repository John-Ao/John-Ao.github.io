const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const M=require('./model.js');
const source=fs.readFileSync(__dirname+'/game.js','utf8');
const startTurn=source.slice(source.indexOf('function startTurn('),source.indexOf('function select('));
const context=vm.createContext({M,assert,performance:{now:()=>100},save(){},update(){},clock:{start(){}},newRun(){}});
vm.runInContext(`
const MANUAL_TURN_MS=230,QUEUED_TURN_MS=90,SCRAMBLE_TURN_MS=40;
let pieces=M.create(),animation=null,queue=[],selected=0,currentRun={status:'running'};
${startTurn}
startTurn(0,1);
animation.start=0;
const previousProgress=100/animation.duration;
startTurn(0,-1);startTurn(0,1);startTurn(0,1);
assert.equal(queue.length,3);
assert.equal(animation.duration,90);
assert.ok(Math.abs((100-animation.start)/animation.duration-previousProgress)<1e-9);
const executed=[];
while(animation){
 executed.push(animation.dir);
 assert.ok(M.turn(pieces,animation.axis,animation.dir));
 animation=null;
 if(queue.length)startTurn(...queue.shift());
}
assert.equal(executed.join(','),'1,-1,1,1');
const expected=M.fromMoves('irregular',[[0,1],[0,-1],[0,1],[0,1]]);
pieces.forEach((p,i)=>p.pose.forEach((v,j)=>assert.ok(Math.hypot(...M.sub(v,expected[i].pose[j]))<1e-6)));
startTurn(0,1);assert.equal(animation.duration,230);
`,context);
console.log('PASS: queued turns preserve order and count, acceleration preserves progress, isolated turns retain normal speed.');

const gestures=source.slice(source.indexOf('// The regular shell stays fixed'),source.indexOf("canvas.addEventListener('wheel'"));
const gestureContext=vm.createContext({M,assert});
vm.runInContext(`
let viewAnimation=null;
function stopViewAnimation(){viewAnimation=null;}
const MANUAL_TURN_MS=230;
let pieces=M.create('regular');
let inputMode='gestures',shape='regular',selected=0,animation=null,queue=[],zoom=1,dirty=false;
let camera=[[1,0,0],[0,1,0],[0,0,1]],turns=[],orbits=[],scale=200;
const canvas={setPointerCapture(){},getBoundingClientRect(){return {left:0,top:0};}};
function view(v){return camera.map(row=>M.dot(row,v));}
function project(v){const q=view(v);return [300+q[0]*scale,300-q[1]*scale,q[2]];}
function orbit(dx,dy){orbits.push([dx,dy]);}
let settles=0;function settleView(){settles++;}
function save(){} function select(i){selected=i;} function pick(){return picked;}
let picked=null;
let polygons=[],centerIds=M.axes.map((_,i)=>i);
let simulateAnimation=false;
function startTurn(axis,dir){turns.push([axis,dir]);selected=axis;if(simulateAnimation)animation={axis,dir};return true;}
${source.slice(source.indexOf('function inside('),source.indexOf('function pick('))}
${gestures}
function event(p,id=1){return {button:0,pointerId:id,clientX:p[0],clientY:p[1]};}
viewAnimation={};canvas.onpointerdown(event([0,0]));assert.equal(viewAnimation,null);
canvas.onpointercancel(event([0,0]));
// All 60 directed face/edge pairs, both directions, with tilted views.
for(selected=0;selected<12;selected++){
 const normal=M.axes[selected],right=M.norm(M.cross(normal,[.13,1,.27])),up=M.cross(normal,right);
 camera=[right,up,normal].map(v=>M.rotate(v,right,.3));
 const face=regularFaces[selected];
 for(let i=0;i<5;i++){
  const midpoint=M.average([face.points[i],face.points[(i+1)%5]]);
  const p=project(M.add(M.mul(midpoint,.92),M.mul(normal,.08)));
  const candidates=edgeCandidates(p);assert.ok(candidates.length);
  const edge=candidates[0];
  for(const dir of [-1,1]){
   const length=Math.hypot(...edge.velocity),delta=edge.velocity.map(v=>v/length*24*dir);
   const original=selected;
   canvas.onpointerdown(event(p));
   canvas.onpointermove(event([p[0]+delta[0],p[1]+delta[1]]));
   assert.equal(orbits.length,0);
   canvas.onpointerup(event([p[0]+delta[0],p[1]+delta[1]]));
   assert.equal(turns.at(-1)[0],edge.axis);assert.equal(turns.at(-1)[1],dir);
   assert.equal(selected,original);
  }
 }
}
// Sample the full sticker polygons, including their inner corners, at
// multiple zoom levels. Expected membership comes from actual model layers.
const blocks=M.create('regular');
for(selected=0;selected<12;selected++){
 const normal=M.axes[selected],right=M.norm(M.cross(normal,[.13,1,.27])),up=M.cross(normal,right);
 camera=[right,up,normal].map(v=>M.rotate(v,right,.3));
 for(const block of blocks){
  const sticker=block.faces.find(f=>f.color===selected);if(!sticker)continue;
  const center=M.average(sticker.points);
  const expected=M.axes.flatMap((n,i)=>i!==selected&&M.layer(blocks,i).includes(block.id)?[i]:[]);
  for(scale of [110,360,650])for(const point of [center,...sticker.points.map(v=>M.add(M.mul(v,.98),M.mul(center,.02)))]){
   const actual=edgeCandidates(project(point)).map(e=>e.axis);
   assert.ok(expected.every(axis=>actual.includes(axis)),'whole edge/corner block must be eligible at every zoom');
  }
 }
}
// Use actual rendered surfaces to exercise side faces outside the selected pentagon.
{
 const savedCenters=centerIds;
 const layers=M.axes.map((_,i)=>M.layer(pieces,i));
 centerIds=layers.map((ids,i)=>ids.find(id=>layers.every((other,j)=>j===i||!other.includes(id))));
 let sideHits=0;
 for(selected=0;selected<12;selected++){
  const normal=M.axes[selected],right=M.norm(M.cross(normal,[.13,1,.27])),up=M.cross(normal,right);
  camera=[right,up,normal].map(v=>M.rotate(v,right,.65));
  polygons=pieces.flatMap(piece=>piece.faces.map(f=>{
   const normal=M.norm(M.cross(M.sub(f.points[1],f.points[0]),M.sub(f.points[2],f.points[0])));
   return {...f,normal,piece:piece.id,screen:f.points.map(project)};
  })).filter(f=>view(f.normal)[2]>.00001);
  for(const f of polygons){
   const p=project(M.average(f.points));
   if(inside(p,regularFaces[selected].points.map(project))||visiblePiece(p)!==f.piece||boundaryPiece(p)===null)continue;
   sideHits++;
   const candidates=edgeCandidates(p);
   const expected=layers.flatMap((ids,i)=>i!==selected&&ids.includes(f.piece)?[i]:[]);
   assert.equal(candidates.map(e=>e.axis).sort((a,b)=>a-b).join(','),expected.join(','));
   assert.ok(onSelectedFace(p));
   const previous=orbits.length,previousSettles=settles,previousTurns=turns.length;
   const edge=candidates[0],to=[p[0]+edge.tangent[0]*24,p[1]+edge.tangent[1]*24];
   canvas.onpointerdown(event(p));canvas.onpointermove(event(to));canvas.onpointerup(event(to));
   assert.equal(turns.length,previousTurns+1);
   canvas.onpointerdown(event(p));canvas.onpointermove(event([900,900]));
   canvas.onpointerdown(event([0,0],2));canvas.onpointermove(event([50,50],2));
   canvas.onpointerup(event([900,900]));canvas.onpointerup(event([50,50],2));
   assert.equal(orbits.length,previous);assert.equal(settles,previousSettles);
   animation={};assert.ok(onSelectedFace(p));animation=null;
  }
 }
 assert.ok(sideHits>0);
 // A closer unrelated surface must occlude a boundary block.
 const boundary=layers[0].find(id=>id!==centerIds[0]);selected=0;
 const surface=(piece,z)=>({piece,screen:[[0,0,z],[10,0,z],[0,10,z]]});
 polygons=[surface(boundary,0),surface(centerIds[1],1)];
 assert.equal(boundaryPiece([2,2]),null);
 polygons=[];centerIds=savedCenters;zoom=1;
}
// The extra band accepts starts 10% inward, but not 25%, at every zoom.
for(selected=0;selected<12;selected++){
 const normal=M.axes[selected],right=M.norm(M.cross(normal,[.13,1,.27])),up=M.cross(normal,right);
 camera=[right,up,normal].map(v=>M.rotate(v,right,.3));
 const face=regularFaces[selected];
 for(let i=0;i<5;i++){
  const midpoint=M.average([face.points[i],face.points[(i+1)%5]]);
  const axis=M.axes.findIndex((n,j)=>j!==selected&&Math.abs(M.dot(n,face.points[i])-1)<1e-6&&Math.abs(M.dot(n,face.points[(i+1)%5])-1)<1e-6);
  for(scale of [110,360,650])for(const extra of [.10,.25]){
   const depth=M.regularDepth-(1-M.regularDepth)*extra;
   const t=(depth-M.dot(M.axes[axis],normal))/(1-M.dot(M.axes[axis],normal));
   const point=project(M.add(M.mul(midpoint,t),M.mul(normal,1-t)));
   assert.equal(edgeCandidates(point).some(e=>e.axis===axis),extra===.10);
  }
  assert.equal(edgeCandidates(project(normal)).length,0);
 }
}
scale=200;
selected=0;camera=[[1,0,0],[0,1,0],[0,0,1]];
const mid=M.average(regularFaces[0].points.slice(0,2));
const p=project(M.add(M.mul(mid,.92),M.mul(M.axes[0],.08)));
const edge=edgeCandidates(p)[0],q=[p[0]+edge.tangent[0]*24,p[1]+edge.tangent[1]*24];
const count=turns.length;
canvas.onpointerdown(event(p));canvas.onpointermove(event(q));canvas.onpointercancel(event(q));
assert.equal(turns.length,count);
canvas.onpointerdown(event(p));canvas.onpointermove(event(q));
canvas.onpointerdown(event([400,400],2));canvas.onpointerup(event(q));canvas.onpointerup(event([400,400],2));
assert.equal(turns.length,count);
canvas.onpointerdown(event(p));
canvas.onpointermove(event([p[0]-edge.tangent[1]*24,p[1]+edge.tangent[0]*24]));
canvas.onpointerup(event(p));assert.equal(orbits.length,0);assert.equal(turns.length,count);
assert.equal(edgeCandidates(project(M.axes[0])).length,0);
assert.equal(edgeCandidates([0,0]).length,0);
// Lock the entire gesture, including movement outside the face and multitouch.
for(const shell of ['regular','irregular']){
 shape=shell;
 polygons=[{piece:0,color:0,normal:M.axes[0],points:regularFaces[0].points,screen:regularFaces[0].points.map(project)}];
 for(const busy of [false,true]){
  animation=busy?{}:null;
  const from=project(M.axes[0]),outside=[900,900],oldSettles=settles,oldZoom=zoom;
  assert.ok(onSelectedFace(from));
  canvas.onpointerdown(event(from));canvas.onpointermove(event(outside));
  canvas.onpointerdown(event([400,400],2));canvas.onpointermove(event([450,450],2));
  canvas.onpointerup(event(outside));canvas.onpointerup(event([450,450],2));
  assert.equal(orbits.length,0);assert.equal(settles,oldSettles);assert.notEqual(zoom,oldZoom);
 }
 animation=null;
}
// Outside-face gestures still rotate, unless another finger starts on the face.
shape='regular';
canvas.onpointerdown(event([0,0]));canvas.onpointermove(event([25,0]));canvas.onpointerup(event([25,0]));
assert.equal(orbits.length,1);
const oldOrbitCount=orbits.length;
canvas.onpointerdown(event([0,0]));canvas.onpointerdown(event(project(M.axes[0]),2));
canvas.onpointermove(event([25,0]));canvas.onpointerup(event([25,0]));canvas.onpointerup(event(project(M.axes[0]),2));
assert.equal(orbits.length,oldOrbitCount);
shape='irregular';assert.equal(edgeCandidates(p).length,0);
shape='regular';selected=null;assert.equal(edgeCandidates(p).length,0);
selected=0;animation={};assert.equal(edgeCandidates(p).length,0);
animation=null;picked=0;selected=4;
for(const shell of ['regular','irregular']){
 shape=shell;
 for(const [offset,delta,dir] of [[[20,0],[0,24],-1],[[20,0],[0,-24],1],[[0,0],[24,0],-1],[[0,0],[-24,0],1],[[0,0],[0,24],-1],[[0,0],[0,-24],1]]){
  const center=project(M.axes[0]),from=[center[0]+offset[0],center[1]+offset[1]],to=[from[0]+delta[0],from[1]+delta[1]];
  const orbitCount=orbits.length,turnCount=turns.length;
  canvas.onpointerdown(event(from));canvas.onpointermove(event(to));canvas.onpointerup(event(to));
  assert.equal(turns.length,turnCount+1);assert.equal(turns.at(-1).join(','),'0,'+dir);
  assert.equal(selected,0);assert.equal(orbits.length,orbitCount);
 }
}
const center=project(M.axes[0]),end=[center[0]+24,center[1]],before=turns.length;
canvas.onpointerdown(event(center));canvas.onpointermove(event(end));canvas.onpointercancel(event(end));
assert.equal(turns.length,before);
canvas.onpointerdown(event(center));canvas.onpointermove(event(end));canvas.onpointerdown(event([400,400],2));
canvas.onpointerup(event(end));canvas.onpointerup(event([400,400],2));assert.equal(turns.length,before);
// Preview changes before release, reverses with the pointer, and does not
// mutate puzzle geometry until the normal turn animation completes.
const poseBefore=JSON.stringify(pieces);
canvas.onpointerdown(event(center));canvas.onpointermove(event([center[0]+24,center[1]]));
const firstAngle=dragPreview.angle;assert.ok(firstAngle<0);assert.equal(turns.length,before);
canvas.onpointermove(event([center[0]+48,center[1]]));assert.ok(dragPreview.angle<firstAngle);
canvas.onpointermove(event([center[0]-24,center[1]]));assert.ok(dragPreview.angle>0);
assert.equal(JSON.stringify(pieces),poseBefore);
canvas.onpointermove(event(center));canvas.onpointerup(event(center));
assert.equal(turns.length,before);assert.equal(dragPreview,null);
canvas.onpointerdown(event(center));canvas.onpointermove(event(end));
const releaseAngle=dragPreview.angle;simulateAnimation=true;
canvas.onpointerup(event(end));assert.equal(animation.fromAngle,releaseAngle);
assert.ok(animation.duration<MANUAL_TURN_MS);assert.equal(dragPreview,null);
animation=null;simulateAnimation=false;
const afterPreview=turns.length;
inputMode='buttons';shape='regular';assert.equal(edgeCandidates(p).length,0);
const oldOrbits=orbits.length;
canvas.onpointerdown(event(center));canvas.onpointermove(event(end));canvas.onpointerup(event(end));
assert.equal(turns.length,afterPreview);assert.ok(orbits.length>oldOrbits);

`,gestureContext);
console.log('PASS: all regular face edges follow swipe direction, preserve selection, and respect orbit/cancel/multitouch guards.');

const modeContext=vm.createContext({M,assert});
vm.runInContext(`
let inputMode='buttons',dirty=false,selected=0;
const INPUT_MODE_KEY='mode',saved={};
const localStorage={setItem(key,value){saved[key]=value;}};
const elements={'input-mode':{setAttribute(k,v){this[k]=v;}},'face-controls':{hidden:false},cw:{hidden:false},ccw:{hidden:false}};
const $=id=>elements[id],canvas={setAttribute(k,v){this[k]=v;}};
function view(v){return v;}
${source.slice(source.indexOf('function setInputMode('),source.indexOf('// Use the actual center surface'))}
setInputMode('gestures');assert.equal(elements['face-controls'].hidden,false);assert.equal(elements.cw.hidden,true);assert.equal(elements.ccw.hidden,true);assert.equal(saved.mode,'gestures');
elements['input-mode'].onclick();assert.equal(inputMode,'buttons');assert.equal(elements['face-controls'].hidden,false);
selected=null;setInputMode('buttons');assert.equal(elements['face-controls'].hidden,true);
setInputMode('invalid');assert.equal(inputMode,'buttons');
`,modeContext);
console.log('PASS: center swipes in both shapes, button-mode orbit, cancellation, mode visibility and preference storage.');

const viewContext=vm.createContext({M,assert,performance:{now:()=>100}});
vm.runInContext(`
let shape='regular',pieces=M.create(shape),selected=null,animation=null,dragPreview=null;
let viewAnimation=null,viewStepAction=null,viewStepStart=null;
function recordViewStep(){} function beginViewStep(){} function stopViewAnimation(){viewAnimation=null;}
let camera=[[1,0,0],[0,1,0],[0,0,1]],autoCenter=true,angleAlign=true,dirty=false;
const regularFaces=M.shell(M.axes),initialLayers=M.axes.map((_,i)=>new Set(M.layer(pieces,i)));
const centerIds=initialLayers.map((layer,i)=>[...layer].find(id=>initialLayers.every((other,j)=>i===j||!other.has(id))));
const elements={'auto-center':{setAttribute(k,v){this[k]=v;}},'angle-align':{setAttribute(k,v){this[k]=v;}}};
const $=id=>elements[id],VIEW_OPTIONS_KEY='view',saved={};
const localStorage={setItem(k,v){saved[k]=JSON.parse(v);}};
function view(v){return camera.map(row=>M.dot(row,v));}
function scheduleSave(){} function save(){}
${source.slice(source.indexOf('// Use the actual center surface'),source.indexOf('function openDialog('))}
for(shape of ['regular','irregular']){
 pieces=M.create(shape);
 for(const scrambled of [false,true]){
  if(scrambled)for(let i=0;i<20;i++)M.turn(pieces,i%12,i%2?1:-1);
  for(const target of facingFaces()){
   const normal=target.normal,right=M.norm(M.cross(normal,[.13,1,.27])),up=M.cross(normal,right);
   camera=[right,up,normal].map(v=>M.rotate(M.rotate(v,normal,.37),right,.12));
   const expected=frontFace().axis,pose=JSON.stringify(pieces);
   const startCamera=JSON.stringify(camera);
   settleView();assert.equal(selected,expected);
   assert.equal(JSON.stringify(camera),startCamera);
   assert.ok(viewAnimation);
   advanceViewAnimation(240);
   assert.notEqual(JSON.stringify(camera),startCamera);
   camera.forEach(row=>assert.ok(Math.abs(Math.hypot(...row)-1)<1e-9));
   assert.ok(M.dot(M.cross(camera[0],camera[1]),camera[2])>1-1e-9);
   advanceViewAnimation(380);assert.equal(viewAnimation,null);
   const face=frontFace();assert.ok(view(face.normal)[2]>1-1e-9);
   camera.forEach(row=>assert.ok(Math.abs(Math.hypot(...row)-1)<1e-9));
   assert.ok(M.dot(M.cross(camera[0],camera[1]),camera[2])>1-1e-9);
   const ps=face.points.map(view),top=Math.max(...ps.map(p=>p[1]));
   assert.ok(ps.some((p,i)=>Math.abs(p[1]-top)<1e-8&&Math.abs(ps[(i+1)%ps.length][1]-top)<1e-8));
   const aligned=JSON.stringify(camera);settleView();
   camera.flat().forEach((v,i)=>assert.ok(Math.abs(v-JSON.parse(aligned).flat()[i])<1e-9));
   assert.equal(JSON.stringify(pieces),pose);
  }
 }
}
autoCenter=false;angleAlign=false;selected=null;
const before=JSON.stringify(camera);settleView();assert.equal(selected,null);assert.equal(JSON.stringify(camera),before);
elements['auto-center'].onclick();assert.notEqual(selected,null);assert.equal(saved.view.autoCenter,true);
elements['angle-align'].onclick();assert.equal(saved.view.angleAlign,true);
camera=camera.map(row=>M.rotate(row,camera[0],.15));settleView();assert.ok(viewAnimation);
advanceViewAnimation(180);const interrupted=JSON.stringify(camera);
elements['angle-align'].onclick();assert.equal(viewAnimation,null);
advanceViewAnimation(1000);assert.equal(JSON.stringify(camera),interrupted);
selected=null;animation={};settleView();assert.equal(selected,null);
animation=null;dragPreview={};settleView();assert.equal(selected,null);
`,viewContext);
console.log('PASS: automatic face selection, face-on/top-edge alignment for both shells before and after scrambling, independent toggles and persistence.');

const undoContext=vm.createContext({M,assert});
vm.runInContext(`
let pieces=M.create('regular'),shape='regular',history=[],selected=0;
let camera=[[1,0,0],[0,1,0],[0,0,1]],animation=null,queue=[],viewAnimation=null,dragPreview=null;
let angleAlign=true,autoCenter=false,currentRun={status:'running'};
const pointers=new Map(),elements={undo:{},redo:{}};
const $=id=>elements[id],clock={start(){},stop(){}};
function update(){updateUndoControls();} function save(){} function updateAutoCenter(){}
function animateView(target){camera=target;} function frontFace(){return {axis:0};}
${source.slice(source.indexOf('let undoSteps='),source.indexOf('// Center blocks belong'))}
const initial=JSON.stringify(pieces.map(p=>p.pose)),initialCamera=JSON.stringify(camera);
M.turn(pieces,0,1);history.push([0,1]);recordStep({type:'turn',axis:0,dir:1});
const turned=JSON.stringify(pieces.map(p=>p.pose));
beginViewStep();camera=camera.map(row=>M.rotate(row,[0,1,0],.3));
const target=camera.map(row=>M.rotate(row,[0,1,0],.2));recordViewStep(target);camera=target;viewStepAction=null;
const rotated=JSON.stringify(camera);
M.turn(pieces,1,-1);history.push([1,-1]);recordStep({type:'turn',axis:1,dir:-1});
const finalPoses=pieces.map(p=>p.pose);
replayStep(false);assert.equal(undoSteps.length,2);
pieces.forEach((p,i)=>p.pose.forEach((v,j)=>assert.ok(Math.hypot(...M.sub(v,JSON.parse(turned)[i][j]))<1e-6)));
replayStep(false);assert.equal(JSON.stringify(camera),initialCamera);
replayStep(false);assert.ok(M.isSolved(pieces,shape));assert.equal(elements.undo.disabled,true);
replayStep(true);replayStep(true);assert.equal(JSON.stringify(camera),rotated);replayStep(true);
pieces.forEach((p,i)=>p.pose.forEach((v,j)=>assert.ok(Math.hypot(...M.sub(v,finalPoses[i][j]))<1e-6)));
const restored=M.fromMoves(shape,history);
pieces.forEach((p,i)=>p.pose.forEach((v,j)=>assert.ok(Math.hypot(...M.sub(v,restored[i].pose[j]))<1e-6)));
replayStep(false);assert.equal(redoSteps.length,1);
M.turn(pieces,2,1);history.push([2,1]);recordStep({type:'turn',axis:2,dir:1});assert.equal(redoSteps.length,0);
const count=undoSteps.length;animation={};replayStep(false);assert.equal(undoSteps.length,count);animation=null;
beginViewStep();recordViewStep(camera);assert.equal(undoSteps.length,count);
beginViewStep();const next=camera.map(row=>M.rotate(row,[1,0,0],.6));recordViewStep(next);
camera=camera.map(row=>M.rotate(row,[1,0,0],.2));stopViewAnimation();
assert.equal(JSON.stringify(undoSteps.at(-1).after.camera),JSON.stringify(camera));
clearSteps();updateUndoControls();assert.equal(elements.undo.disabled,true);assert.equal(elements.redo.disabled,true);
`,undoContext);
console.log('PASS: mixed turn/view undo and redo, replayable saved moves, branch invalidation, interrupted view steps and busy guards.');

const S=require('./session.js');
let timerNow=0;
const timerClock=new S.Stopwatch(()=>timerNow),timerElements={};
function timerNode(){return {children:[],append(...nodes){this.children.push(...nodes);},focus(){}};}
let timerBox;
const timerRun={status:'idle'};
const timerContext=vm.createContext({
 clock:timerClock,currentRun:timerRun,history:[],tick(){},save(){},timeText:ms=>String(ms),
 $:id=>timerElements[id]||(timerElements[id]={}),document:{createElement:timerNode},
 openDialog(){timerClock.pause('modal');timerBox=timerNode();return timerBox;},
 closeDialog(){timerClock.resume('modal');},paragraph(){},
 button(label,onclick){return {label,onclick,focus(){}};}
});
vm.runInContext(source.slice(source.indexOf('function showTimer('),source.indexOf('function confirmAction(')),timerContext);
const timerAction=label=>timerBox.children.at(-1).children.find(b=>b.label===label).onclick();
timerElements['timer-control'].onclick();assert.equal(timerClock.running,false);
timerAction('开始');timerNow=1000;assert.equal(timerClock.elapsed(),1000);
timerElements['timer-control'].onclick();timerNow=2000;assert.equal(timerClock.elapsed(),1000);
timerAction('清零');assert.equal(timerClock.elapsed(),1000);
timerAction('取消');assert.equal(timerClock.elapsed(),1000);
timerContext.closeDialog();timerNow=2500;assert.equal(timerClock.elapsed(),1500);
timerElements['timer-control'].onclick();timerAction('清零');timerAction('清零');
assert.equal(timerClock.elapsed(),0);assert.equal(timerClock.running,false);assert.equal(timerRun.status,'idle');
timerAction('开始');timerNow=3000;assert.equal(timerClock.elapsed(),500);
console.log('PASS: timer start, dialog pause/resume, reset confirmation/cancellation and restart from zero.');
