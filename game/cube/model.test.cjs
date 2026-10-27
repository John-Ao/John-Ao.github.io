const assert=require('node:assert/strict');
const M=require('./model.js');
const signature=p=>JSON.stringify(p,(k,v)=>typeof v==='number'&&Object.is(v,-0)?0:v);
let cases=0;
for(let x=1;x<=5;x++)for(let y=1;y<=5;y++)for(let z=1;z<=5;z++){
 const size=[x,y,z],p=M.create(size),initial=signature(p);
 assert.equal(p.length,x*y*z);assert(M.solved(p));
 assert.equal(p.reduce((s,p)=>s+p.stickers.length,0),2*(x*y+y*z+x*z));
 for(let a=0;a<3;a++)for(let i=0;i<size[a];i++){
  const l=i-(size[a]-1)/2,other=size.filter((_,j)=>j!==a);
  assert.equal(M.step(size,a),other[0]===other[1]?Math.PI/2:Math.PI);
  M.turn(p,size,a,l,1);M.turn(p,size,a,l,-1);assert.equal(signature(p),initial);
  const count=other[0]===other[1]?4:2;for(let j=0;j<count;j++)M.turn(p,size,a,l,1);assert.equal(signature(p),initial);
 }
 const moves=[];
 for(let n=0;n<60;n++){const a=(n*7+n%4)%3,l=(n*13%size[a])-(size[a]-1)/2,d=n%2?1:-1;M.turn(p,size,a,l,d);moves.push([a,l,d]);
  assert.equal(new Set(p.map(p=>p.p.join(','))).size,p.length);
  for(const piece of p){piece.p.forEach((v,i)=>assert(Math.abs(v)<size[i]/2));for(const s of piece.stickers){const a=s.n.findIndex(n=>n!==0);assert.equal(piece.p[a]*s.n[a]+0,(size[a]-1)/2);}}
 }
 for(const [a,l,d]of moves.reverse())M.turn(p,size,a,l,-d);assert.equal(signature(p),initial);assert(M.solved(p));cases++;
}
const camera=M.axes;
for(const x of [-1,0,1])for(const y of [-1,0,1]){
 const point=[x,y,1.5];
 const right=M.matchGesture(point,[0,0,1],camera,100,0),up=M.matchGesture(point,[0,0,1],camera,0,-100);
 assert.equal(right.axis,1);assert.equal(right.dir,1);assert.equal(up.axis,0);assert.equal(up.dir,-1);
}
assert.throws(()=>M.create([0,3,3]));assert.throws(()=>M.create([1,2.5,3]));
console.log(`PASS: ${cases} sizes, every layer and legal angle, inverse scrambles, occupancy and exterior stickers; face-center/edge/corner gestures.`);
// Projected neighboring sticker centers define the row/column direction.
for(const camera of [M.axes,M.axes.map(v=>M.rotate(M.rotate(v,0,-.4),1,.6))]){
 const distance=9,project=p=>{const q=camera.map(r=>M.dot(r,p));return [q[0]/(distance-q[2]),-q[1]/(distance-q[2])];};
 for(const point of [[0,0,1.5],[1,1,1.5],[-1,-1,1.5]])for(const axis of [0,1])for(const dir of [-1,1]){
  const a=project(point),b=project(point.map((v,i)=>v+M.cross(M.axes[axis],[0,0,1])[i]*dir));
  const match=M.matchGesture(point,[0,0,1],camera,b[0]-a[0],b[1]-a[1],distance);
  assert.equal(match.axis,axis);assert.equal(match.dir,dir);
 }
}
console.log('PASS: perspective gesture directions match projected neighboring stickers.');
const trace=points=>{const track=M.createTrajectory();points.forEach(p=>M.extendTrajectory(track,...p));return track;};
const choose=(track,previous)=>M.matchTrajectory([0,0,1.5],[0,0,1],M.axes,track,9,previous);
const correction=trace([[10,0]]);assert.equal(choose(correction).axis,1);
M.extendTrajectory(correction,10,110);assert.equal(choose(correction,1).axis,0);
// Identical endpoints, different complete paths: the trajectory must matter.
assert.equal(choose(trace([[0,100],[60,100],[60,60]])).axis,0);
assert.equal(choose(trace([[100,0],[100,60],[60,60]])).axis,1);
const sparse=trace([[10,0],[10,110]]),dense=trace(Array.from({length:10},(_,i)=>[i+1,0]).concat(Array.from({length:110},(_,i)=>[10,i+1])));
for(const key of ['xx','xy','yy','length'])assert(Math.abs(sparse[key]-dense[key])<1e-6);
assert.equal(choose(dense).axis,choose(sparse).axis);
assert.equal(choose(trace([[0,100],[0,-80]])).dir,-1);
assert.equal(choose(trace([[0,100],[0,0]])),null);
assert.equal(choose(trace([[3,2],[-2,3],[1,1]])),null);
assert.equal(choose(trace([[60,60]]),0).axis,0);
assert.equal(choose(trace([[60,60]]),1).axis,1);
console.log('PASS: whole-path correction, same-endpoint path discrimination, sample-density independence, reversal, return-to-origin, jitter and tie stability.');
// Three-face views from above and below: every visible sticker follows its
// projected neighbor, including thin cuboids and nearly parallel projected rows.
let projectedCases=0;
for(const pitch of [-.62,.62])for(const size of [[3,3,3],[2,3,4],[1,5,2],[5,1,1]]){
 const camera=M.axes.map(v=>M.rotate(M.rotate(v,0,pitch),1,.78)),distance=Math.hypot(...size)*1.8;
 const project=p=>{const q=camera.map(r=>M.dot(r,p));return [q[0]/(distance-q[2]),-q[1]/(distance-q[2])];};
 for(const piece of M.create(size))for(const sticker of piece.stickers){
  const point=piece.p.map((v,i)=>v+sticker.n[i]*.5);
  if(M.dot(sticker.n,camera[2].map((v,i)=>v*distance-point[i]))<=0)continue;
  const eligible=[0,1,2].filter(a=>sticker.n[a]===0);
  for(const axis of eligible)for(const dir of [-1,1]){
   const tangent=M.cross(M.axes[axis],sticker.n),a=project(point),b=project(point.map((v,i)=>v+tangent[i]*dir));
   const delta=b.map((v,i)=>v-a[i]),length=Math.hypot(...delta),track=trace([delta.map(v=>v/length*100)]);
   const match=M.matchTrajectory(point,sticker.n,camera,track,distance,eligible.find(a=>a!==axis));
   assert.equal(match.axis,axis);assert.equal(match.dir,dir);projectedCases++;
  }
 }
}
console.log(`PASS: ${projectedCases} projected-neighbor swipes across upper/lower three-face views and cuboid sizes, with correction from the wrong preview axis.`);
