const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const source = fs.readFileSync(__dirname + '/game.js', 'utf8');
const rules = source.slice(source.indexOf('function pathToBlank'), source.indexOf('function report'));
const shuffle = source.slice(source.indexOf('function newRound'), source.indexOf("$('#shuffle').onclick"));
const context = vm.createContext({assert, Math});
vm.runInContext(`let rows,cols,beads,moves,moved;let clock={};function freezeClock(){}function renderTimer(){}function stopDrag(){}function resetClock(){}function report(){}function save(){}function draw(){}${rules}${shuffle}
for(const [r,c] of [[2,2],[2,3],[3,3],[4,4]]){
 rows=r;cols=c;newRound(false);assert(solved());
 const initial=beads.join(',');turn(rows*cols-cols);assert.equal(beads.indexOf(0),rows*cols-cols);turn(rows*cols-1);assert.equal(beads.join(','),initial);
 assert.equal(pathToBlank(0).length,0);
 for(let n=0;n<100;n++){
  newRound(true);assert(!solved());assert.equal(new Set(beads).size,rows*cols);
  // Every shuffle step uses a legal adjacent move, so the resulting state is reachable.
  const blank=beads.indexOf(0),neighbor=beads.findIndex((_,i)=>pathToBlank(i).length===1),before=beads.join(',');turn(neighbor);turn(blank);assert.equal(beads.join(','),before);
 }
}
`, context);
console.log('Passed: four sizes, row chains, invalid moves, 400 shuffles, reversible moves');

const timing = source.slice(source.indexOf('function move(index)'), source.indexOf('function validConfig'));
vm.runInNewContext(`
 let clock={enabled:true,phase:'finished',elapsed:12345},runningSince=null;
 let mode='slide',moved=true,moves=0,isSolved=false;
 function timerPaused(){return false;}function pathToBlank(){return [0];}
 function turn(){}function solved(){return isSolved;}function renderTimer(){}
 function freezeClock(){runningSince=null;}function report(){}function draw(){}function save(){}
 ${timing}
 move(0);assert.equal(clock.phase,'finished');assert.equal(clock.elapsed,12345);assert.equal(runningSince,null);
 isSolved=true;move(0);assert.equal(clock.elapsed,12345);assert.equal(clock.phase,'finished');
 resetClock();assert.equal(clock.elapsed,0);assert.equal(clock.phase,'ready');
 isSolved=false;move(0);assert.equal(clock.phase,'running');assert.notEqual(runningSince,null);
 isSolved=true;move(0);assert.equal(clock.phase,'finished');assert.equal(runningSince,null);
`,{assert,Date});
console.log('Passed: finished timer stays frozen across manual moves; explicit reset starts a new timed round');

vm.runInNewContext(`
 let rows=3,cols=3,beads=[1,2,3,4,5,6,7,8,0],moves=0,moved=false;
 let mode='click',clock={enabled:false},runningSince=null;
 function timerPaused(){return false;}function renderTimer(){}function freezeClock(){}
 function report(){}function draw(){}function save(){}
 ${rules}${timing}
 move(6);assert.equal(beads.join(','),'1,2,3,4,5,6,0,7,8');assert.equal(moves,1);
 move(0);assert.equal(beads.join(','),'0,2,3,1,5,6,4,7,8');assert.equal(moves,2);
 move(4);move(0);assert.equal(beads.join(','),'0,2,3,1,5,6,4,7,8');assert.equal(moves,2);
 move(6);move(8);assert.equal(beads.join(','),'1,2,3,4,5,6,7,8,0');assert.equal(moves,4);
`,{assert,Date});
console.log('Passed: click mode moves row/column chains in both directions, counts one step, rejects invalid cells');

const commitSlide = source.slice(source.indexOf('function commitSlide()'), source.indexOf("board.addEventListener('pointerdown'"));
for (const axis of ['x', 'y']) for (const sign of [-1, 1]) for (const progress of [40, 100]) {
 const property = axis === 'x' ? 'left' : 'top';
 const tiles = [200, 300].map(position => ({style: {left: position + 'px', top: position + 'px', transform: `translate${axis.toUpperCase()}(${progress * sign}px)`}}));
 let dragging = true, flushed = false, committed = false;
 vm.runInNewContext(`${commitSlide}commitSlide();`, {
  drag: {index: 2, axis, progress, sign, tiles},
  board: {get offsetWidth() {
   assert(dragging, 'release position must be applied without a transition');
   tiles.forEach((tile, i) => {
    assert.equal(parseFloat(tile.style[property]), 200 + i * 100 + progress * sign);
    assert.equal(tile.style.transform, '');
   });
   flushed = true;
   return 500;
  }},
  stopDrag() {assert(flushed);dragging = false;},
  move(index) {
   assert.equal(index, 2);assert(!dragging);
   tiles.forEach((tile, i) => {
    const destination = 200 + i * 100 + 100 * sign;
    assert.equal(destination - parseFloat(tile.style[property]), (100 - progress) * sign || 0,
     'only the remaining distance should animate; a fully dragged tile must stay in place');
   });
   committed = true;
  }
 });
 assert(committed);
}
console.log('Passed: horizontal/vertical chain release continuity in both directions, partial and full drags');
