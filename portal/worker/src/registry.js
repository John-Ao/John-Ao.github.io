import { VERSION, DAY, SESSION_TTL, random, hash, verify, validKey, validId, loginMessage, requestMessage, registrationMessage, assert, json, failure } from '../../shared/protocol.js';

export class PortalRegistry {
  constructor(ctx, env) { this.ctx = ctx; this.env = env; }
  alias(value) { assert(typeof value === 'string' && value.trim().length > 0 && value.trim().length <= 80, '别名应为 1–80 个字符'); return value.trim(); }
  async room(id, op, body = {}) {
    const result = await this.env.ROOMS.get(this.env.ROOMS.idFromName(id)).fetch('https://room/' + op, { method: 'POST', body: JSON.stringify(body) });
    const data = await result.json(); assert(result.ok, data.error, result.status); return data;
  }
  async load() {
    const count = await this.ctx.storage.get('registry-count');
    this.chunkCount = count || 0;
    const chunks = count ? await this.ctx.storage.get(Array.from({ length: count }, (_, i) => 'registry:' + i)) : null;
    this.data = chunks ? JSON.parse(Array.from({ length: count }, (_, i) => chunks.get('registry:' + i)).join('')) : { challenges: {}, sessions: {}, codes: {}, rooms: {}, rates: {} };
    const trust = this.env.ADMIN_PUBLIC_KEY + ':' + this.env.KDF_CONFIG;
    if (this.data.trust !== trust) {
      // Changing the dashboard's trust root also recovers a lost password.
      for (const id of Object.keys(this.data.rooms)) await this.room(id, 'close');
      this.data = { trust, challenges: {}, sessions: {}, codes: {}, rooms: {}, rates: {}, keys: this.data.keys || {}, keyInvitations: {} };
    }
    this.data.keys ||= {}; this.data.keyInvitations ||= {};
    const now = Date.now();
    for (const group of ['challenges', 'sessions', 'codes', 'rates', 'keyInvitations']) for (const [id, item] of Object.entries(this.data[group])) if (item.expires <= now) delete this.data[group][id];
    for (const session of Object.values(this.data.sessions)) for (const [nonce, expires] of Object.entries(session.nonces)) if (expires <= now) delete session.nonces[nonce];
    this.publicKey = this.data.override?.publicKey || this.env.ADMIN_PUBLIC_KEY;
    try { this.kdf = this.data.override?.kdf || JSON.parse(this.env.KDF_CONFIG || 'null'); } catch { this.kdf = null; }
  }
  async save() {
    // Each DO storage value is bounded; atomically store a chunked snapshot.
    const encoded = JSON.stringify(this.data), chunks = encoded.match(/[\s\S]{1,24000}/g) || [''];
    await this.ctx.storage.transaction(async txn => {
      for (let i = 0; i < chunks.length; i++) await txn.put('registry:' + i, chunks[i]);
      for (let i = chunks.length; i < this.chunkCount; i++) await txn.delete('registry:' + i);
      await txn.put('registry-count', chunks.length);
    });
    this.chunkCount = chunks.length;
    await this.ctx.storage.setAlarm(Date.now() + 3600000);
  }
  async alarm() { await this.ctx.blockConcurrencyWhile(async () => { await this.load(); for (const id of Object.keys(this.data.rooms)) { const r = await this.room(id, 'info'); if (r.closed) delete this.data.rooms[id]; } await this.save(); }); }
  async fetch(request) {
    return this.ctx.blockConcurrencyWhile(async () => {
      try { await this.load(); const result = await this.route(request); await this.save(); return json(result); }
      catch (e) { if (this.data) await this.save(); return failure(e); }
    });
  }
  limit(request, purpose, max) {
    const key = purpose + ':' + (request.headers.get('CF-Connecting-IP') || 'local');
    let rate = this.data.rates[key];
    if (!rate || rate.expires <= Date.now()) {
      assert(Object.keys(this.data.rates).length < 256, '服务繁忙，请稍后重试', 429);
      rate = this.data.rates[key] = { count: 0, expires: Date.now() + 60000 };
    }
    assert(++rate.count <= max, '操作过于频繁，请稍后再试', 429);
  }
  session(publicKey, scope, extra = {}) {
    assert(Object.keys(this.data.sessions).length < 64, '会话数量已达上限，请退出其他会话', 429);
    const id = random();
    this.data.sessions[id] = { publicKey, scope, created: Date.now(), expires: Date.now() + (scope === 'guest' ? DAY : SESSION_TTL), nonces: {}, ...extra };
    return { session: id, expires: this.data.sessions[id].expires, scope, ...extra };
  }
  async authenticate(path, body, auth, audience) {
    const s = this.data.sessions[auth?.session];
    assert(s && s.expires > Date.now(), '登录已过期，请重新登录', 401);
    assert(Number.isFinite(auth.time) && Math.abs(Date.now() - auth.time) < 60000 && validId(auth.nonce), '请求已过期', 401);
    assert(!s.nonces[auth.nonce], '请求不能重复使用', 409);
    assert(Object.keys(s.nonces).length < 64, '请求过于频繁', 429);
    assert(await verify(s.publicKey, auth.signature, requestMessage(path, body, auth, audience)), '签名验证失败', 401);
    if (s.keyId) {
      const key = this.data.keys[s.keyId];
      assert(key && !key.revokedAt, '此密钥已被撤销', 403);
      key.lastUsedAt = Date.now(); if (s.gameId) key.lastGameId = s.gameId;
    }
    s.nonces[auth.nonce] = Date.now() + 120000;
    return s;
  }
  async route(request) {
    const url = new URL(request.url), path = url.pathname, audience = url.origin;
    if (request.method === 'GET' && path === '/v1/config') return { version: VERSION, configured: validKey(this.publicKey) && !!this.kdf, publicKey: this.publicKey, kdf: this.kdf, games: JSON.parse(this.env.GAME_PATHS || '{}') };
    assert(request.method === 'POST', '请求方法不支持', 405);
    const raw = await request.text(); assert(raw.length < 16384, '请求过大', 413);
    let envelope; try { envelope = JSON.parse(raw); } catch { assert(false, '无效 JSON'); }
    const { body = {}, auth } = envelope;
    assert(body && typeof body === 'object' && !Array.isArray(body), '请求格式错误');
    const games = JSON.parse(this.env.GAME_PATHS || '{}');
    assert(validKey(this.publicKey) && this.kdf, '服务尚未配置管理员公钥', 503);
    if (path === '/v1/challenge') {
      this.limit(request, 'login', 10);
      assert(Object.keys(this.data.challenges).length < 64, '登录请求过多', 429);
      assert(!body.purpose || ['admin', 'member'].includes(body.purpose), '登录用途无效');
      const id = random(16), c = { id, nonce: random(), audience, purpose: body.purpose || 'admin', expires: Date.now() + 60000 };
      this.data.challenges[id] = c; return c;
    }
    if (path === '/v1/login') {
      this.limit(request, 'verify', 10);
      const c = this.data.challenges[body.challenge];
      assert(c && (c.purpose || 'admin') === 'admin' && c.expires > Date.now() && c.audience === audience && validKey(body.publicKey), '登录挑战已失效', 401);
      delete this.data.challenges[body.challenge];
      assert(await verify(this.publicKey, body.signature, loginMessage(c, body.publicKey, 'admin')), '密码不正确或签名无效', 401);
      return this.session(body.publicKey, 'admin');
    }
    if (path === '/v1/key-invitations/inspect' || path === '/v1/keys/register') {
      this.limit(request, 'key-registration', 20);
      assert(validId(body.invitationId) && validKey(body.secret), '注册链接格式错误');
      const invitation = this.data.keyInvitations[body.invitationId];
      assert(invitation && invitation.expires > Date.now() && invitation.secretHash === await hash(body.secret), '注册链接已失效或已超过 5 分钟', 410);
      if (path.endsWith('/inspect')) return { expires: invitation.expires, alias: invitation.alias, claimed: !!invitation.keyId };
      assert(validKey(body.publicKey) && body.publicKey !== this.publicKey, '普通密钥公钥无效');
      assert(await verify(body.publicKey, body.signature, registrationMessage(audience, body.invitationId, invitation.secretHash, body.publicKey)), '密钥持有证明无效', 401);
      const keyId = await hash(body.publicKey);
      if (invitation.keyId) {
        assert(invitation.keyId === keyId && !this.data.keys[keyId]?.revokedAt, '注册链接已被使用', 409);
        return { keyId, alias: this.data.keys[keyId].alias };
      }
      assert(!this.data.keys[keyId], '此密钥已经注册或已被撤销', 409);
      assert(Object.keys(this.data.keys).length < 128, '密钥数量已达上限', 429);
      this.data.keys[keyId] = { keyId, publicKey: body.publicKey, alias: invitation.alias, created: Date.now(), lastUsedAt: null, loginCount: 0, roomsCreated: 0, revokedAt: null };
      invitation.keyId = keyId;
      return { keyId, alias: invitation.alias };
    }
    if (path === '/v1/key-login') {
      this.limit(request, 'key-login', 20);
      const c = this.data.challenges[body.challenge], key = this.data.keys[body.keyId];
      assert(c && c.purpose === 'member' && c.expires > Date.now() && c.audience === audience && validKey(body.publicKey), '登录挑战已失效', 401);
      delete this.data.challenges[body.challenge];
      assert(key && !key.revokedAt, '密钥不存在或已被撤销', 403);
      assert(await verify(key.publicKey, body.signature, loginMessage(c, body.publicKey, 'member:' + key.keyId)), '密钥签名无效', 401);
      const result = this.session(body.publicKey, 'member', { keyId: key.keyId });
      key.lastUsedAt = Date.now(); key.loginCount++;
      return { ...result, alias: key.alias };
    }
    if (path === '/v1/exchange') {
      this.limit(request, 'exchange', 20);
      const code = this.data.codes[body.code];
      assert(code && code.expires > Date.now() && await hash(body.verifier || '') === code.pkce, '授权码无效或已过期', 401);
      if (code.keyId) assert(this.data.keys[code.keyId] && !this.data.keys[code.keyId].revokedAt, '密钥已被撤销', 403);
      const result = this.session(code.publicKey, 'game', { gameId: code.gameId, ...(code.keyId ? { keyId: code.keyId } : {}) });
      delete this.data.codes[body.code];
      return result;
    }
    if (path === '/v1/join') {
      this.limit(request, 'join', 20);
      assert(validId(body.roomId) && validKey(body.publicKey) && validKey(body.invite), '邀请格式错误');
      const result = await this.room(body.roomId, 'join', { publicKey: body.publicKey, inviteHash: await hash(body.invite), gameId: body.gameId });
      // Retries by the same key are safe, including when the HTTP response was lost.
      for (const [id, s] of Object.entries(this.data.sessions)) if (s.scope === 'guest' && s.roomId === body.roomId && s.publicKey === body.publicKey) return { session: id, expires: s.expires, scope: s.scope, roomId: s.roomId, gameId: s.gameId, seat: 1 };
      return { ...this.session(body.publicKey, 'guest', { roomId: body.roomId, gameId: result.gameId }), seat: 1 };
    }
    const session = await this.authenticate(path, body, auth, audience);
    this.limit(request, 'api', 120);
    if (path.startsWith('/v1/admin/keys') || path.startsWith('/v1/admin/key-invitations')) {
      assert(session.scope === 'admin', '需要管理员权限', 403);
      if (path === '/v1/admin/key-invitations') {
        assert(validId(body.invitationId) && validKey(body.secret), '注册链接参数无效');
        const alias = this.alias(body.alias), existing = this.data.keyInvitations[body.invitationId], secretHash = await hash(body.secret);
        if (existing) { assert(existing.secretHash === secretHash && !existing.keyId, '链接 ID 已占用', 409); return { invitationId: body.invitationId, expires: existing.expires }; }
        assert(Object.keys(this.data.keyInvitations).length < 32, '待使用链接过多，请稍后重试', 429);
        const expires = Date.now() + 5 * 60000;
        this.data.keyInvitations[body.invitationId] = { alias, secretHash, created: Date.now(), expires };
        return { invitationId: body.invitationId, expires };
      }
      if (path === '/v1/admin/key-invitations/revoke') { delete this.data.keyInvitations[body.invitationId]; return { ok: true }; }
      if (path === '/v1/admin/keys') {
        const active = {};
        for (const [id, room] of Object.entries(this.data.rooms)) {
          const info = await this.room(id, 'info');
          if (info.closed) delete this.data.rooms[id];
          else if (room.keyId) active[room.keyId] = (active[room.keyId] || 0) + 1;
        }
        return { keys: Object.values(this.data.keys).map(key => ({ ...key, activeRooms: active[key.keyId] || 0, activeSessions: Object.values(this.data.sessions).filter(s => s.keyId === key.keyId).length })), invitations: Object.entries(this.data.keyInvitations).map(([invitationId, i]) => ({ invitationId, alias: i.alias, expires: i.expires, claimed: !!i.keyId })) };
      }
      const key = Object.hasOwn(this.data.keys, body.keyId) ? this.data.keys[body.keyId] : null; assert(key, '密钥不存在', 404);
      if (path === '/v1/admin/keys/alias') { key.alias = this.alias(body.alias); return { ok: true, alias: key.alias }; }
      if (path === '/v1/admin/keys/revoke') {
        key.revokedAt ||= Date.now();
        // Persist denial before closing sockets, so a partial failure cannot re-authorize the key.
        await this.save();
        const sessionIds = Object.entries(this.data.sessions).filter(([, s]) => s.keyId === key.keyId).map(([id]) => id);
        for (const [id, room] of Object.entries(this.data.rooms)) {
          if (room.keyId === key.keyId) { await this.room(id, 'close'); delete this.data.rooms[id]; }
          else if (sessionIds.length) await this.room(id, 'disconnect', { sessionIds });
        }
        for (const id of sessionIds) delete this.data.sessions[id];
        for (const [id, code] of Object.entries(this.data.codes)) if (code.keyId === key.keyId) delete this.data.codes[id];
        return { ok: true };
      }
      assert(false, '接口不存在', 404);
    }
    if (path === '/v1/logout') {
      delete this.data.sessions[auth.session];
      for (const id of Object.keys(this.data.rooms)) await this.room(id, 'disconnect', { sessionId: auth.session });
      return { ok: true };
    }
    if (path === '/v1/authorize') {
      assert(['admin', 'member'].includes(session.scope), '仅管理员或普通密钥可授权创建房间', 403);
      assert(Object.hasOwn(games, body.gameId) && validKey(body.publicKey) && validKey(body.pkce), '授权参数无效');
      const redirect = new URL(body.redirect, audience);
      assert((this.env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).includes(redirect.origin) && redirect.pathname === games[body.gameId] && !redirect.search && !redirect.hash, '返回地址不允许');
      assert(Object.keys(this.data.codes).length < 64, '授权请求过多', 429);
      const code = random(); this.data.codes[code] = { gameId: body.gameId, publicKey: body.publicKey, pkce: body.pkce, expires: Date.now() + 60000, ...(session.keyId ? { keyId: session.keyId } : {}) };
      return { code };
    }
    if (path === '/v1/rooms') {
      assert(['admin', 'game'].includes(session.scope), '无权创建房间', 403);
      assert(Object.hasOwn(games, body.gameId) && (session.scope === 'admin' || session.gameId === body.gameId), '游戏未授权', 403);
      assert(validId(body.roomId), '房间 ID 无效');
      const existing = this.data.rooms[body.roomId];
      if (!existing) assert(Object.keys(this.data.rooms).length < 50, '房间上限为 50，请先关闭旧房间', 429);
      else assert(existing.owner === session.publicKey && existing.gameId === body.gameId && (existing.keyId || null) === (session.keyId || null), '房间 ID 已占用', 409);
      // Write the index before contacting the Room; repeated creation repairs partial failures.
      this.data.rooms[body.roomId] = { gameId: body.gameId, owner: session.publicKey, created: existing?.created || Date.now(), creationCounted: existing?.creationCounted || false, ...(session.keyId ? { keyId: session.keyId } : {}) };
      await this.save();
      const result = await this.room(body.roomId, 'create', { gameId: body.gameId, owner: session.publicKey, roomId: body.roomId });
      if (!this.data.rooms[body.roomId].creationCounted && session.keyId) { this.data.keys[session.keyId].roomsCreated++; this.data.keys[session.keyId].lastGameId = body.gameId; }
      this.data.rooms[body.roomId].creationCounted = true;
      return result;
    }
    if (path === '/v1/admin/rooms') {
      assert(session.scope === 'admin', '需要管理员权限', 403);
      const rooms = [];
      for (const [id, index] of Object.entries(this.data.rooms)) {
        const info = await this.room(id, 'info');
        if (info.closed) delete this.data.rooms[id]; else rooms.push({ ...index, ...info, roomId: id });
      }
      return { rooms };
    }
    if (path === '/v1/admin/rotate') {
      assert(session.scope === 'admin' && Date.now() - session.created < 300000, '请重新输入当前密码登录后再轮换', 403);
      assert(validKey(body.publicKey) && body.kdf?.version === 1 && body.kdf.algorithm === 'argon2id' && body.kdf.memorySize === 65536 && body.kdf.iterations === 3 && body.kdf.parallelism === 4 && /^[\w-]{22}$/.test(body.kdf.salt), '新公钥或配置无效');
      for (const id of Object.keys(this.data.rooms)) await this.room(id, 'close');
      this.data.override = { publicKey: body.publicKey, kdf: body.kdf };
      this.data.sessions = {}; this.data.codes = {}; this.data.challenges = {}; this.data.rooms = {}; this.data.keyInvitations = {};
      return { ok: true };
    }
    const match = path.match(/^\/v1\/rooms\/([\w-]+)\/(info|invite|revoke-invite|reset-guest|close|ticket)$/);
    assert(match && validId(match[1]), '接口不存在', 404);
    const [, id, op] = match;
    const info = await this.room(id, 'info'); assert(!info.closed, '房间已关闭或过期', 410);
    const owner = (this.data.rooms[id]?.keyId || null) === (session.keyId || null) && info.owner === session.publicKey && (session.scope === 'admin' || (session.scope === 'game' && session.gameId === info.gameId));
    const guest = session.scope === 'guest' && session.roomId === id && info.guest === session.publicKey;
    const admin = session.scope === 'admin';
    if (op === 'info') { assert(owner || guest || admin, '无权访问房间', 403); return { ...info, seat: owner ? 0 : guest ? 1 : null }; }
    if (op === 'ticket') {
      assert(owner || guest, '无权加入此房间，请重新授权', 403);
      return this.room(id, 'ticket', { seat: owner ? 0 : 1, publicKey: session.publicKey, sessionId: auth.session, expires: session.expires });
    }
    assert(owner || admin, '需要房主或管理员权限', 403);
    if (op === 'invite') { assert(validKey(body.secret), '邀请密钥无效'); return this.room(id, op, { inviteHash: await hash(body.secret) }); }
    if (op === 'close') { await this.room(id, op); delete this.data.rooms[id]; return { ok: true }; }
    return this.room(id, op);
  }
}
