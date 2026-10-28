const assert=require('node:assert/strict'),P=require('./polyhedra');
for(const shape of [ [[0,0],[100,0],[100,100],[0,100]], [[0,90],[50,0],[100,90]], [[0,40],[20,0],[90,10],[110,80],[30,110]] ])for(const points of [shape,shape.slice().reverse()]){
 const inset=P.insetProjected(points,1.6);assert(inset.length>=3);
 const area=points.reduce((s,a,i)=>{const b=points[(i+1)%points.length];return s+a[0]*b[1]-b[0]*a[1];},0),sign=Math.sign(area);
 points.forEach((a,i)=>{const b=points[(i+1)%points.length],dx=b[0]-a[0],dy=b[1]-a[1];const distances=inset.map(p=>sign*(dx*(p[1]-a[1])-dy*(p[0]-a[0]))/Math.hypot(dx,dy));assert(Math.abs(Math.min(...distances)-1.6)<1e-8);});
}
assert.deepEqual(P.insetProjected([[0,0],[2,0],[2,2],[0,2]],1.6),[]);
const depth=(x,y)=>20-1/(.1+.001*x+.002*y),points=[[0,0],[100,0],[100,100],[0,100]].map(([x,y])=>[x,y,depth(x,y)]);
for(const [x,y,z]of P.insetProjected(points,1.6,20))assert(Math.abs(z-depth(x,y))<1e-8,'perspective depth stays on the original face');
for(const order of [2,4,6]){
 const pieces=P.create('megaminx',order),m=order/2;assert.equal(pieces.length,20+60*m*(m-1));
 for(let color=0;color<12;color++)assert.equal(pieces.flatMap(p=>p.faces).filter(f=>f.color===color).length,5*m*m);
 const surfaceKey=f=>f.points.map(v=>v.map(x=>Math.round(x*1e5)).join(',')).sort().join('|');
 const surface=ps=>ps.flatMap(p=>p.faces.filter(f=>f.color>=0)).map(surfaceKey).sort();
 const original=surface(pieces);
 for(let i=0;i<48;i++){P.turn(pieces,'megaminx',order,i%12,i%m,i%2?1:-1);assert.deepEqual(surface(pieces),original,'turns permute the surface without holes or overlaps');}
}
console.log('PASS: equal edge offsets in both windings, collapsed faces, perspective depth; even minx topology and surface coverage after turns.');
// Equal in-plane margins do not grow when a face tilts toward edge-on.
const square3D=[[-1,-1,0],[1,-1,0],[1,1,0],[-1,1,0]],margin=.04;
for(const angle of [0,Math.PI/4,Math.PI*.45,Math.PI*.495]){
 const face=square3D.map(v=>P.rotate(v,[0,1,0],angle)),inset=P.insetFace(face,margin);
 assert.equal(inset.length,4);
 const local=inset.map(v=>P.rotate(v,[0,1,0],-angle));
 for(const p of local){assert(Math.abs(p[2])<1e-8);assert(Math.abs(Math.abs(p[0])-(1-margin))<1e-8);assert(Math.abs(Math.abs(p[1])-(1-margin))<1e-8);}
 const faceWidth=Math.max(...face.map(v=>v[0]))-Math.min(...face.map(v=>v[0])),stickerWidth=Math.max(...inset.map(v=>v[0]))-Math.min(...inset.map(v=>v[0]));
 assert(Math.abs(stickerWidth/faceWidth-(1-margin))<1e-8);
}
console.log('PASS: face-plane insets remain equidistant and preserve coverage up to an 89.1-degree tilt.');
