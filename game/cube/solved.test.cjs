const assert=require('node:assert/strict'),P=require('./polyhedra'),M=require('./model');
const shared=require('./fixtures/megaminx-2-solved.json');
const replay=P.create(shared.puzzleType,shared.order);
assert.equal(shared.moves.length,shared.cursor);
for(const move of shared.moves)P.turn(replay,shared.puzzleType,shared.order,...move);
assert(P.solved(replay,'megaminx',2),'the shared 236-move solved Kilominx must be recognized');
P.turn(replay,'megaminx',2,0,0,1);
assert(!P.solved(replay,'megaminx',2),'one additional face turn is not solved');
P.turn(replay,'megaminx',2,0,0,-1);
assert(P.solved(replay,'megaminx',2));
console.log('PASS shared Kilominx: solved, turned, and restored');

for(const [type,orders] of Object.entries(P.orders)){
 if(type==='gear')continue;
 for(const order of orders.length?orders:[3]){
  const pieces=P.create(type,order),c=P.config(type,order);
  assert(P.solved(pieces,type,order));
  const angle=type==='sq1'?Math.PI/2:c.step,n=c.axes[0];
  for(const p of pieces){
   if(p.anchor)p.anchor=P.rotate(p.anchor,n,angle);
   for(const f of p.faces)f.points=f.points.map(v=>P.rotate(v,n,angle));
  }
  assert(P.solved(pieces,type,order),`${type} ${order}: rigid reorientation is solved`);
  const move=P.legalMoves(pieces,type,order)[0];
  P.turn(pieces,type,order,...move,1);
  assert(!P.solved(pieces,type,order),`${type} ${order}: mixed faces are not solved`);
  P.turn(pieces,type,order,...move,-1);
  assert(P.solved(pieces,type,order));
  // Uniform colors alone are insufficient if the pieces leave the shell.
  for(const p of pieces)for(const f of p.faces)f.points=f.points.map(v=>v.map(x=>x*1.01));
  assert(!P.solved(pieces,type,order),`${type} ${order}: wrong shape is not solved`);
  console.log(`PASS ${type} ${order}: orientation-independent solve, mixed faces, shell geometry`);
 }
}
for(const size of [...Array.from({length:8},(_,i)=>[i+2,i+2,i+2]),[2,3,4],[1,5,5],[5,1,5],[5,5,1]])for(let axis=0;axis<3;axis++){
 const pieces=M.create(size);
 for(let layer=-(size[axis]-1)/2;layer<size[axis]/2;layer++)M.turn(pieces,size,axis,layer,1);
 assert(M.solved(pieces));
 const side=size.findIndex(n=>n>1);
 M.turn(pieces,size,side,(size[side]-1)/2,1);assert(!M.solved(pieces));
 M.turn(pieces,size,side,(size[side]-1)/2,-1);assert(M.solved(pieces));
}
console.log('PASS cuboids: orders 2–9, rectangular and flat shapes, all three axes, mixed faces and inverse');
