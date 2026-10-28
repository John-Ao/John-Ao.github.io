const assert=require('node:assert/strict'),P=require('./polyhedra');
const surface=pieces=>pieces.flatMap(p=>p.faces.filter(f=>f.color>=0)).map(f=>f.points.map(v=>v.map(x=>Math.round(x*1e5)).join(',')).sort().join('|')).sort();
for(const order of P.orders.megaminx){
 const pieces=P.create('megaminx',order),c=P.config('megaminx',order),m=c.cuts.length,original=surface(pieces);
 for(let axis=0;axis<c.axes.length;axis++){
  assert.equal(P.layerCount('megaminx',order),m);
  assert.equal(P.selection(pieces,'megaminx',order,axis,m),null,'no broad middle layer');
  const selected=[];
  for(let layer=0;layer<m;layer++){
   const ids=P.selection(pieces,'megaminx',order,axis,layer);
   assert(ids?.length);
   assert(ids.every(id=>!selected.includes(id)),'layers do not overlap');
   selected.push(...ids);
   const low=c.cuts[layer],high=layer===0?Infinity:c.cuts[layer-1];
   for(const p of pieces.filter(p=>ids.includes(p.id))){
    const heights=p.anchor?[P.dot(p.anchor,c.axes[axis])]:p.faces.flatMap(f=>f.points.map(v=>P.dot(v,c.axes[axis])));
    assert(Math.min(...heights)>=low-1e-6&&Math.max(...heights)<=high+1e-6);
   }
   const before=structuredClone(pieces),selectedIds=new Set(ids);
   P.turn(pieces,'megaminx',order,axis,layer,1);
   for(let i=0;i<pieces.length;i++)if(!selectedIds.has(pieces[i].id))assert.deepEqual(pieces[i],before[i]);
   assert.deepEqual(surface(pieces),original,'inner turns preserve complete surface coverage');
   P.turn(pieces,'megaminx',order,axis,layer,-1);assert(P.solved(pieces,'megaminx',order));
  }
 }
 console.log('PASS megaminx '+order+': disjoint layers, no broad middle, surface coverage and inverse');
}
