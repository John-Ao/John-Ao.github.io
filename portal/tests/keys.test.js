import test from 'node:test';
import assert from 'node:assert/strict';
import { Miniflare } from 'miniflare';
import { build } from 'esbuild';
import { newIdentity, sign } from '../crypto/keys.js';
import { random, hash, loginMessage, registrationMessage, requestMessage } from '../shared/protocol.js';
const origin='https://keys.test',base='http://localhost';
test('普通密钥注册、5 分钟期限、权限边界、别名、统计与撤销', { timeout:60000 }, async t=>{
  const master=await newIdentity();
  const bundle=await build({entryPoints:[new URL('../worker/src/index.js',import.meta.url).pathname],bundle:true,format:'esm',write:false});
  const options={modules:true,script:bundle.outputFiles[0].text,compatibilityDate:'2025-03-01',bindings:{ALLOWED_ORIGINS:origin,ADMIN_PUBLIC_KEY:master.publicKey,KDF_CONFIG:JSON.stringify({version:1})},durableObjects:{REGISTRY:{className:'PortalRegistry',useSQLite:true},ROOMS:{className:'GameRoom',useSQLite:true}}};
  const mf=new Miniflare(options);t.after(()=>mf.dispose());
  async function call(path,body={},credentials,status=200){
    let auth;if(credentials){auth={session:credentials.session,time:Date.now(),nonce:random(16)};auth.signature=await sign(credentials.privateKey,requestMessage(path,body,auth,base));}
    const r=await mf.dispatchFetch(base+path,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({body,auth})});const result=await r.json();assert.equal(r.status,status,JSON.stringify(result));return result;
  }
  const adminIdentity=await newIdentity(),challenge=await call('/v1/challenge');
  const admin={...adminIdentity,...await call('/v1/login',{challenge:challenge.id,publicKey:adminIdentity.publicKey,signature:await sign(master.privateKey,loginMessage(challenge,adminIdentity.publicKey,'admin'))})};
  async function grant(alias){const invitation={invitationId:random(16),secret:random()};const result=await call('/v1/admin/key-invitations',{...invitation,alias},admin);assert(Math.abs(result.expires-Date.now()-300000)<3000);return invitation;}
  async function enroll(invitation,key,status=200){return call('/v1/keys/register',{...invitation,publicKey:key.publicKey,signature:await sign(key.privateKey,registrationMessage(base,invitation.invitationId,await hash(invitation.secret),key.publicKey))},undefined,status);}
  async function memberLogin(key,keyId){const c=await call('/v1/challenge',{purpose:'member'}),identity=await newIdentity();return {...identity,...await call('/v1/key-login',{challenge:c.id,keyId,publicKey:identity.publicKey,signature:await sign(key.privateKey,loginMessage(c,identity.publicKey,'member:'+keyId))})};}
  async function authorize(member,identity){const verifier=random(),{code}=await call('/v1/authorize',{publicKey:identity.publicKey,pkce:await hash(verifier),redirect:origin+'/game/quoridor/'},member);return {...identity,...await call('/v1/exchange',{code,verifier})};}
  const invitation=await grant('成员甲'),key=await newIdentity();
  await enroll({...invitation,secret:random()},key,410);
  await call('/v1/keys/register',{...invitation,publicKey:key.publicKey,signature:random()},undefined,401);
  const registration=await enroll(invitation,key);assert.equal(registration.keyId,await hash(key.publicKey));
  assert.deepEqual(await enroll(invitation,key),registration);await enroll(invitation,await newIdentity(),409);
  const member=await memberLogin(key,registration.keyId);
  for(const path of ['/v1/admin/keys','/v1/admin/rooms','/v1/admin/key-invitations','/v1/admin/keys/alias','/v1/admin/rotate'])await call(path,{},member,403);
  const adminAttempt=await call('/v1/challenge');await call('/v1/login',{challenge:adminAttempt.id,publicKey:member.publicKey,signature:await sign(key.privateKey,loginMessage(adminAttempt,member.publicKey,'admin'))},undefined,401);
  await call('/v1/rooms',{roomId:random(16)},member,403); // Only creator or admin sessions can create regions.
  const gameIdentity=await newIdentity(),game=await authorize(member,gameIdentity),roomId=random(16);
  await call('/v1/rooms',{roomId},game);await call('/v1/rooms',{roomId},game);
  await call('/v1/admin/keys',{},game,403);
  await call('/v1/admin/keys/alias',{keyId:registration.keyId,alias:'新的别名'},admin);
  const list=await call('/v1/admin/keys',{},admin),row=list.keys[0];assert.equal(row.alias,'新的别名');assert.equal(row.roomsCreated,1);assert.equal(row.loginCount,1);assert.equal(row.activeRooms,1);assert(row.lastUsedAt);
  // A second authorized principal cannot inherit the first principal's rooms
  // even when a browser reuses the same game-client key pair.
  const secondKey=await newIdentity(),secondRegistration=await enroll(await grant('成员乙'),secondKey);
  const secondMember=await memberLogin(secondKey,secondRegistration.keyId),secondGame=await authorize(secondMember,gameIdentity);
  await call(`/v1/rooms/${roomId}/ticket`,{},secondGame,403);
  await call('/v1/rooms',{roomId},secondGame,409);
  const {ticket}=await call(`/v1/rooms/${roomId}/ticket`,{},game);
  const response=await mf.dispatchFetch(`${base}/v1/connect/${roomId}?ticket=${ticket}`,{headers:{Origin:origin,Upgrade:'websocket'}});assert.equal(response.status,101);
  const socket=response.webSocket;let closed=false;socket.addEventListener('message',e=>{if(JSON.parse(e.data).type==='closed')closed=true;});socket.accept();
  const verifier=random(),{code}=await call('/v1/authorize',{publicKey:gameIdentity.publicKey,pkce:await hash(verifier),redirect:origin+'/game/quoridor/'},member);
  await call('/v1/admin/keys/revoke',{keyId:registration.keyId},admin);
  await call('/v1/exchange',{code,verifier},undefined,401);await call(`/v1/rooms/${roomId}/ticket`,{},game,401);
  for(let i=0;i<100&&!closed;i++)await new Promise(r=>setTimeout(r,10));assert(closed);socket.close();
  const c=await call('/v1/challenge',{purpose:'member'});await call('/v1/key-login',{challenge:c.id,keyId:registration.keyId,publicKey:member.publicKey,signature:await sign(key.privateKey,loginMessage(c,member.publicKey,'member:'+registration.keyId))},undefined,403);
  const raceInvitation=await grant('并发注册'),racers=await Promise.all([newIdentity(),newIdentity()]);
  const statuses=await Promise.all(racers.map(async identity=>{
    const body={...raceInvitation,publicKey:identity.publicKey,signature:await sign(identity.privateKey,registrationMessage(base,raceInvitation.invitationId,await hash(raceInvitation.secret),identity.publicKey))};
    return (await mf.dispatchFetch(base+'/v1/keys/register',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({body})})).status;
  }));assert.deepEqual(statuses.sort(),[200,409]);
  const unused=await grant('过期测试'),unusedKey=await newIdentity();
  // Reload the real Worker with only its clock advanced; storage stays intact.
  await mf.setOptions({...options,script:options.script.replaceAll('Date.now()', '(Date.now() + 300001)')});
  await enroll(unused,unusedKey,410);await call('/v1/key-invitations/inspect',unused,undefined,410);
});
