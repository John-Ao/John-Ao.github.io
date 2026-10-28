const assert=require('node:assert/strict'),S=require('./state'),P=require('./polyhedra'),M=require('./model'),C=require('./clock-model');
const fresh=s=>s.puzzleType==='cuboid'?M.create(s.size):s.puzzleType==='clock'?C.fresh(...s.clockSize):P.create(s.puzzleType,s.order);
const turn=(s,m)=>s.puzzleType==='cuboid'?M.turn(s.pieces,s.size,...m):s.puzzleType==='clock'?C.move(s.pieces,...m):P.turn(s.pieces,s.puzzleType,s.order,...m);
function close(a,b){if(typeof a==='number'){assert(Math.abs(a-b)<1e-7,`${a} != ${b}`);return;}if(Array.isArray(a)){assert.equal(a.length,b.length);a.forEach((v,i)=>close(v,b[i]));return;}if(a&&typeof a==='object'){assert.deepEqual(Object.keys(a).sort(),Object.keys(b).sort());for(const k of Object.keys(a))close(a[k],b[k]);return;}assert.equal(a,b);}
let seed=42;const random=()=>((seed=(1664525*seed+1013904223)>>>0)/2**32);
for(const type of ['cuboid',...Object.keys(P.orders),'clock'])for(const order of type==='cuboid'?[2,3,4]:P.orders[type]?.length?P.orders[type]:[3]){
 const s={puzzleType:type,order,size:[order,3,2],clockSize:[6,4]};s.pieces=fresh(s);
 const first=S.encode(s);close(S.decode(first).pieces,s.pieces);
 for(let i=0;i<24;i++){
  const legal=type==='cuboid'||type==='clock'?null:P.legalMoves(s.pieces,type,order);
  const move=type==='cuboid'?[i%3,i%s.size[i%3]-(s.size[i%3]-1)/2,i%2?1:-1]:type==='clock'?(i%3===0?[2,i%15,1]:[i%2,i%4,i%2?11:-7]):[...legal[Math.floor(random()*legal.length)],random()<.5?1:-1];
  turn(s,move);
 }
 const encoded=S.encode(s),restored=S.decode(encoded);close(restored.pieces,s.pieces);assert.equal(S.encode(restored),encoded);
 // Restored geometry must remain on the exact cut planes for subsequent play.
 if(type!=='cuboid'&&type!=='clock'){
  assert.deepEqual(P.legalMoves(restored.pieces,type,order),P.legalMoves(s.pieces,type,order));
  const move=[...P.legalMoves(s.pieces,type,order)[0],1];turn(s,move);turn(restored,move);close(restored.pieces,s.pieces);
 }
 for(const bad of ['',encoded.slice(0,-1),encoded+'A',encoded.slice(0,-3)+'AAA','%7B%22v%22:1%7D'])assert.throws(()=>S.decode(bad));
 console.log(`PASS state ${type} ${order}: current geometry, continued play, stable re-encoding and corruption`);
}
const fixture=require('./fixtures/megaminx-2-solved.json'),s={...fixture};s.pieces=fresh(s);for(const m of fixture.moves)turn(s,m);
const encoded=S.encode(s),old=encodeURIComponent(JSON.stringify(fixture));assert(encoded.length<old.length*.02);
assert(P.solved(S.decode(encoded).pieces,'megaminx',2));
console.log(`PASS shared 236-move position: ${old.length} → ${encoded.length} characters, no move history`);
