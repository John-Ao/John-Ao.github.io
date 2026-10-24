const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const M=require('./model.js');
const source=fs.readFileSync(__dirname+'/game.js','utf8');
const startTurn=source.slice(source.indexOf('function startTurn('),source.indexOf('function select('));
const context=vm.createContext({M,assert,performance:{now:()=>100},save(){},update(){},clock:{start(){}},newRun(){}});
vm.runInContext(`
const MANUAL_TURN_MS=230,QUEUED_TURN_MS=90,SCRAMBLE_TURN_MS=40;
let pieces=M.create(),animation=null,queue=[],selected=0,currentRun={status:'running'};
${startTurn}
startTurn(0,1);
animation.start=0;
const previousProgress=100/animation.duration;
startTurn(0,-1);startTurn(0,1);startTurn(0,1);
assert.equal(queue.length,3);
assert.equal(animation.duration,90);
assert.ok(Math.abs((100-animation.start)/animation.duration-previousProgress)<1e-9);
const executed=[];
while(animation){
 executed.push(animation.dir);
 assert.ok(M.turn(pieces,animation.axis,animation.dir));
 animation=null;
 if(queue.length)startTurn(...queue.shift());
}
assert.equal(executed.join(','),'1,-1,1,1');
const expected=M.fromMoves('irregular',[[0,1],[0,-1],[0,1],[0,1]]);
pieces.forEach((p,i)=>p.pose.forEach((v,j)=>assert.ok(Math.hypot(...M.sub(v,expected[i].pose[j]))<1e-6)));
startTurn(0,1);assert.equal(animation.duration,230);
`,context);
console.log('PASS: queued turns preserve order and count, acceleration preserves progress, isolated turns retain normal speed.');
