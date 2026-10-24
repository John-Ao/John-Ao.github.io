// Tacta rules and deck order are interpreted locally; Portal only orders events.
export const GAME_VERSION = 'tacta-net-v1';
const check=(ok,message)=>{if(!ok)throw Error(message);};
const round=v=>typeof v==='string'&&/^[\w-]{16,80}$/.test(v);
const seed=v=>Number.isInteger(v)&&v>=0&&v<=0xffffffff;
// Mulberry32: fixed unsigned 32-bit arithmetic, one draw per Fisher-Yates step.
export function seededRandom(value){let n=value;return ()=>{n=(n+0x6D2B79F5)|0;let t=Math.imul(n^(n>>>15),1|n);t^=t+Math.imul(t^(t>>>7),61|t);return ((t^(t>>>14))>>>0)/4294967296;};}
const initial=(E,s)=>E.create(seededRandom(s),{width:1600,height:1100});
export function applyEvent(E,model,event){
 const p=event?.payload,seat=event?.seat;
 check(p&&p.version===GAME_VERSION&&[0,1].includes(seat),'游戏版本或玩家身份不一致');
 if(!model){
  check(p.kind==='init'&&seat===0&&round(p.roundId)&&seed(p.seed),'无效的初始化消息');
  return {board:initial(E,p.seed),history:[],roundId:p.roundId,revision:0,proposal:null};
 }
 check(p.roundId===model.roundId&&Number.isSafeInteger(p.base)&&p.base===model.revision,'操作对应的局面与本地不一致');
 const n={...model,history:[...model.history]};
 if(p.kind==='action'){
  check(!model.proposal&&!model.board.finished,'当前不能落牌');
  check(model.board.turn===seat,'不是发送者的回合');
  const a=p.action;
  check(a&&typeof a.id==='string'&&Number.isInteger(a.rotation)&&a.rotation>=0&&a.rotation<360&&a.rotation%45===0&&typeof a.flip==='boolean'&&[a.x,a.y].every(Number.isFinite),'落牌字段无效');
  n.board=structuredClone(model.board);
  E.play(n.board,a.id,a.rotation,a.flip,a.x,a.y);
  n.history.push(model.board);n.revision++;
 }else if(p.kind==='propose'){
  check(!model.proposal&&['undo','restart'].includes(p.operation),'协商请求无效');
  if(p.operation==='undo')check(model.history.length>0,'当前没有可以撤回的操作');
  else check(round(p.nextRound)&&p.nextRound!==model.roundId&&seed(p.seed),'新局参数无效');
  check(typeof event.id==='string'&&event.id.length>0,'提案 ID 无效');
  n.proposal={id:event.id,seat,operation:p.operation,nextRound:p.nextRound,seed:p.seed};
 }else if(p.kind==='respond'){
  const request=model.proposal;
  check(request&&request.seat!==seat&&p.proposalId===request.id&&typeof p.accept==='boolean','协商回复无效');
  if(p.accept){
   if(request.operation==='undo'){n.board=n.history.pop();n.revision++;}
   else{n.board=initial(E,request.seed);n.history=[];n.roundId=request.nextRound;n.revision=0;}
  }
  n.proposal=null;
 }else if(p.kind==='resign'){
  check(!model.proposal&&!model.board.finished,'当前不能认输');
  n.history.push(model.board);n.board={...model.board,finished:true,resigned:seat};n.revision++;
 }else check(false,'未知游戏操作');
 return n;
}
export function replay(E,events){
 check(Array.isArray(events),'消息记录无效');
 let model=null,seq=0;const ids=new Set();
 for(const e of events){check(e.seq===++seq&&typeof e.id==='string'&&!ids.has(e.id),'消息记录不连续或重复');ids.add(e.id);model=applyEvent(E,model,e);}
 return model;
}
