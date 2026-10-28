const assert=require('node:assert/strict'),P=require('./polyhedra');
for(const order of P.orders.octahedron){
 const pieces=P.create('octahedron',order),config=P.config('octahedron',order),m=config.cuts.length;
 for(let axis=0;axis<4;axis++){
  const layers=[];
  for(const a of [axis,axis+4])for(const layer of [0,...Array.from({length:m-1},(_,i)=>1+i+(order%2))])layers.push(P.selection(pieces,'octahedron',order,a,layer));
  if(order%2)layers.push(P.selection(pieces,'octahedron',order,axis,1));
  assert.equal(layers.length,order);
  const ids=layers.flat();assert.equal(ids.length,pieces.length);assert.equal(new Set(ids).size,pieces.length,'each piece belongs to one slice');
 }
 for(let axis=0;axis<8;axis++)for(let layer=1;layer<P.layerCount('octahedron',order);layer++){
  const before=structuredClone(pieces),ids=new Set(P.selection(pieces,'octahedron',order,axis,layer));
  assert(ids.size>0);P.turn(pieces,'octahedron',order,axis,layer,1);
  for(let i=0;i<pieces.length;i++)if(!ids.has(pieces[i].id))assert.deepEqual(pieces[i],before[i],'other layers stay fixed');
  for(let i=0;i<2;i++)P.turn(pieces,'octahedron',order,axis,layer,1);
  assert(P.solved(pieces,'octahedron',order));
 }
}
console.log('PASS octahedron: complete disjoint layers, independent inner turns, three-turn cycles');
