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
  for(let layer=0;layer<order-1;layer++){
   const legacy=structuredClone(pieces),expanded=structuredClone(pieces);
   for(const p of legacy)if(Math.min(...p.faces.flatMap(f=>f.points.map(v=>P.dot(v,c.axes[axis]))))>=c.cuts[layer]-1e-6)
    for(const f of p.faces)f.points=f.points.map(v=>P.rotate(v,c.axes[axis],c.step));
   for(let slice=layer;slice<order-1;slice++)P.turn(expanded,'pyraminx',order,axis,slice,1);
   assert.deepEqual(expanded,legacy,'legacy cap equals its individual slices');
  }
 }
 console.log('PASS pyramid '+order+': disjoint layers, stationary neighbours, inverse, legacy cap equivalence');
}
