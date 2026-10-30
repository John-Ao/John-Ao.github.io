const assert=require('node:assert/strict'),H=require('./engine.js');
let tested=0;function test(n,f){f();tested++;console.log('✓ '+n)}
function fixture(entries,turn=0){let s=H.fresh();s.turn=turn;for(let [k,p,t] of entries)(s.board[k]??=[]).push({p,t});return s;}
test('双方首枚相邻；随后不可接触敌方',()=>{let s=H.play(H.fresh(),{t:'A',to:'0,0'});assert.equal(H.placements(s,'Q').length,6);s=H.play(s,{t:'A',to:'1,0'});assert(H.placements(s,'Q').includes('-1,0'));assert(!H.placements(s,'Q').includes('0,1'));assert.deepEqual(H.moves(s,'0,0'),[])});
test('第四回合必须放蜂后',()=>{let s=H.fresh();s.turns[0]=3;assert.equal(H.placements(s,'A').length,0);assert.equal(H.placements(s,'Q').length,1)});
test('不能移动蜂群连接点',()=>{let s=fixture([['0,0',0,'A'],['-1,0',0,'Q'],['1,0',1,'Q']]);assert.deepEqual(H.moves(s,'0,0'),[])});
test('蜂后沿边滑动，不能穿过窄口',()=>{let s=fixture([['0,0',0,'Q'],['1,0',1,'Q']]);assert.deepEqual(new Set(H.moves(s,'0,0')),new Set(['0,1','1,-1']));assert(!H.gate({'1,0':[{}],'0,1':[{}]},'0,0','1,1'));let b={'1,0':[{}],'0,-1':[{}]};assert(!H.gate(b,'0,0','1,-1'));});
test('蚱蜢直线跨过连续棋子至首个空格',()=>{let s=fixture([['0,0',0,'G'],['1,0',0,'Q'],['2,0',1,'Q']]);assert.deepEqual(H.moves(s,'0,0'),['3,0'])});
test('蜘蛛恰好三步；兵蚁可绕行',()=>{let s=fixture([['0,0',0,'S'],['1,0',0,'Q']]);assert.deepEqual(H.moves(s,'0,0'),['2,0']);s.board['0,0'][0].t='A';assert.equal(H.moves(s,'0,0').length,5)});
test('甲虫可叠放；覆盖棋子不能移动；顶层决定颜色',()=>{let s=fixture([['0,0',0,'B'],['1,0',1,'Q'],['0,1',0,'Q']]);assert(H.moves(s,'0,0').includes('1,0'));let n=H.play(s,{from:'0,0',to:'1,0'});assert.equal(n.board['1,0'].length,2);assert.deepEqual(H.moves(n,'1,0'),[]);assert(!H.placements(n,'A').includes('2,0'));n.turn=0;assert(H.moves(n,'1,0').includes('2,0'))});
test('甲虫高层窄口',()=>{let b={'1,0':[{},{}],'0,-1':[{},{}]};assert(!H.gate(b,'0,0','1,-1',2));assert(H.gate(b,'0,0','1,-1',3))});
test('围住蜂后与同时围住的平局',()=>{let s=fixture([['0,0',0,'Q']]);for(let k of H.near('0,0'))s.board[k]=[{p:1,t:'A'}];assert.equal(H.outcome(s),'black');s.board['1,0']=[{p:1,t:'Q'}];for(let k of H.near('1,0'))s.board[k]??=[{p:0,t:'A'}];assert.equal(H.outcome(s),'draw')});
test('合法行动存在时不可跳过；行动不修改旧局面',()=>{let s=H.fresh();assert.throws(()=>H.play(s,{pass:true}));H.play(s,{t:'Q',to:'0,0'});assert.equal(Object.keys(s.board).length,0)});
test('随机完整对局保持连通与棋子总量',()=>{let seed=173;function rnd(n){seed=(seed*1664525+1013904223)>>>0;return seed%n}for(let game=0;game<15;game++){let s=H.fresh();for(let i=0;i<180&&!s.result;i++){let actions=[];for(let t of Object.keys(H.counts))for(let to of H.placements(s,t))actions.push({t,to});for(let from of Object.keys(s.board))for(let to of H.moves(s,from))actions.push({from,to});s=H.play(s,actions.length?actions[rnd(actions.length)]:{pass:true});assert(H.connected(s.board));for(let p=0;p<2;p++)assert.equal(Object.values(s.reserve[p]).reduce((a,b)=>a+b,0)+Object.values(s.board).flat().filter(x=>x.p===p).length,11);}}});
console.log(`${tested} tests passed`);
