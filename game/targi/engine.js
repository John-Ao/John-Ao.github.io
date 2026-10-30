(function(root){
  'use strict';
  const D=typeof module!=='undefined'&&module.exports?require('./cards.js'):root.TargiCards;
  const ring=[1,2,3,4,9,14,19,24,23,22,21,20,15,10,5,0];
  const centers=[6,7,8,11,12,13,16,17,18];
  const border={1:['贵族','打出或弃掉手牌','noble'],2:['椰枣','获得 1 椰枣',0],3:['盐','获得 1 盐',1],5:['商人','货物兑换 · 不限次数','trade'],6:['胡椒','获得 1 胡椒',2],7:['椰枣','获得 1 椰枣',0],9:['海市蜃楼','移动一个尚未使用的交点','move'],10:['银匠','兑换胜利分 · 一次','silver'],11:['胡椒','获得 1 胡椒',2],13:['商队','抽取一张货物牌','caravan'],14:['部落扩张','抽取一张部落牌','expand'],15:['盐','获得 1 盐',1]};
  const clone=x=>JSON.parse(JSON.stringify(x));
  const cards=p=>p.rows.flat();
  const has=(p,effect)=>cards(p).some(c=>c.effect===effect);
  const goodsCount=p=>p.r[0]+p.r[1]+p.r[2];
  function shuffle(a,rng=Math.random){for(let i=a.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
  function log(s,msg){s.log.unshift(msg);s.log=s.log.slice(0,100);}
  const name=i=>i?'赭方':'蓝方';
  function draw(s,kind){const deck=kind==='tribe'?'td':'gd',discard=kind==='tribe'?'tx':'gx';if(!s[deck].length)s[deck]=shuffle(s[discard].splice(0));if(!s[deck].length)throw Error('牌库与弃牌堆均为空');const card=s[deck].pop();if(kind==='goods'&&!s[deck].length&&s[discard].length)s[deck]=shuffle(s[discard].splice(0));return card;}
  function create(first=0,rng=Math.random){
    const s={version:2,players:[0,1].map(()=>({r:[2,2,2,1,4],rows:[[],[],[]],hand:null,storedGold:0,blockedRound:0,seen:[false,false,false],productionUsed:[],freeHandUsed:false,endBonus:false})),td:shuffle(clone(D.tribes),rng),gd:shuffle(clone(D.goods),rng),tx:[],gx:[],board:{},placed:[[],[]],actions:[[],[]],first,turn:first,round:1,robber:1,phase:'place',pending:null,raidPaid:0,log:[]};
    centers.forEach((x,i)=>s.board[x]=draw(s,i%2?'tribe':'goods'));
    log(s,`基础版新对局，${name(first)}先手。`);return s;
  }
  function opposite(i){let r=Math.floor(i/5),c=i%5;return r===0?20+c:r===4?c:c===0?r*5+4:r*5;}
  function quota(s,p){return s.players[p].blockedRound===s.round?2:3;}
  function legal(s,i,p=s.turn){const n=ring.indexOf(i)+1;return s.phase==='place'&&n>0&&n%4!==0&&s.placed[p].length<quota(s,p)&&(!s.placed.flat().includes(i))&&!s.placed[1-p].includes(opposite(i))&&(n!==s.robber||has(s.players[p],'robber'));}
  function intersections(list){const rs=[...new Set(list.filter(i=>i%5===0||i%5===4).map(i=>Math.floor(i/5)))],cs=[...new Set(list.filter(i=>i<5||i>=20).map(i=>i%5))];return rs.flatMap(r=>cs.map(c=>r*5+c));}
  function place(s,i){if(!legal(s,i))throw Error('此处不能放置族人');s.placed[s.turn].push(i);log(s,`${name(s.turn)}落子：${border[ring.indexOf(i)+1][0]}`);if([0,1].every(p=>s.placed[p].length===quota(s,p))){s.actions=s.placed.map(a=>[...a,...intersections(a)]);s.phase='action';s.turn=s.first;}else if(s.placed[1-s.turn].length<quota(s,1-s.turn))s.turn=1-s.turn;}
  function score(s,index){
    const p=s.players[index],all=cards(p),rows=p.rows.map(row=>row.length!==4?0:new Set(row.map(c=>c.type)).size===1?4:new Set(row.map(c=>c.type)).size===4?2:0);
    const detail=all.map(c=>{let n=0;switch(c.effect){case'pairs':n=Math.floor(all.filter(d=>d.type===c.arg).length/2);break;case'majority':n=+(all.length>cards(s.players[1-index]).length);break;case'ten':n=+(all.length>=10);break;case'rightmost':n=p.rows.some(row=>row.length===4&&row[3].id===c.id)?2:0;break;case'diversity':n=Math.min(2,rows.filter(v=>v===2).length)*2;break;}return {id:c.id,points:n};}).filter(d=>d.points);
    const printed=all.reduce((n,c)=>n+c.vp,0),abilities=detail.reduce((n,d)=>n+d.points,0),rowPoints=rows.reduce((a,b)=>a+b,0);
    return {tokens:p.r[4],printed,abilities,rows,rowPoints,detail,total:p.r[4]+printed+abilities+rowPoints};
  }
  function winner(s){const a=s.players[0],b=s.players[1];const delta=score(s,0).total-score(s,1).total||a.r[3]-b.r[3]||goodsCount(a)-goodsCount(b);return delta===0?null:delta>0?0:1;}
  // Enumerate player-selected discounts instead of silently spending a particular good.
  function discounted(cost,n){if(n<=0||!cost.slice(0,3).some(Boolean))return [cost];return cost.slice(0,3).flatMap((v,i)=>{if(!v)return [];const next=[...cost];next[i]--;return discounted(next,n-1);});}
  function payments(s,c,source='board',index=s.turn){
    const p=s.players[index];if(cards(p).length>=12||(source==='freeHand'&&p.freeHandUsed))return [];
    const reductions=cards(p).filter(d=>d.effect==='discount'&&d.arg===c.type).length+(source==='noble'&&has(p,'nobleDiscount')?1:0);
    const result=[];
    for(const base of c.costs){
      for(const reduced of discounted([...base],reductions)){
        // A gold-only card has no printed good; any good may pay the free-hand surcharge.
        const extras=source==='freeHand'?(base.slice(0,3).some(Boolean)?[0,1,2].filter(i=>base[i]>0):[0,1,2]):[-1];
        for(const extra of extras){const cost=[...reduced];if(extra>=0)cost[extra]++;
          for(const stored of cost[3]>0&&p.storedGold?[0,1]:[0]){const pay=[...cost];pay[3]-=stored;if(pay.every((n,i)=>n<=p.r[i]))result.push({pay,stored});}
        }
      }
    }
    return [...new Map(result.map(v=>[JSON.stringify(v),v])).values()];
  }
  function produce(s){const p=s.players[s.turn];for(const c of cards(p).filter(c=>c.effect==='production')){if(p.seen[c.arg]&&!p.productionUsed.includes(c.id)){p.r[c.arg]++;p.productionUsed.push(c.id);log(s,`${name(s.turn)}触发 ${c.id}：额外获得 1 ${['椰枣','盐','胡椒'][c.arg]}`);}}}
  function gainGoodsCard(s,c,choice){const p=s.players[s.turn],gain=c.gain.length?c.gain:[[choice,1]];for(const [i,n] of gain){p.r[i]+=n;if(i<3)p.seen[i]=true;}produce(s);}
  // Remove the used central card now and reserve the next deck card face down now,
  // so Caravan / Tribal Expansion never draw a card already dealt to the board.
  function consume(s,origin,disposition='discard'){
    s.actions[s.turn]=s.actions[s.turn].filter(i=>i!==origin);
    if(centers.includes(origin)){const old=s.board[origin];if(disposition==='discard')s[old.kind==='tribe'?'tx':'gx'].push(old);s.board[origin]={kind:'back',card:draw(s,old.kind==='tribe'?'goods':'tribe')};}
  }
  function complete(s,disposition='discard'){const q=s.pending;if(q?.origin!=null)consume(s,q.origin,disposition);else if(q?.source==='expand'&&disposition==='discard')s.tx.push(q.card);s.pending=null;}
  function activate(s,origin){
    if(s.phase!=='action'||s.pending||!s.actions[s.turn].includes(origin))throw Error('当前不能执行此行动');
    const p=s.players[s.turn];s.pending={origin};
    if(centers.includes(origin)){const c=s.board[origin];s.pending={origin,kind:c.kind==='tribe'?'tribe':'goods',source:'board',card:c};if(c.kind==='goods'&&c.gain.length){gainGoodsCard(s,c);complete(s);}return;}
    const action=border[ring.indexOf(origin)+1][2];
    if(typeof action==='number'){p.r[action]++;complete(s);return;}
    if(action==='caravan'){const c=draw(s,'goods');s.gx.push(c);s.pending={origin,kind:'goods',source:'caravan',card:c};if(c.gain.length){gainGoodsCard(s,c);complete(s);}return;}
    if(action==='expand'){s.pending={origin,kind:'tribe',source:'expand',card:draw(s,'tribe')};return;}
    if(action==='noble'){if(!p.hand){complete(s);return;}s.pending={origin,kind:'tribe',source:'noble',card:p.hand};return;}
    s.pending={origin,kind:action};
  }
  function skip(s,origin){if(s.phase!=='action'||s.pending||!s.actions[s.turn].includes(origin))throw Error('无法放弃');s.actions[s.turn]=s.actions[s.turn].filter(i=>i!==origin);log(s,`${name(s.turn)}放弃一个行动，中央牌保留`);}
  function freeHand(s){const p=s.players[s.turn];if(s.phase!=='action'||s.pending||!p.hand||p.freeHandUsed||!has(p,'freeHand'))throw Error('不能发动手牌能力');s.pending={kind:'tribe',source:'freeHand',card:p.hand};}
  function mayBuild(s){const q=s.pending;return q?.kind==='tribe'&&!(q.source==='noble'&&q.card.heldRound===s.round);}
  function build(s,row,paymentIndex){
    const q=s.pending,p=s.players[s.turn];if(!mayBuild(s)||!Number.isInteger(row)||row<0||row>2||p.rows[row].length===4)throw Error('不能在此行建造');
    const plan=payments(s,q.card,q.source)[paymentIndex];if(!plan)throw Error('支付方案无效');
    plan.pay.forEach((n,i)=>p.r[i]-=n);p.storedGold-=plan.stored;
    const c={...q.card};delete c.heldRound;p.rows[row].push(c);
    if(['noble','freeHand'].includes(q.source))p.hand=null;
    if(q.source==='freeHand')p.freeHandUsed=true;
    log(s,`${name(s.turn)}建造 ${c.id} ${D.types[c.type]}，第 ${row+1} 行`);
    complete(s,'taken');
    switch(c.effect){
      case 'storedGold':p.storedGold++;break;
      case 'block':s.players[1-s.turn].blockedRound=s.round+1;break;
      case 'builtGoods':s.pending={kind:'bonusGoods',left:Math.floor(cards(p).length/2),after:'action'};break;
      case 'emptyGoods':s.pending={kind:'bonusGoods',left:Math.floor((12-cards(p).length)/2),after:'action'};break;
      case 'choiceBonus':s.pending={kind:'choiceBonus'};break;
      case 'rearrange':s.pending={kind:'rearrange',original:clone(p.rows),grid:p.rows.map(r=>[...r,...Array(4-r.length).fill(null)]),held:[],moved:[],selected:null};break;
    }
    if(s.pending?.kind==='bonusGoods'&&s.pending.left===0)s.pending=null;
    produce(s);
  }
  function tribeDecision(s,decision){const q=s.pending,p=s.players[s.turn];if(q?.kind!=='tribe')throw Error('没有待处理部落牌');
    if(decision==='cancel'){if(q.source!=='freeHand'&&q.source!=='noble')throw Error('抽牌后不能撤回');complete(s,'taken');return;}
    if(decision==='hold'){if(p.hand||q.source==='noble'||q.source==='freeHand')throw Error('只能持有一张手牌');p.hand={...q.card,heldRound:s.round};complete(s,'taken');return;}
    if(decision==='discard'){if(q.source==='freeHand')throw Error('额外手牌能力不允许弃牌');if(q.source==='noble'){s.tx.push(p.hand);p.hand=null;complete(s,'taken');}else if(q.source==='expand'){s.tx.push(q.card);complete(s,'taken');}else complete(s);return;}
    throw Error('无效选择');
  }
  function chooseGood(s,i){if(![0,1,2].includes(i))throw Error('请选择货物');const q=s.pending,p=s.players[s.turn];
    if(q?.kind==='goods'){gainGoodsCard(s,q.card,i);complete(s);return;}
    if(q?.kind==='bonusGoods'){p.r[i]++;q.left--;if(!q.left){s.pending=null;if(q.after==='endTurn')passTurn(s);}return;}
    if(q?.kind==='raidGoods'){if(p.r[i]<1)throw Error('没有此货物');p.r[i]--;if(--q.left===0){s.pending=null;raidComplete(s,true);}return;}
    throw Error('当前无需选择货物');
  }
  function bonus(s,what){if(s.pending?.kind!=='choiceBonus')throw Error('没有入场奖励');const p=s.players[s.turn];if(what==='goods')s.pending={kind:'bonusGoods',left:3,after:'action'};else if(what==='gold'||what==='vp'){p.r[what==='gold'?3:4]++;s.pending=null;}else throw Error('无效奖励');}
  function exchanges(s){const q=s.pending,p=s.players[s.turn],options=[];if(!q||!['trade','silver'].includes(q.kind))return options;
    for(let i=0;i<3;i++){if(q.kind==='trade'){for(let j=0;j<4;j++)if(i!==j){const n=j===3?3:has(p,'trade')?1:2;if(p.r[i]>=n)options.push({i,n,j,m:1});}}else for(const [n,m] of [[2,1],[4,3]])if(p.r[i]>=n)options.push({i,n,j:4,m});}
    if(q.kind==='silver')for(const [n,m] of [[1,2],[2,4]])if(p.r[3]>=n)options.push({i:3,n,j:4,m});return options;
  }
  function exchange(s,index){const o=exchanges(s)[index];if(!o)throw Error('无效兑换');const p=s.players[s.turn];p.r[o.i]-=o.n;p.r[o.j]+=o.m;if(s.pending.kind==='silver')complete(s);}
  function moveTargets(s){return centers.filter(i=>!s.actions.flat().includes(i)&&s.board[i].kind!=='back');}
  function move(s,from,to){if(s.pending?.kind!=='move'||!centers.includes(from)||!s.actions[s.turn].includes(from)||!moveTargets(s).includes(to))throw Error('无法移动到此格');s.actions[s.turn]=s.actions[s.turn].map(i=>i===from?to:i);complete(s);}
  function rearrange(s,op,row,col){const q=s.pending;if(q?.kind!=='rearrange')throw Error('不在重排阶段');
    if(op==='reset'){q.grid=q.original.map(r=>[...r,...Array(4-r.length).fill(null)]);q.held=[];q.moved=[];q.selected=null;return;}
    if(op==='done'){if(q.held.length||q.grid.some(r=>r.some((c,i)=>c&&r.slice(0,i).includes(null))))throw Error('请放回所有牌，且每行左侧不能留空');s.players[s.turn].rows=q.grid.map(r=>r.filter(Boolean));s.pending=null;return;}
    if(op==='cancel'){s.players[s.turn].rows=q.original;s.pending=null;return;}
    if(!Number.isInteger(row)||!Number.isInteger(col)||row<0||row>2||col<0||col>3)throw Error('无效位置');
    if(op==='lift'){const c=q.grid[row][col];if(!c||(!q.moved.includes(c.id)&&q.moved.length===2))throw Error('至多重排两张牌');if(!q.moved.includes(c.id))q.moved.push(c.id);q.held.push(c);q.grid[row][col]=null;return;}
    if(op==='drop'){if(q.grid[row][col]||!q.held.length)throw Error('此处无法放牌');q.grid[row][col]=q.held.shift();return;}
    throw Error('无效重排操作');
  }
  function endTurn(s){if(s.phase!=='action'||s.pending||s.actions[s.turn].length)throw Error('还有未完成行动');const p=s.players[s.turn];if(has(p,'noGoods')&&!p.seen.some(Boolean)&&!p.endBonus){p.endBonus=true;s.pending={kind:'bonusGoods',left:1,after:'endTurn'};}else passTurn(s);}
  function passTurn(s){s.pending=null;if(s.turn===s.first)s.turn=1-s.first;else{s.phase='limit';s.turn=s.first;checkLimit(s);}}
  function checkLimit(s){let p=s.players[s.turn];if(p.r[3]>3){log(s,`${name(s.turn)}退回 ${p.r[3]-3} 黄金`);p.r[3]=3;}if(goodsCount(p)>10)return;
    if(s.turn===s.first){s.turn=1-s.first;checkLimit(s);return;}
    if(s.players.some(p=>cards(p).length===12)){s.phase='end';log(s,'12 张部落触发终局，本回合双方行动均已完成。');return;}
    for(const i of centers)if(s.board[i].kind==='back')s.board[i]=s.board[i].card;
    s.first=1-s.first;s.turn=s.first;s.placed=[[],[]];s.actions=[[],[]];s.robber++;
    s.players.forEach(p=>{p.seen=[false,false,false];p.productionUsed=[];p.freeHandUsed=false;p.endBonus=false;});
    if(s.robber%4===0){s.phase='raid';s.raidPaid=0;}else{s.round++;s.phase='place';}
  }
  function discardLimit(s,i){if(s.phase!=='limit'||![0,1,2].includes(i)||s.players[s.turn].r[i]<1||goodsCount(s.players[s.turn])<=10)throw Error('无法弃货');s.players[s.turn].r[i]--;checkLimit(s);}
  function raidCost(s){return {goods:s.robber===16?0:s.robber/4,gold:s.robber===16?1:0,vp:s.robber<12?1:s.robber===12?2:3};}
  function raidOptions(s){const p=s.players[s.turn],r=raidCost(s);const options=[];if(has(p,'raidImmune'))options.push('immune');if(p.r[4]>=r.vp)options.push('vp');if(r.gold?p.r[3]>=r.gold:goodsCount(p)>=r.goods)options.push('resources');if(!options.length)options.push('unable');return options;}
  function raid(s,choice){if(s.phase!=='raid'||s.pending||!raidOptions(s).includes(choice))throw Error('无法如此支付袭击');const p=s.players[s.turn],r=raidCost(s);
    if(choice==='immune'){raidComplete(s,false);return;}
    if(choice==='unable'){s.players[1-s.turn].r[4]+=r.vp;log(s,`${name(s.turn)}无力支付袭击，${name(1-s.turn)}获得 ${r.vp} 分`);raidComplete(s,false);return;}
    if(choice==='vp'){p.r[4]-=r.vp;raidComplete(s,true);return;}
    if(r.gold){p.r[3]-=r.gold;raidComplete(s,true);}else s.pending={kind:'raidGoods',left:r.goods};
  }
  function raidComplete(s,paid){if(paid&&has(s.players[s.turn],'raidReward'))s.players[s.turn].r[4]++;s.raidPaid++;if(s.raidPaid===2){if(s.robber===16){s.phase='end';log(s,'第四次袭击结束，进行最终计分。');}else{s.robber++;s.round++;s.phase='place';s.turn=s.first;}}else s.turn=1-s.turn;s.pending=null;}
  // All public changes use a copy: invalid commands cannot partially mutate a saved game.
  function dispatch(state,action){const s=clone(state);switch(action.type){
    case'place':place(s,action.cell);break;
    case'activate':activate(s,action.cell);break;
    case'skip':skip(s,action.cell);break;
    case'build':build(s,action.row,action.payment);break;
    case'tribe':tribeDecision(s,action.choice);break;
    case'good':chooseGood(s,action.resource);break;
    case'bonus':bonus(s,action.choice);break;
    case'exchange':exchange(s,action.index);break;
    case'move':move(s,action.from,action.to);break;
    case'rearrange':rearrange(s,action.op,action.row,action.col);break;
    case'freeHand':freeHand(s);break;
    case'endTurn':endTurn(s);break;
    case'limit':discardLimit(s,action.resource);break;
    case'raid':raid(s,action.choice);break;
    case'finish':if(!s.pending||!['trade','silver','move'].includes(s.pending.kind))throw Error('无法结束');complete(s);break;
    default:throw Error('未知指令');
  }return s;}
  const api={create,dispatch,ring,centers,border,opposite,intersections,quota,legal,score,winner,payments,mayBuild,has,cards,goodsCount,exchanges,moveTargets,raidOptions,raidCost,clone};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.Targi=api;
})(typeof globalThis!=='undefined'?globalThis:this);
