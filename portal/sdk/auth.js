import { config } from '../config.js';
import { random, loginMessage, requestMessage } from '../shared/protocol.js';
import { newIdentity, sign, deriveMaster } from '../crypto/keys.js';
export function apiBase() {
  if (!config.apiBase) throw new Error('通信服务尚未配置，请先完成 portal/README.md 中的 Cloudflare 部署');
  const url = new URL(config.apiBase);
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname))) throw new Error('通信服务必须使用 HTTPS');
  return url.origin;
}
export async function api(path, body = {}, credentials) {
  const base = apiBase(); let auth;
  if (credentials) {
    auth = { session: credentials.session, time: Date.now(), nonce: random(16) };
    auth.signature = await sign(credentials.privateKey, requestMessage(path, body, auth, base));
  }
  const r = await fetch(base + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ body, auth }), cache: 'no-store', referrerPolicy: 'no-referrer' });
  const data = await r.json();
  if (!r.ok) throw Object.assign(new Error(data.error || '服务请求失败'), { status: r.status }); return data;
}
export async function serverConfig() {
  const r = await fetch(apiBase() + '/v1/config', { cache: 'no-store', referrerPolicy: 'no-referrer' });
  const data = await r.json(); if (!r.ok) throw new Error(data.error); return data;
}
export async function adminLogin(password) {
  const settings = await serverConfig();
  if (!settings.configured) throw new Error('请先在初始化页面生成公钥，并配置 Cloudflare');
  const master = await deriveMaster(password, settings.kdf); password = '';
  if (master.publicKey !== settings.publicKey) throw new Error('密码不正确');
  const identity = await newIdentity(), c = await api('/v1/challenge');
  const result = await api('/v1/login', { challenge: c.id, publicKey: identity.publicKey, signature: await sign(master.privateKey, loginMessage(c, identity.publicKey, 'admin')) });
  return { ...identity, ...result };
}
