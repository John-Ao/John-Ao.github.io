import { api, adminLogin, serverConfig } from './sdk/auth.js';
import { deriveMaster } from './crypto/keys.js';
import { random, ROOM_IDLE_TTL } from './shared/protocol.js';
import { $, status, busy, download, kdfConfig, fingerprint } from './ui.js';
let credentials, settings, currentKeyInvite=null, keyInviteTimer=null;
async function refresh() {
  const { rooms } = await api('/v1/admin/rooms', {}, credentials);
  $('rooms').replaceChildren();
  if (!rooms.length) { const row = document.createElement('tr'), td = document.createElement('td'); td.colSpan = 3; td.textContent = '暂无房间'; row.append(td); $('rooms').append(row); }
  for (const room of rooms) {
    const row = document.createElement('tr');
    const name = document.createElement('td'); name.textContent = room.roomId;
    const state = document.createElement('td'); state.textContent = `${room.guest ? '双方已加入' : '等待访客'} · ${room.seq} 条消息 · ${new Date(room.lastActivity + ROOM_IDLE_TTL).toLocaleString()} 过期`;
    const controls = document.createElement('td');
    for (const [label, op] of [['撤销邀请','revoke-invite'], ['重置访客席位','reset-guest'], ['关闭房间','close']]) {
      const button = document.createElement('button'); button.textContent = label;
      button.onclick = () => busy(button, async () => {
        if (['close','reset-guest'].includes(op) && !confirm(`${label}？${op === 'reset-guest' ? '现有访客将断开，房间消息记录会保留。' : '双方将断开，消息记录将删除。'}`)) return;
        await api(`/v1/rooms/${room.roomId}/${op}`, {}, credentials);
        await refreshKeys(); status(label + '完成');
      }); controls.append(button);
    }
    row.append(name, state, controls); $('rooms').append(row);
  }
}
$('login').onsubmit = e => { e.preventDefault(); busy(e.submitter, async () => {
  status('正在登录…'); const password = $('password').value; $('password').value = '';
  credentials = await adminLogin(password); settings = await serverConfig();
  $('fingerprint').textContent = `公钥指纹：${await fingerprint(settings.publicKey)} · 协议 v${settings.version}`;
  $('login').hidden = true; $('admin').hidden = false; await refreshKeys(); status('已登录');
}); };
$('refresh').onclick = e => busy(e.target, async () => { await refreshKeys(); status('房间和密钥列表已更新'); });
$('export').onclick = () => download(settings);
$('logout').onclick = e => busy(e.target, async () => { await api('/v1/logout', {}, credentials); clearKeyInvite(); credentials = null; $('admin').hidden = true; $('login').hidden = false; status('已退出'); });
$('rotate').onsubmit = e => { e.preventDefault(); busy(e.submitter, async () => {
  if ($('newPassword').value !== $('repeatPassword').value) throw new Error('两次新密码不一致');
  if (!confirm('更换密码并关闭全部房间、撤销全部会话？')) return;
  status('正在验证当前密码并派生新密钥…');
  credentials = await adminLogin($('currentPassword').value);
  const kdf = kdfConfig(), key = await deriveMaster($('newPassword').value, kdf);
  const next = { publicKey: key.publicKey, kdf };
  await api('/v1/admin/rotate', next, credentials); download(next);
  $('rotate').reset(); clearKeyInvite(); credentials = null; $('admin').hidden = true; $('login').hidden = false; status('密码已轮换，请保存下载的公开恢复配置并重新登录。');
}); };
serverConfig().then(s => status(s.configured ? '服务可用，请登录' : '服务尚未配置管理员公钥')).catch(e => status(e.message, true));

function clearKeyInvite(){currentKeyInvite=null;clearTimeout(keyInviteTimer);$('keyInviteResult').hidden=true;$('copyKeyInvite').hidden=true;$('keyInviteLink').value='';$('keyInviteExpiry').textContent='';}
function date(value){return value?new Date(value).toLocaleString():'尚未使用';}
async function refreshKeys(){
  const {keys,invitations}=await api('/v1/admin/keys',{},credentials);$('keys').replaceChildren();$('keyInvitations').replaceChildren();
  if(!keys.length){const tr=document.createElement('tr'),td=document.createElement('td');td.colSpan=3;td.textContent='暂无游戏密钥';tr.append(td);$('keys').append(tr);}
  for(const key of keys){
    const row=document.createElement('tr');row.dataset.keyId=key.keyId;
    const identity=document.createElement('td'),alias=document.createElement('input');alias.value=key.alias;alias.maxLength=80;alias.setAttribute('aria-label','密钥别名');
    const fingerprint=document.createElement('small');fingerprint.textContent=key.keyId.slice(0,20)+' · '+(key.revokedAt?'已撤销':'有效');fingerprint.title=key.publicKey;
    const save=document.createElement('button');save.textContent='保存别名';save.onclick=()=>busy(save,async()=>{await api('/v1/admin/keys/alias',{keyId:key.keyId,alias:alias.value},credentials);await refreshKeys();status('别名已保存');});identity.append(alias,fingerprint,save);
    const usage=document.createElement('td');usage.className='key-usage';usage.textContent=`创建：${date(key.created)}\n最近鉴权：${date(key.lastUsedAt)}\n密钥登录 ${key.loginCount} 次 · 创建房间 ${key.roomsCreated} 次\n当前 ${key.activeRooms} 个房间 · ${key.activeSessions} 个会话`;
    const actions=document.createElement('td'),revoke=document.createElement('button');revoke.textContent=key.revokedAt?'已撤销':'撤销密钥';revoke.disabled=!!key.revokedAt;
    revoke.onclick=()=>busy(revoke,async()=>{
      const accepted=await confirmKeyRevoke();if(!accepted)return;
      await api('/v1/admin/keys/revoke',{keyId:key.keyId},credentials);await refreshKeys();status('密钥及相关会话已撤销');
    });actions.append(revoke);row.append(identity,usage,actions);$('keys').append(row);
  }
  for(const invitation of invitations){
    const item=document.createElement('p');item.textContent=`${invitation.alias} · ${invitation.claimed?'已使用':'待使用'} · ${date(invitation.expires)} 失效 `;
    if(!invitation.claimed){const button=document.createElement('button');button.textContent='撤销链接';button.onclick=()=>busy(button,async()=>{await api('/v1/admin/key-invitations/revoke',{invitationId:invitation.invitationId},credentials);if(currentKeyInvite===invitation.invitationId)clearKeyInvite();await refreshKeys();status('注册链接已撤销');});item.append(button);}
    $('keyInvitations').append(item);
  }
  if(!invitations.length)$('keyInvitations').textContent='暂无有效注册链接';
  if(currentKeyInvite&&!invitations.some(i=>i.invitationId===currentKeyInvite&&!i.claimed))clearKeyInvite();
  await refresh();
}
function confirmKeyRevoke(){return new Promise(resolve=>{const dialog=$('keyConfirm');dialog.returnValue='';dialog.addEventListener('close',()=>resolve(dialog.returnValue==='accept'),{once:true});dialog.showModal();});}
$('cancelKeyRevoke').onclick=()=>$('keyConfirm').close('cancel');$('acceptKeyRevoke').onclick=()=>$('keyConfirm').close('accept');
$('createKeyInvite').onsubmit=e=>{e.preventDefault();busy(e.submitter,async()=>{
  clearKeyInvite();const invitationId=random(16),secret=random();
  const {expires}=await api('/v1/admin/key-invitations',{invitationId,secret,alias:$('keyAlias').value},credentials);
  currentKeyInvite=invitationId;const url=new URL('key.html',location.href);url.hash=new URLSearchParams({id:invitationId,secret});
  $('keyInviteLink').value=url.href;$('keyInviteResult').hidden=false;$('copyKeyInvite').hidden=false;$('keyInviteExpiry').textContent=`仅可注册一个密钥，${date(expires)} 失效。`;
  keyInviteTimer=setTimeout(()=>{clearKeyInvite();status('注册链接已超过 5 分钟，可重新生成。');},Math.max(0,expires-Date.now()));await refreshKeys();status('密钥注册链接已生成');
});};
$('copyKeyInvite').onclick=e=>busy(e.target,async()=>{await navigator.clipboard.writeText($('keyInviteLink').value);status('注册链接已复制');});
$('refreshKeys').onclick=e=>busy(e.target,async()=>{await refreshKeys();status('密钥列表已更新');});
