const assert=require('node:assert/strict');
const Q=require('./engine.js');
let count=0;
function test(name,fn){fn();count++;console.log('✓ '+name);}
test('初始棋盘、轮流行动与非法移动',()=>{const s=Q.initial();assert.equal(s.remaining[0],10);assert.equal(Q.moves(s).length,3);assert.equal(Q.play(s,{type:'move',r:6,c:4}),null);const n=Q.play(s,{type:'move',r:7,c:4});assert.equal(n.turn,1);assert.equal(s.pawns[0].r,8);});
test('相邻跳子，能够直跳时不能斜跳',()=>{const s=Q.initial();s.pawns=[{r:4,c:4},{r:3,c:4}];const m=Q.moves(s);assert(m.some(p=>p.r===2&&p.c===4));assert(!m.some(p=>p.r===3&&p.c===3));});
test('身后墙阻挡时侧跳，不能穿墙侧跳',()=>{const s=Q.initial();s.pawns=[{r:4,c:4},{r:3,c:4}];s.walls=[{r:2,c:4,o:'h'},{r:3,c:3,o:'v'}];const m=Q.moves(s);assert(m.some(p=>p.r===3&&p.c===5));assert(!m.some(p=>p.r===3&&p.c===3));assert(!m.some(p=>p.r===2&&p.c===4));});
test('边界阻挡时侧跳',()=>{const s=Q.initial();s.pawns=[{r:1,c:4},{r:0,c:4}];assert(Q.moves(s).some(p=>p.r===0&&p.c===3));});
test('隔墙不能跳子',()=>{const s=Q.initial();s.pawns=[{r:4,c:4},{r:3,c:4}];s.walls=[{r:3,c:4,o:'h'}];assert(!Q.moves(s).some(p=>p.r<4));});
test('墙重叠与交叉，端点连接合法',()=>{const s=Q.initial();s.walls=[{r:3,c:3,o:'h'}];assert(Q.wallError(s,{r:3,c:4,o:'h'}));assert(Q.wallError(s,{r:3,c:3,o:'v'}));assert.equal(Q.wallError(s,{r:3,c:5,o:'h'}),'');});
test('不能封死任意一方的道路',()=>{const s=Q.initial();s.pawns[0]={r:8,c:0};s.walls=[{r:7,c:0,o:'h'}];assert(Q.wallError(s,{r:7,c:0,o:'v'}));assert(Q.wallError(s,{r:7,c:1,o:'v'}).includes('通往终点'));});
test('落墙扣除库存并切换回合，无墙不能再放',()=>{const s=Q.initial();const n=Q.play(s,{type:'wall',r:3,c:3,o:'h'});assert.equal(n.remaining[0],9);assert.equal(n.turn,1);s.remaining[0]=0;assert.equal(Q.play(s,{type:'wall',r:3,c:3,o:'h'}),null);});
test('到达终点立即胜利并禁止继续行动',()=>{for(const p of [0,1]){const s=Q.initial(p);s.pawns[p]={r:p===0?1:7,c:2};const n=Q.play(s,{type:'move',r:p===0?0:8,c:2});assert.equal(n.winner,p);assert.deepEqual(Q.moves(n),[]);assert.equal(Q.play(n,{type:'wall',r:3,c:3,o:'h'}),null);}});
console.log(count+' tests passed');
