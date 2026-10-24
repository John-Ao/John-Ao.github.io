import { api, apiBase } from './sdk/auth.js';
import { stored } from './sdk/storage.js';
import { deriveMaster } from './crypto/keys.js?v=2';
import { personalKey, savePersonalKey, downloadPersonalKey, registerKey, memberLogin } from './sdk/personal-key.js';
import { $, status, busy, kdfConfig } from './ui.js';
import { config } from './config.js';
import { validId, validKey, hash } from './shared/protocol.js';
let invitation, expires=0, registered;
const params = new URLSearchParams(location.hash.slice(1));
globalThis.history.replaceState(null, '', location.pathname);
function pendingId() { return apiBase() + ':registration:' + invitation.invitationId; }
function showRegistered(key) {
  registered=key;$('register').hidden=true;$('registered').hidden=false;$('expiry').textContent='';
  $('keySummary').textContent=`密钥已创建：${key.alias || key.keyId.slice(0,16)}。请保存恢复文件和密钥密码。`;
  $('games').replaceChildren();for(const [name,path] of Object.entries(config.games)){const a=document.createElement('a');a.textContent='打开 '+name;a.href=path;$('games').append(a);}
  status('密钥已保存到当前浏览器，可以用于游戏登录。');
}
$('backup').onclick=()=>downloadPersonalKey(registered);
$('register').onsubmit=e=>{e.preventDefault();busy(e.submitter,async()=>{
  if(Date.now()>=expires)throw new Error('注册链接已超过 5 分钟，请管理员重新生成');
  if($('keyPassword').value!==$('keyRepeat').value)throw new Error('两次密码不一致');
  status('正在生成并注册密钥…');
  const pending=await stored(pendingId()),kdf=pending?.kdf||kdfConfig();
  const key={...await deriveMaster($('keyPassword').value,kdf,'member'),kdf};key.keyId=await hash(key.publicKey);$('register').reset();
  if(pending&&pending.publicKey!==key.publicKey)throw new Error('请使用本次注册首次填写的密钥密码，或重新获取注册链接');
  // Keep the public recovery parameters and private CryptoKey before sending;
  // a lost registration response can be retried without claiming a second key.
  await stored(pendingId(),key);
  const result=await registerKey(invitation,key);const complete={...key,...result};
  await savePersonalKey(complete);await stored(pendingId(),null);sessionStorage.removeItem('portal.key-invitation');showRegistered(complete);
});};
async function start(){
  if(params.has('secret')){invitation={invitationId:params.get('id'),secret:params.get('secret')};sessionStorage.setItem('portal.key-invitation',JSON.stringify(invitation));}
  else invitation=JSON.parse(sessionStorage.getItem('portal.key-invitation')||'null');
  if(!invitation){const saved=await personalKey();if(saved){showRegistered(saved);return;}throw new Error('请通过管理员提供的 5 分钟注册链接访问本页');}
  if(!validId(invitation.invitationId)||!validKey(invitation.secret))throw new Error('注册链接格式错误');
  const pending=await stored(pendingId());
  // If registration committed but its response was lost, prove possession of
  // the saved draft instead of depending on an already-expired invite.
  if(pending?.keyId){
    let session;try{session=await memberLogin(pending);}catch(e){if(![401,403].includes(e.status))throw e;}
    if(session){const recovered={...pending,alias:session.alias};await savePersonalKey(recovered);await stored(pendingId(),null);sessionStorage.removeItem('portal.key-invitation');await api('/v1/logout',{},session).catch(()=>{});showRegistered(recovered);return;}
  }
  const info=await api('/v1/key-invitations/inspect',invitation);expires=info.expires;
  if(info.claimed&&!pending)throw new Error('此注册链接已使用，请打开游戏使用已有密钥，或向管理员获取新链接');
  $('expiry').textContent=`别名：${info.alias}；有效期至 ${new Date(expires).toLocaleTimeString()}。`;
  $('register').hidden=false;status(info.claimed?'注册已提交，请再次输入原密码完成本地保存。':'设置你自己的密钥密码。');
  setTimeout(()=>{if(!registered){$('register').hidden=true;status('注册链接已超过 5 分钟，请管理员重新生成。',true);}},Math.max(0,expires-Date.now()));
}
start().catch(e=>{status(e.message,true);if(e.status===410)sessionStorage.removeItem('portal.key-invitation');});

window.addEventListener('hashchange',()=>{if(location.hash)location.reload();});
