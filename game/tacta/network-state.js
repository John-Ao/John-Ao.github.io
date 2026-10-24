'use strict';
let random, applyEvent, replay, GAME_VERSION, portal;
async function loadPortal(){
 if(location.protocol==='file:')throw new Error('联网需要通过 HTTPS 网站或本地 HTTP 服务访问，本地双人模式可直接使用。');
 if(portal)return;
 const [sdk,protocol,game]=await Promise.all([import('../../portal/sdk/client.js?v=2'),import('../../portal/shared/protocol.js'),import('./online-protocol.mjs')]);
 random=protocol.random;({applyEvent,replay,GAME_VERSION}=game);portal=sdk.createPortal({gameId:'tacta'});
}
let online = null, onlineModel = null, networkError = '', peerJoined = false, peerOnline = false, connectionStatus = '';
let incomingParams=new URLSearchParams(location.hash.slice(1));
let invitation=null, invitationEntry=incomingParams.has('invite')||sessionStorage.getItem('tacta.invitationEntry')==='1'||!!sessionStorage.getItem('tacta.invitation');
if(incomingParams.has('invite')){
 invitation={room:incomingParams.get('room'),invite:incomingParams.get('invite')};
 sessionStorage.setItem('tacta.invitation',JSON.stringify(invitation));
 sessionStorage.setItem('tacta.invitationEntry','1');
 sessionStorage.setItem('tacta.invitationRoom',invitation.room);
 globalThis.history.replaceState(null,'',location.pathname+location.search);
}
let roomIntent=0;
const activeRoomKey = 'tacta.online.room', recentRoomKey = 'tacta.online.recent';
let localSnapshot=null;
const busyButtons=new Set();
let shareExpires=0,inviteExpiryTimer=null;
function clearInviteLink(){ $('shareLink').value='';shareExpires=0;clearTimeout(inviteExpiryTimer); }
function canAct() { return !online || (!!onlineModel && online.ready && !online.pending && !networkError && peerJoined && !onlineModel.proposal && state.turn === online.seat); }

