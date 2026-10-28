const assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),P=require('./polyhedra');
const context=vm.createContext({P,Math,puzzleType:'megaminx',width:390,height:700,dirty:false,turnStep:()=>2*Math.PI/5});
vm.runInContext(fs.readFileSync(__dirname+'/types.js','utf8'),context);
const dragCode=fs.readFileSync(__dirname+'/game.js','utf8');vm.runInContext(dragCode.slice(dragCode.indexOf('function dragRadiansPerPixel'),dragCode.indexOf('function releaseVelocity')),context);
let checks=0,middleChecks=0;
for(const order of P.orders.megaminx){
 const pieces=P.create('megaminx',order),config=P.config('megaminx',order);
 Object.assign(context,{order,pieces});
 for(let state=0;state<2;state++){
  if(state)for(const axis of [0,2,5])P.turn(pieces,'megaminx',order,axis,0,1);
  const legal=P.legalMoves(pieces,'megaminx',order).map(([axis,layer])=>({axis,layer,ids:P.selection(pieces,'megaminx',order,axis,layer)}));
  for(const piece of pieces)for(const face of piece.faces.filter(f=>f.color>=0)){
   const normal=P.norm(P.cross(P.sub(face.points[1],face.points[0]),P.sub(face.points[2],face.points[0]))),point=P.average(face.points),hit={piece,normal,point};
   const candidates=legal.filter(c=>c.ids.includes(piece.id)).map(c=>({...c,count:c.ids.length}));
   const eligible=context.megaminxClickCandidates(hit,candidates,config);
   assert(eligible.every(c=>c.layer<config.cuts.length));
   assert(eligible.every(c=>Math.abs(P.dot(config.axes[c.axis],normal))<.99));
   const u=P.norm(P.sub(face.points[1],face.points[0])),v=P.cross(normal,u);
   for(const tilt of [0,.4,-.6]){
    context.project=p=>{const depth=8-P.dot(p,normal)-tilt*P.dot(p,u);return [195+100*P.dot(p,u)/depth,350-100*(P.dot(p,v)+tilt*P.dot(p,normal))/depth];};
    for(const candidate of eligible){
     const axis=config.axes[candidate.axis],direction=P.cross(axis,normal),a=context.project(point),b=context.project(point.map((x,i)=>x+direction[i]*.01)),delta=P.sub(b,a),len=Math.hypot(...delta);
     for(const sign of [-1,1]){
      const x=sign*delta[0]/len*80,y=sign*delta[1]/len*80;
      context.drag={hit,polyCandidates:candidates,track:{x,y,xx:x*x,xy:x*y,yy:y*y}};
      vm.runInContext('updatePolyDrag()',context);
      assert(context.drag.turn);
      assert(Math.abs(P.dot(config.axes[context.drag.turn.axis],normal))<.99);
      assert(Math.abs(P.dot(config.axes[context.drag.turn.axis],axis))>1-1e-6,'swipe follows the layer cut');
      assert(Math.abs(context.drag.turn.angle)>0);
      const selected=legal.find(c=>c.axis===context.drag.turn.axis&&c.layer===context.drag.turn.layer).ids;
      assert.deepEqual(selected.slice().sort((a,b)=>a-b),candidate.ids.slice().sort((a,b)=>a-b),'gesture selects this slice alone');
      if(candidate.layer>0)middleChecks++;
      checks++;
     }
    }
   }
  }
 }
}
assert(middleChecks>0);
console.log('PASS megaminx: '+checks+' layer gestures, all stickers, orders 2–7, both directions, tilted views and turned states');
