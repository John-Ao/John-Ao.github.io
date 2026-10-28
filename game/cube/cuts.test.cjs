const assert=require('node:assert/strict'),P=require('./polyhedra');
for(const type of ['skewb','octahedron','icosahedron'])for(const order of P.orders[type]){
 const c=P.config(type,order),faces=P.shell(c.normals),segments=order;
 for(const face of faces)face.points.forEach((a,i)=>{
  const b=face.points[(i+1)%face.points.length],ts=[0,1];
  for(const axis of c.axes)for(const d of c.cuts){const da=P.dot(a,axis),db=P.dot(b,axis);if(Math.abs(db-da)<1e-8)continue;const t=(d-da)/(db-da);if(t>1e-7&&t<1-1e-7&&!ts.some(u=>Math.abs(u-t)<1e-7))ts.push(t);}
  ts.sort((a,b)=>a-b);assert.equal(ts.length,segments+1,`${type} ${order} edge division count`);for(let j=1;j<ts.length;j++){const halfCorners=type==='skewb'&&order>2,expected=halfCorners?((j===1||j===ts.length-1)?.5:1)/(order-1):1/segments;assert(Math.abs(ts[j]-ts[j-1]-expected)<1e-7,`${type} ${order} edge segment widths`);}
 });
 if(type==='skewb'){
  for(const vertex of faces.flatMap(f=>f.points))for(const axis of c.axes)for(const d of c.cuts)assert(Math.abs(P.dot(vertex,axis)-d)>1e-7,'no skewb cut may pass through a cube vertex');
 }
 if(type!=='skewb'){
  const pieces=P.create(type,order),area=points=>{const origin=points[0];let sum=0;for(let i=1;i<points.length-1;i++)sum+=Math.hypot(...P.cross(P.sub(points[i],origin),P.sub(points[i+1],origin)))/2;return sum;};
  faces.forEach((f,color)=>{const tiles=pieces.flatMap(p=>p.faces.filter(g=>g.color===color));assert.equal(tiles.length,order**2);for(const tile of tiles)assert(Math.abs(area(tile.points)-area(f.points)/order**2)<1e-7,'equal-area triangular stickers');});
 }
 if(type==='icosahedron'){
  assert.equal(c.axes.length,12);assert.equal(c.step,2*Math.PI/5);
  for(const axis of c.axes){const vertices=faces.flatMap(f=>f.points);assert(vertices.some(v=>P.dot(P.norm(v),axis)>1-1e-7));}
 }
 console.log(`PASS ${type} ${order}: edge counts and widths, triangular subdivisions and rotation axes`);
}
