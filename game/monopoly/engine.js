/* Monopoly — deterministic rules engine; no browser dependencies. */
(function(root){
'use strict';
const colors=['#936346','#78bfc8','#c7659b','#e69b48','#d96055','#ddbd44','#55a17d','#5774af'];
const names=['起点','地中海大道','公益基金','波罗的海大道','所得税','雷丁铁路','东方大道','机会','佛蒙特大道','康涅狄格大道','监狱 / 探视','圣查尔斯广场','电力公司','州立大道','弗吉尼亚大道','宾夕法尼亚铁路','圣詹姆斯广场','公益基金','田纳西大道','纽约大道','免费停车','肯塔基大道','机会','印第安纳大道','伊利诺伊大道','B&O 铁路','大西洋大道','文特诺大道','自来水公司','马文花园','前往监狱','太平洋大道','北卡罗来纳大道','公益基金','宾夕法尼亚大道','短线铁路','机会','公园广场','奢侈税','木板路'];
const rows=[
[1,0,60,2,10,30,90,160,250],[3,0,60,4,20,60,180,320,450],
[6,1,100,6,30,90,270,400,550],[8,1,100,6,30,90,270,400,550],[9,1,120,8,40,100,300,450,600],
[11,2,140,10,50,150,450,625,750],[13,2,140,10,50,150,450,625,750],[14,2,160,12,60,180,500,700,900],
[16,3,180,14,70,200,550,750,950],[18,3,180,14,70,200,550,750,950],[19,3,200,16,80,220,600,800,1000],
[21,4,220,18,90,250,700,875,1050],[23,4,220,18,90,250,700,875,1050],[24,4,240,20,100,300,750,925,1100],
[26,5,260,22,110,330,800,975,1150],[27,5,260,22,110,330,800,975,1150],[29,5,280,24,120,360,850,1025,1200],
[31,6,300,26,130,390,900,1100,1275],[32,6,300,26,130,390,900,1100,1275],[34,6,320,28,150,450,1000,1200,1400],
[37,7,350,35,175,500,1100,1300,1500],[39,7,400,50,200,600,1400,1700,2000]];
const board=names.map((name,id)=>({id,name,type:'rest'}));
rows.forEach(([id,group,price,...rents])=>Object.assign(board[id],{type:'street',group,price,rents,cost:(Math.floor(group/2)+1)*50,color:colors[group]}));
[5,15,25,35].forEach(id=>Object.assign(board[id],{type:'rail',price:200}));
[12,28].forEach(id=>Object.assign(board[id],{type:'utility',price:150}));
[2,17,33].forEach(id=>board[id].type='chest');[7,22,36].forEach(id=>board[id].type='chance');
board[4].type=board[38].type='tax';board[4].tax=200;board[38].tax=100;board[30].type='jail';
const chance=[['前往起点，领取 200','go',0],['前往伊利诺伊大道','go',24],['前往圣查尔斯广场','go',11],['前往最近的铁路，租金加倍','rail'],['前往最近的铁路，租金加倍','rail'],['前往最近的公用事业，按新骰子点数的 10 倍付租','utility'],['银行分红，收入 50','cash',50],['保留一张免费出狱卡','free'],['后退三格','back'],['直接入狱','jail'],['维修：每栋房屋 25，每座酒店 100','repair',25,100],['缴纳罚款 15','cash',-15],['前往雷丁铁路','go',5],['前往木板路','go',39],['向另一位玩家支付 50','other',-50],['投资到期，收入 150','cash',150]];
const chest=[['前往起点，领取 200','go',0],['银行结算，收入 200','cash',200],['支付医药费 50','cash',-50],['出售股票，收入 50','cash',50],['保留一张免费出狱卡','free'],['直接入狱','jail'],['假日基金到期，收入 100','cash',100],['退税，收入 20','cash',20],['生日，另一位玩家赠予 10','other',10],['保险到期，收入 100','cash',100],['支付住院费 100','cash',-100],['支付学费 50','cash',-50],['咨询收入 25','cash',25],['街道维修：每栋房屋 40，每座酒店 115','repair',40,115],['获得奖金 10','cash',10],['收到遗产 100','cash',100]];
function shuffled(n,rng){const a=Array.from({length:n},(_,i)=>i);for(let i=n-1;i>0;i--){const j=Math.floor(rng()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
class Game {
 constructor(saved, rng=Math.random) {
  this.rng=rng;
  if(saved){this.s=saved;this.s.version=2;this.s.players.forEach(p=>p.bankrupt??=false);this.s.rentClaims??=this.s.rentClaim?[this.s.rentClaim]:[];delete this.s.rentClaim;this.s.market??=null;this.s.transfer??=null;this.s.estate??=null;if(this.s.auction&&!this.s.auction.kind){Object.assign(this.s.auction,{kind:'property',eligible:[0,1],confirmed:[],after:'done'});}return;}
  this.s={version:2,players:[0,1].map(i=>({name:`玩家 ${i+1}`,cash:1500,pos:0,jail:0,cards:[],bankrupt:false})),props:board.map(()=>({owner:null,level:0,mort:false})),turn:0,round:1,phase:'roll',doubles:0,extra:false,dice:[1,1],decks:{chance:shuffled(16,rng),chest:shuffled(16,rng)},log:[],houses:32,hotels:12,debt:null,auction:null,winner:null,rentClaims:[],market:null,transfer:null,estate:null};
  let a,b;do{a=this.die()+this.die();b=this.die()+this.die();}while(a===b);this.s.turn=a>b?0:1;this.note(`先手掷骰：玩家 1 得 ${a}，玩家 2 得 ${b}；${this.player.name}先行。`);
 }
 get player(){return this.s.players[this.s.turn];}
 die(){return 1+Math.floor(this.rng()*6);}
 note(t){this.s.log.unshift(t);this.s.log=this.s.log.slice(0,100);}
 fail(t){throw Error(t);}
 alive(){return [0,1].filter(i=>!this.s.players[i].bankrupt);}
 group(id){return board.filter(b=>b.type==='street'&&b.group===board[id].group).map(b=>b.id);}
 ownsSet(id){const p=this.s.props[id];return p.owner!==null&&this.group(id).every(i=>this.s.props[i].owner===p.owner);}
 available(who){const a=this.s.auction;return this.s.players[who].cash-(a?.leader===who?a.bid:0);}
 rent(id,dice=this.s.dice[0]+this.s.dice[1]){
  const b=board[id],p=this.s.props[id];if(p.owner===null||p.mort)return 0;
  if(b.type==='street')return p.level?b.rents[p.level]:b.rents[0]*(this.ownsSet(id)?2:1);
  const count=board.filter(x=>x.type===b.type&&this.s.props[x.id].owner===p.owner).length;
  return b.type==='rail'?25*2**(count-1):dice*(count===2?10:4);
 }
 pay(from,to,amount,after='done'){
  if(amount<=0){this.resume(after);return;}
  if(this.s.players[from].cash<amount){this.s.debt={from,to,amount,after};this.s.phase='debt';this.note(`${this.s.players[from].name}需支付 ${amount}，请变卖建筑、抵押或交易筹款。`);return;}
  this.s.players[from].cash-=amount;if(to!==null)this.s.players[to].cash+=amount;
  this.note(`${this.s.players[from].name}向${to===null?'银行':this.s.players[to].name}支付 ${amount}。`);this.resume(after);
 }
 resume(after){
  if(typeof after==='object'){this.s.phase=after.phase;return;}
  if(after==='jailMove'){this.player.jail=0;this.move(this.s.dice[0]+this.s.dice[1]);}
  else if(after==='bail'){this.player.jail=0;this.s.phase='roll';}
  else if(after==='transferPaid'){const t=this.s.transfer;this.s.props[t.queue.shift()].mort=!t.redeem;this.nextTransfer();}
  else if(after==='estateAuction')this.nextEstateAuction();
  else this.s.phase=after;
 }
 settle(){const d=this.s.debt;if(!d)this.fail('没有待付账款');if(this.s.players[d.from].cash<d.amount)this.fail('现金仍不足');this.s.debt=null;this.pay(d.from,d.to,d.amount,d.after);}
 claimRent(index=0){
  const r=this.s.rentClaims[index];if(!r||!['done','roll'].includes(this.s.phase))this.fail('当前没有可索取的租金');
  const after={phase:this.s.phase};this.s.rentClaims.splice(index,1);this.note(`玩家 ${r.to+1}索取${board[r.id].name}租金 ${r.amount}。`);this.pay(r.from,r.to,r.amount,after);
 }

 roll(){
  if(this.s.phase!=='roll')this.fail('请先完成当前操作');const s=this.s,p=this.player;
  if(s.rentClaims.some(r=>r.from!==s.turn))this.note('下一位玩家已掷骰，未索取的上一回合租金失效。');s.rentClaims=s.rentClaims.filter(r=>r.from===s.turn);
  const a=this.die(),b=this.die();s.dice=[a,b];s.extra=false;this.note(`${p.name}掷出 ${a} + ${b}。`);
  if(p.jail){if(a===b){p.jail=0;this.move(a+b);}else if(p.jail===3)this.pay(s.turn,null,50,'jailMove');else{p.jail++;s.phase='done';this.note('未掷出双数，继续留在监狱。');}return;}
  if(a===b){s.doubles++;if(s.doubles===3){this.jail();return;}s.extra=true;}else s.doubles=0;this.move(a+b);
 }
 jail(){this.player.pos=10;this.player.jail=1;this.s.extra=false;this.s.doubles=0;this.s.phase='done';this.note(`${this.player.name}入狱，本回合结束。`);}
 bail(card=false,index=0){if(this.s.phase!=='roll'||!this.player.jail)this.fail('现在不能出狱');if(card){if(!this.player.cards[index])this.fail('没有这张出狱卡');const c=this.player.cards.splice(index,1)[0];this.s.decks[c.deck].push(c.id);this.player.jail=0;this.note('使用免费出狱卡。');}else this.pay(this.s.turn,null,50,'bail');}
 move(n){const old=this.player.pos;if(n>0&&old+n>=40){this.player.cash+=200;this.note('经过起点，收入 200。');}this.player.pos=(old+n+40)%40;this.land();}
 go(id,special){let n=(id-this.player.pos+40)%40;if(id===0&&n===0)n=40;if(this.player.pos+n>=40){this.player.cash+=200;this.note('经过起点，收入 200。');}this.player.pos=id;this.land(special);}
 land(special){
  const s=this.s,b=board[this.player.pos],p=s.props[b.id];this.note(`${this.player.name}到达${b.name}。`);s.phase='done';
  if(b.price){
   if(p.owner===null){s.phase='buy';return;}if(p.owner===s.turn||p.mort)return;
   let roll=s.dice[0]+s.dice[1];if(b.type==='utility'){roll=this.die()+this.die();this.note(`公用事业租金重新掷骰：${roll} 点。`);}
   let amount=special==='utility'?roll*10:this.rent(b.id,roll);if(special==='rail')amount*=2;
   s.rentClaims.push({id:b.id,from:s.turn,to:p.owner,amount});this.note(`玩家 ${p.owner+1}可在下一位玩家掷骰前索租 ${amount}。`);return;
  }
  if(b.type==='tax')this.pay(s.turn,null,b.tax);if(b.type==='jail')this.jail();if(b.type==='chance'||b.type==='chest')this.draw(b.type);
 }
 draw(deck){
  const s=this.s,id=s.decks[deck].shift(),c=(deck==='chance'?chance:chest)[id];this.note(`${deck==='chance'?'机会':'公益基金'}：${c[0]}。`);s.phase='done';s.card={deck,text:c[0]};
  if(c[1]==='free'){this.player.cards.push({deck,id});return;}s.decks[deck].push(id);
  switch(c[1]){
   case'go':this.go(c[2]);break;case'jail':this.jail();break;case'back':this.move(-3);break;
   case'rail':this.go([5,15,25,35].find(i=>i>this.player.pos)??5,'rail');break;
   case'utility':this.go([12,28].find(i=>i>this.player.pos)??12,'utility');break;
   case'cash':if(c[2]>0)this.player.cash+=c[2];else this.pay(s.turn,null,-c[2]);break;
   case'other':if(c[2]>0)this.pay(1-s.turn,s.turn,c[2]);else this.pay(s.turn,1-s.turn,-c[2]);break;
   case'repair':{let n=0;s.props.forEach(p=>{if(p.owner===s.turn)n+=p.level===5?c[3]:p.level*c[2];});this.pay(s.turn,null,n);break;}
  }
 }
 buy(){if(this.s.phase!=='buy')this.fail('现在不能购买');const id=this.player.pos,b=board[id];if(this.player.cash<b.price)this.fail('现金不足，可选择拍卖');this.player.cash-=b.price;this.s.props[id].owner=this.s.turn;this.note(`${this.player.name}以 ${b.price} 购入${b.name}。`);this.s.phase='done';}
 openAuction(data){this.s.auction={bid:0,leader:null,actor:this.alive()[0],confirmed:[],eligible:this.alive(),...data};this.s.phase='auction';}
 startAuction(){if(this.s.phase!=='buy')this.fail('现在不能拍卖');this.openAuction({kind:'property',id:this.player.pos,after:'done',actor:this.s.turn});}
 bid(amount,who=this.s.auction?.actor){
  const a=this.s.auction;if(this.s.phase!=='auction'||!a.eligible.includes(who))this.fail('当前不能参与竞价');
  if(!Number.isInteger(amount)||amount<Math.max(10,a.bid+1))this.fail('起价 10，每次至少加价 1');if(amount>this.s.players[who].cash)this.fail('出价不能超过现金');
  a.bid=amount;a.leader=who;a.confirmed=[];a.actor=a.eligible.find(i=>i!==who)??who;this.note(`玩家 ${who+1}出价 ${amount}。`);
 }
 pass(who=this.s.auction?.actor){
  const a=this.s.auction;if(this.s.phase!=='auction'||!a.eligible.includes(who))this.fail('没有可确认的拍卖');
  if(!a.confirmed.includes(who))a.confirmed.push(who);
  if(a.eligible.every(i=>a.confirmed.includes(i)))this.finishAuction();else a.actor=a.eligible.find(i=>!a.confirmed.includes(i));
 }
 finishAuction(){
  const a=this.s.auction;if(!a||!a.eligible.every(i=>a.confirmed.includes(i)))this.fail('需要所有竞买人确认落槌');
  if(a.leader!==null){
   this.s.players[a.leader].cash-=a.bid;
   if(a.kind==='building'){const id=this.s.market.plans[a.leader].shift();this.placeBuilding(id);this.note(`玩家 ${a.leader+1}以 ${a.bid} 竞得建筑，建在${board[id].name}。`);}
   else{this.s.props[a.id].owner=a.leader;this.note(`玩家 ${a.leader+1}以 ${a.bid} 拍得${board[a.id].name}。`);}
  }else this.note('无人出价，本次流拍。');
  this.s.auction=null;
  if(a.kind==='building'){if(a.leader===null)this.finishMarket();else this.nextBuildingAuction();}
  else this.resume(a.after);
 }
 end(){if(this.s.phase!=='done')this.fail('请先完成当前操作');if(!this.s.extra){this.s.turn=1-this.s.turn;this.s.round++;this.s.doubles=0;}this.s.phase='roll';this.s.card=null;}
 manageOK(){if(!['roll','done','debt','buy','auction','transfer'].includes(this.s.phase))this.fail('请先完成当前银行操作');}
 buildable(id,props=this.s.props){
  const b=board[id],p=props[id];if(b?.type!=='street'||p.owner===null||p.level>=5||this.s.players[p.owner].bankrupt)return false;
  const group=this.group(id).map(i=>props[i]);return group.every(x=>x.owner===p.owner&&!x.mort)&&p.level===Math.min(...group.map(x=>x.level));
 }
 // A purchase is announced before allocation so both players can request scarce stock.
 requestBuild(id){
  this.manageOK();if(this.s.auction||this.s.transfer)this.fail('请先完成结算');
  if(!this.buildable(id))this.fail('需拥有完整且未抵押的色组，并均匀建造');if(this.s.debt?.from===this.s.props[id].owner)this.fail('请先偿付自己的债务');
  const p=this.s.props[id],kind=p.level===4?'hotel':'house',stock=kind==='hotel'?this.s.hotels:this.s.houses;
  if(!stock)this.fail('银行无此类建筑，请等待其他玩家售回');
  this.s.market={kind,plans:[[],[]],ready:[false,false],after:this.s.phase,actor:p.owner,scarce:false};this.s.market.plans[p.owner].push(id);this.s.phase='building';
 }
 planProps(who){const props=this.s.props.map(p=>({...p}));for(const id of this.s.market.plans[who])props[id].level++;return props;}
 planOptions(who){const m=this.s.market;if(!m||this.s.debt?.from===who)return [];const props=this.planProps(who);const cost=m.plans[who].reduce((n,id)=>n+board[id].cost,0);return board.filter(b=>props[b.id].owner===who&&this.buildable(b.id,props)&&(props[b.id].level===4?'hotel':'house')===m.kind).map(b=>b.id);}
 addPlan(who,id){if(this.s.phase!=='building'||!this.planOptions(who).includes(id))this.fail('此计划不符合均匀建造、类型或资金条件');this.s.market.plans[who].push(id);this.s.market.ready=[false,false];}
 undoPlan(who){if(this.s.phase!=='building')this.fail('没有建造计划');this.s.market.plans[who].pop();this.s.market.ready=[false,false];}
 confirmPlan(who){
  if(this.s.phase!=='building')this.fail('没有建造计划');const m=this.s.market;m.ready[who]=true;m.actor=1-who;
  if(!m.ready.every(Boolean))return;
  const total=m.plans.flat().length,stock=m.kind==='hotel'?this.s.hotels:this.s.houses;
  if(total>stock&&m.plans.every(p=>p.length)){m.scarce=true;this.note('双方需求超过银行库存，逐个拍卖建筑，10 起拍。');this.nextBuildingAuction();return;}
  // A sole buyer cannot request more stock than exists.
  if(total>stock){m.ready=[false,false];this.fail('建造数量超过库存，请撤销多余计划');}
  if([0,1].some(who=>m.plans[who].reduce((n,id)=>n+board[id].cost,0)>this.s.players[who].cash)){m.ready=[false,false];this.fail('计划费用超过现金，请减少建造数量');}
  for(const who of [0,1])for(const id of m.plans[who]){this.s.players[who].cash-=board[id].cost;this.placeBuilding(id);this.note(`${board[id].name}按标价建造${m.kind==='hotel'?'酒店':'房屋'}。`);}
  this.finishMarket();
 }
 placeBuilding(id){const p=this.s.props[id];if(!this.buildable(id))this.fail('建筑位置已不符合规则');if(p.level===4){if(!this.s.hotels)this.fail('没有酒店');this.s.hotels--;this.s.houses+=4;}else{if(!this.s.houses)this.fail('没有房屋');this.s.houses--;}p.level++;}
 nextBuildingAuction(){
  const m=this.s.market,stock=m.kind==='hotel'?this.s.hotels:this.s.houses;
  const eligible=[0,1].filter(i=>m.plans[i].length&&this.s.players[i].cash>=10&&this.buildable(m.plans[i][0]));
  if(!stock||!eligible.length){this.finishMarket();return;}
  this.openAuction({kind:'building',eligible,actor:eligible[0]});
 }
 finishMarket(){const after=this.s.market.after;this.s.market=null;this.s.phase=after;}
 cancelMarket(){if(this.s.phase!=='building')this.fail('拍卖开始后不能取消');this.finishMarket();}
 build(id,sell=false){
  if(!sell){this.requestBuild(id);return;}
  this.manageOK();const b=board[id],p=this.s.props[id],s=this.s;if(b.type!=='street'||p.owner===null)this.fail('请选择已拥有的街道');
  if(s.market)this.fail('请先完成建筑分配');const group=this.group(id).map(i=>s.props[i]);
  if(!p.level||p.level!==Math.max(...group.map(x=>x.level)))this.fail('必须均匀出售：先出售建筑最多的地产');
  if(p.level===5&&s.houses<4)this.fail('银行不足 4 栋房屋，无法拆分酒店；可整组清售');
  if(p.level===5){s.hotels++;s.houses-=4;}else s.houses++;p.level--;s.players[p.owner].cash+=b.cost/2;this.note(`${b.name}出售一层建筑，收入 ${b.cost/2}。`);
 }
 liquidate(id){this.manageOK();if(this.s.market)this.fail('请先完成建筑分配');const p=this.s.props[id];if(p.owner===null||board[id].type!=='street')this.fail('请选择街道');this.group(id).forEach(i=>this.sellAllBuildings(i));this.note('整组建筑已按半价售回银行。');}
 sellAllBuildings(id){const p=this.s.props[id];if(!p.level)return;this.s.players[p.owner].cash+=p.level*board[id].cost/2;if(p.level===5)this.s.hotels++;else this.s.houses+=p.level;p.level=0;}
 mortgage(id){
  this.manageOK();const b=board[id],p=this.s.props[id];if(p.owner===null||!b.price)this.fail('该地产尚无主人');
  if(this.s.market)this.fail('请先完成建筑分配');if(this.s.transfer?.queue.includes(id))this.fail('请先选择该地产的接收方式');
  if(b.type==='street'&&this.group(id).some(i=>this.s.props[i].level))this.fail('请先卖掉该色组的所有建筑');
  if(p.mort){if(this.s.debt?.from===p.owner)this.fail('请先结清债务');const cost=b.price/2+Math.ceil(b.price/20);if(this.available(p.owner)<cost)this.fail('可用现金不足（最高竞价已预留）');this.s.players[p.owner].cash-=cost;}
  else this.s.players[p.owner].cash+=b.price/2;p.mort=!p.mort;this.note(`${b.name}已${p.mort?'抵押':'赎回'}。`);
 }
 trade(offer){
  this.manageOK();if(this.s.market||this.s.transfer||this.s.estate)this.fail('请先完成建筑或遗产结算');
  const {give,take,cashGive,cashTake,cardsGive=0,cardsTake=0,from,mortgageChoices={}}=offer,to=1-from;
  if(![0,1].includes(from)||![cashGive,cashTake,cardsGive,cardsTake].every(n=>Number.isInteger(n)&&n>=0))this.fail('交易金额无效');
  if(new Set([...give,...take]).size!==give.length+take.length)this.fail('地产重复');
  for(const [ids,owner] of [[give,from],[take,to]])for(const id of ids){const b=board[id];if(!b||this.s.props[id].owner!==owner)this.fail('产权已变化');if(b.type==='street'&&this.group(id).some(i=>this.s.props[i].level))this.fail('交易前需卖掉该组全部建筑');if(this.s.props[id].mort&&!['keep','redeem'].includes(mortgageChoices[id]))this.fail('请为每处抵押地产选择立即赎回或付息保留');}
  const fee=ids=>ids.reduce((n,id)=>n+(this.s.props[id].mort?Math.ceil(board[id].price/20)+(mortgageChoices[id]==='redeem'?board[id].price/2:0):0),0);
  const p=this.s.players;if(this.available(from)<cashGive||this.available(to)<cashTake||this.available(from)-cashGive+cashTake<fee(take)||this.available(to)-cashTake+cashGive<fee(give))this.fail('可用现金不足以支付交易及抵押接收费用');
  if(p[from].cards.length<cardsGive||p[to].cards.length<cardsTake)this.fail('出狱卡不足');
  const keys=p=>p.cards.map(c=>`${c.deck}:${c.id}`);for(const [who,chosen,n] of [[from,offer.cardsGiveKeys,cardsGive],[to,offer.cardsTakeKeys,cardsTake]])if(chosen&&(chosen.length!==n||new Set(chosen).size!==n||chosen.some(k=>!keys(p[who]).includes(k))))this.fail('所选出狱卡无效');
  p[from].cash+=cashTake-cashGive-fee(take);p[to].cash+=cashGive-cashTake-fee(give);
  const pick=(who,chosen,n)=>{if(!chosen)return p[who].cards.splice(0,n);const take=p[who].cards.filter(c=>chosen.includes(`${c.deck}:${c.id}`));p[who].cards=p[who].cards.filter(c=>!chosen.includes(`${c.deck}:${c.id}`));return take;};
  const c1=pick(from,offer.cardsGiveKeys,cardsGive),c2=pick(to,offer.cardsTakeKeys,cardsTake);p[from].cards.push(...c2);p[to].cards.push(...c1);
  give.forEach(id=>this.s.props[id].owner=to);take.forEach(id=>this.s.props[id].owner=from);
  for(const id of [...give,...take])if(mortgageChoices[id]==='redeem')this.s.props[id].mort=false;
  this.note('双方确认交易；地产、现金和出狱卡已交换，抵押接收费用已结清。');
 }
 liquidationValue(who){return this.s.players[who].cash+this.s.props.reduce((n,p,id)=>n+(p.owner===who?(p.mort?0:board[id].price/2)+p.level*(board[id].cost||0)/2:0),0);}
 bankrupt(){
  const s=this.s,d=s.debt;if(s.phase!=='debt'||!d)this.fail('只有负债时可以宣告破产');
  if(this.liquidationValue(d.from)>=d.amount)this.fail('出售建筑并抵押地产后仍可偿付，不能宣告破产');
  const loser=d.from,p=s.players[loser];s.props.forEach((q,id)=>{if(q.owner===loser)this.sellAllBuildings(id);});p.bankrupt=true;p.jail=0;s.rentClaims=[];s.debt=null;s.transfer=null;s.auction=null;
  this.note(`玩家 ${loser+1}清算后仍不能偿付 ${d.amount}，宣告破产。`);
  const ids=board.filter(b=>s.props[b.id].owner===loser).map(b=>b.id);
  if(d.to!==null&&!s.players[d.to].bankrupt){
   s.players[d.to].cash+=p.cash;p.cash=0;s.players[d.to].cards.push(...p.cards);p.cards=[];ids.forEach(id=>s.props[id].owner=d.to);
   s.estate={loser,to:d.to,queue:[]};s.transfer={owner:d.to,queue:ids.filter(id=>s.props[id].mort),redeem:false};this.nextTransfer();
  }else{
   p.cash=0;for(const c of p.cards)s.decks[c.deck].push(c.id);p.cards=[];ids.forEach(id=>Object.assign(s.props[id],{owner:null,mort:false,level:0}));
   s.estate={loser,to:null,queue:ids};this.nextEstateAuction();
  }
 }
 nextTransfer(){if(this.s.transfer.queue.length)this.s.phase='transfer';else{this.s.transfer=null;this.finishEstate();}}
 receiveMortgage(redeem){
  if(this.s.phase!=='transfer')this.fail('没有待接收的抵押地产');const t=this.s.transfer,id=t.queue[0];
  if(redeem&&this.s.players[t.owner].cash<board[id].price/2+Math.ceil(board[id].price/20))this.fail('立即赎回现金不足，可先管理资产或选择仅付利息');
  t.redeem=redeem;this.pay(t.owner,null,Math.ceil(board[id].price/20)+(redeem?board[id].price/2:0),'transferPaid');
 }
 nextEstateAuction(){const e=this.s.estate;if(!this.alive().length||!e.queue.length){this.finishEstate();return;}const id=e.queue.shift();this.openAuction({kind:'property',id,after:'estateAuction'});}
 finishEstate(){this.s.estate=null;this.s.transfer=null;this.s.auction=null;this.s.debt=null;this.s.winner=this.alive()[0]??null;this.s.phase='over';this.note(this.s.winner===null?'所有玩家均已破产，无人获胜。':`${this.s.players[this.s.winner].name}成为最后未破产的玩家，获胜。`);}
}
const api={Game,board,colors,chance,chest};if(typeof module!=='undefined')module.exports=api;else root.Monopoly=api;
})(typeof window!=='undefined'?window:globalThis);
