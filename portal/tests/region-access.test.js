import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Miniflare } from 'miniflare';
import { build } from 'esbuild';
import { newIdentity, sign } from '../crypto/keys.js';
import { random, hash, loginMessage, requestMessage, DAY, GUEST_IDLE_TTL, ROOM_IDLE_TTL } from '../shared/protocol.js';

const origin='https://regions.test', base='http://localhost', hour=3600000;
test('generic regions: sliding guest access, expiry, replacement grants and seven-day cleanup', {timeout:60000}, async t=>{
  const master=await newIdentity();
  // Only the test bundle gets a per-DO clock. Live sockets survive clock advances.
  const bundle=await build({entryPoints:[new URL('../worker/src/index.js',import.meta.url).pathname],bundle:true,format:'esm',write:false,
    plugins:[{name:'controlled-clock',setup(build){build.onLoad({filter:/worker\/src\/(room|registry)\.js$/},async args=>{
      let source=await readFile(args.path,'utf8');
      source=source.replaceAll('Date.now()', 'this.now()').replace('  async fetch(request) {', `  now() { return this.testNow ?? Date.now(); }
  async fetch(request) {
    if (new URL(request.url).pathname === '/__test-clock') {
      this.testNow = Number(await request.text());
      if (new URL(request.url).searchParams.has('alarm')) await this.alarm();
      return new Response('ok');
    }`);
      return {contents:source,loader:'js'};
    });}}]});
  const mf=new Miniflare({modules:true,script:bundle.outputFiles[0].text,compatibilityDate:'2025-03-01',bindings:{ALLOWED_ORIGINS:origin,ADMIN_PUBLIC_KEY:master.publicKey,KDF_CONFIG:JSON.stringify({version:1})},durableObjects:{REGISTRY:{className:'PortalRegistry',useSQLite:true},ROOMS:{className:'GameRoom',useSQLite:true}}});
  t.after(()=>mf.dispose());
  const registryNS=await mf.getDurableObjectNamespace('REGISTRY'), roomsNS=await mf.getDurableObjectNamespace('ROOMS');
  const registry=registryNS.get(registryNS.idFromName('portal-v1'));
  const roomId=random(16),otherId=random(16),room=roomsNS.get(roomsNS.idFromName(roomId)),other=roomsNS.get(roomsNS.idFromName(otherId));
  const start=Date.now();let now=start;
  async function clock(offset,alarm=false){now=start+offset;for(const stub of [registry,room,other])await stub.fetch('https://test/__test-clock'+(alarm&&stub!==registry?'?alarm':''),{method:'POST',body:String(now)});}
  await clock(0);
  async function call(path,body={},cred,status=200){
    let auth;if(cred){auth={session:cred.session,time:now,nonce:random(16)};auth.signature=await sign(cred.privateKey,requestMessage(path,body,auth,base));}
    const response=await mf.dispatchFetch(base+path,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({body,auth})});
    const result=await response.json();assert.equal(response.status,status,JSON.stringify(result));return result;
  }
  const ownerIdentity=await newIdentity();
  async function login(){const c=await call('/v1/challenge');return {...ownerIdentity,...await call('/v1/login',{challenge:c.id,publicKey:ownerIdentity.publicKey,signature:await sign(master.privateKey,loginMessage(c,ownerIdentity.publicKey,'admin'))})};}
  let owner=await login();
  const app=await newIdentity(),verifier=random();
  const {code}=await call('/v1/authorize',{publicKey:app.publicKey,pkce:await hash(verifier),redirect:origin+'/previously-unknown-tool.html'},owner);
  const creator=await call('/v1/exchange',{code,verifier});assert.equal(creator.scope,'creator');assert.equal(creator.gameId,undefined);
  await call('/v1/rooms',{roomId},undefined,401);
  await call('/v1/rooms',{roomId},owner);await call('/v1/rooms',{roomId:otherId},owner);
  const invite=random(),shared=await call(`/v1/rooms/${roomId}/invite`,{secret:invite},owner);assert.equal(shared.expires,now+DAY);
  const identity=await newIdentity(),guest={...identity,...await call('/v1/join',{roomId,invite,publicKey:identity.publicKey})};
  assert.equal(guest.expires,now+GUEST_IDLE_TTL);
  await clock(hour);
  for(const path of [`/v1/rooms/${otherId}/info`,`/v1/rooms/${roomId}/invite`,`/v1/rooms/${roomId}/close`,'/v1/admin/rooms'])await call(path,{},guest,403);
  await call('/v1/rooms',{roomId:random(16)},guest,403);
  assert.equal((await (await room.fetch('https://test/info')).json()).guestExpires,start+GUEST_IDLE_TTL);
  async function socket(cred){const {ticket}=await call(`/v1/rooms/${roomId}/ticket`,{},cred);const res=await mf.dispatchFetch(`${base}/v1/connect/${roomId}?ticket=${ticket}`,{headers:{Origin:origin,Upgrade:'websocket'}});assert.equal(res.status,101);const ws=res.webSocket,messages=[];ws.addEventListener('message',e=>messages.push(e.data==='pong'?'pong':JSON.parse(e.data)));ws.accept();return {ws,messages};}
  async function wait(s,fn){for(let i=0;i<100;i++){const result=s.messages.find(fn);if(result)return result;await new Promise(r=>setTimeout(r,10));}assert.fail(JSON.stringify(s.messages));}
  let connection=await socket(guest);
  const sync=await wait(connection,m=>m.type==='sync');assert.equal(sync.gameId,undefined);
  await clock(7*hour);
  async function write(s,seq){const id=random(16);s.ws.send(JSON.stringify({type:'event',id,expectedSeq:seq,payload:{anything:['opaque',seq],notAGame:true}}));await wait(s,m=>m.type==='ack'&&m.id===id);}
  await write(connection,0);
  await clock(9*hour); // original guest session expired, but its grant was renewed by the WS write
  const read=await call(`/v1/rooms/${roomId}/info`,{},guest);assert.equal(read.guestExpires,now+GUEST_IDLE_TTL);assert.equal(read.gameId,undefined);
  await write(connection,1); // attachment's initial expires must not override the sliding grant
  await clock(16*hour);
  connection.ws.close();connection=await socket(guest);await wait(connection,m=>m.type==='sync'&&m.seq===2);
  const lastActive=now;
  await clock(23*hour);
  connection.ws.send('ping');await wait(connection,m=>m==='pong');
  let info=await (await room.fetch('https://test/info')).json();assert.equal(info.guestExpires,lastActive+GUEST_IDLE_TTL);assert.equal(info.lastActivity,lastActive);
  let closeCode;connection.ws.addEventListener('close',e=>{closeCode=e.code;});
  await clock(24*hour+1,true);
  for(let i=0;i<100&&!closeCode;i++)await new Promise(r=>setTimeout(r,10));assert.equal(closeCode,4001);
  await call(`/v1/rooms/${roomId}/info`,{},guest,401);
  await call('/v1/join',{roomId,invite,publicKey:identity.publicKey},undefined,403);
  info=await (await room.fetch('https://test/info')).json();assert.equal(info.guest,null);assert.equal(info.seq,2);
  owner=await login();
  const renewedInvite=random();await call(`/v1/rooms/${roomId}/invite`,{secret:renewedInvite},owner);
  const renewed={...identity,...await call('/v1/join',{roomId,invite:renewedInvite,publicKey:identity.publicKey})};assert.notEqual(renewed.session,guest.session);assert.notEqual(renewed.grantId,guest.grantId);
  connection=await socket(renewed);await wait(connection,m=>m.type==='sync'&&m.seq===2);
  await call(`/v1/rooms/${roomId}/ticket`,{},guest,401);
  // Revoking and re-granting to the same key cannot revive an old session.
  await call(`/v1/rooms/${roomId}/reset-guest`,{},owner);
  const replacementInvite=random();await call(`/v1/rooms/${roomId}/invite`,{secret:replacementInvite},owner);
  const replacement={...identity,...await call('/v1/join',{roomId,invite:replacementInvite,publicKey:identity.publicKey})};
  await call(`/v1/rooms/${roomId}/ticket`,{},renewed,403);assert.notEqual(replacement.grantId,renewed.grantId);
  const regionLastActive=now;
  await clock(regionLastActive-start+ROOM_IDLE_TTL-1);
  assert.equal((await (await room.fetch('https://test/info')).json()).seq,2); // metadata inspections do not renew it
  await clock(regionLastActive-start+ROOM_IDLE_TTL,true);
  assert.deepEqual(await (await room.fetch('https://test/info')).json(),{closed:true});
  owner=await login();await call(`/v1/rooms/${roomId}/info`,{},owner,410);
});
