const assert=require('node:assert/strict'),B=require('./engine.js');
function empty(p=0,dice=[1,2]){return {...B.initial(),points:Array(24).fill(0),turn:p,phase:'moving',dice,rolled:dice};}
let tests=0;function test(name,fn){fn();tests++;console.log('✓ '+name);}
test('初始布局各15子',()=>{const s=B.initial();assert.equal(s.points.filter(n=>n>0).reduce((a,b)=>a+b),15);assert.equal(s.points.filter(n=>n<0).reduce((a,b)=>a-b,0),15);});
test('开局同点重掷，大者先手',()=>{assert.equal(B.roll(B.initial(),3,3).phase,'opening');const s=B.roll(B.initial(),2,5);assert.equal(s.turn,1);assert.deepEqual(s.dice,[2,5]);});
test('双骰走四次',()=>assert.deepEqual(B.roll({...B.initial(),phase:'roll'},4,4).dice,[4,4,4,4]));
test('吃单子，优先重新入场',()=>{let s=empty(0,[1]);s.points[6]=1;s.points[5]=-1;s=B.move(s,{from:6,to:5,die:1});assert.equal(s.bar[1],1);s.turn=1;s.dice=[2];assert(B.legal(s).every(m=>m.from===-1));});
test('两子封锁入场，允许跳过',()=>{const s=empty(0,[1,2]);s.bar[0]=1;s.points[23]=-2;s.points[22]=-2;assert.equal(B.legal(s).length,0);assert.equal(B.end(s).turn,1);});
test('必须用完两骰',()=>{const s=empty(0,[1,2]);s.points[2]=1;s.points[0]=-2;assert.deepEqual(B.legal(s),[{from:2,to:1,die:1}]);});
test('只能用一骰时必须使用较大值',()=>{const s=empty(0,[1,2]);s.points[0]=1;s.off[0]=14;assert.deepEqual(B.legal(s),[{from:0,to:24,die:2}]);});
test('未全部进入内盘不可收子',()=>{const s=empty(0,[6]);s.points[0]=1;s.points[6]=1;assert(!B.legal(s).some(m=>m.to===24));});
test('超点仅可收最远棋子',()=>{const s=empty(0,[6]);s.points[1]=1;s.points[3]=1;assert.deepEqual(B.legal(s),[{from:3,to:24,die:6}]);});
test('反向收子与获胜',()=>{const s=empty(1,[1]);s.points[23]=-1;s.off[1]=14;const n=B.move(s,{from:23,to:24,die:1});assert.equal(n.winner,1);assert.equal(n.phase,'over');});
test('单胜、双胜、三胜',()=>{const s=empty();s.winner=0;s.off[1]=1;assert.equal(B.score(s),1);s.off[1]=0;s.points[20]=-15;assert.equal(B.score(s),2);s.bar[1]=1;assert.equal(B.score(s),3);});
test('拒绝非法走法和提前结束',()=>{const s=B.roll(B.initial(),6,1);assert.equal(B.end(s),null);assert.equal(B.move(s,{from:23,to:0,die:6}),null);});
test('完整随机对局保持棋子守恒并结束',()=>{let seed=42;const rand=n=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed%n;};for(let game=0;game<8;game++){let s=B.initial(),steps=0;while(s.winner===null&&steps++<5000){if(['opening','roll'].includes(s.phase))s=B.roll(s,rand(6)+1,rand(6)+1);else{const moves=B.legal(s);s=moves.length?B.move(s,moves[rand(moves.length)]):B.end(s);}for(let p=0;p<2;p++)assert.equal(s.points.reduce((a,n)=>a+(n*(p===0?1:-1)>0?Math.abs(n):0),0)+s.bar[p]+s.off[p],15);}assert.notEqual(s.winner,null);}});
console.log(tests+' tests passed');
