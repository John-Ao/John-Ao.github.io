const assert=require('node:assert/strict'),P=require('./polyhedra');
for(const order of P.orders.pyraminx){
 const pieces=P.create('pyraminx',order),c=P.config('pyraminx',order);
 for(let axis=0;axis<4;axis++){
  const selected=new Set();
  for(let layer=0;layer<order;layer++){
   const ids=P.selection(pieces,'pyraminx',order,axis,layer);
   for(const id of ids){assert(!selected.has(id),'layers must not overlap');selected.add(id);}
   const copy=structuredClone(pieces);
   P.turn(copy,'pyraminx',order,axis,layer,1);
   copy.forEach((p,i)=>{if(!ids.includes(p.id))assert.deepEqual(p,pieces[i],'other layers remain stationary');});
   P.turn(copy,'pyraminx',order,axis,layer,-1);
   copy.forEach((p,i)=>p.faces.forEach((f,j)=>f.points.forEach((v,k)=>assert(Math.hypot(...v.map((x,a)=>x-pieces[i].faces[j].points[k][a]))<1e-8))));
  }
  assert.equal(selected.size,pieces.length,'all layers cover the puzzle');

 }
 console.log('PASS pyramid '+order+': disjoint layers, stationary neighbours, inverse');
}
