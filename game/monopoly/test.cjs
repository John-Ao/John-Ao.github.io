const {Game,board,chance,chest}=require('./engine.js');
const assert=require('node:assert/strict');let count=0;
function test(name,fn){fn();count++;console.log('✓',name);}
function fresh(){const g=new Game();g.s.turn=0;g.s.log=[];return g;}
function dice(g,a,b){let i=0;g.rng=()=>(([a,b][i++%2])-.5)/6;}
function own(g,ids,who,level=0){ids.forEach(id=>Object.assign(g.s.props[id],{owner:who,level}));}
function build(g,id){g.build(id);g.confirmPlan(0);g.confirmPlan(1);}
function closeAuction(g){for(const i of [...g.s.auction.eligible])g.pass(i);}
function card(g,deck,id){g.s.decks[deck]=[id,...g.s.decks[deck].filter(x=>x!==id)];g.draw(deck);}
function invariant(g){const s=g.s;assert.ok(s.players.every(p=>p.cash>=0&&Number.isInteger(p.cash)&&p.pos>=0&&p.pos<40));assert.equal(s.houses+s.props.reduce((n,p)=>n+(p.level<5?p.level:0),0),32);assert.equal(s.hotels+s.props.filter(p=>p.level===5).length,12);for(const deck of ['chance','chest']){const ids=[...s.decks[deck],...s.players.flatMap(p=>p.cards.filter(c=>c.deck===deck).map(c=>c.id))];assert.equal(ids.length,16);assert.equal(new Set(ids).size,16);}for(const b of board.filter(b=>b.type==='street')){const group=g.group(b.id).map(i=>s.props[i]);assert.ok(Math.max(...group.map(p=>p.level))-Math.min(...group.map(p=>p.level))<=1);if(group.some(p=>p.level)){assert.ok(group.every(p=>p.owner===group[0].owner&&!p.mort));}}}
test('40 格、28 处地产、16+16 张卡、每人 1500',()=>{const g=fresh();assert.equal(board.length,40);assert.equal(board.filter(b=>b.price).length,28);assert.equal(g.player.cash,1500);invariant(g);});
test('经过起点一次发薪，购地正确扣款',()=>{const g=fresh();g.player.pos=39;g.move(2);assert.equal(g.player.cash,1700);g.buy();assert.equal(g.player.cash,1640);assert.equal(g.s.props[1].owner,0);});
test('三次双数入狱，前两次额外回合保留',()=>{const g=fresh();dice(g,2,2);g.roll();g.end();g.roll();g.startAuction();closeAuction(g);g.end();g.roll();assert.equal(g.player.jail,1);assert.equal(g.player.pos,10);assert.equal(g.s.extra,false);});
test('监狱掷双数出狱不能追加掷骰',()=>{const g=fresh();g.jail();g.s.phase='roll';dice(g,3,3);g.roll();assert.equal(g.player.jail,0);assert.equal(g.player.pos,16);assert.equal(g.s.extra,false);});
test('第三次出狱失败筹款后按原骰子移动',()=>{const g=fresh();g.player.pos=10;g.player.jail=3;g.player.cash=0;own(g,[1,3],0);dice(g,1,2);g.roll();assert.equal(g.s.phase,'debt');g.mortgage(1);g.mortgage(3);g.settle();assert.equal(g.player.pos,13);assert.equal(g.player.jail,0);assert.equal(g.player.cash,10);});
test('全组空地双租、抵押免租，房东手动索租',()=>{const g=fresh();own(g,[1,3],1);g.s.props[3].mort=true;assert.equal(g.rent(1),4);assert.equal(g.rent(3),0);g.player.pos=1;g.land();assert.equal(g.player.cash,1500);g.claimRent();assert.equal(g.player.cash,1496);assert.equal(g.s.players[1].cash,1504);});
test('下一位玩家掷骰才过索租期限，交接本身不免租',()=>{const g=fresh();own(g,[1],1);g.player.pos=1;g.land();g.end();assert.equal(g.s.rentClaims.length,1);dice(g,1,2);g.roll();assert.equal(g.s.rentClaims.length,0);assert.throws(()=>g.claimRent());assert.equal(g.s.players[0].cash,1500);});
test('同一玩家双数连掷保留多笔待索租',()=>{const g=fresh();own(g,[1,3],1);g.player.pos=1;g.land();g.s.extra=true;g.end();dice(g,1,1);g.roll();assert.equal(g.s.rentClaims.length,2);g.claimRent(1);g.claimRent(0);assert.equal(g.player.cash,1488);});
test('跨回合索租欠款清偿后恢复掷骰状态',()=>{const g=fresh();own(g,[39],1);own(g,[1,3],0);g.player.cash=0;g.player.pos=39;g.land();g.end();g.claimRent();assert.equal(g.s.debt.from,0);g.mortgage(1);g.mortgage(3);g.settle();assert.equal(g.s.phase,'roll');assert.equal(g.s.turn,1);assert.equal(g.s.players[0].cash,10);});
test('铁路租金按持有数、抵押仍计组数',()=>{const g=fresh();own(g,[5,15,25,35],1);g.s.props[15].mort=true;assert.equal(g.rent(5),200);assert.equal(g.rent(15),0);g.player.pos=7;card(g,'chance',3);assert.equal(g.player.pos,15);assert.equal(g.s.rentClaims.length,0);g.player.pos=22;card(g,'chance',3);assert.equal(g.s.rentClaims[0].amount,400);});
test('公用事业重新掷骰，机会卡强制十倍',()=>{const g=fresh();own(g,[12],1);dice(g,2,3);g.player.pos=12;g.land();assert.equal(g.s.rentClaims[0].amount,20);g.s.rentClaims=[];g.player.pos=7;card(g,'chance',5);assert.equal(g.s.rentClaims[0].amount,50);});
test('双方建造计划执行均匀限制与库存守恒',()=>{const g=fresh();own(g,[1,3],0);build(g,1);assert.throws(()=>g.build(1));assert.throws(()=>g.mortgage(3));build(g,3);for(let n=0;n<3;n++){build(g,1);build(g,3);}assert.equal(g.s.houses,24);build(g,1);assert.equal(g.s.hotels,11);assert.equal(g.s.houses,28);g.build(1,true);assert.equal(g.s.houses,24);g.liquidate(1);invariant(g);});
test('建造无需等待本方回合，监狱仍能建造',()=>{const g=fresh();own(g,[1,3],1);g.s.players[1].jail=1;build(g,1);assert.equal(g.s.players[1].cash,1450);assert.equal(g.s.turn,0);assert.equal(g.s.phase,'roll');});
function scarce(){const g=fresh();own(g,[1,3],0,3);own(g,[6,8,9],1,3);own(g,[11,13,14],0,4);own(g,[16,18,19],1,1);g.s.props[19].level=2;g.s.houses=1;invariant(g);return g;}
test('最后一栋房屋双方争购，竞拍而非先到先得',()=>{const g=scarce();g.build(1);g.addPlan(1,6);g.confirmPlan(0);g.confirmPlan(1);assert.equal(g.s.auction.kind,'building');g.bid(10,0);g.pass(0);g.bid(11,1);assert.deepEqual(g.s.auction.confirmed,[]);closeAuction(g);assert.equal(g.s.props[6].level,4);assert.equal(g.s.props[1].level,3);assert.equal(g.s.phase,'roll');assert.equal(g.s.players[1].cash,1489);invariant(g);});
test('库存大于一但总需求更多，仍逐栋竞拍',()=>{const g=scarce();g.build(19,true);assert.equal(g.s.houses,2);g.build(1);g.addPlan(0,3);g.addPlan(1,6);g.confirmPlan(0);g.confirmPlan(1);g.bid(10,0);closeAuction(g);assert.equal(g.s.phase,'auction');g.bid(12,1);closeAuction(g);assert.equal(g.s.houses,0);assert.equal(g.s.market,null);invariant(g);});
test('酒店拆分需要四栋房屋，整组清售可解除短缺',()=>{const g=scarce();g.s.props[11].level=5;g.s.houses+=4;g.s.hotels--;g.s.houses-=4;g.s.props[26].owner=1;g.s.props[27].owner=1;g.s.props[29].owner=1;g.s.props[26].level=2;g.s.props[27].level=1;g.s.props[29].level=1;assert.throws(()=>g.build(11,true),/不足 4/);g.liquidate(11);assert.equal(g.s.hotels,12);invariant(g);});
test('拍卖公开报价，暂不加价后仍可重新加价',()=>{const g=fresh();g.player.pos=1;g.land();g.startAuction();g.pass(0);g.bid(10,1);assert.deepEqual(g.s.auction.confirmed,[]);g.bid(11,0);assert.throws(()=>g.bid(11,1));g.pass(1);assert.equal(g.s.phase,'auction');g.pass(0);assert.equal(g.s.props[1].owner,0);assert.equal(g.player.cash,1489);});
test('无人竞价双方确认后地产留在银行',()=>{const g=fresh();g.player.pos=1;g.land();g.startAuction();closeAuction(g);assert.equal(g.s.props[1].owner,null);assert.equal(g.s.phase,'done');});
test('拍卖可抵押筹款，但不能花掉已预留的最高报价',()=>{const g=fresh();own(g,[3],0);g.player.pos=1;g.land();g.startAuction();g.mortgage(3);g.bid(1530,0);assert.throws(()=>g.mortgage(3));closeAuction(g);assert.equal(g.player.cash,0);});
test('赎回所有地产均精确为本金加10%，无浮点进位误差',()=>{for(const b of board.filter(x=>x.price)){const g=fresh();own(g,[b.id],0);g.mortgage(b.id);const cash=g.player.cash;g.mortgage(b.id);assert.equal(cash-g.player.cash,b.price/2+Math.ceil(b.price/20));}});
test('抵押交易可立即赎回，不能重复收取利息',()=>{const g=fresh();own(g,[1],0);g.mortgage(1);g.trade({from:0,give:[1],take:[],cashGive:0,cashTake:100,mortgageChoices:{1:'redeem'}});assert.equal(g.s.players[1].cash,1367);assert.equal(g.s.props[1].mort,false);});
test('保留抵押交易先付10%，以后赎回再次付本金加10%',()=>{const g=fresh();own(g,[1],0);g.mortgage(1);g.trade({from:0,give:[1],take:[],cashGive:0,cashTake:100,mortgageChoices:{1:'keep'}});assert.equal(g.s.players[1].cash,1397);g.mortgage(1);assert.equal(g.s.players[1].cash,1364);});
test('未选择抵押接收方式或资金不足的交易不会部分提交',()=>{const g=fresh();own(g,[1],0);g.mortgage(1);const before=JSON.stringify(g.s);assert.throws(()=>g.trade({from:0,give:[1],take:[],cashGive:0,cashTake:0}));assert.equal(JSON.stringify(g.s),before);g.s.players[1].cash=0;assert.throws(()=>g.trade({from:0,give:[1],take:[],cashGive:0,cashTake:0,mortgageChoices:{1:'keep'}}));assert.equal(g.s.props[1].owner,0);});
test('后退三格触发公益基金，前往起点和前往监狱分别处理工资',()=>{const g=fresh();g.player.pos=36;g.s.decks.chest=[1,...g.s.decks.chest.filter(x=>x!==1)];card(g,'chance',8);assert.equal(g.player.pos,33);assert.equal(g.player.cash,1700);card(g,'chance',0);assert.equal(g.player.cash,1900);card(g,'chance',9);assert.equal(g.player.cash,1900);assert.equal(g.player.pos,10);});
test('出狱卡持有时离开牌堆，交易后使用归还原牌堆',()=>{const g=fresh();card(g,'chance',7);g.trade({from:0,give:[],take:[],cashGive:0,cashTake:0,cardsGive:1});g.s.turn=1;g.jail();g.s.phase='roll';g.bail(true);assert.equal(g.player.jail,0);assert.equal(g.s.decks.chance.length,16);invariant(g);});
test('维修按实体房屋与酒店计费，不把酒店算成五栋',()=>{const g=fresh();own(g,[1,3],0,4);g.s.props[1].level=5;g.s.houses=28;g.s.hotels=11;card(g,'chance',10);assert.equal(g.player.cash,1300);card(g,'chest',13);assert.equal(g.player.cash,1025);invariant(g);});
test('现金不足但卖房抵押可支付时不能破产',()=>{const g=fresh();own(g,[1,3],0);g.player.cash=0;g.pay(0,null,50);assert.throws(()=>g.bankrupt(),/仍可偿付/);g.mortgage(1);g.mortgage(3);g.settle();assert.equal(g.player.cash,10);});
test('欠玩家破产：建筑折现、剩余现金/地产/出狱卡转交',()=>{const g=fresh();own(g,[1,3],0,1);g.s.houses=30;card(g,'chest',4);g.player.cash=5;g.pay(0,1,500);g.bankrupt();assert.equal(g.s.players[0].bankrupt,true);assert.equal(g.s.players[1].cash,1555);assert.equal(g.s.players[1].cards.length,1);assert.equal(g.s.props[1].owner,1);assert.equal(g.s.houses,32);assert.equal(g.s.winner,1);invariant(g);});
test('欠玩家破产：继承抵押地产逐一选择付息或立即赎回',()=>{const g=fresh();own(g,[1,3],0);g.mortgage(1);g.mortgage(3);g.player.cash=0;g.pay(0,1,100);g.bankrupt();assert.equal(g.s.phase,'transfer');g.receiveMortgage(false);assert.equal(g.s.players[1].cash,1497);g.receiveMortgage(true);assert.equal(g.s.players[1].cash,1464);assert.equal(g.s.props[1].mort,true);assert.equal(g.s.props[3].mort,false);assert.equal(g.s.phase,'over');});
test('欠银行破产：还卡、解除抵押、地产逐一拍卖后判胜',()=>{const g=fresh();own(g,[1,3],0);g.mortgage(1);card(g,'chance',7);g.player.cash=0;g.pay(0,null,200);g.bankrupt();assert.equal(g.s.decks.chance.length,16);assert.equal(g.s.props[1].mort,false);assert.equal(g.s.phase,'auction');assert.deepEqual(g.s.auction.eligible,[1]);g.bid(10,1);g.pass(1);assert.equal(g.s.props[1].owner,1);assert.equal(g.s.phase,'auction');g.pass(1);assert.equal(g.s.props[3].owner,null);assert.equal(g.s.winner,1);invariant(g);});
test('继承者也付不起抵押利息时进入债务而非跳过结算',()=>{const g=fresh();own(g,[1],0);g.mortgage(1);g.player.cash=0;g.s.players[1].cash=0;g.pay(0,1,50);g.bankrupt();assert.throws(()=>g.receiveMortgage(true));g.receiveMortgage(false);assert.equal(g.s.phase,'debt');assert.equal(g.s.debt.amount,3);g.bankrupt();assert.equal(g.s.phase,'over');assert.equal(g.s.winner,null);invariant(g);});
test('非当前玩家欠款也按债务人正确清算',()=>{const g=fresh();g.s.players[1].cash=0;card(g,'chest',8);assert.equal(g.s.debt.from,1);g.bankrupt();assert.equal(g.s.winner,0);});
test('新建造阶段、自由拍卖、遗产接收均可序列化恢复',()=>{let g=scarce();g.build(1);g.addPlan(1,6);g=new Game(JSON.parse(JSON.stringify(g.s)));g.confirmPlan(0);g.confirmPlan(1);g.bid(20,1);g=new Game(JSON.parse(JSON.stringify(g.s)));closeAuction(g);assert.equal(g.s.props[6].level,4);g=fresh();own(g,[1],0);g.mortgage(1);g.player.cash=0;g.pay(0,1,100);g.bankrupt();g=new Game(JSON.parse(JSON.stringify(g.s)));g.receiveMortgage(false);assert.equal(g.s.winner,1);});
test('旧版存档原位升级，保留资产与未完拍卖',()=>{const g=fresh();g.player.pos=1;g.land();g.startAuction();g.s.version=1;delete g.s.auction.kind;delete g.s.rentClaims;const h=new Game(JSON.parse(JSON.stringify(g.s)));assert.equal(h.s.version,2);h.bid(10,0);closeAuction(h);assert.equal(h.s.props[1].owner,0);});
test('全部32张事件卡均能完成动作且保持牌堆与库存',()=>{for(const deck of ['chance','chest'])for(let i=0;i<16;i++){const g=fresh();g.player.pos=7;card(g,deck,i);assert.ok(['done','buy'].includes(g.s.phase));invariant(g);}});
test('20局最多各2000步随机演练：资金、库存、均匀建设、牌堆守恒',()=>{
 let seed=7281;const rng=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 for(let run=0;run<20;run++){
  const g=new Game(undefined,rng);
  for(let i=0;i<2000&&g.s.phase!=='over';i++){
   const s=g.s;
   if(['roll','done'].includes(s.phase)&&s.rentClaims.length){g.claimRent();}
   else if(s.phase==='roll')g.roll();
   else if(s.phase==='buy'){if(g.player.cash>=board[g.player.pos].price)g.buy();else g.startAuction();}
   else if(s.phase==='auction'){const a=s.auction;if(a.leader===null){const who=a.eligible.find(w=>s.players[w].cash>=10);if(who!==undefined)g.bid(10,who);}closeAuction(g);}
   else if(s.phase==='done'){
    const id=board.find(b=>g.buildable(b.id)&&g.available(s.props[b.id].owner)>b.cost+200&&(s.props[b.id].level===4?s.hotels:s.houses)>0)?.id;
    if(id!==undefined&&rng()<.3){build(g,id);}else g.end();
   }else if(s.phase==='debt'){
    const who=s.debt.from;if(g.liquidationValue(who)<s.debt.amount)g.bankrupt();
    else{for(const b of board)if(s.props[b.id].owner===who&&s.props[b.id].level)g.liquidate(b.id);for(const b of board)if(s.props[b.id].owner===who&&!s.props[b.id].mort)g.mortgage(b.id);g.settle();}
   }else if(s.phase==='transfer')g.receiveMortgage(false);else assert.fail('Unhandled phase '+s.phase);
   invariant(g);
  }
 }
});
test('最后一座酒店争购：归还四栋房屋，酒店库存归零',()=>{const g=fresh();own(g,[1,3,11,13,14],0,5);own(g,[6,8,9,16,18,19],1,5);own(g,[21,23,24],0,4);own(g,[26,27,29],1,4);g.s.houses=8;g.s.hotels=1;g.build(21);g.addPlan(1,26);g.confirmPlan(0);g.confirmPlan(1);g.bid(25,1);closeAuction(g);assert.equal(g.s.props[26].level,5);assert.equal(g.s.hotels,0);assert.equal(g.s.houses,12);invariant(g);});
test('资金不足的多栋标价计划不会部分扣款或建造',()=>{const g=fresh();own(g,[1,3],0);g.player.cash=50;g.build(1);g.addPlan(0,3);g.confirmPlan(0);assert.throws(()=>g.confirmPlan(1));assert.equal(g.player.cash,50);assert.equal(g.s.houses,32);assert.equal(g.s.props[1].level,0);assert.equal(g.s.phase,'building');});
test('对手筹款期间 有支付能力的玩家可建造，之后恢复债务',()=>{const g=fresh();own(g,[1,3],1);g.player.cash=0;g.pay(0,null,10);build(g,1);assert.equal(g.s.phase,'debt');assert.equal(g.s.debt.from,0);assert.equal(g.s.props[1].level,1);});
test('持有两张出狱卡时可选择使用哪副牌的卡',()=>{const g=fresh();card(g,'chance',7);card(g,'chest',4);g.jail();g.s.phase='roll';g.bail(true,1);assert.equal(g.player.cards[0].deck,'chance');assert.equal(g.s.decks.chest.length,16);assert.equal(g.s.decks.chance.length,15);invariant(g);});
test('交易出狱卡可指定牌堆，另一张仍留原主人',()=>{const g=fresh();card(g,'chance',7);card(g,'chest',4);g.trade({from:0,give:[],take:[],cashGive:0,cashTake:0,cardsGive:1,cardsGiveKeys:['chest:4']});assert.equal(g.player.cards[0].deck,'chance');assert.equal(g.s.players[1].cards[0].deck,'chest');invariant(g);});
console.log(`${count} tests passed`);
