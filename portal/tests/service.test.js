import test from 'node:test';
import assert from 'node:assert/strict';
import { Miniflare } from 'miniflare';
import { build } from 'esbuild';
import { newIdentity, sign } from '../crypto/keys.js';
import { random, hash, loginMessage, requestMessage } from '../shared/protocol.js';

const origin='https://example.test', base='http://localhost';
test('Worker/SQLite DO 鉴权、邀请与纯通信集成', { timeout: 60000 }, async t => {
  const master=await newIdentity();
  const bundled=await build({entryPoints:[new URL('../worker/src/index.js',import.meta.url).pathname],bundle:true,format:'esm',write:false});
  const mf=new Miniflare({modules:true,script:bundled.outputFiles[0].text,compatibilityDate:'2025-03-01',bindings:{ALLOWED_ORIGINS:origin,ADMIN_PUBLIC_KEY:master.publicKey,KDF_CONFIG:JSON.stringify({version:1,algorithm:'argon2id',salt:random(16),memorySize:65536,iterations:3,parallelism:4})},durableObjects:{REGISTRY:{className:'PortalRegistry',useSQLite:true},ROOMS:{className:'GameRoom',useSQLite:true}}});
  t.after(()=>mf.dispose());
  async function envelope(path, body={}, cred) {
    let auth;if(cred){auth={session:cred.session,time:Date.now(),nonce:random(16)};auth.signature=await sign(cred.privateKey,requestMessage(path,body,auth,base));}return {body,auth};
  }
  async function send(path, env, expected=200) {const r=await mf.dispatchFetch(base+path,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify(env)});const data=await r.json();assert.equal(r.status,expected,JSON.stringify(data));return data;}
  async function call(path,body={},cred,expected=200){return send(path,await envelope(path,body,cred),expected);}
  async function login() {const identity=await newIdentity(),c=await call('/v1/challenge');const body={challenge:c.id,publicKey:identity.publicKey,signature:await sign(master.privateKey,loginMessage(c,identity.publicKey,'admin'))};const result=await call('/v1/login',body);return {...identity,...result,loginBody:body};}
  async function socket(id,cred){const {ticket}=await call(`/v1/rooms/${id}/ticket`,{},cred);const r=await mf.dispatchFetch(`${base}/v1/connect/${id}?ticket=${ticket}`,{headers:{Origin:origin,Upgrade:'websocket'}});assert.equal(r.status,101);const ws=r.webSocket;const messages=[];ws.addEventListener('message',e=>{if(e.data!=='pong')messages.push(JSON.parse(e.data));});ws.accept();return {ws,messages,ticket};}
  async function wait(socket,predicate){for(let i=0;i<100;i++){const message=socket.messages.find(predicate);if(message)return message;await new Promise(r=>setTimeout(r,20));}assert.fail('WebSocket message timeout: '+JSON.stringify(socket.messages));}
  const denied=await mf.dispatchFetch(base+'/v1/config',{headers:{Origin:'https://evil.test'}});assert.equal(denied.status,403);
  const admin=await login();await call('/v1/login',admin.loginBody,undefined,401);
  const replay=await envelope('/v1/admin/rooms',{},admin);await send('/v1/admin/rooms',replay);await send('/v1/admin/rooms',replay,409);
  const expired=await envelope('/v1/admin/rooms',{},admin);expired.auth.time-=120000;expired.auth.signature=await sign(admin.privateKey,requestMessage('/v1/admin/rooms',{},expired.auth,base));await send('/v1/admin/rooms',expired,401);
  const tampered=await envelope('/v1/admin/rooms',{},admin);tampered.body={extra:true};await send('/v1/admin/rooms',tampered,401);
  const gameIdentity=await newIdentity(),verifier=random();
  const {code}=await call('/v1/authorize',{publicKey:gameIdentity.publicKey,pkce:await hash(verifier),redirect:origin+'/game/quoridor/'},admin);
  await call('/v1/exchange',{code,verifier:'wrong'},undefined,401);
  const host={...gameIdentity,...await call('/v1/exchange',{code,verifier})};await call('/v1/exchange',{code,verifier},undefined,401);
  await call('/v1/admin/rooms',{},host,403);
  await call('/v1/authorize',{publicKey:gameIdentity.publicKey,pkce:await hash(verifier),redirect:'https://evil.test/game/quoridor/'},admin,400);
  const roomId=random(16),path=`/v1/rooms/${roomId}`;
  await call('/v1/rooms',{roomId},host);await call('/v1/rooms',{roomId},host);
  const invite=random();await call(path+'/invite',{secret:invite},host);
  const visitor=await newIdentity(),other=await newIdentity();
  const guest={...visitor,...await call('/v1/join',{roomId,invite,publicKey:visitor.publicKey})};
  const retry=await call('/v1/join',{roomId,invite,publicKey:visitor.publicKey});assert.equal(retry.session,guest.session);
  await call('/v1/join',{roomId,invite,publicKey:other.publicKey},undefined,409);
  await call(path+'/close',{},guest,403);
  await call('/v1/rooms',{roomId:random(16)},guest,403);
  await call('/v1/authorize',{publicKey:guest.publicKey,pkce:random(),redirect:origin+'/game/quoridor/'},guest,403);
  await call('/v1/admin/keys',{},guest,403);
  const a=await socket(roomId,host),b=await socket(roomId,guest);await wait(a,m=>m.type==='sync');await wait(b,m=>m.type==='sync');
  const ticketReplay=await mf.dispatchFetch(`${base}/v1/connect/${roomId}?ticket=${a.ticket}`,{headers:{Origin:origin,Upgrade:'websocket'}});assert.equal(ticketReplay.status,401);
  // Deliberately illegal game data must still be forwarded: the server is game-agnostic.
  const input={type:'event',id:random(16),expectedSeq:0,payload:{kind:'move',r:-999,c:1000}};
  a.ws.send(JSON.stringify(input));await wait(a,m=>m.type==='ack'&&m.id===input.id);const delivered=await wait(b,m=>m.type==='event');assert.deepEqual(delivered.event.payload,input.payload);assert.equal(delivered.event.seat,0);
  a.ws.send(JSON.stringify(input));await new Promise(r=>setTimeout(r,60));assert.equal(b.messages.filter(m=>m.type==='event').length,1);
  const stale={...input,id:random(16)};b.ws.send(JSON.stringify(stale));await wait(b,m=>m.type==='error'&&m.id===stale.id&&m.status===409);
  a.ws.close(1000);const resumed=await socket(roomId,host);const sync=await wait(resumed,m=>m.type==='sync');assert.equal(sync.seq,1);assert.deepEqual(sync.events[0].payload,input.payload);
  const info=await call(path+'/info',{},host);assert.equal(info.tickets,undefined);assert.equal(info.invite.hash,undefined);
  await call(path+'/reset-guest',{},admin);await call(path+'/ticket',{},guest,403);
  await call('/v1/join',{roomId,invite,publicKey:visitor.publicKey},undefined,403);
  await call(path+'/close',{},admin);await call(path+'/ticket',{},host,410);
  resumed.ws.close();b.ws.close();
  const concurrentId=random(16),concurrentInvite=random();
  await call('/v1/rooms',{roomId:concurrentId},host);
  await call(`/v1/rooms/${concurrentId}/invite`,{secret:concurrentInvite},host);
  const racers=await Promise.all([newIdentity(),newIdentity()]);
  const outcomes=await Promise.all(racers.map(identity=>mf.dispatchFetch(base+'/v1/join',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({body:{roomId:concurrentId,invite:concurrentInvite,publicKey:identity.publicKey}})})));
  assert.deepEqual(outcomes.map(r=>r.status).sort(),[200,409]);
  await call(`/v1/rooms/${concurrentId}/reset-guest`,{},admin);
  await call(`/v1/rooms/${concurrentId}/invite`,{secret:random()},host);
  await call(`/v1/rooms/${concurrentId}/revoke-invite`,{},host);
  await call('/v1/join',{roomId:concurrentId,invite:concurrentInvite,publicKey:racers[0].publicKey},undefined,403);
  const live=await socket(concurrentId,host);await wait(live,m=>m.type==='sync');
  const replacement=await newIdentity(),newKdf={version:1,algorithm:'argon2id',salt:random(16),memorySize:65536,iterations:3,parallelism:4};
  await call('/v1/admin/rotate',{publicKey:replacement.publicKey,kdf:newKdf},admin);
  await wait(live,m=>m.type==='closed');
  await call('/v1/admin/rooms',{},admin,401);
  await call(`/v1/rooms/${concurrentId}/ticket`,{},host,401);
  const settings=await (await mf.dispatchFetch(base+'/v1/config',{headers:{Origin:origin}})).json();assert.equal(settings.publicKey,replacement.publicKey);
  const challenge=await call('/v1/challenge'),newSessionKey=await newIdentity();
  const signed=await sign(replacement.privateKey,loginMessage(challenge,newSessionKey.publicKey,'admin'));
  const newAdmin={...newSessionKey,...await call('/v1/login',{challenge:challenge.id,publicKey:newSessionKey.publicKey,signature:signed})};
  const empty=await call('/v1/admin/rooms',{},newAdmin);assert.equal(empty.rooms.length,0);
  live.ws.close();
});
