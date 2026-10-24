'use strict';
let random, applyEvent, replay, GAME_VERSION, portal;
async function loadPortal(){
 if(location.protocol==='file:')throw new Error('联网需要通过 HTTPS 网站或本地 HTTP 服务访问，本地双人模式可直接使用。');
 if(portal)return;
 const [sdk,protocol,game]=await Promise.all([import('../../portal/sdk/client.js?v=2'),import('../../portal/shared/protocol.js'),import('./online-protocol.mjs')]);
 random=protocol.random;({applyEvent,replay,GAME_VERSION}=game);portal=sdk.createPortal({gameId:'quoridor'});
}
let online = null, onlineModel = null, networkError = '', peerJoined = false, peerOnline = false, connectionStatus = '';
let invitation=null, invitationEntry=new URLSearchParams(location.hash.slice(1)).has('invite')||sessionStorage.getItem('quoridor.invitationEntry')==='1'||!!sessionStorage.getItem('quoridor.invitation');
const activeRoomKey = 'quoridor.online.room', recentRoomKey = 'quoridor.online.recent';
let localSnapshot=null;
const busyButtons=new Set();
let shareExpires=0,inviteExpiryTimer=null;
function clearInviteLink(){ $('shareLink').value='';shareExpires=0;clearTimeout(inviteExpiryTimer); }
function canAct() { return !online || (!!onlineModel && online.ready && !online.pending && !networkError && peerJoined && !onlineModel.proposal && state.turn === online.seat); }

const $=id=>document.getElementById(id),Q=window.Quoridor,names=['玩家一','玩家二'];
// One notice at a time. Confirmation promises resolve false on Escape or ×.
let dialogQueue=[],activeDialog=null,seenProposal=null,peerLeaveTimer=null,peerLeaveNotified=false;
function openDialog(id){
 for(const dialog of document.querySelectorAll('dialog[open]'))if(dialog.id!==id)dialog.close();
 if(!$(id).open)$(id).showModal();
 window.fitGame();
}
function pumpDialogs(){
 if(activeDialog||$('proposal').open)return;
 while(dialogQueue.length){
  const next=dialogQueue.shift();
  if(next.valid&&!next.valid()){next.resolve(false);continue;}
  activeDialog=next;
  $('eventTitle').textContent=next.title;$('eventMessage').textContent=next.message;
  $('eventCancel').hidden=!next.confirm;$('eventAccept').textContent=next.confirm||'知道了';
  openDialog('eventDialog');return;
 }
}
function gameDialog(title,message,{confirm=null,key=null,valid=null}={}){
 if(key&&(activeDialog?.key===key||dialogQueue.some(d=>d.key===key)))return Promise.resolve(false);
 return new Promise(resolve=>{dialogQueue.push({title,message,confirm,key,valid,resolve});pumpDialogs();});
}
function dismissNotice(key){
 dialogQueue=dialogQueue.filter(d=>{if(d.key===key){d.resolve(false);return false;}return true;});
 if(activeDialog?.key===key)$('eventDialog').close();
}
function clearDialogs(){
 for(const item of dialogQueue)item.resolve(false);dialogQueue=[];
 if(activeDialog){activeDialog.cancelled=true;$('eventDialog').close('cancel');}
 for(const dialog of document.querySelectorAll('dialog[open]'))if(dialog.id!=='eventDialog')dialog.close('cancel');
}
function refreshDialogs(){
 if(activeDialog?.valid&&!activeDialog.valid())$('eventDialog').close();
}
$('eventAccept').onclick=()=>{$('eventDialog').returnValue='accept';$('eventDialog').close('accept');};
$('eventCancel').onclick=()=>$('eventDialog').close('cancel');
$('eventDialog').addEventListener('close',()=>{
 const finished=activeDialog;activeDialog=null;
 finished?.resolve(!finished.cancelled&&$('eventDialog').returnValue==='accept'&&(!finished.valid||finished.valid()));
 $('eventDialog').returnValue='';queueMicrotask(pumpDialogs);
});
$('eventDialog').addEventListener('cancel',()=>{$('eventDialog').returnValue='';});
for(const button of document.querySelectorAll('[data-close]'))button.onclick=()=>$(button.dataset.close).close('cancel');
$('proposal').addEventListener('close',()=>queueMicrotask(pumpDialogs));
let state=Q.initial(Math.random()<.5?0:1),history=[],mode='move',orientation='h',preview=null;
const key='quoridor.local.v1';
try{const saved=JSON.parse(localStorage.getItem(key));if(saved&&Array.isArray(saved.history)&&saved.history.length<10000){const start=Q.initial(saved.start);let s=start,hs=[];for(const action of saved.history){const n=Q.play(s,action);if(!n)throw Error('invalid');hs.push(s);s=n;}state=s;history=hs;}}catch{}
let actions=[];
// Reconstruct persisted actions from the verified state history.
function actionBetween(a,b){const p=a.turn;return b.walls.length>a.walls.length?{type:'wall',...b.walls[b.walls.length-1]}:{type:'move',...b.pawns[p]};}
if(history.length)actions=history.map((s,i)=>actionBetween(s,history[i+1]||state));
function save(){if(online)return;try{localStorage.setItem(key,JSON.stringify({start:(history[0]||state).turn,history:actions}));}catch{}}
function pos(el,x,y,w,h){Object.assign(el.style,{left:x/496*100+'%',top:y/496*100+'%',width:w/496*100+'%',height:h/496*100+'%'});}
function fence(w,extra=''){const el=document.createElement('div');el.className='fence '+extra;pos(el,w.o==='h'?w.c*56:w.c*56+48,w.o==='h'?w.r*56+48:w.r*56,w.o==='h'?104:8,w.o==='h'?8:104);$('board').append(el);}
function commit(action){if(online){if(canAct())sendGame({kind:'action',action});return;}const next=Q.play(state,action);if(!next)return;history.push(state);actions.push(action);state=next;preview=null;mode='move';save();render();}
function render(){
 document.documentElement.style.setProperty('--accent',state.turn===0?'#22677b':'#a65a26');
 $('turn').textContent=state.winner===null?names[state.turn]+'的回合':names[state.winner]+'获胜';
 $('ply').textContent='第 '+(state.ply+1)+' 手';
 for(let p=0;p<2;p++){$('player'+p).classList.toggle('active',state.turn===p);$('player'+p).querySelector('.stock').textContent='剩余墙 '+state.remaining[p]+' / 10';}
 $('hint').textContent=state.winner!==null?'已到达对面底线。本局结束。':mode==='move'?'点击带圆点的格子移动。':preview?(Q.wallError(state,preview)||'墙位可用，确认后结束本回合。'):'点击棋盘交点预览墙位，再确认放置。';
 $('move').setAttribute('aria-pressed',mode==='move');$('wall').setAttribute('aria-pressed',mode==='wall');
 $('horizontal').setAttribute('aria-pressed',orientation==='h');$('vertical').setAttribute('aria-pressed',orientation==='v');
 $('wallControls').hidden=mode!=='wall'||state.winner!==null;
 $('move').disabled=!canAct()||state.winner!==null;$('wall').disabled=!canAct()||state.winner!==null||state.remaining[state.turn]===0;
 $('confirm').disabled=!canAct()||!preview||!!Q.wallError(state,preview);$('undo').disabled=online?(!peerOnline||!onlineModel?.history.length||!online.ready||!!online.pending||!!onlineModel.proposal||!!networkError):!history.length;
 $('restart').disabled=!!online&&(!peerOnline||!onlineModel||!online.ready||!!online.pending||!!onlineModel.proposal||!!networkError);
 renderNetwork();
 if(online&&state.winner===null&&!canAct())$('hint').textContent=networkError?'消息未通过本地校验，请查看联网状态。':!online.ready?'正在恢复连接，请稍候。':online.pending?'正在确认操作。':!peerJoined?'等待对手通过邀请加入。':onlineModel?.proposal?'等待双方完成协商。':'等待对手行动。';
 const board=$('board');board.replaceChildren();const legal=Q.moves(state);
 for(let r=0;r<9;r++)for(let c=0;c<9;c++){
 const el=document.createElement('button'),can=canAct()&&mode==='move'&&legal.some(p=>p.r===r&&p.c===c);el.className='cell'+(r===0?' goal0':r===8?' goal1':'')+(can?' legal':'');pos(el,c*56,r*56,48,48);
 let p=state.pawns.findIndex(p=>p.r===r&&p.c===c);el.setAttribute('aria-label',`${r+1} 行 ${c+1} 列${p>=0?'，'+names[p]:can?'，可移动':''}`);
 el.disabled=!can; if(p>=0){const pawn=document.createElement('span');pawn.className='pawn p'+p+(state.turn===p?' current':'');pawn.textContent=p+1;el.append(pawn);}el.onclick=()=>commit({type:'move',r,c});board.append(el);
 }
 state.walls.forEach(w=>fence(w));
 if(canAct()&&mode==='wall'&&state.winner===null){
 if(preview)fence(preview,'preview'+(Q.wallError(state,preview)?' invalid':''));
 for(let r=0;r<8;r++)for(let c=0;c<8;c++){const el=document.createElement('button');el.className='anchor'+(preview&&preview.r===r&&preview.c===c?' selected':'');pos(el,c*56+24,r*56+24,56,56);el.setAttribute('aria-label',`预览第 ${r+1} 行 ${c+1} 列${orientation==='h'?'横':'竖'}墙`);el.onclick=()=>{preview={r,c,o:orientation};render();};board.append(el);}
 }
 window.fitGame();
}
$('move').onclick=()=>{mode='move';preview=null;render();};$('wall').onclick=()=>{mode='wall';render();};
for(const [id,o] of [['horizontal','h'],['vertical','v']])$(id).onclick=()=>{orientation=o;if(preview)preview.o=o;render();};
$('confirm').onclick=()=>{if(preview)commit({type:'wall',...preview});};
$('undo').onclick=async()=>{if(online){sendGame({kind:'propose',operation:'undo'});return;}if(history.length&&await gameDialog('撤回上一步？','将恢复上一手之前的棋盘和墙数量。',{confirm:'确认悔棋',valid:()=>!online&&history.length>0})){state=history.pop();actions.pop();mode='move';preview=null;save();render();}};
$('restart').onclick=()=>{if(online){sendGame({kind:'propose',operation:'restart',nextRound:random(16),turn:crypto.getRandomValues(new Uint8Array(1))[0]%2});return;}openDialog('restartDialog');};$('cancelRestart').onclick=()=>$('restartDialog').close();
$('acceptRestart').onclick=()=>{state=Q.initial(Math.random()<.5?0:1);history=[];actions=[];mode='move';preview=null;save();render();$('restartDialog').close();};
$('rules').onclick=()=>openDialog('rulesDialog');

function renderNetwork(){
 $('networkStatus').hidden=!online;
 if(online){
   const who=online.seat===0?'你是玩家一':online.seat===1?'你是玩家二':'正在确认席位';
   $('networkStatus').textContent=networkError?`对局已暂停：${networkError}`:`${who} · ${connectionStatus}${!peerJoined?' · 等待对手加入':!peerOnline?' · 对手离线':''}${online.pending?' · 等待操作确认':''}`;
 }
 const p=onlineModel?.proposal;
 $('reviewProposal').hidden=!online||!p||!!networkError;
 if(online&&p&&!networkError){
   const own=p.seat===online.seat,operation=p.operation==='undo'?'悔棋':'重开棋局';
   $('proposalTitle').textContent=own?'等待对方同意':'对方请求'+operation;
   $('proposalText').textContent=own?`已发送${operation}请求。对方同意后才会执行。`:p.operation==='undo'?'是否同意撤回上一手，恢复此前的棋盘？':'是否同意开始新一局？当前棋盘将清空，并重新决定先手。';
   $('proposalActions').hidden=own;
   $('acceptProposal').disabled=$('rejectProposal').disabled=!online.ready||!!online.pending;
   if(seenProposal!==p.id){seenProposal=p.id;openDialog('proposal');}
 }else{seenProposal=null;if($('proposal').open)$('proposal').close();}
 refreshDialogs();
 $('roomControls').hidden=!online;
 const host=online?.seat===0;
 $('inviteControls').hidden=!host;
 if(!host||peerJoined||!online.ready||(shareExpires&&shareExpires<=Date.now()))clearInviteLink();
 for(const id of ['inviteRoom','resetGuest','closeRoom'])$(id).hidden=!host;
 $('inviteRoom').disabled=!online?.ready||peerJoined;
 $('copyInvite').disabled=!online?.ready||!$('shareLink').value||peerJoined;
 $('copyInvite').hidden=$('inviteLinkField').hidden=!$('shareLink').value;
 $('inviteHint').hidden=!peerJoined;
 $('resetGuest').disabled=!online?.ready||!peerJoined;
 $('closeRoom').disabled=!online?.ready;
 $('syncRoom').disabled=!online||connectionStatus==='连接中';
 $('inviteRoom').textContent=$('shareLink').value?'重新生成邀请':'生成邀请';
 $('loginAgain').hidden=online?.seat===1||invitationEntry;
 $('resign').disabled=!onlineModel||!online?.ready||!!online?.pending||!!onlineModel?.proposal||state.winner!==null||!!networkError;
 $('createRoom').hidden=!!online||invitationEntry;
 $('createRoom').disabled=!portal;
 $('resumeRoom').hidden=!!online||!!invitation||!(sessionStorage.getItem(activeRoomKey)||sessionStorage.getItem(recentRoomKey));
 for(const button of busyButtons)button.disabled=true;
}
async function sendGame(payload){
 if(!onlineModel||networkError)return;
 const room=online;
 try{await room.send({version:GAME_VERSION,roundId:onlineModel.roundId,base:onlineModel.revision,...payload});}
 catch(e){if(online===room&&!room.stopped){$('networkMessage').textContent=e.message;gameDialog('操作未完成',e.message);}}
 render();
}
function updateModel(model){onlineModel=model;if(model){state=model.board;history=model.history;}preview=null;mode='move';render();}
function leaveOnline(room,{remember=false,message='已返回本地对局'}={}){
 if(online!==room)return;
 online=null;room.disconnect();clearTimeout(peerLeaveTimer);peerLeaveNotified=false;
 clearDialogs();onlineModel=null;networkError='';peerJoined=false;peerOnline=false;seenProposal=null;connectionStatus='';
 sessionStorage.removeItem(activeRoomKey);
 if(remember)sessionStorage.setItem(recentRoomKey,room.id);else if(sessionStorage.getItem(recentRoomKey)===room.id)sessionStorage.removeItem(recentRoomKey);
 sessionStorage.removeItem('quoridor.invitation');invitation=null;$('joinRoom').hidden=true;
 clearInviteLink();$('networkMessage').textContent=message;
 if(localSnapshot){({state,history,actions}=localSnapshot);localSnapshot=null;}
 mode='move';preview=null;render();
}
async function attachRoom(room){
 if(!localSnapshot)localSnapshot=structuredClone({state,history,actions});
 clearDialogs();clearInviteLink();
 sessionStorage.removeItem(recentRoomKey);
 clearTimeout(peerLeaveTimer);peerLeaveNotified=false;seenProposal=null;
 online?.disconnect();online=room;onlineModel=null;networkError='';peerJoined=false;peerOnline=false;
 sessionStorage.setItem(activeRoomKey,room.id);$('networkMessage').textContent='正在连接房间…';
 room.on('sync',data=>{
   if(online!==room)return;
   try{const model=replay(Q,data.events);networkError='';updateModel(model);
     if(!model&&data.seat===0&&!room.pending)room.send({version:GAME_VERSION,kind:'init',roundId:random(16),turn:crypto.getRandomValues(new Uint8Array(1))[0]%2}).catch(e=>{if(online===room&&!room.stopped)$('networkMessage').textContent=e.message;});
   }catch(e){networkError='本地校验失败：'+e.message;render();gameDialog('对局已暂停',networkError,{key:'invalid-message'});}
 });
 room.on('event',event=>{
   if(online!==room||networkError)return;
   const previous=onlineModel;
   try{
     updateModel(applyEvent(Q,onlineModel,event));
     if(event.payload.kind==='respond'){
       const operation=previous.proposal.operation==='undo'?'悔棋':'重开棋局';
       if(event.payload.accept)gameDialog(operation==='悔棋'?'已悔棋':'新棋局已开始',operation==='悔棋'?'双方已同意，棋盘已恢复到上一手之前。':'双方已同意，棋盘已重置并重新决定先手。',{key:'result:'+event.id});
       else if(previous.proposal.seat===room.seat)gameDialog('请求被拒绝',`对方拒绝了${operation}请求，当前棋局保持不变。`,{key:'result:'+event.id});
     }else if(event.payload.kind==='resign')gameDialog('本局结束',event.seat===room.seat?'你已认输，对方获胜。':'对方已认输，你获胜了。',{key:'result:'+event.id});
     else if(previous?.board.winner===null&&onlineModel.board.winner!==null)gameDialog('本局结束',onlineModel.board.winner===room.seat?'你已到达对面底线，获得胜利。':'对方已到达对面底线，本局结束。',{key:'result:'+event.id});
   }catch(e){networkError=`${event.seat===room.seat?'本机':'对方'}第 ${event.seq} 条消息未通过本地校验：${e.message}`;render();gameDialog('对局已暂停',networkError,{key:'invalid-message'});}
 });
 room.on('presence',data=>{
   if(online!==room)return;
   const wasOnline=peerOnline;
   peerJoined=data.joined;peerOnline=data.online.includes(1-room.seat);render();
   if(peerOnline){
     clearTimeout(peerLeaveTimer);dismissNotice('peer-left');
     if(peerLeaveNotified){peerLeaveNotified=false;gameDialog('对方已重新连接','可以继续当前棋局。',{key:'peer-returned'});}
   }else if(wasOnline){
     clearTimeout(peerLeaveTimer);
     peerLeaveTimer=setTimeout(()=>{
       if(online!==room||!room.ready||peerOnline)return;
       peerLeaveNotified=true;
       if($('proposal').open)$('proposal').close();
       gameDialog('对方已离开或断线','棋局已保留。可以等待对方重新连接，或在联网菜单中退出对局。',{key:'peer-left',valid:()=>online===room&&room.ready&&!peerOnline});
     },1500);
   }
 });
 room.on('pending',()=>{if(online===room)render();});
 let lastConnectionError=null;
 room.on('status',status=>{
   if(online!==room)return;
   connectionStatus=({connecting:'连接中',connected:'已连接',disconnected:'已断线，正在重连',closed:'连接已关闭'})[status];
   $('networkMessage').textContent=connectionStatus;
   if(status==='connected')$('networkDialog').close();
   if(status!=='connected')clearTimeout(peerLeaveTimer);
   render();
   if(status==='closed'){
     const message=lastConnectionError?.message||'房间已关闭或当前连接已结束。';
     if(lastConnectionError?.status!==401||room.seat===1)leaveOnline(room,{message});
     else{clearDialogs();clearInviteLink();}
     gameDialog('连接已结束',message,{key:'connection-closed'});
   }
 });
 room.on('error',e=>{if(online!==room)return;lastConnectionError=e;$('networkMessage').textContent=e.message;if([401,403,410].includes(e.status))networkError=e.message;else connectionStatus=e.message;render();});
 await room.connect();render();
}
async function networkTask(button,fn){
 if(busyButtons.has(button))return;
 const taskRoom=online;busyButtons.add(button);button.disabled=true;
 try{await fn();}catch(e){
   if(taskRoom&&online!==taskRoom)return;
   $('networkMessage').textContent=e.message;
   if(button.id==='joinRoom'&&[403,409,410].includes(e.status)){invitation=null;sessionStorage.removeItem('quoridor.invitation');$('joinRoom').hidden=true;}
   if(e.status===410&&online){const room=online;leaveOnline(room,{message:e.message});gameDialog('房间已关闭',e.message,{key:'connection-closed'});}
   else gameDialog('操作未完成',e.message);
 }finally{busyButtons.delete(button);button.disabled=false;renderNetwork();}
}
$('network').onclick=async()=>{openDialog('networkDialog');try{await loadPortal();renderNetwork();}catch(e){$('networkMessage').textContent=e.message;$('createRoom').disabled=true;}};
$('createRoom').onclick=e=>networkTask(e.target,async()=>{if(invitationEntry)return;try{await portal.credentials();}catch(error){if(error.status===401){sessionStorage.setItem('quoridor.createAfterLogin','1');await portal.login();return;}throw error;}await attachRoom(await portal.createRoom());});
$('resumeRoom').onclick=e=>networkTask(e.target,async()=>{const id=sessionStorage.getItem(activeRoomKey)||sessionStorage.getItem(recentRoomKey);try{await portal.credentials(id);}catch(error){if(error.status===401&&!error.message.includes('访客')){await portal.login();return;}throw error;}await attachRoom(portal.room(id));});
$('inviteRoom').onclick=e=>networkTask(e.target,async()=>{const room=online;if(!room?.ready||peerJoined)return;clearInviteLink();renderNetwork();const invite=await portal.createInvite(room.id);if(online!==room||!room.ready||peerJoined)return;$('shareLink').value=invite.url;shareExpires=invite.expires;inviteExpiryTimer=setTimeout(()=>{if(online===room){clearInviteLink();renderNetwork();$('networkMessage').textContent='邀请已过期，可重新生成。';}},Math.max(0,invite.expires-Date.now()));$('networkMessage').textContent='分享链接 24 小时内有效；访客连续 8 小时无操作后需重新分享。';});
$('copyInvite').onclick=e=>networkTask(e.target,async()=>{if(!$('shareLink').value)throw new Error('请先生成邀请');try{await navigator.clipboard.writeText($('shareLink').value);$('networkMessage').textContent='邀请链接已复制';}catch{$('shareLink').select();$('networkMessage').textContent='请选择并复制链接';}});
$('loginAgain').onclick=e=>networkTask(e.target,async()=>{await portal.login();});
$('syncRoom').onclick=()=>{online?.reconnect();$('networkMessage').textContent='正在重新读取消息记录…';};
$('resign').onclick=async()=>{const room=online,model=onlineModel;if(await gameDialog('确认认输？','认输后本局结束，对方获胜。',{confirm:'确认认输',valid:()=>online===room&&onlineModel===model&&room.ready&&!room.pending}))sendGame({kind:'resign'});};
$('reviewProposal').onclick=()=>openDialog('proposal');
$('acceptProposal').onclick=()=>sendGame({kind:'respond',proposalId:onlineModel.proposal.id,accept:true});
$('rejectProposal').onclick=()=>sendGame({kind:'respond',proposalId:onlineModel.proposal.id,accept:false});
$('resetGuest').onclick=e=>networkTask(e.target,async()=>{const room=online;if(await gameDialog('重置访客席位？','现有访客将断开连接。棋局保留，新访客可接续此局。',{confirm:'重置席位',valid:()=>online===room&&room.ready})){await portal.roomAction(room.id,'reset-guest');if(online!==room)return;peerJoined=false;peerOnline=false;clearTimeout(peerLeaveTimer);clearInviteLink();$('networkMessage').textContent='访客席位已重置，可生成新邀请';}});
$('closeRoom').onclick=e=>networkTask(e.target,async()=>{const room=online;if(await gameDialog('关闭房间？','双方将断开连接，房间的消息记录会被删除。',{confirm:'关闭房间',valid:()=>online===room&&room.ready})){await portal.roomAction(room.id,'close');if(online===room){leaveOnline(room,{message:'房间已关闭，可以创建新房间。'});gameDialog('房间已关闭','可以在联网菜单中创建新房间并生成新的邀请链接。',{key:'connection-closed'});}}});
$('leaveRoom').onclick=async()=>{const room=online;if(await gameDialog('离开联网对局？','你将断开连接并返回本地对局。对方会收到离线提示。',{confirm:'离开对局',valid:()=>online===room})){leaveOnline(room,{remember:true});}};

async function receiveInvitation(params){
 invitationEntry=true;sessionStorage.setItem('quoridor.invitationEntry','1');
 const incoming={room:params.get('room'),invite:params.get('invite')};
 historyURLClear();
 if(online){
   const room=online;
   if(room.id===incoming.room&&room.ready&&!room.stopped){gameDialog('已在此房间中','当前身份已连接，无需再次使用邀请链接。');return;}
   if(!await gameDialog('切换到邀请房间？','当前连接将断开，原房间会保留。',{confirm:'切换房间',valid:()=>online===room}))return;
   leaveOnline(room,{remember:true});
 }
 invitation=incoming;sessionStorage.setItem('quoridor.invitation',JSON.stringify(invitation));
 $('joinRoom').hidden=false;$('networkMessage').textContent='点击“加入邀请对局”认领访客席位。';openDialog('networkDialog');renderNetwork();
}
async function bootNetwork(){
 if(location.protocol==='file:')return;
 try{
   await loadPortal();
   const params=new URLSearchParams(location.hash.slice(1));
   if(params.has('invite')){await receiveInvitation(params);return;}
   invitation=JSON.parse(sessionStorage.getItem('quoridor.invitation')||'null');
   const loggedIn=await portal.completeLogin();
   if(invitation){$('joinRoom').hidden=false;$('networkMessage').textContent='点击“加入邀请对局”认领访客席位。';openDialog('networkDialog');}
   else if(loggedIn&&sessionStorage.getItem('quoridor.createAfterLogin')){sessionStorage.removeItem('quoridor.createAfterLogin');await attachRoom(await portal.createRoom());}
   else if(sessionStorage.getItem(activeRoomKey))await attachRoom(portal.room(sessionStorage.getItem(activeRoomKey)));
 }catch(e){$('networkMessage').textContent=e.message;openDialog('networkDialog');}
 renderNetwork();
}
function historyURLClear(){window.history.replaceState(null,'',location.pathname+location.search);}
$('joinRoom').onclick=e=>networkTask(e.target,async()=>{const requested=invitation;if(!requested)return;const room=await portal.join(requested.room,requested.invite);if(invitation!==requested)return;sessionStorage.removeItem('quoridor.invitation');invitation=null;$('joinRoom').hidden=true;await attachRoom(room);});
window.addEventListener('hashchange',()=>{if(location.hash)bootNetwork();});
render();bootNetwork();
