// One notice at a time. Confirmation promises resolve false on Escape or ×.
let dialogQueue=[],activeDialog=null,seenProposal=null,peerLeaveTimer=null,peerLeaveNotified=false;
function openDialog(id){
 for(const dialog of document.querySelectorAll('dialog[open]'))if(dialog.id!==id)dialog.close();
 if(!$(id).open)$(id).showModal();
 
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
 $('undo').hidden=!online;
 $('undo').disabled=!online?.ready||!peerOnline||!!online?.pending||!!networkError||!onlineModel?.history.length||!!p;
 $('newBtn').disabled=!!online&&(!onlineModel||!online.ready||!peerOnline||!!online.pending||!!networkError||!!p);
 for(const id of ['dualLayout','mirrorPlayer2','autoHandoff','privacyBtn'])$(id).disabled=!!online;
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
 $('resign').disabled=!onlineModel||!online?.ready||!!online?.pending||!!onlineModel?.proposal||state.finished||!!networkError;
 $('createRoom').hidden=!!online||invitationEntry;
 $('createRoom').disabled=!portal;
 $('resumeRoom').hidden=!!online||!!invitation||(invitationEntry&&sessionStorage.getItem(recentRoomKey)!==sessionStorage.getItem('tacta.invitationRoom'))||!(sessionStorage.getItem(activeRoomKey)||sessionStorage.getItem(recentRoomKey));
 for(const button of busyButtons)button.disabled=true;
}
async function sendGame(payload){
 if(!onlineModel||networkError||!online?.ready||online.pending)return;
 const room=online;
 try{const message={version:GAME_VERSION,roundId:onlineModel.roundId,base:onlineModel.revision,...payload};applyEvent(E,onlineModel,{seat:room.seat,id:'preflight',payload:message});await room.send(message);}
 catch(e){if(online===room&&!room.stopped){$('networkMessage').textContent=e.message;gameDialog('操作未完成',e.message);}}
 render();
}
function updateModel(model){onlineModel=model;if(model)state=model.board;resetSelection();render();}
function leaveOnline(room,{remember=false,message='已返回本地对局'}={}){
 if(online!==room)return;
 roomIntent++;online=null;room.disconnect();clearTimeout(peerLeaveTimer);peerLeaveNotified=false;
 clearDialogs();onlineModel=null;networkError='';peerJoined=false;peerOnline=false;seenProposal=null;connectionStatus='';
 sessionStorage.removeItem(activeRoomKey);
 if(remember)sessionStorage.setItem(recentRoomKey,room.id);else if(sessionStorage.getItem(recentRoomKey)===room.id)sessionStorage.removeItem(recentRoomKey);
 sessionStorage.removeItem('tacta.invitation');invitation=null;$('joinRoom').hidden=true;
 clearInviteLink();$('networkMessage').textContent=message;
 if(localSnapshot){({state,layout}=localSnapshot);localSnapshot=null;}
 resetSelection();render();
}
async function attachRoom(room){
 if(!localSnapshot)localSnapshot=structuredClone({state,layout});
 clearDialogs();clearInviteLink();layout={dual:false,mirror:false};
 sessionStorage.removeItem(recentRoomKey);
 clearTimeout(peerLeaveTimer);peerLeaveNotified=false;seenProposal=null;
 online?.disconnect();online=room;onlineModel=null;networkError='';peerJoined=false;peerOnline=false;
 sessionStorage.setItem(activeRoomKey,room.id);$('networkMessage').textContent='正在连接房间…';
 room.on('sync',data=>{
   if(online!==room)return;
   try{if(data.seq!==data.events.length)throw Error('房间或消息记录不匹配');const model=replay(E,data.events);networkError='';updateModel(model);
     if(!model&&data.seat===0&&!room.pending)room.send({version:GAME_VERSION,kind:'init',roundId:random(16),seed:crypto.getRandomValues(new Uint32Array(1))[0]}).catch(e=>{if(online===room&&!room.stopped)$('networkMessage').textContent=e.message;});
   }catch(e){networkError='本地校验失败：'+e.message;render();gameDialog('对局已暂停',networkError,{key:'invalid-message'});}
 });
 room.on('event',event=>{
   if(online!==room||networkError)return;
   const previous=onlineModel;
   try{
     updateModel(applyEvent(E,onlineModel,event));
     if(event.payload.kind==='respond'){
       const operation=previous.proposal.operation==='undo'?'悔棋':'重开棋局';
       if(event.payload.accept)gameDialog(operation==='悔棋'?'已悔棋':'新棋局已开始',operation==='悔棋'?'双方已同意，棋盘已恢复到上一手之前。':'双方已同意，棋盘已重置并重新决定先手。',{key:'result:'+event.id});
       else if(previous.proposal.seat===room.seat)gameDialog('请求被拒绝',`对方拒绝了${operation}请求，当前棋局保持不变。`,{key:'result:'+event.id});
     }else if(event.payload.kind==='resign')gameDialog('本局结束',event.seat===room.seat?'你已认输，对方获胜。':'对方已认输，你获胜了。',{key:'result:'+event.id});
     else if(previous&&!previous.board.finished&&onlineModel.board.finished)gameDialog('本局结束','双方已出完卡牌，可查看结算。',{key:'result:'+event.id});
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
     if(lastConnectionError?.status!==401||room.seat===1)leaveOnline(room,{message,remember:lastConnectionError?.code===4002});
     else{clearDialogs();clearInviteLink();}
     gameDialog('连接已结束',message,{key:'connection-closed'});
   }
 });
 room.on('error',e=>{if(online!==room)return;lastConnectionError=e;$('networkMessage').textContent=e.message;if([401,403,410].includes(e.status))networkError=e.message;else connectionStatus=e.message;render();});
 await room.connect();render();
}
async function networkTask(button,fn){
 if(busyButtons.has(button))return;
 const taskRoom=online,taskInvitation=invitation;busyButtons.add(button);button.disabled=true;
 try{await fn();}catch(e){
   if(online!==taskRoom||invitation!==taskInvitation)return;
   $('networkMessage').textContent=e.message;
   if(button.id==='joinRoom'&&[403,409,410].includes(e.status)){invitation=null;sessionStorage.removeItem('tacta.invitation');$('joinRoom').hidden=true;}
   if(e.status===410&&online){const room=online;leaveOnline(room,{message:e.message});gameDialog('房间已关闭',e.message,{key:'connection-closed'});}
   else gameDialog('操作未完成',e.message);
 }finally{busyButtons.delete(button);button.disabled=false;renderNetwork();}
}
$('network').onclick=async()=>{openDialog('networkDialog');try{await loadPortal();renderNetwork();}catch(e){$('networkMessage').textContent=e.message;$('createRoom').disabled=true;}};
$('createRoom').onclick=e=>networkTask(e.target,async()=>{if(invitationEntry||online)return;const intent=++roomIntent;try{await portal.credentials();}catch(error){if(error.status===401){sessionStorage.setItem('tacta.createAfterLogin','1');await portal.login();return;}throw error;}const room=await portal.createRoom();if(intent!==roomIntent||invitationEntry||online)return;await attachRoom(room);});
$('resumeRoom').onclick=e=>networkTask(e.target,async()=>{const id=sessionStorage.getItem(activeRoomKey)||sessionStorage.getItem(recentRoomKey);try{await portal.credentials(id);}catch(error){if(error.status===401&&error.scope!=='guest'&&!invitationEntry){sessionStorage.setItem('tacta.resumeAfterLogin',id);await portal.login();return;}throw error;}await attachRoom(portal.room(id));});
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
 const intent=++roomIntent;invitationEntry=true;sessionStorage.setItem('tacta.invitationEntry','1');
 refreshDialogs();
 const incoming={room:params.get('room'),invite:params.get('invite')};
 sessionStorage.setItem('tacta.invitationRoom',incoming.room);
 historyURLClear();
 if(online){
   const room=online;
   if(room.id===incoming.room&&room.ready&&!room.stopped){gameDialog('已在此房间中','当前身份已连接，无需再次使用邀请链接。');return;}
   if(!await gameDialog('切换到邀请房间？','当前连接将断开，原房间会保留。',{confirm:'切换房间',valid:()=>online===room&&roomIntent===intent}))return;
   leaveOnline(room,{remember:true});
 }
 invitation=incoming;sessionStorage.setItem('tacta.invitation',JSON.stringify(invitation));
 $('joinRoom').hidden=false;$('networkMessage').textContent='点击“加入邀请对局”认领访客席位。';openDialog('networkDialog');renderNetwork();
}
async function bootNetwork(){
 if(location.protocol==='file:')return;
 try{
   await loadPortal();
   const params=new URLSearchParams(location.hash.slice(1));
   if(params.has('invite')){await receiveInvitation(params);return;}
   invitation=JSON.parse(sessionStorage.getItem('tacta.invitation')||'null');
   const loggedIn=await portal.completeLogin();
   if(invitation){$('joinRoom').hidden=false;$('networkMessage').textContent='点击“加入邀请对局”认领访客席位。';openDialog('networkDialog');}
   else if(loggedIn&&sessionStorage.getItem('tacta.resumeAfterLogin')){const id=sessionStorage.getItem('tacta.resumeAfterLogin');sessionStorage.removeItem('tacta.resumeAfterLogin');await attachRoom(portal.room(id));}
   else if(loggedIn&&!invitationEntry&&sessionStorage.getItem('tacta.createAfterLogin')){sessionStorage.removeItem('tacta.createAfterLogin');await attachRoom(await portal.createRoom());}
   else if(sessionStorage.getItem(activeRoomKey))await attachRoom(portal.room(sessionStorage.getItem(activeRoomKey)));
 }catch(e){$('networkMessage').textContent=e.message;openDialog('networkDialog');}
 renderNetwork();
}
function historyURLClear(){window.history.replaceState(null,'',location.pathname+location.search);}
$('joinRoom').onclick=e=>networkTask(e.target,async()=>{const requested=invitation;if(!requested)return;const room=await portal.join(requested.room,requested.invite);if(invitation!==requested)return;sessionStorage.removeItem('tacta.invitation');invitation=null;$('joinRoom').hidden=true;await attachRoom(room);});
window.addEventListener('hashchange',()=>{if(location.hash)bootNetwork();});
$('undo').onclick=()=>sendGame({kind:'propose',operation:'undo'});
function requestRestart(){if(online)sendGame({kind:'propose',operation:'restart',nextRound:random(16),seed:crypto.getRandomValues(new Uint32Array(1))[0]});else openDialog('restart');}
$('newBtn').onclick=$('againBtn').onclick=requestRestart;
render();bootNetwork();
