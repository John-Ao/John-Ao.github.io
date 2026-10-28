const assert=require('node:assert/strict'),C=require('./clock-model.js');
for(let w=2;w<=6;w++)for(let h=2;h<=6;h++){
 const s=C.fresh(w,h),original=JSON.stringify(s),moves=[];
 for(let i=0;i<100;i++){const move=i%3===0?[2,i%s.pins.length,1]:[i%2,i%4,1+i%11];C.move(s,...move);moves.push(move);
 for(const p of [0,w-1,w*(h-1),w*h-1])assert.equal((s.faces[0][p]+s.faces[1][C.mirror(p,w)])%12,0);
 }for(const [a,l,d] of moves.reverse())C.move(s,a,l,-d);assert.equal(JSON.stringify(s),original);
 const all=C.fresh(w,h);C.turn(all,0,0,1);assert(all.faces[0].every(n=>n===1));
}
for(const size of [[1,3],[7,3],[2.5,3],[3,NaN]])assert.throws(()=>C.fresh(...size));
console.log('PASS: all 25 sizes, mirrored corners, inverse replay and validation');

for(let w=2;w<=6;w++)for(let h=2;h<=6;h++){
 const state=C.fresh(w,h);
 assert(C.solved(state));
 for(let i=0;i<state.pins.length;i++)C.move(state,2,i,1);
 assert(C.solved(state),'pin positions do not affect a solved clock');
 for(let face=0;face<2;face++)for(let dial=0;dial<w*h;dial++){
  state.faces[face][dial]=1;assert(!C.solved(state),'every dial on both sides must point to twelve');
  state.faces[face][dial]=0;assert(C.solved(state));
 }
}
console.log('PASS clock solved state: all 25 dimensions, both faces, every dial and pin independence');
