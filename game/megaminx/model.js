/* Geometry-only, dependency-free model. Coordinates use an inradius of 1. */
(function (root) {
'use strict';
const EPS=1e-7, PHI=(1+Math.sqrt(5))/2;
const add=(a,b)=>a.map((v,i)=>v+b[i]), sub=(a,b)=>a.map((v,i)=>v-b[i]), mul=(a,s)=>a.map(v=>v*s);
const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0), cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const norm=a=>mul(a,1/Math.hypot(...a));
const rotate=(p,n,t)=>add(add(mul(p,Math.cos(t)),mul(cross(n,p),Math.sin(t))),mul(n,dot(n,p)*(1-Math.cos(t))));
const average=ps=>mul(ps.reduce(add,[0,0,0]),1/ps.length);
let normals=[];
for(const a of [-1,1])for(const b of [-1,1]) normals.push(norm([0,a,b*PHI]),norm([a,b*PHI,0]),norm([b*PHI,0,a]));
// Keep a pentagonal face towards the viewer and one edge horizontal.
const front=normals[0], align=norm(cross(front,[0,0,1])), angle=Math.acos(front[2]);
normals=normals.map(n=>rotate(n,align,angle));
const axes=normals.map(n=>rotate(n,[0,0,1],Math.PI*2/15));
// Slightly inset cuts widen the narrowest stickers without creating extra slivers.
const depth=.79, regularDepth=Math.sqrt(5)/3, step=2*Math.PI/5;
function ordered(points,n){const c=average(points),u=norm(sub(points[0],c)),v=cross(n,u);return points.sort((a,b)=>Math.atan2(dot(sub(a,c),v),dot(sub(a,c),u))-Math.atan2(dot(sub(b,c),v),dot(sub(b,c),u)));}
function unique(ps){return ps.filter((p,i)=>!ps.slice(0,i).some(q=>Math.hypot(...sub(p,q))<EPS*10));}
function shell(surfaceNormals=normals){const vertices=[];for(let i=0;i<12;i++)for(let j=i+1;j<12;j++)for(let k=j+1;k<12;k++){
 const [a,b,c]=[surfaceNormals[i],surfaceNormals[j],surfaceNormals[k]],d=dot(a,cross(b,c));if(Math.abs(d)<EPS)continue;
 const p=mul(add(add(cross(b,c),cross(c,a)),cross(a,b)),1/d);
 if(surfaceNormals.every(n=>dot(n,p)<1+EPS))vertices.push(p);
}const vs=unique(vertices);return surfaceNormals.map((n,color)=>({color,points:ordered(vs.filter(p=>Math.abs(dot(n,p)-1)<EPS),n)}));}
function clip(faces,n,d){const result=[],cuts=[];
 for(const f of faces){const ps=[];for(let i=0;i<f.points.length;i++){const a=f.points[i],b=f.points[(i+1)%f.points.length],da=dot(a,n)-d,db=dot(b,n)-d;
 if(da<=EPS)ps.push(a);
 if((da < -EPS&&db>EPS)||(da>EPS&&db < -EPS)){const p=add(a,mul(sub(b,a),da/(da-db)));ps.push(p);cuts.push(p);}
 }const clean=unique(ps);if(clean.length>=3)result.push({color:f.color,points:clean});}
 const cap=unique(cuts);if(cap.length>=3)result.push({color:-1,points:ordered(cap,n)});return result;
}
function create(shape='irregular'){const depth=shape==='regular'?regularDepth:.79;let pieces=[shell(shape==='regular'?axes:normals)];for(const n of axes){const next=[];for(const p of pieces){const ds=p.flatMap(f=>f.points.map(v=>dot(n,v)-depth));if(Math.min(...ds)<-EPS&&Math.max(...ds)>EPS){next.push(clip(p,n,depth),clip(p,mul(n,-1),-depth));}else next.push(p);}pieces=next;}
 return pieces.map(faces=>{
 const center=average(faces.flatMap(f=>f.points));
 // The cut-halfspace signature identifies the same physical piece in either shell.
 const id=axes.reduce((mask,n,i)=>mask|(dot(n,center)>depth?1<<i:0),0);
 return {id,faces,cutDepth:depth,pose:[[1,0,0],[0,1,0],[0,0,1]]};
 });}
function layer(pieces,index){const n=axes[index],selected=[];for(const p of pieces){const ds=p.faces.flatMap(f=>f.points.map(v=>dot(n,v)-p.cutDepth));if(Math.max(...ds)<=EPS)continue;if(Math.min(...ds)<-EPS)return null;selected.push(p.id);}return selected;}
function turn(pieces,index,direction){const ids=layer(pieces,index);if(!ids||!ids.length)return false;const set=new Set(ids);for(const p of pieces)if(set.has(p.id)){
 for(const f of p.faces)f.points=f.points.map(v=>rotate(v,axes[index],direction*step));
 p.pose=p.pose.map(v=>rotate(v,axes[index],direction*step));
 }return true;}
function reshape(pieces,shape){
 const poses=new Map(pieces.map(p=>[p.id,p.pose]));
 return create(shape).map(p=>{
  const pose=poses.get(p.id);if(!pose)throw Error('Missing piece mapping: '+p.id);
  p.pose=pose.map(v=>v.slice());
  for(const f of p.faces)f.points=f.points.map(v=>add(add(mul(pose[0],v[0]),mul(pose[1],v[1])),mul(pose[2],v[2])));
  return p;
 });
}
// Replay on lightweight piece anchors, then build the surface once.
function fromMoves(shape,moves){
 const state=create('regular');
 for(const p of state)p.anchor=average(p.faces.flatMap(f=>f.points));
 for(const [axis,dir] of moves){
  const n=axes[axis];
  for(const p of state)if(dot(p.anchor,n)>regularDepth+EPS){
   p.anchor=rotate(p.anchor,n,dir*step);p.pose=p.pose.map(v=>rotate(v,n,dir*step));
  }
 }
 return reshape(state,shape);
}
// Inset a convex projected polygon by a fixed pixel distance. Interpolate depth
// along clipped edges so the result stays on the original face plane.
function insetProjected(points,distance){
 let result=points.map(p=>p.slice());
 const area=points.reduce((sum,a,i)=>{const b=points[(i+1)%points.length];return sum+a[0]*b[1]-b[0]*a[1];},0);
 const sign=area>=0?1:-1;
 for(let i=0;i<points.length&&result.length;i++){
  const a=points[i],b=points[(i+1)%points.length],dx=b[0]-a[0],dy=b[1]-a[1],length=Math.hypot(dx,dy);
  if(length<EPS)continue;
  const side=p=>sign*(dx*(p[1]-a[1])-dy*(p[0]-a[0]))/length-distance;
  const next=[];
  for(let j=0;j<result.length;j++){
   const p=result[j],q=result[(j+1)%result.length],dp=side(p),dq=side(q);
   if(dp>=0)next.push(p);
   if((dp>=0)!==(dq>=0))next.push(add(p,mul(sub(q,p),dp/(dp-dq))));
  }
  result=next;
 }
 return result;
}
const solvedShells=new Map();
function isSolved(pieces,shape){
 if(!solvedShells.has(shape))solvedShells.set(shape,new Map(create(shape).map(p=>[p.id,p])));
 const initial=solvedShells.get(shape);
 return pieces.every(p=>p.faces.filter(f=>f.color>=0).every(f=>{
  const original=initial.get(p.id).faces.find(g=>g.color===f.color);
  return original&&f.points.every(v=>original.points.some(w=>Math.hypot(...sub(v,w))<1e-5));
 }));
}
const api={add,sub,mul,dot,cross,norm,rotate,average,normals,axes,depth,regularDepth,insetProjected,step,create,reshape,fromMoves,isSolved,layer,turn,shell};
if(typeof module!=='undefined')module.exports=api;else root.Pentafish=api;
})(globalThis);
