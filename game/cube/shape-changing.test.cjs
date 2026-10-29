const assert=require('node:assert/strict'),P=require('./polyhedra'),S=require('./state');
const countFaces=p=>p.faces.filter(f=>f.color>=0).length;
const encode=(type,pieces)=>S.encode({puzzleType:type,order:3,pieces});
let seed=231;const random=()=>((seed=(1664525*seed+1013904223)>>>0)/2**32);
for(const type of ['helicopter','mixup']){
 let pieces=P.create(type),original=structuredClone(pieces);
 assert.equal(pieces.length,type==='helicopter'?32:26);
 assert.equal(pieces.filter(p=>countFaces(p)===3).length,8);
 assert.equal(pieces.filter(p=>countFaces(p)===1).length,type==='helicopter'?24:6);
 if(type==='mixup')assert.equal(pieces.filter(p=>countFaces(p)===2).length,12);
 const amounts=P.turnAmounts(type);
 for(const [a,l] of P.legalMoves(pieces,type,3))for(const amount of amounts)for(const sign of [-1,1]){
  const dir=amount*sign;
  P.turn(pieces,type,3,a,l,dir);assert(!P.solved(pieces,type,3));
  pieces=S.decode(encode(type,pieces)).pieces;
  P.turn(pieces,type,3,a,l,-dir);assert(P.solved(pieces,type,3));
 }
 if(type==='helicopter'){
  // A jumbling stop exposes a neighboring cut that is blocked between detents.
  const axis=0,ids=new Set(P.selection(pieces,type,3,axis,0)),n=P.config(type,3).axes[axis];
  const intermediate=structuredClone(pieces);
  for(const p of intermediate)if(ids.has(p.id))for(const f of p.faces)f.points=f.points.map(v=>P.rotate(v,n,.6));
  P.turn(pieces,type,3,axis,0,amounts[0]);
  assert(P.legalMoves(pieces,type,3).some(([a,l])=>a!==axis&&!P.selection(intermediate,type,3,a,l)));
  assert(pieces.some(p=>p.faces.some(f=>f.points.some(v=>v.some(x=>Math.abs(x)>1+1e-6)))));
 }else{
  assert.equal(P.step(type,3,0,0),Math.PI/2);assert.equal(P.step(type,3,0,1),Math.PI/4);
  P.turn(pieces,type,3,0,1,1);
  const movedCenters=pieces.filter(p=>countFaces(p)===1&&Math.abs(P.average(p.faces.filter(f=>f.color>=0)[0].points)[0])<1e-6);
  assert.equal(movedCenters.length,4);
  assert(movedCenters.every(p=>P.selection(pieces,type,3,2,0).includes(p.id)||P.selection(pieces,type,3,3,0).includes(p.id)),'centers enter outer layers after a 45° slice');
  P.turn(pieces,type,3,2,0,1);
 }
 const special=encode(type,pieces),restored=S.decode(special);
 assert.equal(encode(type,restored.pieces),special);
 assert.deepEqual(P.legalMoves(restored.pieces,type,3),P.legalMoves(pieces,type,3));
 pieces=P.create(type);const moves=[];let blocked=0;
 for(let i=0;i<997;i++){
  const legal=P.legalMoves(pieces,type,3),c=P.config(type,3);
  for(let a=0;a<c.axes.length;a++)for(let l=0;l<P.layerCount(type,3);l++)if(!P.selection(pieces,type,3,a,l)){
   blocked++;const before=encode(type,pieces);assert.throws(()=>P.turn(pieces,type,3,a,l,1));assert.equal(encode(type,pieces),before);
  }
  const move=[...legal[Math.floor(random()*legal.length)],amounts[Math.floor(random()*amounts.length)]*(random()<.5?1:-1)];
  P.turn(pieces,type,3,...move);moves.push(move);
  if(i%100===0)pieces=S.decode(encode(type,pieces)).pieces;
 }
 if(type==='helicopter')assert(blocked>0,'jumbling must block crossing cuts');assert(!P.solved(pieces,type,3));
 pieces=S.decode(encode(type,pieces)).pieces;
 for(const [a,l,d] of moves.reverse())P.turn(pieces,type,3,a,l,-d);
 assert(P.solved(pieces,type,3));
 pieces.forEach((p,i)=>p.faces.forEach((f,j)=>f.points.forEach((v,k)=>assert(Math.hypot(...P.sub(v,original[i].faces[j].points[k]))<1e-6))));
 console.log(`PASS ${type}: pieces, special turns, legal cuts, 997 moves with reloads, inverse and all vertices restored`);
}

// Consecutive drags must align absolute cut orientations, including after reload.
for(let axis=0;axis<12;axis++)for(const sign of [-1,1]){
 const type='helicopter',j=P.turnAmounts(type)[0];
 let pieces=P.create(type);
 P.turn(pieces,type,3,axis,0,sign*j);
 pieces=S.decode(encode(type,pieces)).pieces;
 const delta=sign*(1-2*j),stops=P.turnStops(pieces,type,3,axis);
 assert(stops.some(n=>Math.abs(n-delta)<1e-9),'70.53° to 109.47° needs a 38.94° stop');
 P.turn(pieces,type,3,axis,0,delta);
 const expected=P.create(type);P.turn(expected,type,3,axis,0,sign*(1-j));
 pieces.forEach((p,i)=>p.frame.forEach((r,k)=>r.forEach((v,l)=>assert(Math.abs(v-expected[i].frame[k][l])<1e-9))));
 P.turn(pieces,type,3,axis,0,-delta);
 P.turn(pieces,type,3,axis,0,-sign*j);
 assert(P.solved(pieces,type,3));
}
console.log('PASS helicopter consecutive alignment stops on all 12 axes in both directions');
