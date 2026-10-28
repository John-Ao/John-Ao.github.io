const assert=require('node:assert/strict'),C=require('./clock-model.js'),legacy=require('../magic_clock/model.js');
for(let mask=0;mask<16;mask++)for(let side=0;side<2;side++)for(let wheel=0;wheel<4;wheel++){
 const a=C.fresh(),b=legacy.fresh();a.pins=b.pins=Array.from({length:4},(_,p)=>!!(mask&(1<<p)));C.turn(a,side,wheel,1);legacy.turn(b,side,wheel,1);assert.deepEqual(a.faces,b.faces);
}
for(let w=2;w<=6;w++)for(let h=2;h<=6;h++){
 const s=C.fresh(w,h),original=JSON.stringify(s),moves=[];
 for(let i=0;i<100;i++){const move=i%3===0?[2,i%s.pins.length,1]:[i%2,i%4,1+i%11];C.move(s,...move);moves.push(move);
 for(const p of [0,w-1,w*(h-1),w*h-1])assert.equal((s.faces[0][p]+s.faces[1][C.mirror(p,w)])%12,0);
 }for(const [a,l,d] of moves.reverse())C.move(s,a,l,-d);assert.equal(JSON.stringify(s),original);
 const all=C.fresh(w,h);C.turn(all,0,0,1);assert(all.faces[0].every(n=>n===1));
}
for(const size of [[1,3],[7,3],[2.5,3],[3,NaN]])assert.throws(()=>C.fresh(...size));
console.log('PASS: legacy 3×3 compatibility, all 25 sizes, mirrored corners, inverse replay and validation');
