const assert=require('node:assert/strict');
const E=require('./engine.js');
assert.deepEqual([1,2,3,4,5].map(n=>E.pieces.filter(s=>s.length===n).length),[1,1,2,5,12]);
assert.equal(E.pieces.flat().length,89);
assert.equal(new Set(E.pieces.map(s=>E.variants(s).map(JSON.stringify).sort()[0])).size,21);
const g=E.create();assert.ok(E.reason(g,0,[[0,0]],1,1));assert.equal(E.reason(g,0,[[0,0]],0,0),'');
assert.ok(E.play(g,0,[[0,0]],0,0));assert.equal(g.turn,1);
assert.ok(E.reason(g,0,[[0,0]],1,0));assert.equal(E.reason(g,0,[[0,0]],1,1),'');assert.ok(E.reason(g,0,[[0,0]],0,0));assert.ok(E.reason(g,0,[[0,0]],-1,0));
assert.equal(E.play(g,0,[[0,0]],0,0),false);
assert.equal(E.reason(g,1,[[0,0]],19,0),'');
for(let c=0;c<4;c++){
  const [x,y]=E.corners[c];
  assert.deepEqual(E.candidates(E.create(),c,[[0,0]]),[{x,y,anchorX:x,anchorY:y}]);
}
const bent=E.normalize([[1,0],[0,1],[1,1]]);
assert.deepEqual(E.candidates(E.create(),2,bent),[{x:18,y:18,anchorX:19,anchorY:18}]);
assert.deepEqual(E.candidates(E.create(),0,bent),[]);
for(const shape of E.variants(bent)){
  const expected=[];
  for(let y=0;y<20;y++)for(let x=0;x<20;x++)if(!E.reason(g,0,shape,x,y))expected.push({x,y,anchorX:x+shape[0][0],anchorY:y+shape[0][1]});
  const dots=E.candidates(g,0,shape);
  assert.deepEqual(dots,expected);
  for(const dot of dots){
    assert.equal(g.board[dot.anchorY*20+dot.anchorX],-1);
    assert.equal(E.reason(g,0,shape,dot.anchorX-shape[0][0],dot.anchorY-shape[0][1]),'');
  }
}
const ended=E.create();ended.ended=true;assert.deepEqual(E.candidates(ended,0,[[0,0]]),[]);
const scores=E.create();assert.equal(E.score(scores,0),0);
assert.equal(E.score(g,0),1);assert.equal(E.score(g,1),0);
scores.board.fill(0,0,89);scores.board.fill(2,89,94);
assert.equal(E.score(scores,0),89);assert.equal(E.score(scores,2),5);
assert.equal(E.score(scores,0)+E.score(scores,2),94);
assert.deepEqual(E.playerScores(scores,2),[94,0]);
assert.deepEqual(E.playerScores(scores,4),[89,0,5,0]);
scores.last[0]=0;assert.equal(E.score(scores,0),89);
scores.last[0]=1;assert.equal(E.score(scores,0),89);
// Full legal games exercise all orientations, automatic passes and final scoring.
for(let run=0;run<3;run++){const s=E.create();let count=0;while(!s.ended){let m;for(let id=(count*7+run*3)%21,k=0;k<21;k++,id=(id+1)%21){m=E.find(s,s.turn,id);if(m)break;}assert.ok(m);assert.ok(E.play(s,m.id,m.s,m.x,m.y));assert.ok(++count<=84);}assert.ok([0,1,2,3].every(c=>!E.find(s,c)));assert.equal(s.board.filter(c=>c>=0).length,s.used.flat().reduce((n,id)=>n+E.pieces[id].length,0));for(let c=0;c<4;c++)assert.equal(E.score(s,c),s.used[c].reduce((n,id)=>n+E.pieces[id].length,0));const replay=E.create();for(const m of s.history)assert.ok(E.play(replay,m.id,m.s,m.x,m.y));assert.deepEqual(replay,s);console.log(`Game ${run+1}: ${count} placements, scores ${[0,1,2,3].map(c=>E.score(s,c)).join(', ')}`);}
console.log('All rule checks passed.');
