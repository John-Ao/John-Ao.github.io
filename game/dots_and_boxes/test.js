const assert=require('node:assert/strict');
const fs=require('node:fs');const vm=require('node:vm');const G=require('./game.js')();
const b=G.board(1,2),s=G.initial(b);
// Leave just the shared central edge: completing it awards two boxes at once.
for(const e of [0,1,2,3,4,6])G.play(b,s,e);
const before=G.clone(s),p=s.turn;assert.equal(G.play(b,s,5),2);assert.equal(s.scores[p-1],2);assert.equal(s.turn,p);assert.equal(s.left,0);
assert.deepEqual(G.replay(b,[0,1,2,3,4,6]),before);assert.throws(()=>G.play(b,s,5));
const single=G.board(1,1),one=G.replay(single,[0,1,2,3]);assert.deepEqual(one.scores,[0,1]);
const chain=G.replay(b,[0,1,2,4,6]);const turn=chain.turn;assert.equal(G.play(b,chain,5),1);assert.equal(chain.turn,turn);assert.equal(G.play(b,chain,3),1);
const encoded=encodeURIComponent(JSON.stringify({v:1,r:1,c:2,m:[0,1,2,4,6]}));assert.deepEqual(G.replay(b,JSON.parse(decodeURIComponent(encoded)).m),G.replay(b,[0,1,2,4,6]));
let message;const scheduled=new Set();const context={createDotsGame:require('./game.js'),postMessage:m=>message=m,performance,Math,setTimeout:fn=>{scheduled.add(fn);return fn;},clearTimeout:fn=>scheduled.delete(fn),Map};vm.createContext(context);vm.runInContext(fs.readFileSync(__dirname+'/ai-worker.js','utf8')+'\ndotsWorkerMain();',context);
function analyzeExact(data){
 context.onmessage(data);let batches=0;
 while(!message.done&&scheduled.size&&batches++<500){const fn=scheduled.values().next().value;scheduled.delete(fn);fn();}
 assert(message.done,'exact analysis should finish within the test budget');
}

analyzeExact({data:{rows:1,cols:1,moves:[]}});assert.equal(message.done,true);assert.equal(message.results.length,4);assert(message.results.every(r=>r.exact&&r.rate===0&&r.margin===-1));
analyzeExact({data:{rows:1,cols:2,moves:[0,1,2,3,4,6]}});assert.equal(message.results[0].rate,1);assert.equal(message.results[0].margin,2);
console.log('Passed: double capture, extra turn, replay/undo, URL serialization, invalid move, exact AI perspective.');
let sample;const simulation={createDotsGame:require('./game.js'),postMessage:m=>sample=m,performance,Math,setTimeout:()=>{},clearTimeout,Map};vm.createContext(simulation);vm.runInContext(fs.readFileSync(__dirname+'/ai-worker.js','utf8')+'\ndotsWorkerMain();',simulation);simulation.onmessage({data:{rows:3,cols:3,moves:[]}});assert(sample.total>0);assert(sample.results.every(r=>r.n>0&&r.rate>=0&&r.rate<=1));console.log('Passed: MCTS batch produces valid visit counts and estimates.');
// Rectangles have four symmetries; squares have eight. Every map is a
// permutation preserving box boundaries, and move orbits partition legal edges.
for(const [r,c] of [[1,1],[2,3],[3,3]]){
 const board=G.board(r,c);assert.equal(board.symmetries.length,r===c?8:4);
 const boxes=new Set(board.boxes.map(ids=>ids.slice().sort((a,b)=>a-b).join(',')));
 for(const map of board.symmetries){assert.equal(new Set(map).size,board.edges.length);for(const ids of board.boxes)assert(boxes.has(ids.map(i=>map[i]).sort((a,b)=>a-b).join(',')));}
 const state=G.replay(board,[0,2]);const groups=G.moveGroups(board,state).flat();assert.deepEqual(groups.sort((a,b)=>a-b),G.legal(state));
 for(const map of board.symmetries){const transformed=G.initial(board);state.edges.forEach((v,i)=>transformed.edges[map[i]]=v);assert.equal(G.canonical(board,state),G.canonical(board,transformed));}
}
const square=G.board(3,3);assert.equal(G.moveGroups(square,G.initial(square)).length,4);
for(const group of G.moveGroups(square,G.initial(square))){const entries=sample.results.filter(r=>group.includes(r.edge));if(entries.length){assert.equal(entries.length,group.length);assert(entries.every(r=>r.n===entries[0].n&&r.rate===entries[0].rate));}}
// Compare symmetry-pruned exact analysis with an independent full minimax.
function brute(board,state,player){if(!state.left)return state.scores[player-1]-state.scores[2-player];const values=G.legal(state).map(e=>{const next=G.clone(state);G.play(board,next,e);return brute(board,next,player);});return state.turn===player?Math.max(...values):Math.min(...values);}
for(const history of [[0,1,2,3,4],[1,4,6,8,10],[0,2,5,7,11]]){
 const board=G.board(2,2),state=G.replay(board,history);analyzeExact({data:{rows:2,cols:2,moves:history}});
 for(const result of message.results){const next=G.clone(state);G.play(board,next,result.edge);assert.equal(result.margin,brute(board,next,state.turn));}
}
console.log('Passed: geometric symmetries, legal move orbits, shared MCTS statistics, exact results versus unpruned minimax.');
// Exhaust every 2x2 occupancy against an independent score-difference DP.
const tiny=G.board(2,2),memo=new Map();
function future(mask){if(mask===4095)return 0;if(memo.has(mask))return memo.get(mask);let best=-Infinity;
 for(let e=0;e<12;e++)if(!(mask&(1<<e))){const next=mask|(1<<e);let gain=0;for(const box of tiny.adjacent[e])if(tiny.boxes[box].every(i=>next&(1<<i)))gain++;best=Math.max(best,gain?gain+future(next):-future(next));}
 memo.set(mask,best);return best;
}
let solvedCount=0;
for(let mask=0;mask<4096;mask++){
 const state=G.initial(tiny);state.edges.forEach((_,i)=>state.edges[i]=mask&(1<<i)?1:0);state.left=G.legal(state).length;
 tiny.boxes.forEach((ids,i)=>{if(ids.every(e=>state.edges[e])){state.boxes[i]=1;state.scores[0]++;}});
 const margin=G.endgameMargin(tiny,state);if(margin!==null){solvedCount++;assert.equal(margin-state.scores[0],future(mask),`mask ${mask}`);}
}
assert(solvedCount>100);
// Two independent four-chains: hand out the last two to take the next four.
const chains=G.board(2,4),chainState=G.replay(chains,Array.from({length:12},(_,i)=>i));
assert.equal(G.endgameInfo(chains,chainState).margin,-4);
G.play(chains,chainState,12);G.play(chains,chainState,13);G.play(chains,chainState,14);
assert.equal(G.endgameInfo(chains,chainState).keep,true);
const cp=G.policy(chains,chainState);assert.equal(cp.reduce((a,z)=>a.weight>z.weight?a:z).edge,16);
// A four-loop plus a six-chain: opening the loop should trigger a four-box handout.
const mixed=G.board(2,5),keep=new Set();
// Exact geometry: 4-loop edges (5,6,16,22); 6-chain internal edges
// top x=3,4, bottom x=3,4, middle horizontal x=4; endpoints top/bottom x=2.
[5,6,16,22,18,19,24,25,9,2,12].forEach(e=>keep.add(e));
const mixedState=G.replay(mixed,mixed.edges.map((_,i)=>i).filter(i=>!keep.has(i)));
assert.deepEqual(G.components(mixed,mixedState).map(c=>[c.type,c.length]).sort(),[['chain',6],['loop',4]]);
G.play(mixed,mixedState,5);const info=G.endgameInfo(mixed,mixedState);assert.equal(info.keep,true);assert.equal(info.k,4);
const lp=G.policy(mixed,mixedState);assert.equal(lp.reduce((a,z)=>a.weight>z.weight?a:z).edge,6);
assert.equal(G.componentValue([{type:'chain',length:3},{type:'chain',length:3}]),2);
assert.equal(G.componentValue(Array.from({length:5},()=>({type:'chain',length:3}))),1);
console.log(`Passed: ${solvedCount} exact endgames versus exhaustive 2x2 DP, leave-two, leave-four, short-chain control exceptions.`);

const wide=G.board(2,6),history=Array.from({length:18},(_,i)=>i);
analyzeExact({data:{rows:2,cols:6,moves:history}});
assert(message.done&&message.results.every(r=>r.exact));
assert.equal(message.results.length,14);assert(message.results.every(r=>r.margin===-8));
console.log('Passed: structural exact solving with more than 11 remaining edges.');

for(const r of sample.results){
 assert(Number.isFinite(r.margin));assert(Math.abs(r.margin)<=9);
 // On a nine-box board, every terminal result is odd and nonzero.
 assert(r.margin>=10*r.rate-9-1e-9&&r.margin<=10*r.rate-1+1e-9);
}
for(const group of G.moveGroups(square,G.initial(square))){
 const entries=sample.results.filter(r=>group.includes(r.edge));
 if(entries.length)assert(entries.every(r=>r.margin===entries[0].margin));
}
console.log('Passed: MCTS mean final margin, winrate consistency, and symmetry-shared margins.');
// A deterministic scheduler verifies resumable proofs, monotone bounds, pause,
// cache reuse across turns, and request IDs without waiting for wall-clock timers.
let tick=0;const queue=new Set(),frames=[];
const progressive={createDotsGame:require('./game.js'),postMessage:m=>frames.push(m),performance:{now:()=>tick+=3},Math,Map,
 setTimeout:fn=>{queue.add(fn);return fn;},clearTimeout:fn=>queue.delete(fn)};
vm.createContext(progressive);vm.runInContext(fs.readFileSync(__dirname+'/ai-worker.js','utf8')+'\ndotsWorkerMain();',progressive);
function pumpUntilDone(){let batches=0;while(!frames.at(-1).done&&queue.size&&batches++<4000){const fn=queue.values().next().value;queue.delete(fn);fn();}assert(frames.at(-1).done,'progressive proof converges');}
progressive.onmessage({data:{id:41,rows:2,cols:2,moves:[]}});
assert(frames[0].proofVisits>0,'proof search also runs with more than 11 empty edges');
pumpUntilDone();const historyFrames=frames.slice();assert(historyFrames.length>1);
const previous=new Map();
for(const frame of historyFrames){
 assert.equal(frame.id,41);
 for(const r of frame.results){
  const old=previous.get(r.edge);
  if(old){assert(r.lower>=old.lower&&r.upper<=old.upper);if(old.exact){assert(r.exact);assert.equal(r.margin,old.margin);assert.equal(r.visits,old.visits);}if(old.outcomeProven){assert(r.outcomeProven);assert.equal(r.rate,old.rate);}}
  previous.set(r.edge,r);
  assert(r.lower<=-future(1<<r.edge)&&r.upper>=-future(1<<r.edge));
 }
}
assert(historyFrames.some(f=>f.provenCount>0&&!f.done),'publish partial proofs');
assert(frames.at(-1).results.every(r=>r.margin===-future(1<<r.edge)));
const doneVisits=frames.at(-1).proofVisits;
progressive.onmessage({data:{id:42,rows:2,cols:2,moves:[]}});
assert(frames.at(-1).done);assert(frames.at(-1).proofVisits<doneVisits,'reuse proofs on the same position');
progressive.onmessage({data:{id:43,rows:2,cols:2,moves:[0]}});pumpUntilDone();
for(const r of frames.at(-1).results)assert.equal(r.margin,-future(1|(1<<r.edge)));
progressive.onmessage({data:{id:44,rows:3,cols:3,moves:[]}});assert(queue.size>0);
progressive.onmessage({data:{type:'pause'}});assert.equal(queue.size,0);
progressive.onmessage({data:{id:45,rows:1,cols:1,moves:[]}});pumpUntilDone();
assert.equal(frames.at(-1).id,45);assert(frames.at(-1).results.every(r=>r.margin===-1));
console.log('Passed: progressive proofs, sound monotone bounds, solved-branch stopping, cache reuse, turn changes, pause, and board changes.');
// Threshold proofs must remain sound after captures, turn changes and draws.
const rectangle=G.board(2,3),fullMask=(1<<rectangle.edges.length)-1,rectMemo=new Map();
function rectFuture(mask){if(mask===fullMask)return 0;if(rectMemo.has(mask))return rectMemo.get(mask);let best=-Infinity;
 for(let edge=0;edge<rectangle.edges.length;edge++)if(!(mask&(1<<edge))){const next=mask|(1<<edge),gain=rectangle.adjacent[edge].filter(i=>rectangle.boxes[i].every(e=>next&(1<<e))).length;best=Math.max(best,gain?gain+rectFuture(next):-rectFuture(next));}
 rectMemo.set(mask,best);return best;
}
for(const moves of [[0,1,2,3,4,5,6,7],[0,3,9,10,1,4,11,2],[16,15,14,13,12,11,10,9]]){
 const position=G.replay(rectangle,moves),start=frames.length;
 progressive.onmessage({data:{id:50,rows:2,cols:3,moves}});pumpUntilDone();
 for(const frame of frames.slice(start))for(const r of frame.results){
  const next=G.clone(position);G.play(rectangle,next,r.edge);
  const mask=next.edges.reduce((m,v,i)=>v?m|(1<<i):m,0),f=rectFuture(mask);
  const actual=next.scores[position.turn-1]-next.scores[2-position.turn]+(next.turn===position.turn?f:-f);
  assert(r.lower<=actual&&r.upper>=actual);
  if(r.outcomeProven)assert.equal(r.rate,actual>0?1:actual<0?0:.5);
  if(r.exact)assert.equal(r.margin,actual);
 }
}
assert(historyFrames.at(-1).outcomeSteps>0);
console.log('Passed: outcome-first threshold proofs versus independent rectangular-board minimax.');
