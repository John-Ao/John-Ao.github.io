const assert=require('node:assert/strict'),P=require('./polyhedra');
const pieces=P.create('sq1'),eps=1e-6,key=ps=>ps.map(v=>v.map(x=>Math.round(x*1e6)).join(',')).sort().join('|');
assert.equal(pieces.length,18);
const tops=pieces.filter(p=>p.faces.flatMap(f=>f.points).every(v=>v[1]>=1/3-eps));
const bottoms=pieces.filter(p=>p.faces.flatMap(f=>f.points).every(v=>v[1]<=-1/3+eps));
assert.equal(tops.length,8);assert.equal(bottoms.length,8);
for(const p of pieces){const ys=p.faces.flatMap(f=>f.points.map(v=>v[1]));assert(Math.abs(Math.max(...ys)-Math.min(...ys)-2/3)<eps);}
for(const layer of [tops,bottoms]){
 const outlines=layer.map(p=>p.faces.find(f=>f.points.every(v=>Math.abs(Math.abs(v[1])-1)<eps)).points);
 const original=new Set(outlines.map(key));
 for(const outline of outlines)for(const axis of [0,2])assert(original.has(key(outline.map(v=>v.map((x,i)=>i===axis?-x:x)))),'cuts reflect across both face axes');
}
assert(P.selection(pieces,'sq1',3,2,0));
P.turn(pieces,'sq1',3,0,0,1);assert.equal(P.selection(pieces,'sq1',3,2,0),null);
P.turn(pieces,'sq1',3,0,0,-1);P.turn(pieces,'sq1',3,2,0,1);P.turn(pieces,'sq1',3,2,0,-1);assert(P.solved(pieces,'sq1',3));
console.log('PASS SQ-1: mirror symmetric cuts, equal layer heights, legal slash and blocked slash');
