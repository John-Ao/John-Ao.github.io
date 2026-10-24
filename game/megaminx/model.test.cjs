const assert=require('node:assert/strict');
const M=require('./model.js');
function close(actual,expected){actual.forEach((p,i)=>p.faces.forEach((f,j)=>f.points.forEach((v,k)=>assert.ok(Math.hypot(...M.sub(v,expected[i].faces[j].points[k]))<1e-6))))}
const initial=M.create();
assert.equal(initial.length,63); // 62 moving blocks and an internal core.
for(let i=0;i<12;i++){
 assert.equal(initial.flatMap(p=>p.faces).filter(f=>f.color===i).length,11);
 const pieces=M.create();assert.equal(M.layer(pieces,i).length,11);
 assert.ok(M.turn(pieces,i,1));assert.ok(M.turn(pieces,i,-1));close(pieces,initial);
 for(let k=0;k<5;k++)assert.ok(M.turn(pieces,i,1));close(pieces,initial);
}
const pieces=M.create(),moves=[];let seed=12345;
for(let i=0;i<200;i++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;const a=seed%12,d=(seed&16)?1:-1;moves.push([a,d]);assert.ok(M.turn(pieces,a,d));}
for(const [a,d] of moves.reverse())assert.ok(M.turn(pieces,a,-d));close(pieces,initial);
console.log('PASS: 12 face partitions, inverse turns, five-turn identity, 200-move scramble and reversal.');

// Switching shells keeps the physical piece identities and their full orientations.
const irregular=M.create(),regular=M.create('regular');
assert.equal(new Set(irregular.map(p=>p.id)).size,63);
assert.deepEqual(irregular.map(p=>p.id).sort((a,b)=>a-b),regular.map(p=>p.id).sort((a,b)=>a-b));
let mixed=M.create(),reference=M.create(),shape='irregular';const mixedMoves=[];
for(let i=0;i<120;i++){
 const axis=(i*7+Math.floor(i/12))%12,dir=i%3?1:-1;
 assert.deepEqual(M.layer(mixed,axis).slice().sort((a,b)=>a-b),M.layer(reference,axis).slice().sort((a,b)=>a-b));
 assert.ok(M.turn(mixed,axis,dir));assert.ok(M.turn(reference,axis,dir));mixedMoves.push([axis,dir]);
 shape=shape==='irregular'?'regular':'irregular';mixed=M.reshape(mixed,shape);
 close(M.reshape(mixed,'irregular'),reference);
}
// Undo crosses shape changes without losing center rotation or piece orientation.
for(const [axis,dir] of mixedMoves.reverse()){
 assert.ok(M.turn(mixed,axis,-dir));shape=shape==='regular'?'irregular':'regular';mixed=M.reshape(mixed,shape);
}
close(M.reshape(mixed,'irregular'),M.create());
close(M.reshape(mixed,'regular'),M.create('regular'));
const regularTurn=M.create('regular');M.turn(regularTurn,4,1);
for(const p of regularTurn)for(const f of p.faces)if(f.color>=0){
 assert.ok(M.axes.some(n=>f.points.every(v=>Math.abs(M.dot(n,v)-1)<1e-6)),'regular shell stays a dodecahedron after turning');
}
console.log('PASS: shell identity mapping, 120 mixed-shape moves, cross-shape undo, regular shell invariance.');

for(const shape of ['regular','irregular']){
 const live=M.create(shape),moves=[];
 assert.ok(M.isSolved(live,shape));
 for(let i=0;i<160;i++){const move=[(i*7+Math.floor(i/12))%12,i%3?1:-1];moves.push(move);M.turn(live,...move);}
 assert.ok(!M.isSolved(live,shape));close(M.fromMoves(shape,moves),live);
 for(const [axis,dir] of moves.slice().reverse())M.turn(live,axis,-dir);
 assert.ok(M.isSolved(live,shape));
}
console.log('PASS: fast session replay and solved detection in both shapes.');

// Every regular outer edge is split into three equal lengths.
for(const face of M.shell(M.axes))for(let i=0;i<face.points.length;i++){
 const a=face.points[i],b=face.points[(i+1)%face.points.length],cuts=[0,1];
 for(const axis of M.axes){
  const da=M.dot(axis,a),db=M.dot(axis,b);
  if(Math.abs(db-da)<1e-7)continue;
  const t=(M.regularDepth-da)/(db-da);
  if(t>1e-7&&t<1-1e-7)cuts.push(t);
 }
 cuts.sort((a,b)=>a-b);
 assert.equal(cuts.length,4);
 cuts.forEach((t,i)=>assert.ok(Math.abs(t-i/3)<1e-7));
}
// Fixed-distance inset works for both windings and preserves projected depth.
const outline=[[0,0,0],[100,0,100],[80,60,200],[10,60,130]];
for(const input of [outline,outline.slice().reverse()]){
 const inset=M.insetProjected(input,1.6);
 assert.equal(inset.length,4);
 for(const p of inset){
  assert.ok(Math.abs(p[2]-p[0]-2*p[1])<1e-7);
  const distances=input.map((a,i)=>{const b=input[(i+1)%input.length];return Math.abs((b[0]-a[0])*(p[1]-a[1])-(b[1]-a[1])*(p[0]-a[0]))/Math.hypot(b[0]-a[0],b[1]-a[1]);});
  assert.ok(distances.every(d=>d>=1.6-1e-7));
  assert.equal(distances.filter(d=>Math.abs(d-1.6)<1e-7).length,2);
 }
}
assert.equal(M.insetProjected([[0,0,0],[1,0,0],[0,1,0]],1.6).length,0);
console.log('PASS: equal regular edge thirds, uniform inset, depth interpolation and narrow polygons.');
