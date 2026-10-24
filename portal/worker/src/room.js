import { DAY, INVITE_TTL, MAX_EVENTS, MAX_LOG_BYTES, MAX_PAYLOAD_BYTES, random, hash, validId, assert, json, failure } from '../../shared/protocol.js';

export class GameRoom {
  constructor(ctx, env) {
    this.ctx = ctx; this.env = env;
    this.ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping', 'pong'));
  }
  async meta() { return await this.ctx.storage.get('meta'); }
  sockets() { return this.ctx.getWebSockets(); }
  send(ws, data) { try { ws.send(JSON.stringify(data)); } catch {} }
  broadcast(data) { for (const ws of this.sockets()) this.send(ws, data); }
  presence(m) { this.broadcast({ type: 'presence', joined: !!m.guest, online: [...new Set(this.sockets().filter(s => s.readyState === 1).map(s => s.deserializeAttachment()?.seat))] }); }
  async schedule(m) {
    const times = [m.lastActivity + DAY];
    for (const ws of this.sockets()) { const a = ws.deserializeAttachment(); if (a?.expires > Date.now()) times.push(a.expires); }
    await this.ctx.storage.setAlarm(Math.max(Date.now() + 1000, Math.min(...times)));
  }
  async close() {
    for (const ws of this.sockets()) { this.send(ws, { type: 'closed', message: '房间已关闭或过期' }); ws.close(4004, 'Room closed'); }
    await this.ctx.storage.deleteAll();
  }
  async active() {
    const m = await this.meta();
    if (m && m.lastActivity + DAY <= Date.now()) { await this.close(); return null; }
    return m;
  }
  async alarm() {
    await this.ctx.blockConcurrencyWhile(async () => {
      const m = await this.active(); if (!m) return;
      for (const ws of this.sockets()) if (ws.deserializeAttachment()?.expires <= Date.now()) ws.close(4001, 'Session expired');
      await this.schedule(m);
    });
  }
  async fetch(request) {
    return this.ctx.blockConcurrencyWhile(async () => {
      try {
        const url = new URL(request.url), op = url.pathname.slice(1);
        const body = request.method === 'POST' ? await request.json() : {};
        let m = await this.active();
        if (op === 'info') return json(m ? { roomId: m.roomId, gameId: m.gameId, owner: m.owner, guest: m.guest, created: m.created, lastActivity: m.lastActivity, seq: m.seq, invite: m.invite ? { expires: m.invite.expires, claimed: !!m.invite.claimed } : null } : { closed: true });
        if (op === 'close') { await this.close(); return json({ ok: true }); }
        if (op === 'create') {
          if (m) { assert(m.owner === body.owner && m.gameId === body.gameId, '房间已存在', 409); return json({ roomId: m.roomId, seat: 0 }); }
          m = { roomId: body.roomId, gameId: body.gameId, owner: body.owner, guest: null, created: Date.now(), lastActivity: Date.now(), seq: 0, bytes: 0, invite: null, tickets: {} };
          await this.ctx.storage.put('meta', m); await this.schedule(m); return json({ roomId: m.roomId, seat: 0 });
        }
        assert(m, '房间已关闭或过期', 410);
        if (op === 'invite') {
          assert(!m.guest, '访客席位已被认领，请先重置访客席位', 409);
          m.invite = { hash: body.inviteHash, expires: Date.now() + INVITE_TTL };
        } else if (op === 'revoke-invite') m.invite = null;
        else if (op === 'join') {
          assert(body.gameId === m.gameId, '邀请与游戏不匹配', 403);
          assert(m.invite && m.invite.hash === body.inviteHash, '邀请已撤销或无效', 403);
          if (m.invite.claimed) {
            assert(m.guest === body.publicKey, '邀请已被其他人使用', 409);
            assert(m.invite.retryUntil > Date.now(), '邀请已消费，请使用已保存的身份重连', 410);
          }
          else {
            assert(m.invite.expires > Date.now() && !m.guest, '邀请已过期或席位已占用', 410);
            m.guest = body.publicKey; m.invite.claimed = true; m.invite.retryUntil = Date.now() + 120000;
          }
        } else if (op === 'reset-guest') {
          m.guest = null; m.invite = null;
          for (const [id, t] of Object.entries(m.tickets)) if (t.seat === 1) delete m.tickets[id];
          for (const ws of this.sockets()) if (ws.deserializeAttachment()?.seat === 1) ws.close(4003, 'Seat revoked');
        } else if (op === 'disconnect') {
          const sessionIds = new Set(body.sessionIds || [body.sessionId]);
          for (const [id, t] of Object.entries(m.tickets)) if (sessionIds.has(t.sessionId)) delete m.tickets[id];
          for (const ws of this.sockets()) if (sessionIds.has(ws.deserializeAttachment()?.sessionId)) ws.close(4001, 'Logged out');
        } else if (op === 'ticket') {
          for (const [id, t] of Object.entries(m.tickets)) if (t.ticketExpires <= Date.now()) delete m.tickets[id];
          assert(Object.keys(m.tickets).length < 16, '连接请求过多', 429);
          assert((body.seat === 0 ? m.owner : m.guest) === body.publicKey, '席位身份不匹配', 403);
          const ticket = random(); m.tickets[await hash(ticket)] = { ...body, ticketExpires: Date.now() + 30000 };
          await this.ctx.storage.put('meta', m); return json({ ticket });
        } else if (op === 'socket') {
          const ticketHash = await hash(url.searchParams.get('ticket') || ''), t = m.tickets[ticketHash];
          assert(t && t.ticketExpires > Date.now() && t.expires > Date.now(), '连接票据无效或已过期', 401);
          delete m.tickets[ticketHash]; await this.ctx.storage.put('meta', m);
          assert((t.seat === 0 ? m.owner : m.guest) === t.publicKey, '席位已撤销', 403);
          for (const ws of this.sockets()) if (ws.deserializeAttachment()?.seat === t.seat) ws.close(4002, 'Replaced by another tab');
          const generation = random(16); m.connections ||= {}; m.connections[t.seat] = generation;
          await this.ctx.storage.put('meta', m);
          const pair = new WebSocketPair(), [client, server] = Object.values(pair);
          server.serializeAttachment({ ...t, generation, window: Date.now(), count: 0 }); this.ctx.acceptWebSocket(server);
          const events = [...(await this.ctx.storage.list({ prefix: 'event:' })).values()];
          this.send(server, { type: 'sync', events, seq: m.seq, seat: t.seat, gameId: m.gameId });
          this.presence(m); await this.schedule(m);
          return new Response(null, { status: 101, webSocket: client });
        } else assert(false, '接口不存在', 404);
        m.lastActivity = Date.now(); await this.ctx.storage.put('meta', m); await this.schedule(m);
        if (op === 'join' || op === 'reset-guest') this.presence(m);
        return json({ ok: true, gameId: m.gameId, expires: m.invite?.expires });
      } catch (e) { return failure(e); }
    });
  }
  async webSocketMessage(ws, raw) {
    await this.ctx.blockConcurrencyWhile(async () => {
      let input;
      try {
        const m = await this.active(), a = ws.deserializeAttachment();
        assert(m && a && a.expires > Date.now(), '房间或会话已过期', 401);
        assert((a.seat === 0 ? m.owner : m.guest) === a.publicKey && m.connections?.[a.seat] === a.generation && ws.readyState === 1, '席位不可用', 403);
        assert(typeof raw === 'string' && new TextEncoder().encode(raw).length <= MAX_PAYLOAD_BYTES + 512, '消息过大', 413);
        if (Date.now() - a.window > 10000) { a.window = Date.now(); a.count = 0; }
        a.count++; ws.serializeAttachment(a); assert(a.count <= 30, '发送过于频繁', 429);
        try { input = JSON.parse(raw); } catch { assert(false, '消息格式错误'); }
        assert(input?.type === 'event' && validId(input.id) && Number.isSafeInteger(input.expectedSeq) && input.payload && typeof input.payload === 'object' && !Array.isArray(input.payload), '消息格式错误');
        assert(new TextEncoder().encode(JSON.stringify(input.payload)).length <= MAX_PAYLOAD_BYTES, '消息过大', 413);
        const previous = await this.ctx.storage.get('dedup:' + input.id);
        if (previous) {
          assert(previous.publicKey === a.publicKey && previous.payload === JSON.stringify(input.payload), '操作 ID 重复', 409);
          this.send(ws, { type: 'ack', id: input.id, seq: previous.seq }); return;
        }
        assert(input.expectedSeq === m.seq, '消息版本冲突，请重新同步', 409);
        const event = { seq: m.seq + 1, id: input.id, seat: a.seat, payload: input.payload };
        const size = new TextEncoder().encode(JSON.stringify(event)).length;
        assert(m.seq < MAX_EVENTS && m.bytes + size <= MAX_LOG_BYTES, '房间记录已满，请创建新房间', 409);
        m.seq++; m.bytes += size; m.lastActivity = Date.now();
        // Payloads are opaque: no game imports, turn checks, or board state here.
        await this.ctx.storage.transaction(async txn => {
          await txn.put('meta', m);
          await txn.put('event:' + String(m.seq).padStart(8, '0'), event);
          await txn.put('dedup:' + input.id, { seq: m.seq, publicKey: a.publicKey, payload: JSON.stringify(input.payload) });
        });
        await this.schedule(m); this.broadcast({ type: 'event', event });
        this.send(ws, { type: 'ack', id: input.id, seq: m.seq });
      } catch (e) { this.send(ws, { type: 'error', id: input?.id, status: e.status || 500, message: e.status ? e.message : '消息保存失败，请重连后重试' }); }
    });
  }
  async webSocketClose(ws, code, reason, wasClean) {
    try { ws.close(code, reason); } catch {}
    const m = await this.meta(); if (m) this.presence(m);
  }
  async webSocketError(ws) { try { ws.close(1011, 'Connection error'); } catch {} }
}
