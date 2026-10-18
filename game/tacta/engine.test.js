const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('./engine');
const C = require('./cards');
const clone=x=>JSON.parse(JSON.stringify(x));
const rectangle=(x,y,w,h)=>[[x,y],[x+w,y],[x+w,y+h],[x,y+h]];
function fixture(regions, owner=0, id='fixture') {return {id,owner,value:regions.reduce((s,r)=>s+r.dots.length,0),suit:'square',regions};}
function region(polygon,dots=[]) {return {id:0,kind:polygon.length===3?'triangle':'rectangle',polygon,dots};}
function place(card,x=0,y=0,rotation=0,flip=false) {return {...card,x,y,rotation,flip};}
function boardState(board) {return {table:{width:1600,height:1100},board,decks:[[],[]],turn:0,finished:false};}
function firstMove(s) {
  for(const c of E.ends(s))for(let r=0;r<360;r+=45)for(const f of [false,true]) {
    const m=E.moves(s,c,r,f,true)[0];if(m)return {c,r,f,m};
  }
}
test('18张固定牌面、三种花色1–6、点数与牌值一致、图形不相互重叠',()=>{
  assert.equal(C.cards.length,18);assert.equal(C.cards.filter(c=>c.evidence==='partial').length,8);
  for(const suit of ['square','circle','triangle'])assert.deepEqual(C.cards.filter(c=>c.suit===suit).map(c=>c.value),[1,2,3,4,5,6]);
  for(const c of C.cards){assert.equal(c.value,c.regions.reduce((s,r)=>s+r.dots.length,0));for(let i=0;i<c.regions.length;i++)for(let j=i+1;j<c.regions.length;j++)assert.ok(E.area(E.intersect(c.regions[i].polygon,c.regions[j].polygon))<.01,`${c.suit}${c.value}`);}
});
test('多边形裁剪与差集正确保留面积',()=>{
  const a=rectangle(0,0,100,100),b=rectangle(40,20,80,60);
  assert.equal(E.area(E.intersect(a,b)),3600);
  assert.equal(E.subtract(a,b).reduce((s,p)=>s+E.area(p),0),6400);
});
test('45°旋转和镜像保持图形面积与点数，并确实产生斜放合法连接',()=>{
  const s=E.create(()=>.4);let diagonal=false;
  for(const c of C.cards)for(let r=0;r<360;r+=45)for(const f of [false,true]) {
    const out=E.orient(c,r,f);assert.ok(Math.abs(E.area(out.polygon)-14300)<.001);
    assert.equal(out.regions.reduce((s,v)=>s+v.dots.length,0),c.value);
    if(r%90&&E.moves(s,c,r,f).length)diagonal=true;
  }
  assert.ok(diagonal);
});
test('同形空心可以盖实心；只计可见点；完全隐藏的卡片不重复参与碰撞',()=>{
  const bottom=fixture([region(rectangle(78,0,22,143),[[89,40],[89,80]])],0,'bottom');
  const top=fixture([region(rectangle(0,0,22,143))],1,'top');
  const s=boardState([place(bottom)]);
  assert.ok(E.validate(s,top,0,false,78,0).ok);
  s.board.push(place(top,78,0));assert.deepEqual(E.score(s),[0,0]);
  const hidden=boardState([place({...bottom,id:'hidden'}),place(bottom)]);
  assert.ok(E.validate(hidden,top,0,false,78,0).ok,'完全隐藏的底层表面不能被重复计为第二张连接牌');
});
test('错位、尺寸不同、覆盖多个形状和同时连接两张牌均拒绝',()=>{
  const base=fixture([region(rectangle(78,0,22,143))],0,'base');
  const candidate=fixture([region(rectangle(0,0,22,143))],1,'candidate');
  let s=boardState([place(base)]);
  assert.equal(E.validate(s,candidate,0,false,77,0).ok,false);
  assert.equal(E.validate(s,candidate,0,false,78,.5).ok,false);
  const short=fixture([region(rectangle(0,21.5,22,100))]);
  assert.equal(E.validate(s,short,0,false,78,0).ok,false);
  const right=fixture([region(rectangle(0,0,22,143))],0,'other');
  s.board.push(place(right,156,0));assert.equal(E.validate(s,candidate,0,false,78,0).ok,false);
  const two=fixture([region(rectangle(0,0,50,71.5)),{...region(rectangle(50,0,50,71.5)),id:1}]);
  s=boardState([place(two)]);assert.equal(E.validate(s,two,0,false,0,71.5).ok,false);
});
test('固定桌边限制所有旋转，不允许靠平移或缩放扩大桌面',()=>{
  const s=E.create();const c=E.ends(s)[0];
  assert.equal(E.validate(s,c,0,false,800,0,true).ok,false);
  assert.equal(E.validate(s,c,45,false,740,0,true).ok,false);
  assert.ok(E.validate(s,c,0,false,600,400,true).ok);
});
test('存在合法连接时不能独立放置，也不能打出牌堆中间的牌',()=>{
  const s=E.create(()=>.4),before=JSON.stringify(s);
  assert.ok(E.hasMove(s));
  assert.throws(()=>E.play(s,E.ends(s)[0].id,0,false,600,400));
  assert.throws(()=>E.play(s,s.decks[s.turn][3].id,0,false,0,0));
  assert.equal(JSON.stringify(s),before);
});
test('全部方向无连接才允许独立放置，独立牌不得接触其他牌',()=>{
  const a=fixture([region(rectangle(0,0,12,19))],0,'a');
  const b=fixture([region(rectangle(0,0,17,23))],1,'b');
  const s=boardState([place(a)]);s.decks=[[b],[]];
  assert.equal(E.hasMove(s),false);
  assert.equal(E.validate(s,b,0,false,100,0,true).ok,false,'仅边缘接触也不是独立放置');
  E.play(s,b.id,0,false,300,0);assert.ok(s.finished);
});
test('开局按两端最小值及其和排序，完全同分仍选有效玩家',()=>{
  for(let i=0;i<20;i++){const s=E.create();const ranks=s.decks.map(d=>[Math.min(d[0].value,d.at(-1).value),d[0].value+d.at(-1).value]);const a=ranks[s.turn],b=ranks[1-s.turn];assert.ok(a[0]<b[0]||a[0]===b[0]&&a[1]<=b[1]);}
});
test('20局36手完整模拟：轮换、可见分、存档与终局',()=>{
  let seed=773;const random=()=>((seed=(seed*1664525+1013904223)>>>0)/4294967296);
  for(let game=0;game<20;game++) {
    const s=E.create(random);
    for(let n=0;n<36;n++) {
      let choice=firstMove(s);
      if(!choice){const c=E.ends(s)[0];for(let y=-450;y<450&&!choice;y+=150)for(let x=-700;x<700;x+=120){if(E.validate(s,c,0,false,x,y,true).ok){choice={c,r:0,f:false,m:{x,y}};break;}}}
      assert.ok(choice,`第${game}局第${n}手`);const {c,r,f,m}=choice,previous=s.turn;
      E.play(s,c.id,r,f,m.x,m.y);assert.equal(s.board.length,n+2);
      assert.deepEqual(E.score(E.restore(clone(s))),E.score(s));
      if(n<35)assert.equal(s.turn,1-previous);
      assert.ok(E.score(s).every(v=>v>=0&&v<=63));
    }
    assert.ok(s.finished);assert.throws(()=>E.play(s,'none',0,false,0,0));
  }
});
test('拒绝旧网格存档及损坏的新存档',()=>{
  assert.throws(()=>E.restore({version:1}));
  const s=E.create();s.board[0].x=NaN;assert.throws(()=>E.restore(s));
});
