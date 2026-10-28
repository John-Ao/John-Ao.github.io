'use strict';
function syncTypeUI(){
 syncAlignmentUI();
 // Face stickers; octahedron and icosahedron show the whole solid with filled faces.
 const icons={
 "gear":"M10 1h4l.6 3 2 .9 2.6-1.5 2 3.5-2.1 2 .2 2.2L22 13l-1.3 3.8-3-.2-1.7 1.5-.5 3-4 .7-1.5-2.6-2.2-.6-2.6 1.3-2.1-3.4 2-2.2-.2-2.2L2 10.6l1.4-3.8 3 .3 1.7-1.5ZM12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z",
 "cuboid": "M2 2h6v6h-6ZM9 2h6v6h-6ZM16 2h6v6h-6ZM2 9h6v6h-6ZM9 9h6v6h-6ZM16 9h6v6h-6ZM2 16h6v6h-6ZM9 16h6v6h-6ZM16 16h6v6h-6Z",
 "pyraminx": "M5.8 15.16L8.67 20.12L11.53 15.16ZM5.33 15.43L2.47 20.39L8.2 20.39ZM15.33 20.12L18.2 15.16L12.47 15.16ZM9.13 20.39L14.87 20.39L12 15.43ZM15.8 20.39L21.53 20.39L18.67 15.43ZM9.13 9.38L12 14.35L14.87 9.38ZM8.67 9.65L5.8 14.62L11.53 14.62ZM12.47 14.62L18.2 14.62L15.33 9.65ZM12 3.88L9.13 8.84L14.87 8.84Z",
 "skewb": "M12.93 21.53L21.53 21.53L21.53 12.93ZM11.07 2.47L2.47 2.47L2.47 11.07ZM12 3.4L3.4 12L12 20.6L20.6 12ZM2.47 12.93L2.47 21.53L11.07 21.53ZM21.53 2.47L12.93 2.47L21.53 11.07Z",
 "megaminx": "M7.36 11.5L9.13 16.95L14.87 16.95L16.64 11.5L12 8.13ZM8.59 5.3L5.73 7.39L6.82 10.76L11.46 7.39ZM15.74 17.23L19.28 17.23L20.38 13.86L17.51 11.78ZM12.54 7.39L17.18 10.76L18.27 7.39L15.41 5.3ZM12 2.83L9.13 4.91L12 6.99L14.87 4.91ZM17.72 11.15L20.58 13.23L21.68 9.86L18.81 7.78ZM9.13 17.87L10.23 21.24L13.77 21.24L14.87 17.87ZM14.44 21.24L17.98 21.24L19.08 17.87L15.53 17.87ZM3.62 13.86L4.72 17.23L8.26 17.23L6.49 11.78ZM5.19 7.78L2.32 9.86L3.42 13.23L6.28 11.15ZM4.92 17.87L6.02 21.24L9.56 21.24L8.47 17.87Z",
 "octahedron": "M8.6 13.79L21.21 12.57L12.2 2.31ZM11.53 21.85L7.93 14.43L2.53 11.58ZM7.93 13.73L11.53 2.25L2.53 10.88ZM12.2 21.91L21.21 13.27L8.6 14.49Z",
 "icosahedron": "M20.23 7.22L10.32 4.42L14.02 13.89ZM3.24 13.92L3.38 17L9.37 22.01ZM3.24 12.92L9.37 4.34L3.38 5.69ZM20.23 18.52L14.02 14.89L10.32 22.1ZM9.73 21.93L13.42 14.72L3.6 13.84ZM3.76 5.29L9.74 3.94L13.67 1.71ZM20.98 10.65L20.84 7.57L20.84 17.88ZM13.42 14.11L9.73 4.64L3.6 13.22ZM20.6 7.7L14.39 14.38L20.6 18.01ZM14.26 1.77L10.33 3.99L20.24 6.78Z",
 "sq1": "M6.13 2.7L2.5 2.7L2.5 11.3L11.1 11.3ZM11.73 2.47L6.77 2.47L11.73 11.07ZM21.3 2.5L12.7 2.5L12.7 11.1L21.3 6.13ZM21.53 11.73L21.53 6.77L12.93 11.73ZM17.87 21.3L21.5 21.3L21.5 12.7L12.9 12.7ZM12.27 21.53L17.23 21.53L12.27 12.93ZM2.7 17.87L2.7 21.5L11.3 21.5L11.3 12.9ZM2.47 12.27L2.47 17.23L11.07 12.27Z"
};
 const group=$('puzzle-types');
 if(!group.children.length){Object.entries(typeNames).forEach(([type,name],i)=>{
  const label=document.createElement('label');label.title=name;const input=document.createElement('input');input.type='radio';input.name='puzzle-type';input.value=type;input.setAttribute('aria-label',name);
  const span=document.createElement('span');span.innerHTML=`<svg viewBox="0 0 24 24" aria-hidden="true"><path fill-rule="evenodd" d="${icons[type]}"/></svg>`;label.append(input,span);group.append(label);
  input.onchange=()=>{if(busy()){syncTypeUI();return;}save();puzzleType=type;order=type==='skewb'?2:3;snap=null;camera=pose(3);zoom=1;reset();snapView();};
 });}
 group.style.setProperty('--count',Object.keys(typeNames).length);
 group.style.setProperty('--index',Object.keys(typeNames).indexOf(puzzleType));group.querySelector(`input[value="${puzzleType}"]`).checked=true;
 $('type-label').textContent='类型';document.title=typeNames[puzzleType];canvas.setAttribute('aria-label',`${typeNames[puzzleType]}；拖动魔方块转层，拖动空白处调整视角。`);
 const cuboid=puzzleType==='cuboid',hasOrder=!cuboid&&P.orders[puzzleType].length>0;
 $('dimensions').hidden=!cuboid&&!hasOrder;document.querySelector('.dimensions').hidden=!cuboid;$('order-row').hidden=!hasOrder;
 $('size-legend').textContent=cuboid?'尺寸':'阶数';$('dimensions').querySelector('button').textContent=cuboid?'应用尺寸并复原':'应用阶数并复原';
 if(hasOrder){const track=$('order-track'),values=P.orders[puzzleType];track.replaceChildren();track.style.setProperty('--count',values.length);track.style.setProperty('--index',values.indexOf(order));
  values.forEach((n,i)=>{const label=document.createElement('label'),input=document.createElement('input'),span=document.createElement('span');input.type='radio';input.name='order';input.value=n;input.checked=n===order;span.textContent=n;input.onchange=()=>track.style.setProperty('--index',i);label.append(input,span);track.append(label);});
 }
 $('turn-help').textContent={cuboid:'正方形截面转 90°，其余转 180°',pyraminx:'沿顶点转轴转动 120°',megaminx:'绕面中心转动 72°',skewb:'沿对角转轴转动 120°',octahedron:'绕三角形面中心转动 120°',icosahedron:'绕顶点转动 72°',gear:'外层转 180°，中层联动 90°，齿轮同步自转',sq1:'上下层转 30°；中层翻转 180°，切面被阻挡时不可翻转'}[puzzleType];
}
function renderPoly(){
 const data=[];polygons=[];const turn=animation||drag?.turn,c=P.config(puzzleType,order),ids=turn?new Set(P.selection(pieces,puzzleType,order,turn.axis,turn.layer)||[]):null;
 function polygon(screen,color,light,bias=0){const tint=color.map(v=>v*light);for(let j=1;j<screen.length-1;j++)for(const i of [0,j,j+1]){const q=screen[i];data.push(q[0]/width*2-1,1-q[1]/height*2,1-2*cameraDistance()/(4*(cameraDistance()-q[2]))-bias,...tint);}}
 for(const piece of pieces)for(const face of piece.faces){
  const world=face.points.map(v=>puzzleType==='gear'&&turn?GearCube.preview(piece,v,turn.axis,turn.angle):ids?.has(piece.id)?P.rotate(v,c.axes[turn.axis],turn.angle):v),center=P.average(world),normal=P.norm(P.cross(P.sub(world[1],world[0]),P.sub(world[2],world[0])));
  if(M.dot(normal,camera[2].map((v,i)=>v*cameraDistance()-center[i]))<=0)continue;
  const screen=world.map(project),light=(.78+.22*Math.max(0,M.dot(normal,camera[2])))*(dim?.42:1);
  polygon(screen,[.055,.062,.07],light);
  if(face.color>=0){polygon(P.insetFace(world,STICKER_INSET/scale).map(project),rgb(colors[face.color]),light,.0005);}
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
function skewbClickCandidates(hit,candidates,config){
 // A physical corner stays attached to its current cube vertex, even after turns.
 const corner=hit.piece.faces.flatMap(f=>f.points).find(v=>v.every(x=>Math.abs(Math.abs(x)-1)<1e-5));
 // Face-space distance splits the center diamond into four fixed quadrants.
 // Projected distances would shift these boundaries when the camera tilts.
 const axes=config.axes.map((n,axis)=>({axis,vertex:n.map(x=>Math.sign(x))}))
  .filter(({axis,vertex})=>candidates.some(c=>c.axis===axis)&&
   (corner?vertex.every((x,i)=>Math.abs(x-corner[i])<1e-5):Math.abs(P.dot(vertex,hit.normal)-1)<1e-5));
 let nearest=null;
 for(const candidate of axes){
  const distance=Math.hypot(...candidate.vertex.map((x,i)=>x-hit.point[i]));
  if(!nearest||distance<nearest.distance-1e-7)nearest={...candidate,distance};
 }
 return nearest?candidates.filter(c=>c.axis===nearest.axis):[];
}
function updatePolyDrag(){
 const track=drag.track;if(Math.hypot(track.x,track.y)<=7){drag.turn=null;dirty=true;return;}
 const c=P.config(puzzleType,order),point=drag.hit.point,base=project(point);let best=null;
 // The model stays fixed throughout a drag; cache all eligible caps once.
 const candidates=drag.polyCandidates??=(c.axes.flatMap((_,axis)=>
  Array.from({length:puzzleType==='sq1'?1:puzzleType==='pyraminx'?order:c.cuts.length},(_,layer)=>{
   const selected=P.selection(pieces,puzzleType,order,axis,layer);
   return selected?.includes(drag.hit.piece.id)?{axis,layer,count:selected.length}:null;
  }).filter(Boolean)));
 const eligible=puzzleType==='skewb'?(drag.skewbCandidates??=skewbClickCandidates(drag.hit,candidates,c)):candidates;
 for(const {axis,layer,count} of eligible){
  const epsilon=puzzleType==='skewb'?1e-4:.01;
  const q=project(puzzleType==='gear'?GearCube.preview(drag.hit.piece,point,axis,epsilon):P.rotate(point,c.axes[axis],epsilon));
  const start=puzzleType==='skewb'?project(P.rotate(point,c.axes[axis],-epsilon)):base;
  const dx=q[0]-start[0],dy=q[1]-start[1],length=Math.hypot(dx,dy);if(length<(puzzleType==='skewb'?1e-7:.01))continue;
  const tangent=[dx/length,dy/length],score=puzzleType==='skewb'?Math.abs(tangent[0]*track.x+tangent[1]*track.y)/Math.hypot(track.x,track.y):tangent[0]**2*track.xx+2*tangent[0]*tangent[1]*track.xy+tangent[1]**2*track.yy;
  // At a shared boundary prefer the smaller independently turning cap.
  if(!best||score>best.score+1e-6||(Math.abs(score-best.score)<1e-6&&count<best.count))best={axis,layer,tangent,score,count};
 }
 drag.turn=best?{...best,angle:Math.max(-1,Math.min(1,(track.x*best.tangent[0]+track.y*best.tangent[1])/Math.max(70,Math.min(width,height)*.22)))*turnStep(best.axis)}:null;dirty=true;
}
