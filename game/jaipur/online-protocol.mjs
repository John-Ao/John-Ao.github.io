// Portal orders messages; all Jaipur rules and negotiation are checked locally.
export const GAME_VERSION = 'jaipur-net-v1';
const check=(ok,message)=>{if(!ok)throw Error(message);};
const round=value=>typeof value==='string'&&/^[\w-]{16,80}$/.test(value);
// Stable random stream: never consult ambient Math.random during replay.
function rng(seed){let n=2166136261;for(const c of seed)n=Math.imul(n^c.charCodeAt(0),16777619);return ()=>{n+=0x6D2B79F5;let t=n;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return ((t^t>>>14)>>>0)/4294967296;};}
export function applyEvent(E,model,event){
  const p=event?.payload,seat=event?.seat;
  check(p&&p.version===GAME_VERSION&&[0,1].includes(seat),'游戏版本或玩家身份不一致');
  if(!model){
    check(p.kind==='init'&&seat===0&&round(p.roundId),'无效的初始化消息');
    return {board:E.round(undefined,undefined,rng(p.roundId)),history:[],roundId:p.roundId,revision:0,proposal:null};
  }
  check(p.roundId===model.roundId&&Number.isSafeInteger(p.base)&&p.base===model.revision,'操作对应的局面与本地不一致');
  const next={...model,history:[...model.history]};
  if(p.kind==='action'){
    check(!model.proposal,'协商尚未结束');
    check(model.board.turn===seat,'不是发送者的回合');
    const a=p.action;
    check(a&&['take','camels','exchange','sell'].includes(a.type)&&Array.isArray(a.market)&&Array.isArray(a.hand)&&Number.isInteger(a.camels)&&a.camels>=0,'行动字段无效');
    check((a.type==='exchange'||a.camels===0)&&(a.type!=='take'||a.hand.length===0)&&(a.type!=='sell'||a.market.length===0)&&(a.type!=='camels'||(!a.market.length&&!a.hand.length)),'行动包含无关选牌');
    next.board=E.act(model.board,a);
    next.history.push(model.board);next.revision++;
  }else if(p.kind==='propose'){
    check(!model.proposal&&['undo','restart','next'].includes(p.operation),'协商请求无效');
    if(p.operation==='undo')check(model.history.length>0,'当前没有可以撤回的操作');
    else check(round(p.nextRound)&&p.nextRound!==model.roundId,'新局参数无效');
    if(p.operation==='next')check(model.board.ended&&!model.board.wins.some(n=>n>=2),'不能开始下一局');
    check(typeof event.id==='string'&&event.id.length>0,'提案 ID 无效');
    next.proposal={id:event.id,seat,operation:p.operation,nextRound:p.nextRound};
  }else if(p.kind==='respond'){
    const proposal=model.proposal;
    check(proposal&&proposal.seat!==seat&&p.proposalId===proposal.id&&typeof p.accept==='boolean','协商回复无效');
    if(p.accept){
      if(proposal.operation==='undo'){next.board=next.history.pop();next.revision++;}
      else{next.board=proposal.operation==='next'?E.nextRound(model.board,rng(proposal.nextRound)):E.round(undefined,undefined,rng(proposal.nextRound));next.history=[];next.roundId=proposal.nextRound;next.revision=0;}
    }
    next.proposal=null;
  }else check(false,'未知游戏操作');
  return next;
}
export function replay(E,events){
  check(Array.isArray(events),'消息记录无效');
  let model=null,seq=0;const ids=new Set();
  for(const event of events){
    check(event.seq===++seq&&typeof event.id==='string'&&!ids.has(event.id),'消息记录不连续或重复');
    ids.add(event.id);model=applyEvent(E,model,event);
  }
  return model;
}
