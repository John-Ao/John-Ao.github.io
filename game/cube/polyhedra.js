/* Convex-piece models; cuts and legal moves use the same geometric planes. */
(function(root){
'use strict';
const Gear=typeof module!=='undefined'?require('./gear'):root.GearCube;
const EPS=1e-6,TAU=2*Math.PI;
const add=(a,b)=>a.map((v,i)=>v+b[i]),sub=(a,b)=>a.map((v,i)=>v-b[i]),mul=(a,s)=>a.map(v=>v*s);
const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],norm=a=>mul(a,1/Math.hypot(...a));
const average=ps=>mul(ps.reduce(add,[0,0,0]),1/ps.length);
const rotate=(p,n,t)=>add(add(mul(p,Math.cos(t)),mul(cross(n,p),Math.sin(t))),mul(n,dot(n,p)*(1-Math.cos(t))));
const unique=ps=>ps.filter((p,i)=>!ps.slice(0,i).some(q=>Math.hypot(...sub(p,q))<EPS));
function ordered(ps,n){const c=average(ps),u=norm(sub(ps[0],c)),v=cross(n,u);return ps.sort((a,b)=>Math.atan2(dot(sub(a,c),v),dot(sub(a,c),u))-Math.atan2(dot(sub(b,c),v),dot(sub(b,c),u)));}
function shell(ns){const vs=[];for(let i=0;i<ns.length;i++)for(let j=i+1;j<ns.length;j++)for(let k=j+1;k<ns.length;k++){
 const [a,b,c]=[ns[i],ns[j],ns[k]],d=dot(a,cross(b,c));if(Math.abs(d)<EPS)continue;
 const p=mul(add(add(cross(b,c),cross(c,a)),cross(a,b)),1/d);if(ns.every(n=>dot(n,p)<=1+EPS))vs.push(p);
}return ns.map((n,color)=>({color,points:ordered(unique(vs.filter(p=>Math.abs(dot(n,p)-1)<EPS)),n)}));}
function clip(faces,n,d){const result=[],cuts=[];for(const f of faces){const ps=[];for(let i=0;i<f.points.length;i++){
 const a=f.points[i],b=f.points[(i+1)%f.points.length],da=dot(a,n)-d,db=dot(b,n)-d;if(da<=EPS)ps.push(a);if(Math.abs(da)<=EPS)cuts.push(a);
 if((da < -EPS&&db>EPS)||(da>EPS&&db < -EPS)){const p=add(a,mul(sub(b,a),da/(da-db)));ps.push(p);cuts.push(p);}
 }const clean=unique(ps);if(clean.length>=3)result.push({color:f.color,points:clean});}
 const cap=unique(cuts);if(cap.length>=3)result.push({color:-1,points:ordered(cap,n)});return result;}
const cubeNormals=[[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]];
const tetra=[[1,1,1],[1,-1,-1],[-1,1,-1],[-1,-1,1]].map(norm);
const phi=(1+Math.sqrt(5))/2,mega=[];for(const a of [-1,1])for(const b of [-1,1])mega.push(norm([0,a,b*phi]),norm([a,b*phi,0]),norm([b*phi,0,a]));
const octa=[...tetra,...tetra.map(n=>mul(n,-1))];
const icosa=octa.map(n=>n.slice());
for(const a of [-1,1])for(const b of [-1,1])icosa.push(norm([0,a/phi,b*phi]),norm([a*phi,0,b/phi]),norm([a/phi,b*phi,0]));
const icoVertices=unique(shell(icosa).flatMap(f=>f.points)),icoAxes=icoVertices.map(norm);
const icoRadius=Math.hypot(...icoVertices[0]);
const icoAdjacent=Math.max(...icoVertices.slice(1).map(v=>dot(v,icoAxes[0])));
const orders={pyraminx:[2,3,4,5],megaminx:[2,3,4,5,6,7],skewb:[2,3,4,5,6,7],octahedron:[3,4,5,6],icosahedron:[3,4,5,6],sq1:[],gear:[]};
function valid(type,order){return Object.hasOwn(orders,type)&&(orders[type].length?orders[type].includes(order):order===3);}
function config(type,order){if(!valid(type,order))throw Error('无效魔方类型或阶数');
 if(type==='gear')return Gear.config;
 if(type==='pyraminx')return {normals:tetra.map(n=>mul(n,-1)),axes:tetra,cuts:Array.from({length:order-1},(_,i)=>-1+4*(i+1)/order),step:TAU/3};
 if(type==='megaminx'&&order%2===0)return {normals:mega,axes:mega,cuts:Array.from({length:order/2},(_,i)=>1-(i+1)*.4/(order/2)),step:TAU/5};
 if(type==='megaminx')return {normals:mega,axes:mega,cuts:Array.from({length:(order-1)/2},(_,i)=>1-(i+1)*(3-Math.sqrt(5))/order),step:TAU/5};
 if(type==='skewb'){
  // Keep cuts strictly between the cube-vertex levels ±1/sqrt(3).
  // End segments are half the width of interior segments. The 2nd order
  // still has the original single center cut and two equal corner segments.
  const cuts=Array.from({length:order-1},(_,i)=>(2*(i+.5)/(order-1)-1)/Math.sqrt(3));
  return {normals:cubeNormals,axes:[...tetra,...tetra.map(n=>mul(n,-1))],cuts,step:TAU/3};
 }
 // On each triangular face, intersections divide every edge into equal parts.
 if(type==='octahedron')return {normals:octa,axes:octa,cuts:Array.from({length:Math.floor(order/2)},(_,i)=>1-2*(i+1)/order),step:TAU/3};
 if(type==='icosahedron')return {normals:icosa,axes:icoAxes,cuts:Array.from({length:order-1},(_,i)=>icoRadius-(icoRadius-icoAdjacent)*(i+1)/order),step:TAU/5};
 return {normals:cubeNormals,axes:[[0,1,0],[0,-1,0],[Math.cos(Math.PI/12),0,Math.sin(Math.PI/12)]],cuts:[1/3],step:Math.PI/6};
}
// Even minxes divide each face into five corner kites, then subdivide each
// kite into an m x m grid. Shared edge/corner tiles form one physical piece.
function createEvenMinx(order){
 const m=order/2,groups=new Map(),key=v=>v.map(x=>Math.round(x*1e7)).join(',');
 for(const face of shell(mega)){
  const center=average(face.points),vs=face.points;
  for(let k=0;k<5;k++){
   const vertex=vs[k],prev=mul(add(vertex,vs[(k+4)%5]),.5),next=mul(add(vertex,vs[(k+1)%5]),.5);
   const at=(u,v)=>add(add(mul(center,(1-u)*(1-v)),mul(prev,u*(1-v))),add(mul(vertex,u*v),mul(next,(1-u)*v)));
   for(let i=0;i<m;i++)for(let j=0;j<m;j++){
    const points=[at(i/m,j/m),at((i+1)/m,j/m),at((i+1)/m,(j+1)/m),at(i/m,(j+1)/m)];
    let id;
    if(i===m-1&&j===m-1)id='corner:'+key(vertex);
    else if(i===m-1)id='edge:'+key(at(1,(j+.5)/m));
    else if(j===m-1)id='edge:'+key(at((i+.5)/m,1));
    else id=`center:${face.color}:${k}:${i}:${j}`;
    if(!groups.has(id))groups.set(id,[]);groups.get(id).push({color:face.color,points});
   }
  }
 }
 return [...groups.values()].map((outer,id)=>{
  const edges=new Map();for(const f of outer)f.points.forEach((a,i)=>{const b=f.points[(i+1)%f.points.length],edge=[key(a),key(b)].sort().join('|');if(edges.has(edge))edges.delete(edge);else edges.set(edge,[a,b]);});
  const faces=[...outer,...[...edges.values()].map(([a,b])=>({color:-1,points:[b,a,[0,0,0]]}))];
  return {id,faces,anchor:average(outer.flatMap(f=>f.points)),frame:[[1,0,0],[0,1,0],[0,0,1]]};
 });
}

function create(type,order=type==='skewb'?2:3){
 if(type==='gear'){config(type,order);return Gear.create();}
 if(type==='megaminx'&&order%2===0){config(type,order);return createEvenMinx(order);}
const c=config(type,order);let cells=[shell(c.normals)];
 if(type==='sq1'){
  const body=cells[0];cells=[];
  for(const sign of [-1,1]){let angle=Math.PI/12;for(let i=0;i<8;i++){const next=angle+(i%2?1:2)*Math.PI/6;
   let fs=clip(body,[0,-sign,0],-1/3);fs=clip(fs,[Math.sin(angle),0,-Math.cos(angle)],0);fs=clip(fs,[-Math.sin(next),0,Math.cos(next)],0);cells.push(fs);angle=next;
  }}
  let mid=clip(clip(body,[0,1,0],1/3),[0,-1,0],1/3);for(const sign of [-1,1])cells.push(clip(mid,mul(c.axes[2],sign),0));
 }else for(const n of c.axes)for(const d of c.cuts){const next=[];for(const fs of cells){const ds=fs.flatMap(f=>f.points.map(p=>dot(p,n)-d));if(Math.min(...ds)<-EPS&&Math.max(...ds)>EPS)next.push(clip(fs,n,d),clip(fs,mul(n,-1),-d));else next.push(fs);}cells=next;}
 return cells.filter(fs=>fs.some(f=>f.color>=0)).map((faces,id)=>({id,faces,frame:[[1,0,0],[0,1,0],[0,0,1]]}));
}
function layerCount(type,order){return type==='sq1'?1:type==='pyraminx'?order:type==='skewb'?order-1:type==='octahedron'?Math.ceil(order/2):config(type,order).cuts.length;}
function selection(pieces,type,order,axis,layer){
 if(type==='gear')return Gear.selection(pieces,axis,layer);
 const c=config(type,order);
 if(!Number.isInteger(axis)||axis<0||axis>=c.axes.length||!Number.isInteger(layer)||layer<0||layer>=layerCount(type,order))return null;
 const n=c.axes[axis],cuts=c.cuts.slice().sort((a,b)=>a-b);let low,high=Infinity;
 if(type==='sq1')low=axis===2?0:1/3;
 else if(['megaminx','icosahedron'].includes(type)){low=c.cuts[layer];if(layer)high=c.cuts[layer-1];}
 else if(type==='pyraminx'){low=layer===order-1?-1:c.cuts[layer];high=layer===order-1?c.cuts[0]:(c.cuts[layer+1]??3);}
 else if(layer===0)low=cuts.at(-1);
 else if(type==='skewb'){low=cuts[layer-1];high=cuts[layer];}
 else{low=order%2===0?cuts[layer-1]:layer===1?-cuts[0]:cuts[layer-2];high=cuts[layer-(order%2)];}
 const ids=[];
 for(const p of pieces){
  if(p.anchor){const h=dot(p.anchor,n);if(h>low+EPS&&h<=high+EPS)ids.push(p.id);continue;}
  const heights=p.faces.flatMap(f=>f.points.map(v=>dot(v,n))),min=Math.min(...heights),max=Math.max(...heights);
  if(max<=low+EPS||min>=high-EPS)continue;
  if(min<low-EPS||max>high+EPS)return null;
  ids.push(p.id);
 }
 return ids.length?ids:null;
}

function step(type,order,axis){return type==='sq1'&&axis===2?Math.PI:config(type,order).step;}
function turn(pieces,type,order,axis,layer,dir){if(type==='gear'){Gear.turn(pieces,axis,layer,dir);return;}const ids=selection(pieces,type,order,axis,layer);if(!ids||![-1,1].includes(dir))throw Error('当前切面被块阻挡');const set=new Set(ids),c=config(type,order);for(const p of pieces)if(set.has(p.id)){const angle=step(type,order,axis)*dir;if(p.anchor)p.anchor=rotate(p.anchor,c.axes[axis],angle);p.frame=p.frame.map(v=>rotate(v,c.axes[axis],angle));for(const f of p.faces)f.points=f.points.map(v=>rotate(v,c.axes[axis],angle));}}
function solved(pieces,type,order){
 if(type==='gear')return Gear.solved(pieces);
 const ns=config(type,order).normals,faceColors=new Map(),colorFaces=new Map();
 // A solved puzzle can have any overall orientation, especially without
 // fixed centers. Require one distinct color per actual outer face.
 for(const p of pieces)for(const f of p.faces){
  if(f.color<0)continue;
  const face=ns.findIndex(n=>f.points.every(v=>Math.abs(dot(v,n)-1)<1e-5));
  if(face<0||(faceColors.has(face)&&faceColors.get(face)!==f.color)||
   (colorFaces.has(f.color)&&colorFaces.get(f.color)!==face))return false;
  faceColors.set(face,f.color);colorFaces.set(f.color,face);
 }
 return faceColors.size===ns.length;
}
function legalMoves(pieces,type,order){const c=config(type,order),out=[];for(let a=0;a<c.axes.length;a++)for(let l=0;l<layerCount(type,order);l++)if(selection(pieces,type,order,a,l))out.push([a,l]);return out;}
// Offset every projected edge inward by the same CSS-pixel distance. Clipping
// may remove a tiny sticker entirely; never replace it with a scaled polygon.
function insetProjected(points,distance,cameraDistance=Infinity){
 if(points.length<3)return [];
 let result=points.map(p=>p.slice());
 const area=points.reduce((sum,a,i)=>{const b=points[(i+1)%points.length];return sum+a[0]*b[1]-b[0]*a[1];},0);
 if(Math.abs(area)<EPS)return [];const sign=area>0?1:-1;
 for(let i=0;i<points.length&&result.length;i++){
  const a=points[i],b=points[(i+1)%points.length],dx=b[0]-a[0],dy=b[1]-a[1],length=Math.hypot(dx,dy);if(length<EPS)continue;
  const side=p=>sign*(dx*(p[1]-a[1])-dy*(p[0]-a[0]))/length-distance,next=[];
  for(let j=0;j<result.length;j++){
   const p=result[j],q=result[(j+1)%result.length],dp=side(p),dq=side(q);
   if(dp>=0)next.push(p);
   if((dp>=0)!==(dq>=0)){
    const t=dp/(dp-dq),v=p.map((x,k)=>x+(q[k]-x)*t);
    if(p.length>2&&Number.isFinite(cameraDistance))v[2]=cameraDistance-1/((1-t)/(cameraDistance-p[2])+t/(cameraDistance-q[2]));
    next.push(v);
   }
  }
  result=next;
 }
 return result.length>=3?result:[];
}

// Inset in the face's own plane, before perspective foreshortening. A screen
// offset would consume disproportionately much of an almost edge-on sticker.
function insetFace(points,distance){
 if(points.length<3)return [];
 const origin=points[0],edge=sub(points[1],origin);if(Math.hypot(...edge)<EPS)return [];
 const u=norm(edge);let normal;
 for(let i=2;i<points.length;i++){const n=cross(u,sub(points[i],origin));if(Math.hypot(...n)>EPS){normal=norm(n);break;}}
 if(!normal)return [];
 const v=cross(normal,u),flat=points.map(p=>{const q=sub(p,origin);return [dot(q,u),dot(q,v)];});
 return insetProjected(flat,distance).map(([x,y])=>add(origin,add(mul(u,x),mul(v,y))));
}
// Share one six-face palette: -X green, +X blue, -Y yellow, +Y white,
// -Z orange, +Z red. Geometric face IDs remain unchanged.
function stickerColorIndex(type,color){
 if(color<0)return color;
 if(type==='cuboid')return [3,2,0,1,4,5][color];
 if(['skewb','sq1','gear'].includes(type))return [3,2,0,1,4,5][color^1];
 return color;
}
const api={stickerColorIndex,layerCount,insetFace,insetProjected,shell,orders,valid,config,create,selection,step,turn,solved,legalMoves,rotate,average,norm,cross,sub,dot};if(typeof module!=='undefined')module.exports=api;else root.PolyPuzzle=api;
})(globalThis);
