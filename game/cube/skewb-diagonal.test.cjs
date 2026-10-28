const assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),P=require('./polyhedra');
const context=vm.createContext({P,Math,puzzleType:'skewb',width:390,height:700,dirty:false,turnStep:()=>2*Math.PI/3});
vm.runInContext(fs.readFileSync(__dirname+'/types.js','utf8'),context);
const dragCode=fs.readFileSync(__dirname+'/game.js','utf8');vm.runInContext(dragCode.slice(dragCode.indexOf('function dragRadiansPerPixel'),dragCode.indexOf('function releaseVelocity')),context);
let checks=0;
for(const order of [3,4,5,6,7]){
 const pieces=P.create('skewb',order),config=P.config('skewb',order);Object.assign(context,{pieces,order});let diagonals=0;
 for(let state=0;state<2;state++){
  if(state)P.turn(pieces,'skewb',order,0,1,1);
  const legal=P.legalMoves(pieces,'skewb',order).map(([axis,layer])=>({axis,layer,ids:P.selection(pieces,'skewb',order,axis,layer)}));
  for(const piece of pieces){
   const faces=piece.faces.filter(f=>f.color>=0);if(faces.length!==1)continue;
   const face=faces[0],point=P.average(face.points),normal=P.norm(P.cross(P.sub(face.points[1],face.points[0]),P.sub(face.points[2],face.points[0]))),hit={piece,point,normal};
   const candidates=legal.filter(c=>c.ids.includes(piece.id)).map(c=>({...c,count:c.ids.length}));
   const eligible=context.skewbClickCandidates(hit,candidates,config);
   if(!eligible.some(c=>c.gesturePoint))continue;
   assert.equal(eligible.length,3);assert.equal(eligible.filter(c=>c.layer>0).length,1);diagonals++;
   const u=P.norm(P.sub(face.points[1],point)),v=P.cross(normal,u);
   for(const tilt of [0,.4,-.4]){
    context.project=p=>{const d=6-tilt*P.dot(p,u)-.2*P.dot(p,v);return [195+500*P.dot(p,u)/d,350-500*P.dot(p,v)/d];};
    const rays=eligible.flatMap(c=>{
     const a=context.project(P.rotate(point,config.axes[c.axis],-1e-4)),b=context.project(P.rotate(point,config.axes[c.axis],1e-4)),dx=b[0]-a[0],dy=b[1]-a[1],length=Math.hypot(dx,dy);
     return [-1,1].map(sign=>({axis:c.axis,layer:c.layer,sign,x:sign*dx/length,y:sign*dy/length}));
    });
    // Test every sector at its tangent, and between the tangent and each boundary.
    for(const ray of rays){
     const angle=Math.atan2(ray.y,ray.x),wrap=x=>Math.atan2(Math.sin(x),Math.cos(x));
     const offsets=rays.filter(r=>r!==ray).map(r=>wrap(Math.atan2(r.y,r.x)-angle));
     const left=Math.max(...offsets.filter(x=>x<0))/2,right=Math.min(...offsets.filter(x=>x>0))/2;
     for(const offset of [left*.8,0,right*.8])for(const start of [point,...face.points.map(p=>p.map((x,i)=>.7*x+.3*point[i]))]){
      context.drag={hit:{...hit,point:start},polyCandidates:candidates,track:{x:100*Math.cos(angle+offset),y:100*Math.sin(angle+offset)}};
      vm.runInContext('updatePolyDrag()',context);
      assert.equal(context.drag.turn.axis,ray.axis);assert.equal(context.drag.turn.layer,ray.layer);assert.equal(Math.sign(context.drag.turn.angle),ray.sign);checks++;
     }
    }
   }
  }
 }
 assert(diagonals>0);console.log(`PASS skewb ${order}: ${diagonals} diagonal pieces in solved/turned states, all six sectors`);
}
console.log(`PASS ${checks} diagonal checks: axis, layer, sign, angular boundaries, translated starts and perspective`);
