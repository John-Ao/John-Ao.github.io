import { validKey } from '../shared/protocol.js';
import { routes } from './routes.js';

export function encodeInvite(routeId, secret) {
  const value = `p1.${routeId}.${secret}`;
  decodeInvite(value);
  return value;
}
export function decodeInvite(value) {
  if (typeof value !== 'string' || value.length > 256) throw new Error('邀请格式无效，请房主重新分享');
  const match = /^p1\.([\w-]{1,80})\.([\w-]{43})$/.exec(value);
  if (!match || !validKey(match[2])) throw new Error('邀请格式无效，请房主重新分享');
  const route = routes().find(route => route.id === match[1]);
  if (!route) throw new Error('邀请中的通信线路不可用，请房主重新分享');
  return { route, secret: match[2] };
}
