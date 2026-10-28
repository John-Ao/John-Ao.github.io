const assert=require('node:assert/strict'),P=require('./polyhedra'),G=require('./gear');
assert.deepEqual(P.orders.gear,[]);
for(let axis=0;axis<6;axis++){
 const pieces=P.create('gear'),original=structuredClone(pieces);
 assert.equal(pieces.filter(p=>p.kind==='gear').length,12);
 const previews=pieces.map(p=>p.faces.map(f=>f.points.map(v=>G.preview(p,v,axis,Math.PI))));
 P.turn(pieces,'gear',3,axis,0,1);
 assert(!P.solved(pieces,'gear',3));
 pieces.forEach((p,i)=>p.faces.forEach((f,j)=>f.points.forEach((v,k)=>assert(Math.hypot(...v.map((x,a)=>x-previews[i][j][k][a]))<1e-8))));
 for(let i=1;i<12;i++)P.turn(pieces,'gear',3,axis,0,1);
 assert(P.solved(pieces,'gear',3));
 pieces.forEach((p,i)=>p.faces.forEach((f,j)=>f.points.forEach((v,k)=>assert(Math.hypot(...v.map((x,a)=>x-original[i].faces[j].points[k][a]))<1e-8))));
}
const pieces=P.create('gear'),original=structuredClone(pieces),moves=[];
let seed=42;const random=()=>((seed=(1664525*seed+1013904223)>>>0)/2**32);
for(let i=0;i<60;i++){const move=[Math.floor(random()*6),0,random()<.5?-1:1];moves.push(move);P.turn(pieces,'gear',3,...move);}
assert(!P.solved(pieces,'gear',3));
for(const [axis,layer,dir] of moves.reverse())P.turn(pieces,'gear',3,axis,layer,-dir);
assert(P.solved(pieces,'gear',3));
pieces.forEach((p,i)=>p.faces.forEach((f,j)=>f.points.forEach((v,k)=>assert(Math.hypot(...v.map((x,a)=>x-original[i].faces[j].points[k][a]))<1e-8))));
console.log('PASS gear: six axes, preview matches commit, 12-step cycles, mixed moves and inverse restore geometry');

// Solved gear paint follows the two adjacent cube planes, including the
// rounded tips; it must not be split across a diagonal circular cap.
for(const piece of G.create().filter(p=>p.kind==='gear')){
 const paint=piece.faces.filter(f=>f.color>=0);
 assert.equal(new Set(paint.map(f=>f.color)).size,2);
 for(const face of paint){
  const axis=Math.floor(face.color/2),sign=face.color%2?-1:1;
  assert(face.stickerMesh);
  assert(face.points.every(v=>Math.abs(v[axis]*sign-(1+.001/Math.SQRT2))<1e-8));
  assert.equal(piece.home[axis],sign);
 }
}
console.log('PASS gear paint: both adjacent faces have matching planar colours');
const corners=G.create().filter(p=>p.kind==='corner');
assert.equal(corners.length,8);
for(const piece of corners){
 const paint=piece.faces.filter(f=>f.color>=0);
 assert.equal(new Set(paint.map(f=>f.color)).size,3);
 for(const face of paint){
  const axis=Math.floor(face.color/2),sign=face.color%2?-1:1;
  assert(face.stickerMesh);
  assert(face.points.every(v=>Math.abs(v[axis]*sign-1.001)<1e-8));
  assert(face.points.flat().every(Number.isFinite));
 }
}
assert.equal((G.faceIcon().match(/M/g)||[]).length,9);
assert(!/NaN|Infinity/.test(G.faceIcon()));
console.log('PASS rounded corners: three matching colour surfaces; icon has nine sticker outlines');
// Corners follow the outer layer as a rigid piece, never the middle's 1:2
// ratio. Check an intermediate frame as well as its committed position.
for(let axis=0;axis<6;axis++){
 const pieces=G.create(),n=G.config.axes[axis],coordinate=Math.floor(axis/2),sign=axis%2?-1:1;
 for(const p of pieces.filter(p=>p.kind==='corner')){
  const moving=p.p[coordinate]===sign,point=p.faces.find(f=>f.color>=0).points[0];
  const expected=moving?P.rotate(point,n,Math.PI/3):point;
  assert(Math.hypot(...G.preview(p,point,axis,Math.PI/3).map((x,i)=>x-expected[i]))<1e-8);
  for(const face of p.faces.filter(f=>f.color>=0)){
   const normal=G.config.axes[face.color];
   assert(G.dragAxes(p,normal).every(i=>Math.abs(P.dot(normal,G.config.axes[i]))<.9));
  }
 }
 G.turn(pieces,axis,0,1);
 for(const p of pieces.filter(p=>p.kind==='corner')){
  const expected=p.home.map((x,i)=>i===coordinate||p.home[coordinate]!==sign?x:-x);
  assert.deepEqual(p.p,expected);
 }
}
assert(G.core.faces.every(f=>f.points.every(v=>Math.hypot(...v)<=.83000001)));
assert(G.create().filter(p=>p.kind==='center').every(p=>p.faces.every(f=>f.points.every(v=>Math.hypot(...v)<1.2))));
console.log('PASS corner selection and rigid outer-layer motion; core stays inside moving shells');
for(const state of [0,1]){
 const pieces=G.create();
 if(state)for(const axis of [0,2,4])G.turn(pieces,axis,0,1);
 for(const piece of pieces.filter(p=>p.kind==='gear')){
  for(const face of piece.faces.filter(f=>f.color>=0)){
   const normal=P.norm(P.cross(P.sub(face.points[1],face.points[0]),P.sub(face.points[2],face.points[0])));
   const axes=G.dragAxes(piece,normal);
   assert.equal(axes.length,2);
   assert(axes.every(axis=>P.dot(piece.p,G.config.axes[axis])===1),'edge gestures only select an outer layer containing the edge');
   assert(axes.every(axis=>G.selection(pieces,axis,0).includes(piece.id)));
  }
 }
}
console.log('PASS gear edge gestures: only outer-layer axes, before and after mixed turns');
