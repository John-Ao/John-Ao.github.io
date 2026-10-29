const assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const P=require('./polyhedra'),M=require('./model');
const source=fs.readFileSync(__dirname+'/game.js','utf8');
const cases=[];
for(const size of [[3,3,3],[2,3,4]])for(let axis=0;axis<3;axis++)cases.push({type:'cuboid',axis,layer:0,step:M.step(size,axis)});
for(const [type,orders] of Object.entries(P.orders))for(const order of orders.length?orders:[3]){
 for(let axis=0;axis<P.config(type,order).axes.length;axis++)for(let layer=0;layer<P.layerCount(type,order);layer++)cases.push({type,axis,layer,step:P.step(type,order,axis,layer)});
}
for(const {type,axis,layer,step} of cases){
let finished=[];
const ctx=vm.createContext({Math,puzzleType:type,turnStep:()=>step,performance:{now:()=>0},matchMedia:()=>({matches:false}),controls(){},finishTurn:a=>finished.push(a)});
vm.runInContext(source.slice(source.indexOf('function turnAnimationAngle'),source.indexOf('function finishTurn')),ctx);
for(const dir of P.turnAmounts(type).flatMap(n=>[-n,n])){
 ctx.animation=null;
 ctx.animateTurn(axis,layer,dir,dir*step,true,'manual',dir*.01);
 assert.equal(ctx.animation,null,'a completed gesture must not block the next turn');
 assert.equal(finished.at(-1).dir,dir);
 assert.equal(ctx.turnAnimationAngle({from:dir*step,to:dir*step,velocity:dir*.01,duration:400},.5),dir*step,'no residual movement at the target');
 ctx.animateTurn(axis,layer,dir,0);
 assert(Math.abs(ctx.animation.duration-180*Math.sqrt(Math.abs(dir)))<1e-9);
 ctx.animateTurn(axis,layer,dir,dir*step*.99,true,'manual',dir*.01);
 assert(ctx.animation.duration<20,'a nearly completed gesture should settle promptly');
 const a=ctx.animation;
 assert(Math.abs(ctx.turnAnimationAngle(a,1)-dir*step)<1e-9);
 ctx.animateTurn(axis,layer,dir,dir*step*.1,false);
 assert.equal(ctx.animation.to,0,'cancelled turns return to their origin');
}
assert.equal(finished.length,2*P.turnAmounts(type).length);
}
console.log(`PASS turn completion: ${cases.length} puzzle/order/axis/layer combinations, both directions, immediate at target, short residual animation and cancellation`);
