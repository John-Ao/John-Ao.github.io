import { json, failure, assert, validId } from '../../shared/protocol.js';
export { PortalRegistry } from './registry.js';
export { GameRoom } from './room.js';
export default {
  async fetch(request, env) {
    const url = new URL(request.url), origin = request.headers.get('Origin');
    const allowed = (env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim());
    try {
      assert(origin && allowed.includes(origin), '不允许的来源', 403);
      if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(origin) });
      let response;
      const match = url.pathname.match(/^\/v1\/connect\/([\w-]+)$/);
      if (match) {
        assert(validId(match[1]) && request.headers.get('Upgrade')?.toLowerCase() === 'websocket', '需要 WebSocket 连接');
        // This is the only publicly reachable Room route. All administrative
        // Room calls originate inside the Registry, never from browser input.
        const stub = env.ROOMS.get(env.ROOMS.idFromName(match[1]));
        response = await stub.fetch(new Request('https://room/socket' + url.search, request));
      } else {
        assert(url.pathname.startsWith('/v1/'), '接口不存在', 404);
        response = await env.REGISTRY.get(env.REGISTRY.idFromName('portal-v1')).fetch(request);
      }
      if (response.status === 101) return response;
      return new Response(response.body, { status: response.status, headers: { ...Object.fromEntries(response.headers), ...cors(origin) } });
    } catch (e) {
      const response = failure(e);
      return new Response(response.body, { status: response.status, headers: { ...Object.fromEntries(response.headers), ...(allowed.includes(origin) ? cors(origin) : {}) } });
    }
  }
};
function cors(origin) { return { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', 'Vary': 'Origin', 'Cache-Control': 'no-store' }; }
