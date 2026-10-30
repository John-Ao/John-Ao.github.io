const assert=require('node:assert/strict');
const R=require('./engine.js'),levels=require('./levels.js');
assert.equal(R.destination([24,0],0,1),null,'edge is not a catcher');
assert.equal(R.destination([24,25],0,1),null,'adjacent piece blocks');
assert.equal(R.destination([21,27,25],0,1),24,'nearest catcher stops one square short');
assert.equal(R.destination([3,45],0,2),38,'vertical movement');
assert.equal(R.destination([21,27],0,1),26,'passing target must not win');
assert.equal(R.destination([24,26],0,1),25,'piece can depart center');
assert.deepEqual(R.solve([24,0]),[],'already solved');
assert.equal(R.solve([0,48]),null,'dead-end detection');
for(const [index,l] of levels.entries()){
 let p=l.pieces.slice();assert.equal(new Set(p).size,p.length);
 for(const [i,d] of l.solution){const before=p.slice();p=R.move(p,i,d);assert.ok(p,`level ${index+1}: legal solution`);assert.equal(new Set(p).size,p.length);assert.equal(before.filter((x,j)=>x!==p[j]).length,1);}
 assert.equal(p[0],24,`level ${index+1}: solved`);
 const path=R.solve(l.pieces);assert.ok(path);assert.equal(path.length,l.par,`level ${index+1}: shortest solution`);
 let start=l.pieces.slice();for(const [i,d]of path)start=R.move(start,i,d);assert.equal(start[0],24);
 console.log(`Level ${index+1}: validated, minimum ${path.length} moves`);
}
console.log('All rule and level tests passed.');

// Published indexes and content remain compatible with existing local saves.
assert.deepEqual(levels.slice(0,12),require('./legacy_levels.json'));
assert.equal(levels.length,60);
function canonical(pieces){
 const forms=[];
 for(const flip of [false,true]){
  let points=pieces.map(p=>[flip?6-p%7:p%7,Math.floor(p/7)]);
  for(let r=0;r<4;r++){
   const positions=points.map(([x,y])=>x+7*y);
   forms.push(JSON.stringify([positions[0],...positions.slice(1).sort((a,b)=>a-b)]));
   points=points.map(([x,y])=>[6-y,x]);
  }
 }
 return forms.sort()[0];
}
assert.equal(new Set(levels.map(l=>canonical(l.pieces))).size,levels.length,'no symmetry/robot-permutation duplicates');
for(let distance=2;distance<=9;distance++)assert.equal(levels.slice(12).filter(l=>l.par===distance).length,6);
console.log('PASS: immutable legacy prefix, 60 distinct puzzles, balanced shortest-distance tiers.');
