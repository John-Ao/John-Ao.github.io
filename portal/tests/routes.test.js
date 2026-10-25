import test from 'node:test';
import assert from 'node:assert/strict';
import { routes, selectedRoute, selectRoute, endpointBase } from '../sdk/routes.js';
import { api, apiBase } from '../sdk/auth.js';
import { newIdentity } from '../crypto/keys.js';
import { requestMessage, verify } from '../shared/protocol.js';

test('relay keeps canonical signature identity, rejects unconfigured destinations, and never retries writes', async t => {
  const values = new Map();
  const originalStorage = globalThis.localStorage, originalFetch = globalThis.fetch;
  globalThis.localStorage = { getItem: k => values.get(k) ?? null, setItem: (k,v) => values.set(k,v) };
  t.after(() => { selectRoute('direct'); globalThis.localStorage = originalStorage; globalThis.fetch = originalFetch; });
  assert.throws(() => selectRoute('https://attacker.example'), /未知/);
  selectRoute('relay');
  assert.equal(selectedRoute().id, 'relay');
  assert.notEqual(endpointBase(), apiBase());
  const identity = await newIdentity();
  let calls=0;
  globalThis.fetch = async (url, options) => {
    calls++;
    assert.equal(url, routes().find(r=>r.id==='relay').url+'/v1/rooms');
    assert.equal(options.credentials,'omit');
    const {body,auth}=JSON.parse(options.body);
    assert.equal(await verify(identity.publicKey, auth.signature, requestMessage('/v1/rooms',body,auth,apiBase())),true);
    assert.equal(await verify(identity.publicKey, auth.signature, requestMessage('/v1/rooms',body,auth,endpointBase())),false);
    throw new TypeError('connection lost after server accepted write');
  };
  await assert.rejects(api('/v1/rooms',{roomId:'example'},{...identity,session:'test'}), /connection lost/);
  assert.equal(calls,1);
  for(const key of values.keys()) values.set(key,'https://attacker.example');
  assert.equal(selectedRoute().id,'direct');
});

test('invitation carries only an allowed route and tab override preserves browser preference', async t => {
  const { encodeInvite, decodeInvite } = await import('../sdk/invite.js');
  const { selectTabRoute } = await import('../sdk/routes.js');
  const { random } = await import('../shared/protocol.js');
  const originalLocal = globalThis.localStorage, originalSession = globalThis.sessionStorage;
  function storage() { const values=new Map();return {getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)}; }
  globalThis.localStorage=storage();globalThis.sessionStorage=storage();
  t.after(()=>{selectRoute('direct');globalThis.localStorage=originalLocal;globalThis.sessionStorage=originalSession;});
  selectRoute('direct');
  const secret=random(), invite=encodeInvite('relay',secret);
  assert.equal(decodeInvite(invite).secret,secret);
  assert.equal(decodeInvite(invite).route.id,'relay');
  for(const bad of [secret,'p1.unknown.'+secret,'p1.https://attacker.example.'+secret,invite+'.extra',null]) assert.throws(()=>decodeInvite(bad),/邀请/);
  selectTabRoute(decodeInvite(invite).route.id);
  assert.equal(selectedRoute().id,'relay');
  assert.equal(localStorage.getItem(`portal.route:${apiBase()}`),'direct');
  const { selectedRoute: afterReload } = await import('../sdk/routes.js?reload-test');
  assert.equal(afterReload().id,'relay');
  selectRoute('direct');
  assert.equal(selectedRoute().id,'direct');
  assert.equal(sessionStorage.getItem(`portal.route:${apiBase()}:tab`),null);
});
