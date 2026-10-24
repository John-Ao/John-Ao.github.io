import { api, apiBase } from './auth.js';
import { stored } from './storage.js';
import { newIdentity, deriveMaster, sign, validateKdf } from '../crypto/keys.js?v=2';
import { hash, loginMessage, registrationMessage, validKey } from '../shared/protocol.js?v=2';
const storageKey = () => apiBase() + ':personal-key:v1';
export const personalKey = () => stored(storageKey());
export async function savePersonalKey(key) { await stored(storageKey(), key); }
export function recoveryFile(key) { return { type: 'portal-personal-key', version: 1, apiBase: apiBase(), keyId: key.keyId, publicKey: key.publicKey, kdf: key.kdf }; }
export function downloadPersonalKey(key) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(recoveryFile(key), null, 2)], { type: 'application/json' }));
  const a = document.createElement('a'); a.href = url; a.download = 'portal-personal-key-recovery.json'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export async function recoverPersonalKey(file, password) {
  if (file?.type !== 'portal-personal-key' || file.version !== 1 || file.apiBase !== apiBase() || !validKey(file.publicKey)) throw new Error('恢复文件不属于当前 Portal，或格式不正确');
  validateKdf(file.kdf);
  const key = await deriveMaster(password, file.kdf, 'member');
  if (key.publicKey !== file.publicKey || await hash(key.publicKey) !== file.keyId) throw new Error('密钥密码不正确或恢复文件已损坏');
  return { ...key, keyId: file.keyId, kdf: file.kdf };
}
export async function memberLogin(key) {
  if (!key?.privateKey || !key.keyId) throw new Error('此浏览器尚未保存普通密钥，请先通过管理员链接注册或导入恢复文件');
  const identity = await newIdentity(), c = await api('/v1/challenge', { purpose: 'member' });
  const result = await api('/v1/key-login', { challenge: c.id, keyId: key.keyId, publicKey: identity.publicKey, signature: await sign(key.privateKey, loginMessage(c, identity.publicKey, 'member:' + key.keyId)) });
  return { ...identity, ...result };
}
export async function registerKey(invitation, key) {
  const signature = await sign(key.privateKey, registrationMessage(apiBase(), invitation.invitationId, await hash(invitation.secret), key.publicKey));
  return api('/v1/keys/register', { ...invitation, publicKey: key.publicKey, signature });
}
