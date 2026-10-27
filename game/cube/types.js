'use strict';
function syncTypeUI(){
 syncAlignmentUI();
 const icons={
 cuboid:'M4 8 12 4 20 8 20 17 12 21 4 17ZM4 8 12 12 20 8M12 12V21M8 6 16 10V19M16 6 8 10V19M4 12 12 16 20 12',
 pyraminx:'M12 3 2 20H22ZM12 3V16L2 20M12 16 22 20M7 11 12 9 17 11M7 11 7 18M17 11 17 18',
 skewb:'M4 8 12 4 20 8 20 17 12 21 4 17ZM4 8 12 12 20 8M12 12V21M8 6 16 19M16 6 8 19M4 12 16 6M20 12 8 6',
 megaminx:'M12 2 21 8 19 19 8 22 2 13 4 5ZM8 8 15 7 18 13 13 18 7 15ZM12 2 15 7M21 8 18 13M19 19 13 18M8 22 7 15M2 13 8 8M4 5 8 8',
 octahedron:'M12 2 2 11 12 22 22 11ZM12 2V14L2 11M12 14 22 11M12 14V22M7 7 17 7M7 7 12 14 17 7',
 icosahedron:'M12 2 21 7 22 17 12 22 2 17 3 7ZM12 2 8 9 3 7M12 2 17 10 21 7M8 9 17 10 13 18ZM3 7 2 17 8 9M2 17 13 18 12 22M17 10 22 17 13 18M13 18 12 22',
 sq1:'M4 6 12 2 20 6V18L12 22 4 18ZM4 6 12 10 20 6M12 10V22M4 10 12 14 20 10M4 14 12 18 20 14M8 4 16 8V12M8 16V20'};
 const group=$('puzzle-types');
 if(!group.children.length){Object.entries(typeNames).forEach(([type,name],i)=>{
  const label=document.createElement('label');label.title=name;const input=document.createElement('input');input.type='radio';input.name='puzzle-type';input.value=type;input.setAttribute('aria-label',name);
  const span=document.createElement('span');span.innerHTML=`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${icons[type]}"/></svg>`;label.append(input,span);group.append(label);
  input.onchange=()=>{if(busy()){syncTypeUI();return;}save();puzzleType=type;order=3;snap=null;camera=pose(3);zoom=1;reset();snapView();};
 });}
 group.style.setProperty('--count',Object.keys(typeNames).length);
 group.style.setProperty('--index',Object.keys(typeNames).indexOf(puzzleType));group.querySelector(`input[value="${puzzleType}"]`).checked=true;
 $('type-label').textContent=typeNames[puzzleType];document.title=typeNames[puzzleType];canvas.setAttribute('aria-label',`${typeNames[puzzleType]}；拖动魔方块转层，拖动空白处调整视角。`);
 const cuboid=puzzleType==='cuboid',hasOrder=!cuboid&&P.orders[puzzleType].length>0;
 $('dimensions').hidden=!cuboid&&!hasOrder;document.querySelector('.dimensions').hidden=!cuboid;$('order-row').hidden=!hasOrder;
 $('size-legend').textContent=cuboid?'尺寸':'阶数';$('dimensions').querySelector('button').textContent=cuboid?'应用尺寸并复原':'应用阶数并复原';
 if(hasOrder){const track=$('order-track'),values=P.orders[puzzleType];track.replaceChildren();track.style.setProperty('--count',values.length);track.style.setProperty('--index',values.indexOf(order));
  values.forEach((n,i)=>{const label=document.createElement('label'),input=document.createElement('input'),span=document.createElement('span');input.type='radio';input.name='order';input.value=n;input.checked=n===order;span.textContent=n;input.onchange=()=>track.style.setProperty('--index',i);label.append(input,span);track.append(label);});
 }
 $('turn-help').textContent={cuboid:'正方形截面转 90°，其余转 180°',pyraminx:'沿顶点转轴转动 120°',megaminx:'绕面中心转动 72°',skewb:'沿对角转轴转动 120°',octahedron:'绕三角形面中心转动 120°',icosahedron:'绕三角形面中心转动 120°',sq1:'上下层转 30°；中层翻转 180°，切面被阻挡时不可翻转'}[puzzleType];
}
function renderPoly(){
 const data=[];polygons=[];const turn=animation||drag?.turn,c=P.config(puzzleType,order),ids=turn?new Set(P.selection(pieces,puzzleType,order,turn.axis,turn.layer)||[]):null;
 function polygon(screen,color,light,bias=0){const tint=color.map(v=>v*light);for(let j=1;j<screen.length-1;j++)for(const i of [0,j,j+1]){const q=screen[i];data.push(q[0]/width*2-1,1-q[1]/height*2,1-2*cameraDistance()/(4*(cameraDistance()-q[2]))-bias,...tint);}}
 for(const piece of pieces)for(const face of piece.faces){
  const world=face.points.map(v=>ids?.has(piece.id)?P.rotate(v,c.axes[turn.axis],turn.angle):v),center=P.average(world),normal=P.norm(P.cross(P.sub(world[1],world[0]),P.sub(world[2],world[0])));
  if(M.dot(normal,camera[2].map((v,i)=>v*cameraDistance()-center[i]))<=0)continue;
  const screen=world.map(project),light=(.78+.22*Math.max(0,M.dot(normal,camera[2])))*(dim?.42:1);
  polygon(screen,[.055,.062,.07],light);
  if(face.color>=0){const inset=world.map(v=>v.map((n,i)=>center[i]+(n-center[i])*.9));polygon(inset.map(project),rgb(colors[face.color]),light,.0005);}
  polygons.push({screen,world,piece,normal});
 }
 gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(data),gl.DYNAMIC_DRAW);gl.drawArrays(gl.TRIANGLES,0,data.length/6);
}
function hitPoly(x,y){
 const distance=cameraDistance(),origin=camera[2].map(v=>v*distance),sx=(x-width/2)/scale,sy=-(y-height/2)/scale;
 const ray=[0,1,2].map(i=>camera[0][i]*sx/distance+camera[1][i]*sy/distance-camera[2][i]);let best=null,nearest=Infinity;
 for(const face of polygons){const {world,normal}=face,den=M.dot(normal,ray);if(Math.abs(den)<1e-8)continue;
  const t=M.dot(normal,P.sub(world[0],origin))/den;if(t<0||t>=nearest)continue;const point=origin.map((v,i)=>v+t*ray[i]);
  if(world.every((a,i)=>M.dot(P.cross(P.sub(world[(i+1)%world.length],a),P.sub(point,a)),normal)>=-1e-6)){nearest=t;best={piece:face.piece,point,normal};}
 }return best;
}
function updatePolyDrag(){
 const track=drag.track;if(Math.hypot(track.x,track.y)<=7){drag.turn=null;dirty=true;return;}
 const c=P.config(puzzleType,order),point=drag.hit.point,base=project(point);let best=null;
 for(const [axis,layer]of P.legalMoves(pieces,puzzleType,order)){
  if(!P.selection(pieces,puzzleType,order,axis,layer).includes(drag.hit.piece.id))continue;
  const q=project(P.rotate(point,c.axes[axis],.01)),dx=q[0]-base[0],dy=q[1]-base[1],length=Math.hypot(dx,dy);if(length<.01)continue;
  const tangent=[dx/length,dy/length],score=tangent[0]**2*track.xx+2*tangent[0]*tangent[1]*track.xy+tangent[1]**2*track.yy;
  // At a shared boundary prefer the smaller independently turning cap.
  const count=P.selection(pieces,puzzleType,order,axis,layer).length;
  if(!best||score>best.score+1e-6||(Math.abs(score-best.score)<1e-6&&count<best.count))best={axis,layer,tangent,score,count};
 }
 drag.turn=best?{...best,angle:Math.max(-1,Math.min(1,(track.x*best.tangent[0]+track.y*best.tangent[1])/Math.max(70,Math.min(width,height)*.22)))*turnStep(best.axis)}:null;dirty=true;
}
