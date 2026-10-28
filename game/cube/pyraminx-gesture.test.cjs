const assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),P=require('./polyhedra');
const context=vm.createContext({P,Math,puzzleType:'pyraminx',width:390,height:700,dirty:false,turnStep:()=>2*Math.PI/3});
vm.runInContext(fs.readFileSync(__dirname+'/types.js','utf8'),context);
let tips=0,layers=0;
for(const order of P.orders.pyraminx){
 const pieces=P.create('pyraminx',order),config=P.config('pyraminx',order);
 Object.assign(context,{order,pieces});
 for(let state=0;state<2;state++){
  if(state)for(const [axis,layer] of [[0,order-1],[1,0],[2,order-2]])P.turn(pieces,'pyraminx',order,axis,layer,1);
  const legal=P.legalMoves(pieces,'pyraminx',order).map(([axis,layer])=>({axis,layer,ids:P.selection(pieces,'pyraminx',order,axis,layer)}));
  for(const piece of pieces)for(const face of piece.faces.filter(f=>f.color>=0)){
   const normal=P.norm(P.cross(P.sub(face.points[1],face.points[0]),P.sub(face.points[2],face.points[0]))),point=P.average(face.points),hit={piece,normal,point};
   const candidates=legal.filter(c=>c.ids.includes(piece.id));
   const eligible=context.pyraminxClickCandidates(hit,candidates,config);
   const tip=piece.faces.some(f=>f.points.some(p=>Math.abs(Math.hypot(...p)-3)<1e-5));
   assert(eligible.length);
   if(tip){assert.equal(eligible.length,1);assert.equal(eligible[0].ids.length,1);}
   else {assert.equal(eligible.length,3);assert(eligible.every(c=>Math.abs(P.dot(config.axes[c.axis],normal))<.99));}
   const u=P.norm(P.sub(face.points[1],face.points[0])),v=P.cross(normal,u);
   for(const tilt of [0,.4,-.6]){
    context.project=p=>{const depth=8-P.dot(p,normal)-tilt*P.dot(p,u);return [195+100*P.dot(p,u)/depth,350-100*(P.dot(p,v)+tilt*P.dot(p,normal))/depth];};
    for(const candidate of eligible){
     const axis=config.axes[candidate.axis],direction=tip?P.cross(axis,point):P.cross(axis,normal);
     const a=context.project(point),b=context.project(point.map((x,i)=>x+direction[i]*.01)),delta=P.sub(b,a),len=Math.hypot(...delta);
     for(const sign of [-1,1]){
      const x=sign*delta[0]/len*80,y=sign*delta[1]/len*80;
      context.drag={hit,track:{x,y,xx:x*x,xy:x*y,yy:y*y}};
      vm.runInContext('updatePolyDrag()',context);
      assert.equal(context.drag.turn?.axis,candidate.axis,'swipe follows the projected layer cut');
      assert.equal(context.drag.turn.layer,candidate.layer);
      assert(Math.abs(context.drag.turn.angle)>0);
      if(tip)tips++;else layers++;
     }
    }
    if(tip)for(const [x,y] of [[80,0],[0,80],[-60,50]]){
     context.drag={hit,track:{x,y,xx:x*x,xy:x*y,yy:y*y}};
     vm.runInContext('updatePolyDrag()',context);
     assert.equal(context.drag.turn?.axis,eligible[0].axis,'any tip gesture keeps its own axis');
    }
   }
  }
 }
}
console.log(`PASS pyraminx gestures: ${tips} tip and ${layers} layer checks, orders 2–5, both directions, tilted views and turned states`);
