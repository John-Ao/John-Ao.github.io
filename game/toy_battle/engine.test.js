'use strict';
const assert=require('node:assert/strict'),T=require('./engine.js');let serial=0;const tile=(p,v)=>({p,v,id:'test-'+serial++});
const fresh=(mapId='castle')=>T.create({mapId,first:0},()=>.37);
function put(s,id,p,v){const t=tile(p,v);s.board[id].push(t);return t;}
assert.equal(T.maps.length,9);
for(const m of T.maps){const s=fresh(m.id);assert.equal(s.hands[0].length,3);assert.equal(s.hands[1].length,4);assert.equal(m.regions.reduce((a,r)=>a+r.medals,0),{castle:14,pool:12,clouds:16,volcano:14,cemetery:14,sea:11,metal:14,battlefield:16,croisette:11}[m.id]);for(const [a,b]of m.edges){assert(T.node(s,a));assert(T.node(s,b));assert.notEqual(a,b);}const reach=new Set([m.nodes[0].id]);for(let n=0;n<30;n++)for(const id of [...reach])T.adj(s,id).forEach(x=>reach.add(x));assert.equal(reach.size,m.nodes.length);}
{const s=fresh();assert(!T.adj(s,'d').includes('e'));assert(!T.adj(s,'k').includes('l'));assert(T.legal(s,tile(0,4),'a'));assert(!T.legal(s,tile(0,4),'R'));put(s,'n',0,7);assert(T.legal(s,tile(0,1),'k'));put(s,'k',1,3);assert(!T.legal(s,tile(0,3),'k'));assert(T.legal(s,tile(0,0),'k'));s.board.k=[tile(1,0)];assert(T.legal(s,tile(0,1),'k'));}
{const s=fresh('pool');for(const v of [1,2,3,4,5])assert(!T.legal(s,tile(0,v),'g'));assert(!T.legal(s,tile(0,4),'d'));s.basic=true;assert(T.legal(s,tile(0,4),'d'));assert.equal(T.connected(s,0).size,2);}
{const s=fresh('metal');assert(!T.legal(s,tile(0,4),'s1'));put(s,'i',0,7);put(s,'g',0,7);s.hands[0]=[tile(0,2)];assert(T.place(s,0,'s1'));assert.equal(s.turn,1);assert.equal(s.phase,'place');}
{const s=fresh('castle');['a','d','h','e','b'].forEach(id=>put(s,id,0,7));T.check(s);assert.equal(s.medals[0],3);T.check(s);assert.equal(s.medals[0],3);s.board.a=[];T.check(s);assert.equal(s.medals[0],3);}
{const s=fresh('battlefield');s.phase='freeze';const id=s.hands[1][0].id;assert(T.select(s,0));assert(s.frozen[1].includes(id));assert(!T.legal(s,s.hands[1][0],'a'));assert(T.recruit(s));assert.equal(s.frozen[1].length,0);}
{const s=fresh('cemetery');const dead=tile(0,7);s.discard=[tile(1,2),dead];s.phase='resurrect';assert(!T.select(s,0));assert(T.select(s,1));assert(s.hands[0].includes(dead));assert.equal(s.discard.length,1);}
{const s=fresh('volcano');const enemy=put(s,'d',1,1);put(s,'g',0,7);s.phase='pushSource';s.origin='p';assert(T.choose(s,'d'));assert(T.targets(s).includes('g'));assert(T.choose(s,'g'));assert.equal(T.top(s,'g'),enemy);assert.equal(s.hands[1].length,4);assert.equal(s.turn,1);}
{const s=fresh('clouds');s.hands[0]=[tile(0,4)];assert(T.place(s,0,'C2'));assert.equal(s.phase,'bases');assert(T.base(s,0));assert.equal(s.phase,'baseDraw');assert(T.effect(s));assert.equal(s.hands[0].length,1);}
{const s=fresh();s.hands[0]=[tile(0,2),tile(0,4)];['n','k','g'].forEach(id=>put(s,id,0,7));assert(T.place(s,0,'c'));assert.equal(s.phase,'extra');assert(T.place(s,0,'f'));assert.equal(s.pending.length,2);assert.equal(s.phase,'bases');assert(T.base(s,1));assert.equal(s.origin,'f');assert(T.choose(s,'g'));assert.equal(s.phase,'bases');assert(T.base(s,0));assert(T.skip(s));assert.equal(s.turn,1);}
{const s=fresh('sea');['d','b','e','h'].forEach(id=>put(s,id,1,7));s.turn=1;s.hands[1]=[tile(1,7)];assert(T.place(s,0,'B2'));assert.equal(s.winner,1);}
let seed=98131;const rng=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};const pick=a=>a[Math.floor(rng()*a.length)];
for(const m of T.maps)for(let game=0;game<100;game++){
 const s=T.create({mapId:m.id,basic:game%10===0},rng);let steps=0;
 while(s.winner===null&&steps++<3000){let ok;
 if(['place','extra'].includes(s.phase)){const opts=[];s.hands[s.turn].forEach((t,i)=>m.nodes.forEach(n=>{if(T.legal(s,t,n.id))opts.push([i,n.id]);}));if(s.phase==='place'&&s.decks[s.turn].length&&s.hands[s.turn].length<8&&(!opts.length||rng()<.25))ok=T.recruit(s);else if(opts.length)ok=T.place(s,...pick(opts));else ok=T.skip(s);
 }else if(s.phase==='bases')ok=T.base(s,Math.floor(rng()*s.pending.length));
 else if(['effect','baseDraw'].includes(s.phase))ok=T.effect(s,rng);
 else if(s.phase==='freeze'){const ids=s.hands[1-s.turn].map((t,i)=>s.frozen[1-s.turn].includes(t.id)?-1:i).filter(i=>i>=0);ok=ids.length?T.select(s,pick(ids)):T.skip(s);}
 else if(s.phase==='resurrect'){const ids=s.discard.map((t,i)=>t.p===s.turn?i:-1).filter(i=>i>=0);ok=ids.length&&s.hands[s.turn].length<8?T.select(s,pick(ids)):T.skip(s);}
 else{const ids=T.targets(s);ok=ids.length?T.choose(s,pick(ids)):T.skip(s);}
 assert(ok,`${m.id} stuck ${s.phase}`);const all=[...s.hands.flat(),...s.decks.flat(),...s.discard,...Object.values(s.board).flat()];assert.equal(all.length,40);assert.equal(new Set(all.map(t=>t.id)).size,40);assert(s.hands.every(h=>h.length<=8));
 }assert.notEqual(s.winner,null,`${m.id} game timeout`);
}
console.log('PASS: 9 maps, targeted rules checks, 900 complete seeded games with tile conservation.');
