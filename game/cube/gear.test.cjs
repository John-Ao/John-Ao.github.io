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
