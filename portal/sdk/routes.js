import { config } from '../config.js';

function origin(value) {
  const url = new URL(value);
  if (url.username || url.password || url.pathname !== '/' || url.search || url.hash ||
      (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname)))) {
    throw new Error('线路必须是 HTTPS 服务地址');
  }
  return url.origin;
}
export function routes() {
  const entries = config.routes?.length ? config.routes : [{ id: 'direct', label: '直连', url: config.apiBase }];
  return entries.map(route => ({ ...route, url: origin(route.url) }));
}
const listeners = new Set();
let memorySelection;
let tabSelection;
function storageKey() { return `portal.route:${origin(config.apiBase)}`; }
function tabStorageKey() { return `${storageKey()}:tab`; }
function tabRoute() {
  let id = tabSelection;
  try { id = sessionStorage.getItem(tabStorageKey()) ?? id; } catch {}
  return routes().find(route => route.id === id);
}
export function selectedRoute() {
  const override = tabRoute();
  if (override) return override;
  let id = memorySelection;
  try { id = localStorage.getItem(storageKey()) ?? id; } catch {}
  return routes().find(route => route.id === id) || routes()[0];
}
export function endpointBase() { return selectedRoute().url; }
export function selectTabRoute(id) {
  if (!routes().some(route => route.id === id)) throw new Error('邀请中的通信线路不可用，请房主重新分享');
  tabSelection = id;
  try { sessionStorage.setItem(tabStorageKey(), id); } catch {}
  for (const listener of listeners) listener();
}
export function selectRoute(id) {
  if (!routes().some(route => route.id === id)) throw new Error('未知通信线路');
  tabSelection = undefined;
  try { sessionStorage.removeItem(tabStorageKey()); } catch {}
  memorySelection = id;
  try { localStorage.setItem(storageKey(), id); } catch {}
  for (const listener of listeners) listener();
}
export function onRouteChange(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
globalThis.addEventListener?.('storage', event => {
  if (event.key === storageKey() || event.key === null) {
    memorySelection = undefined;
    if (!tabRoute()) for (const listener of listeners) listener();
  }
});
