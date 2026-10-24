import { personalKey, memberLogin, recoverPersonalKey, savePersonalKey } from './sdk/personal-key.js';
import { adminLogin, api } from './sdk/auth.js';
import { $, status, busy } from './ui.js';
import { validKey, validId } from './shared/protocol.js';
const params = new URLSearchParams(location.search);
let redirect;
try {
  redirect = new URL(params.get('redirect'));
  if (!/^[\w-]{1,80}$/.test(params.get('game') || '') || redirect.origin !== location.origin || redirect.username || redirect.password || redirect.search || redirect.hash || !validKey(params.get('key')) || !validKey(params.get('pkce')) || !validId(params.get('state'))) throw new Error('授权请求无效，请从游戏页面重新发起登录');
  $('scope').textContent = `授权 ${params.get('game')} 创建及管理自己的对局房间。`;
} catch (e) { $('login').hidden = true; $('personal').hidden = true; status(e.message, true); }
async function authorize(credentials) {
  try {
    const { code } = await api('/v1/authorize', { publicKey: params.get('key'), pkce: params.get('pkce'), redirect: redirect.href }, credentials);
    // Logout failure must not discard an already-issued one-time authorization code.
    await api('/v1/logout', {}, credentials).catch(() => {});
    redirect.hash = new URLSearchParams({ code, state: params.get('state') }); location.replace(redirect);
  } catch (error) { await api('/v1/logout', {}, credentials).catch(() => {}); throw error; }
}
$('login').onsubmit = e => { e.preventDefault(); busy(e.submitter, async () => {
  status('正在登录…'); const password = $('password').value; $('password').value = '';
  await authorize(await adminLogin(password));
}); };
$('keyLogin').onclick=e=>busy(e.target,async()=>{status('正在验证游戏密钥…');const key=await personalKey(),credentials=await memberLogin(key);await savePersonalKey({...key,alias:credentials.alias});await authorize(credentials);});
$('importKey').onsubmit=e=>{e.preventDefault();busy(e.submitter,async()=>{
  const file=$('keyFile').files[0];if(!file||file.size>8192)throw new Error('请选择有效的密钥恢复 JSON 文件');
  const key=await recoverPersonalKey(JSON.parse(await file.text()),$('keyPassword').value);$('keyPassword').value='';
  const credentials=await memberLogin(key);await savePersonalKey({...key,alias:credentials.alias});await authorize(credentials);
});};
if(redirect&& !$('login').hidden)personalKey().then(key=>{
  $('keyLogin').disabled=!key;$('keyName').textContent=key?`当前密钥：${key.alias||key.keyId.slice(0,16)}`:'此浏览器尚未保存游戏密钥。可使用管理员注册链接创建，或导入恢复文件。';
  if(!key)$('masterLogin').open=true;
}).catch(e=>status(e.message,true));
