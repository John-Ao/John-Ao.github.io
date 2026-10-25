const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync(__dirname+'/app.js','utf8');
const context={document:{querySelector(){}},console};vm.createContext(context);
vm.runInContext(source.split('let level=')[0]+';globalThis.levels=LEVELS;globalThis.shape=shape;globalThis.catalog=CATALOG;',context);
for(const l of context.levels){
 const cells=new Set(l.cells.map(String));assert.equal(cells.size,l.cells.length,`level ${l.id+1}: overlapping solution`);
 const seen=new Set(),todo=[l.cells[0]];while(todo.length){const [x,y]=todo.pop(),k=String([x,y]);if(seen.has(k)||!cells.has(k))continue;seen.add(k);todo.push([x-1,y],[x+1,y],[x,y-1],[x,y+1]);}assert.equal(seen.size,cells.size,`level ${l.id+1}: disconnected target`);
 for(const p of l.pieces)for(let r=0;r<4;r++)for(const f of [false,true]){const shape=context.shape(p.t,r,f);assert.equal(new Set(shape.map(String)).size,shape.length);assert.equal(Math.min(...shape.map(p=>p[0])),0);assert.equal(Math.min(...shape.map(p=>p[1])),0);}
}
console.log(`PASS: all ${context.levels.length} new and legacy solutions cover connected targets without overlaps.`);
context.key=p=>p.join(',');
vm.runInContext(source.slice(source.indexOf('function validate(data)'),source.indexOf('function share()'))+';globalThis.validate=validate;',context);
for(const l of context.levels){assert.doesNotThrow(()=>context.validate({level:l.id,placed:l.pieces}));assert.doesNotThrow(()=>context.validate({level:l.id,placed:[]}));const invalid=JSON.parse(JSON.stringify(l.pieces));invalid[0].x=-50;assert.throws(()=>context.validate({level:l.id,placed:invalid}));assert.throws(()=>context.validate({level:l.id,placed:[l.pieces[0],l.pieces[0]]}));}
console.log('PASS: shared/imported positions accept valid states and reject overlap, duplicate pieces and out-of-bounds data.');

const catalog=JSON.parse(fs.readFileSync(__dirname+'/design/catalog.json','utf8'));
assert.equal(context.levels.length,12+catalog.levels.length);
assert.deepEqual(JSON.parse(JSON.stringify(context.catalog)),catalog.levels,'embedded catalog must match design data');
for(let i=0;i<catalog.levels.length;i++){
 const l=context.levels[12+i],seen=new Set();
 assert.equal(l.pieces.length*5,l.cells.length);
 assert.equal(new Set(l.pieces.map(p=>p.t)).size,l.pieces.length);
 for(const p of l.pieces)for(const [x,y] of context.shape(p.t,p.r,p.f))seen.add(String([x+p.x,y+p.y]));
 assert.deepEqual([...seen].sort(),Array.from(l.cells,String).sort());
 assert.equal(new Set(l.pieces.map(p=>p.id)).size,l.pieces.length);
}
console.log('PASS: curated geometry exactly matches every stored answer, including reflections and all 12 pieces.');

function canonicalTarget(cells){
 const variants=[];
 for(const flip of [1,-1]){
  let points=cells.map(([x,y])=>[x*flip,y]);
  for(let r=0;r<4;r++){
   const minX=Math.min(...points.map(p=>p[0])),minY=Math.min(...points.map(p=>p[1]));
   variants.push(JSON.stringify(points.map(([x,y])=>[x-minX,y-minY]).sort((a,b)=>a[0]-b[0]||a[1]-b[1])));
   points=points.map(([x,y])=>[-y,x]);
  }
 }
 return variants.sort()[0];
}
const signatures=new Set();
for(const entry of catalog.levels){
 const signature=JSON.stringify([canonicalTarget(entry.cells),entry.defs.map(d=>d[0]).sort()]);
 assert.ok(!signatures.has(signature),'duplicate target and piece set');signatures.add(signature);
 if(entry.maxSide){
  assert.ok(Math.max(...entry.cells.map(p=>p[0]))+1<=8);
  assert.ok(Math.max(...entry.cells.map(p=>p[1]))+1<=8);
  assert.equal(entry.maxSide,8);
  assert.equal(entry.complete,true);
  assert.ok(entry.solutions>0&&entry.solutions<33);
 }
}
console.log('PASS: compact expansion respects 8×8 bounds and has no duplicate puzzles.');
