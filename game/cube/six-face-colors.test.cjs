const assert=require('node:assert/strict'),M=require('./model'),P=require('./polyhedra');
const expected=new Map([['0,1,0',1],['0,-1,0',0],['-1,0,0',3],['1,0,0',2],['0,0,1',5],['0,0,-1',4]]);
for(const p of M.create([2,3,4]))for(const s of p.stickers)assert.equal(P.stickerColorIndex('cuboid',s.color),expected.get(s.n.join(',')));
for(const type of ['skewb','sq1','gear'])for(const order of P.orders[type].length?P.orders[type]:[3]){
 const c=P.config(type,order);
 for(const p of P.create(type,order))for(const f of p.faces.filter(f=>f.color>=0))assert.equal(P.stickerColorIndex(type,f.color),expected.get(c.normals[f.color].join(',')));
}
console.log('PASS all six-face types: up white, down yellow, left green, right blue, front red, back orange');
