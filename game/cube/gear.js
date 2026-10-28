/* Fixed-order Gear Cube. Outer half turns drive the middle slice at 1:2
 * and the four middle edge gears through an additional 60-degree rotation. */
(function(root){
'use strict';
const add=(a,b)=>a.map((v,i)=>v+b[i]),sub=(a,b)=>a.map((v,i)=>v-b[i]),mul=(a,s)=>a.map(v=>v*s),dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],norm=v=>mul(v,1/Math.hypot(...v));
const basis=[[1,0,0],[0,1,0],[0,0,1]],axes=basis.flatMap(v=>[v,mul(v,-1)]);
const rotate=(v,n,a)=>add(add(mul(v,Math.cos(a)),mul(cross(n,v),Math.sin(a))),mul(n,dot(n,v)*(1-Math.cos(a))));
function box(p,half){const center=mul(p,.69),faces=[];for(let a=0;a<3;a++)for(const sign of [-1,1]){
 const n=mul(basis[a],sign),u=basis[(a+1)%3],v=cross(n,u),points=[[-1,-1],[1,-1],[1,1],[-1,1]].map(([x,y])=>center.map((c,i)=>c+n[i]*half+u[i]*x*half+v[i]*y*half));
 faces.push({color:p[a]===sign?a*2+(sign<0?1:0):-1,points});
}return faces;}
function wheel(p){
 const n=norm(p),center=mul(p,.79),u=basis[p.indexOf(0)],v=cross(n,u),faces=[],count=48;
 const at=(angle,r,depth)=>add(center,add(mul(n,depth),add(mul(u,Math.cos(angle)*r),mul(v,Math.sin(angle)*r))));
 const ring=Array.from({length:count},(_,i)=>({a:i*Math.PI*2/count,r:i%4===1||i%4===2?.365:.3}));
 for(let i=0;i<count;i++){
  const a=ring[i],b=ring[(i+1)%count],frontA=at(a.a,a.r,.105),frontB=at(b.a,b.r,.105),backA=at(a.a,a.r,-.105),backB=at(b.a,b.r,-.105);
  faces.push({color:-1,points:[at(0,0,.105),frontA,frontB]},{color:-1,points:[at(0,0,-.105),backB,backA]},{color:-1,points:[frontB,frontA,backA,backB]});
 }
 const colors=p.flatMap((sign,a)=>sign?[{color:a*2+(sign<0?1:0),side:v[a]*sign}]:[]).sort((a,b)=>b.side-a.side);
 for(const side of [-1,1])for(let half=0;half<2;half++){
  const points=Array.from({length:17},(_,i)=>at(half*Math.PI+i*Math.PI/16,.285,side*.108));
  if(side<0)points.reverse();faces.push({color:colors[half].color,points});
 }
 for(const side of [-1,1]){const points=Array.from({length:16},(_,i)=>at(i*Math.PI/8,.065,side*.112));if(side<0)points.reverse();faces.push({color:-1,points});}
 return faces;
}
function create(){const pieces=[];for(let x=-1;x<=1;x++)for(let y=-1;y<=1;y++)for(let z=-1;z<=1;z++){
 const p=[x,y,z],count=p.filter(Boolean).length;if(!count)continue;
 const kind=count===2?'gear':count===3?'corner':'center';
 pieces.push({id:pieces.length,p,home:p.slice(),kind,frame:basis.map(v=>v.slice()),faces:kind==='gear'?wheel(p):box(p,count===3?.32:.31)});
}return pieces;}
function valid(axis,layer){return Number.isInteger(axis)&&axis>=0&&axis<6&&layer===0;}
function selection(pieces,axis,layer){return valid(axis,layer)?pieces.filter(p=>dot(p.p,axes[axis])>=0).map(p=>p.id):null;}
function motion(piece,axis,angle){const n=axes[axis],level=dot(piece.p,n);return {n,level,orbit:level>0?angle:level===0?angle/2:0,spin:level===0&&piece.kind==='gear'?angle/3:0};}
function preview(piece,point,axis,angle){
 const m=motion(piece,axis,angle);let v=point;
 if(m.spin){const center=mul(piece.p,.79);v=add(center,rotate(sub(v,center),norm(piece.p),m.spin));}
 return rotate(v,m.n,m.orbit);
}
function turn(pieces,axis,layer,dir){
 if(!valid(axis,layer)||![-1,1].includes(dir))throw Error('无效齿轮转动');
 for(const p of pieces){const angle=dir*Math.PI,m=motion(p,axis,angle);if(!m.orbit)continue;
  for(const f of p.faces)f.points=f.points.map(v=>preview(p,v,axis,angle));
  p.frame=p.frame.map(v=>rotate(m.spin?rotate(v,norm(p.p),m.spin):v,m.n,m.orbit));
  p.p=rotate(p.p,m.n,m.orbit).map(Math.round);
 }
}
function solved(pieces){return pieces.every(p=>p.p.every((v,i)=>v===p.home[i])&&(p.kind==='center'||p.frame.every((v,i)=>v.every((x,j)=>Math.abs(x-basis[i][j])<1e-6))));}
const api={create,selection,turn,solved,preview,config:{normals:axes,axes,cuts:[0],step:Math.PI}};
if(typeof module!=='undefined')module.exports=api;else root.GearCube=api;
})(globalThis);
