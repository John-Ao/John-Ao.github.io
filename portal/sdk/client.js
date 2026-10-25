import { api, apiBase } from './auth.js';
import { selectedRoute, selectTabRoute } from './routes.js';
import { encodeInvite, decodeInvite } from './invite.js';
import { stored } from './storage.js';
import { newIdentity } from '../crypto/keys.js';
import { random, hash } from '../shared/protocol.js';
import { RoomConnection } from './transport.js?v=2';
export function createPortal({ gameId, returnPath = location.pathname.replace(/index\.html$/, '') }) { return new PortalClient(gameId, returnPath); }
class PortalClient {
  constructor(gameId, returnPath) {
    if (typeof gameId !== 'string' || !/^[\w-]{1,80}$/.test(gameId)) throw new Error('客户端标识无效');
    const url = new URL(returnPath, location.origin);
    if (url.origin !== location.origin || url.search || url.hash || url.username || url.password) throw new Error('返回地址必须是本站页面');
    this.gameId = gameId; this.returnURL = url.href;
  }
  key(roomId) { return `${apiBase()}:${this.gameId}:${roomId || 'host'}`; }
  async identity(roomId) {
    const key = this.key(roomId); let value = await stored(key);
    if (!value) { value = await newIdentity(); await stored(key, value); } return value;
  }
  async login() {
    const identity = await this.identity(), verifier = random(), state = random(16);
    sessionStorage.setItem('portal.oauth.' + this.gameId, JSON.stringify({ verifier, state, time: Date.now() }));
    const redirect = this.returnURL;
    const url = new URL('../login.html', import.meta.url);
    url.search = new URLSearchParams({ game: this.gameId, key: identity.publicKey, pkce: await hash(verifier), state, redirect });
    location.assign(url); return new Promise(() => {});
  }
  async completeLogin() {
    const params = new URLSearchParams(location.hash.slice(1)); if (!params.has('code')) return false;
    globalThis.history.replaceState(null, '', location.pathname + location.search);
    const pending = JSON.parse(sessionStorage.getItem('portal.oauth.' + this.gameId) || 'null');
    if (!pending || pending.state !== params.get('state') || Date.now() - pending.time > 600000) throw new Error('登录返回校验失败，请重新登录');
    const identity = await this.identity();
    const session = await api('/v1/exchange', { code: params.get('code'), verifier: pending.verifier });
    await stored(this.key(), { ...identity, ...session }); sessionStorage.removeItem('portal.oauth.' + this.gameId); return true;
  }
  async credentials(roomId) {
    // Guest expiry is sliding and authoritative in the room (including WS writes).
    const guest = roomId ? await stored(this.key(roomId)) : null;
    const value = guest?.session ? guest : await stored(this.key());
    if (!value?.session || (value.scope !== 'guest' && value.expires <= Date.now())) throw Object.assign(new Error(guest?.session ? '访客凭证已过期，请房主重新授权席位' : '请先通过 Portal 登录'), { status: 401, scope: guest?.session ? 'guest' : 'creator' });
    return value;
  }
  async createRoom() {
    const credentials = await this.credentials();
    const storageKey = 'portal.creating.' + this.gameId;
    let roomId = sessionStorage.getItem(storageKey); if (!roomId) { roomId = random(16); sessionStorage.setItem(storageKey, roomId); }
    await api('/v1/rooms', { roomId }, credentials);
    sessionStorage.removeItem(storageKey); return this.room(roomId);
  }
  async join(roomId, invite) {
    const invitation = decodeInvite(invite);
    selectTabRoute(invitation.route.id);
    const identity = await this.identity(roomId);
    const session = await api('/v1/join', { roomId, invite: invitation.secret, publicKey: identity.publicKey }, undefined, invitation.route.url);
    await stored(this.key(roomId), { ...identity, ...session }); return this.room(roomId);
  }
  room(roomId) { return new RoomConnection(this, roomId); }
  async createInvite(roomId) {
    const route = selectedRoute();
    const secret = random(); const { expires } = await api(`/v1/rooms/${roomId}/invite`, { secret }, await this.credentials(roomId), route.url);
    const url = new URL(this.returnURL); url.hash = new URLSearchParams({ room: roomId, invite: encodeInvite(route.id, secret) });
    return { url: url.href, expires };
  }
  async roomAction(roomId, action) { return api(`/v1/rooms/${roomId}/${action}`, {}, await this.credentials(roomId)); }
}
