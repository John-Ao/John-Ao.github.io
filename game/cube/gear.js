/* Fixed-order Gear Cube. Outer half turns drive the middle slice at 1:2
 * and the four middle edge gears through an additional 60-degree rotation. */
(function(root){
'use strict';
const add=(a,b)=>a.map((v,i)=>v+b[i]),sub=(a,b)=>a.map((v,i)=>v-b[i]),mul=(a,s)=>a.map(v=>v*s),dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],norm=v=>mul(v,1/Math.hypot(...v));
const basis=[[1,0,0],[0,1,0],[0,0,1]],axes=basis.flatMap(v=>[v,mul(v,-1)]);
const rotate=(v,n,a)=>add(add(mul(v,Math.cos(a)),mul(cross(n,v),Math.sin(a))),mul(n,dot(n,v)*(1-Math.cos(a))));
// Rounded notches and lobes on the three exposed faces of each corner.
function cornerOutline(){
 const points=[[1,1],[.44,1]];
 const curve=(c1,c2,end)=>{const start=points[points.length-1];for(let i=1;i<=12;i++){const t=i/12,q=1-t;points.push([0,1].map(k=>q*q*q*start[k]+3*q*q*t*c1[k]+3*q*t*t*c2[k]+t*t*t*end[k]));}};
 curve([.40,.90],[.67,.88],[.56,.75]);
 curve([.50,.68],[.31,.79],[.34,.62]);
 curve([.35,.48],[.55,.64],[.59,.59]);
 curve([.64,.55],[.48,.35],[.62,.34]);
 curve([.79,.31],[.68,.50],[.75,.56]);
 curve([.88,.67],[.90,.40],[1,.44]);
 return points;
}
const centerOutline=()=>Array.from({length:64},(_,i)=>{const a=i*Math.PI/32,r=.24-.09*Math.cos(4*a);return [r*Math.cos(a),r*Math.sin(a)];});
function insetOutline(outline,d=.018){
 return outline.map((q,i)=>{
  const prev=outline[(i+outline.length-1)%outline.length],next=outline[(i+1)%outline.length];
  const inward=(a,b)=>{const dx=b[0]-a[0],dy=b[1]-a[1],len=Math.hypot(dx,dy);return [-dy/len,dx/len];};
  const a=inward(prev,q),b=inward(q,next),den=1+dot(a,b);
  return q.map((x,k)=>x+d*(a[k]+b[k])/den);
 });
}
function triangles(points){
 const cross2=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
 const ids=points.map((_,i)=>i),result=[];
 while(ids.length>3){
  let found=false;
  for(let j=0;j<ids.length;j++){
   const a=ids[(j+ids.length-1)%ids.length],b=ids[j],c=ids[(j+1)%ids.length];
   if(cross2(points[a],points[b],points[c])<=1e-10)continue;
   if(ids.some(k=>k!==a&&k!==b&&k!==c&&cross2(points[a],points[b],points[k])>=-1e-10&&cross2(points[b],points[c],points[k])>=-1e-10&&cross2(points[c],points[a],points[k])>=-1e-10))continue;
   result.push([a,b,c]);ids.splice(j,1);found=true;break;
  }
  if(!found)throw Error('Invalid gear outline');
 }
 result.push(ids);return result;
}
function shapedBlock(p,corner){
 const faces=[];
 for(let axis=0;axis<3;axis++){
  if(!p[axis])continue;
  const u=(axis+1)%3,v=(axis+2)%3,normal=mul(basis[axis],p[axis]);
  const outline=corner?cornerOutline():centerOutline(),paint=insetOutline(outline);
  const at=(q,depth=0)=>{const point=[0,0,0];point[axis]=p[axis]*(1-depth);point[u]=q[0]*(corner?p[u]:1);point[v]=q[1]*(corner?p[v]:1);return point;};
  const orient=points=>{if(dot(cross(sub(points[1],points[0]),sub(points[2],points[0])),normal)<0)points.reverse();return points;};
  for(const tri of triangles(outline))faces.push({color:-1,points:orient(tri.map(i=>at(outline[i])))});
  for(const tri of triangles(paint))faces.push({color:axis*2+(p[axis]<0?1:0),stickerMesh:true,points:orient(tri.map(i=>at(paint[i],-.001)))});
  for(let i=0;i<outline.length;i++){const a=outline[i],b=outline[(i+1)%outline.length];const wall=[at(a),at(a,.15),at(b,.15),at(b)];if(p[axis]*(corner?p[u]*p[v]:1)<0)wall.reverse();faces.push({color:-1,points:wall});}
 }
 return faces;
}
function faceIcon(){
 const paths=[],path=points=>paths.push(points.map((q,i)=>(i?'L':'M')+q.map(x=>(12+x*10).toFixed(2)).join(' ')).join('')+'Z');
 for(const x of [-1,1])for(const y of [-1,1])path(insetOutline(cornerOutline(),.025).map(q=>[q[0]*x,q[1]*y]));
 path(insetOutline(centerOutline(),.025));
 const edge=Array.from({length:49},(_,i)=>{const a=i*Math.PI/48,r=.365+.065*Math.cos(6*a);return [Math.cos(a)*r*.94,1-Math.sin(a)*r*Math.SQRT2-.025];});
 for(let k=0;k<4;k++)path(edge.map(([x,y])=>[[x,y],[-y,x],[-x,-y],[y,-x]][k]));
 return paths.join('');
}
function wheel(p){
 // The two coloured halves meet on the cube edge, rather than sharing a
 // flat circular cap. A six-lobed outline forms the rounded gear teeth.
 const n=norm(p),center=mul(p,.79),u=basis[p.indexOf(0)],v=cross(n,u),faces=[];
 const count=96,outline=Array.from({length:count},(_,i)=>{
  const a=i*Math.PI*2/count,r=.365+.065*Math.cos(6*a);
  return [Math.cos(a)*r,Math.sin(a)*r];
 });
 const surface=([x,y],depth=0)=>add(center,add(mul(u,x),add(mul(v,y),mul(n,.21*Math.SQRT2-Math.abs(y)-depth))));
 // Offset the complete outline before triangulating: internal triangle
 // edges must never acquire sticker gaps.
 const inset=outline.map((q,i)=>{
  const prev=outline[(i+count-1)%count],next=outline[(i+1)%count];
  const inward=(a,b)=>{const dx=b[0]-a[0],dy=b[1]-a[1],len=Math.hypot(dx,dy);return [-dy/len,dx/len];};
  const a=inward(prev,q),b=inward(q,next),d=1+a[0]*b[0]+a[1]*b[1];
  return [q[0]+.018*(a[0]+b[0])/d,q[1]+.018*(a[1]+b[1])/d];
 });
 const orient=(points,outward)=>{
  if(dot(cross(sub(points[1],points[0]),sub(points[2],points[0])),outward)<0)points.reverse();
  return points;
 };
 for(let i=0;i<count;i++){
  const j=(i+1)%count,a=outline[i],b=outline[j],side=(a[1]+b[1])>0?1:-1;
  const faceAxis=p.findIndex((sign,k)=>sign&&v[k]*sign*side>0),outward=mul(basis[faceAxis],p[faceAxis]);
  faces.push({color:-1,points:orient([surface([0,0]),surface(a),surface(b)],outward)});
  // Leave a narrow black seam at the ridge, and a continuous border around
  // the entire coloured lobe. Coplanar triangles are rendered without inset.
  const paint=q=>[q[0],q[1]*.96+side*.008];
  faces.push({color:faceAxis*2+(p[faceAxis]<0?1:0),stickerMesh:true,
   points:orient([surface([0,side*.008],-.001),surface(paint(inset[i]),-.001),surface(paint(inset[j]),-.001)],outward)});
  faces.push({color:-1,points:orient([surface(a),surface(a,.14),surface(b,.14),surface(b)],add(mul(u,(a[0]+b[0])/2),mul(v,(a[1]+b[1])/2)))});
  faces.push({color:-1,points:orient([surface([0,0],.14),surface(b,.14),surface(a,.14)],mul(n,-1))});
 }
 return faces;
}
function create(){const pieces=[];for(let x=-1;x<=1;x++)for(let y=-1;y<=1;y++)for(let z=-1;z<=1;z++){
 const p=[x,y,z],count=p.filter(Boolean).length;if(!count)continue;
 const kind=count===2?'gear':count===3?'corner':'center';
 pieces.push({id:pieces.length,p,home:p.slice(),kind,frame:basis.map(v=>v.slice()),faces:kind==='gear'?wheel(p):shapedBlock(p,count===3)});
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
// A stationary spherical core stays inside every moving shell; unlike a
// face-sized backing plate it cannot sweep through the neighbouring layers.
const core={core:true,faces:[]};
for(let lat=0;lat<16;lat++)for(let lon=0;lon<32;lon++){
 const point=(i,j)=>{const a=i*Math.PI/16,b=j*Math.PI/16;return [.83*Math.sin(a)*Math.cos(b),.83*Math.cos(a),.83*Math.sin(a)*Math.sin(b)];};
 const points=[point(lat,lon),point(lat,lon+1),point(lat+1,lon+1),point(lat+1,lon)];
 if(lat===0)points.shift();if(lat===15)points.pop();
 if(dot(cross(sub(points[1],points[0]),sub(points[2],points[0])),points[0])<0)points.reverse();
 core.faces.push({color:-1,points});
}
function dragAxes(piece,normal){
 return axes.map((_,i)=>i).filter(i=>piece.kind==='gear'?dot(piece.p,axes[i])>.5:Math.abs(dot(axes[i],normal))<.9);
}
const api={core,dragAxes,faceIcon,create,selection,turn,solved,preview,config:{normals:axes,axes,cuts:[0],step:Math.PI}};
if(typeof module!=='undefined')module.exports=api;else root.GearCube=api;
})(globalThis);
