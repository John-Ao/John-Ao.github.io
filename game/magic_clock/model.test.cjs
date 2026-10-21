const assert=require('node:assert/strict');
const M=require('./model.js');
for(let mask=0;mask<16;mask++)for(let side=0;side<2;side++)for(let wheel=0;wheel<4;wheel++){
 const s=M.fresh();s.pins=s.pins.map((_,i)=>!!(mask&(1<<i)));
 const before=JSON.stringify(s);M.turn(s,side,wheel,1);assert(M.valid(s));assert(!M.solved(s));M.turn(s,side,wheel,-1);assert.equal(JSON.stringify(s),before);
 M.turn(s,side,wheel,12);assert.equal(JSON.stringify(s),before);
}
const all=M.fresh();M.turn(all,0,0,1);assert.deepEqual(all.faces[0],Array(9).fill(1));assert.deepEqual(all.faces[1],[11,0,11,0,0,0,11,0,11]);
const one=M.fresh();one.pins=[true,false,false,false];M.turn(one,0,0,1);assert.deepEqual(one.faces[0],[1,1,0,1,1,0,0,0,0]);assert.deepEqual(one.faces[1],[0,0,11,0,0,0,0,0,0]);
const mirrored=M.fresh();mirrored.pins=[false,true,true,true];M.turn(mirrored,1,1,1);assert.deepEqual(mirrored.faces[1],[0,1,1,0,1,1,0,0,0]);assert.deepEqual(mirrored.faces[0],[11,0,0,0,0,0,0,0,0]);
const s=M.fresh(),history=[];for(let n=0;n<200;n++){s.pins=s.pins.map(()=>Math.random()<.5);const move={pins:[...s.pins],side:n%2,wheel:n%4,amount:1+Math.floor(Math.random()*11)};history.push(move);M.turn(s,move.side,move.wheel,move.amount);assert(M.valid(s));}for(const move of history.reverse()){s.pins=move.pins;M.turn(s,move.side,move.wheel,-move.amount);}assert(M.solved(s));
assert(!M.valid({faces:[[0],[0]],pins:[]}));const invalid=M.fresh();invalid.faces[0][0]=1;assert(!M.valid(invalid));
console.log('Passed: 128 pin/side/wheel combinations, mirrored coupling, 12-step cycles, 200-move reversal, invalid states.');
