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
