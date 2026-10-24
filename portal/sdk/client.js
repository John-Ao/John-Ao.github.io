import { config } from '../config.js';
import { api, apiBase } from './auth.js';
import { stored } from './storage.js';
import { newIdentity } from '../crypto/keys.js';
import { random, hash } from '../shared/protocol.js';
import { RoomConnection } from './transport.js?v=2';
export function createPortal({ gameId }) { return new PortalClient(gameId); }
class PortalClient {
  constructor(gameId) { if (!config.games[gameId]) throw new Error('未注册的游戏'); this.gameId = gameId; }
  key(roomId) { return `${apiBase()}:${this.gameId}:${roomId || 'host'}`; }
  async identity(roomId) {
    const key = this.key(roomId); let value = await stored(key);
    if (!value) { value = await newIdentity(); await stored(key, value); } return value;
  }
  async login() {
    const identity = await this.identity(), verifier = random(), state = random(16);
    sessionStorage.setItem('portal.oauth.' + this.gameId, JSON.stringify({ verifier, state, time: Date.now() }));
    const redirect = new URL(config.games[this.gameId], location.origin).href;
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
    const guest = roomId ? await stored(this.key(roomId)) : null;
    const value = guest?.session ? guest : await stored(this.key());
    if (!value?.session || value.expires <= Date.now()) throw Object.assign(new Error(guest?.session ? '访客凭证已过期，请房主重新授权席位' : '请先通过 Portal 登录'), { status: 401, scope: guest?.session ? 'guest' : 'game' });
    return value;
  }
  async createRoom() {
    const credentials = await this.credentials();
    const storageKey = 'portal.creating.' + this.gameId;
    let roomId = sessionStorage.getItem(storageKey); if (!roomId) { roomId = random(16); sessionStorage.setItem(storageKey, roomId); }
    await api('/v1/rooms', { roomId, gameId: this.gameId }, credentials);
    sessionStorage.removeItem(storageKey); return this.room(roomId);
  }
  async join(roomId, invite) {
    const identity = await this.identity(roomId);
    const session = await api('/v1/join', { roomId, invite, publicKey: identity.publicKey, gameId: this.gameId });
    await stored(this.key(roomId), { ...identity, ...session }); return this.room(roomId);
  }
  room(roomId) { return new RoomConnection(this, roomId); }
  async createInvite(roomId) {
    const secret = random(); const { expires } = await api(`/v1/rooms/${roomId}/invite`, { secret }, await this.credentials(roomId));
    const url = new URL(config.games[this.gameId], location.origin); url.hash = new URLSearchParams({ room: roomId, invite: secret });
    return { url: url.href, expires };
  }
  async roomAction(roomId, action) { return api(`/v1/rooms/${roomId}/${action}`, {}, await this.credentials(roomId)); }
}
