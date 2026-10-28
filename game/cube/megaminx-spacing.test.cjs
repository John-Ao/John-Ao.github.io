const assert=require('node:assert/strict'),P=require('./polyhedra');
for(const order of [3,5,7]){
 const c=P.config('megaminx',order),faces=P.shell(c.normals);
 for(const face of faces)face.points.forEach((a,i)=>{
  const b=face.points[(i+1)%face.points.length],ts=[0,1];
  for(const axis of c.axes)for(const d of c.cuts){
   const da=P.dot(a,axis),db=P.dot(b,axis);if(Math.abs(db-da)<1e-8)continue;
   const t=(d-da)/(db-da);
   if(t>1e-7&&t<1-1e-7&&!ts.some(v=>Math.abs(v-t)<1e-7))ts.push(t);
  }
  ts.sort((a,b)=>a-b);assert.equal(ts.length,order+1);
  for(let j=1;j<ts.length;j++)assert(Math.abs(ts[j]-ts[j-1]-1/order)<1e-7,'all edge segments, including the middle, have equal length');
 });
 const spacing=(3-Math.sqrt(5))/order;
 c.cuts.forEach((d,i)=>assert(Math.abs((i?c.cuts[i-1]:1)-d-spacing)<1e-7,'parallel cuts have equal spacing'));
 console.log('PASS megaminx '+order+': all edges divided equally; uniform parallel cut spacing');
}
