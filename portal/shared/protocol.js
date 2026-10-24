export const VERSION = 1;
export const DAY = 86400000;
export const SESSION_TTL = 8 * 3600000;
export const INVITE_TTL = DAY;
export const ROOM_IDLE_TTL = 7 * DAY;
export const GUEST_IDLE_TTL = 8 * 3600000;
export const MAX_EVENTS = 2048;
export const MAX_LOG_BYTES = 512 * 1024;
export const MAX_PAYLOAD_BYTES = 4096;
export const utf8 = new TextEncoder();
export function b64(bytes) { return btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
export function unb64(s) { if (typeof s !== 'string' || !/^[\w-]+$/.test(s) || s.length > 4096) throw new Error('无效编码'); return Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0)); }
export function random(n = 32) { return b64(crypto.getRandomValues(new Uint8Array(n))); }
export async function hash(s) { return b64(await crypto.subtle.digest('SHA-256', typeof s === 'string' ? utf8.encode(s) : s)); }
export function loginMessage(c, publicKey, scope) { return JSON.stringify(['portal-login', VERSION, c.audience, c.id, c.nonce, c.expires, publicKey, scope]); }
export function requestMessage(path, body, auth, audience) { return JSON.stringify(['portal-request', VERSION, audience, 'POST', path, auth.session, auth.time, auth.nonce, body]); }
export async function verify(publicKey, signature, message) {
  try { const key = await crypto.subtle.importKey('raw', unb64(publicKey), 'Ed25519', false, ['verify']); return await crypto.subtle.verify('Ed25519', key, unb64(signature), utf8.encode(message)); } catch { return false; }
}
export function validKey(s) { try { return unb64(s).length === 32; } catch { return false; } }
export function validId(s) { return typeof s === 'string' && /^[\w-]{16,80}$/.test(s); }
export function assert(ok, message, status = 400) { if (!ok) throw Object.assign(new Error(message), { status }); }
export function json(body, status = 200) { return Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } }); }
export function failure(e) { return json({ error: e.status ? e.message : '服务暂不可用，请稍后重试' }, e.status || 500); }

export function registrationMessage(audience, invitationId, secretHash, publicKey) { return JSON.stringify(['portal-key-registration', VERSION, audience, invitationId, secretHash, publicKey]); }
