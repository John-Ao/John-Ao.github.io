const assert=require('node:assert/strict'),P=require('./polyhedra');
let seed=314159;const random=()=>((seed=(1664525*seed+1013904223)>>>0)/2**32);
for(const type of Object.keys(P.orders))for(const order of P.orders[type].length?P.orders[type]:[3]){
 const pieces=P.create(type,order),original=JSON.parse(JSON.stringify(pieces));assert(P.solved(pieces,type,order));
 for(const [axis,layer] of P.legalMoves(pieces,type,order)){
  const count=Math.round(2*Math.PI/P.step(type,order,axis));for(let i=0;i<count;i++)P.turn(pieces,type,order,axis,layer,1);assert(P.solved(pieces,type,order));
 }
 for(const piece of pieces){const edges=new Map();for(const face of piece.faces)face.points.forEach((a,i)=>{const b=face.points[(i+1)%face.points.length],key=[a,b].map(v=>v.map(x=>Math.round(x*1e5)).join()).sort().join('|');edges.set(key,(edges.get(key)||0)+1);});assert([...edges.values()].every(n=>n===2),'each piece has a closed shell');}
 const moves=[];for(let i=0;i<60;i++){const choices=P.legalMoves(pieces,type,order),move=[...choices[Math.floor(random()*choices.length)],random()<.5?-1:1];P.turn(pieces,type,order,...move);moves.push(move);}
 assert(!P.solved(pieces,type,order));
 for(const [axis,layer,dir] of moves.reverse())P.turn(pieces,type,order,axis,layer,-dir);
 assert(P.solved(pieces,type,order));pieces.forEach((p,i)=>p.faces.forEach((f,j)=>f.points.forEach((v,k)=>assert(Math.hypot(...v.map((x,a)=>x-original[i].faces[j].points[k][a]))<1e-5))));
 console.log(`PASS ${type} ${order}: full rotations, 60 legal moves and inverse, all vertices restored`);
}
const square=P.create('sq1');P.turn(square,'sq1',3,0,0,1);assert.equal(P.selection(square,'sq1',3,2,0),null);assert.throws(()=>P.turn(square,'sq1',3,2,0,1));
console.log('PASS SQ-1 rejects a blocked slice');
