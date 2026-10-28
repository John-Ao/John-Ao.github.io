const assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),P=require('./polyhedra');
const context=vm.createContext({P,Math,puzzleType:'skewb',width:390,height:700,dirty:false,turnStep:()=>2*Math.PI/3});
vm.runInContext(fs.readFileSync(__dirname+'/types.js','utf8'),context);
let checked=0;
function check(pieces,order,piece,face,point,expected){
 const normal=P.norm(P.cross(P.sub(face.points[1],face.points[0]),P.sub(face.points[2],face.points[0])));
 const coordinate=normal.findIndex(x=>Math.abs(x)>.9),u=(coordinate+1)%3,v=(coordinate+2)%3;
 context.project=p=>[195+p[u]*100,350-p[v]*100];
 context.order=order;context.pieces=pieces;
 const axis=P.config('skewb',order).axes[expected];
 const a=context.project(P.rotate(point,axis,-1e-4)),b=context.project(P.rotate(point,axis,1e-4));
 const delta=b.map((x,i)=>x-a[i]),length=Math.hypot(...delta);if(length<1e-7)return;
 for(const sign of [-1,1]){
  context.drag={hit:{piece,point,normal},track:{x:sign*delta[0]/length*80,y:sign*delta[1]/length*80}};
  vm.runInContext('updatePolyDrag()',context);
  const turn=context.drag.turn;
  assert(turn);assert.equal(turn.axis,expected,'click position determines the corner axis');
  assert.equal(Math.sign(turn.angle),sign);
  const count=P.selection(pieces,'skewb',order,turn.axis,turn.layer).length;
  for(let layer=0;layer<order-1;layer++){
   const ids=P.selection(pieces,'skewb',order,expected,layer);
   if(ids?.includes(piece.id))assert(count<=ids.length);
  }
  // Changing the gesture must not select another corner.
  context.drag.track={x:67,y:-51};vm.runInContext('updatePolyDrag()',context);
  assert.equal(context.drag.turn.axis,expected);checked++;
 }
}
for(const order of P.orders.skewb){
 const pieces=P.create('skewb',order),config=P.config('skewb',order);
 for(let state=0;state<2;state++){
  if(state)P.turn(pieces,'skewb',order,6,0,1);
  for(const piece of pieces){
   const corner=piece.faces.flatMap(f=>f.points).find(p=>p.every(x=>Math.abs(Math.abs(x)-1)<1e-5));
   if(corner){
    const axis=config.axes.findIndex(n=>n.every((x,i)=>Math.sign(x)===Math.sign(corner[i])));
    for(const face of piece.faces.filter(f=>f.color>=0))check(pieces,order,piece,face,P.average(face.points),axis);
   }
  }
 }
}
console.log('PASS skewb corners: '+checked+' checks, both signs, orders 2–7 and turned states');
// Eight sectors select a perpendicular axis and its rotation sign.
{
 const pieces=P.create('skewb',2),config=P.config('skewb',2);let checked=0;
 Object.assign(context,{order:2,pieces});
 for(let state=0;state<2;state++){
  if(state)P.turn(pieces,'skewb',2,5,0,-1);
  for(const piece of pieces){
   const faces=piece.faces.filter(f=>f.color>=0);if(faces.length!==1)continue;
   const face=faces[0],normal=P.norm(P.cross(P.sub(face.points[1],face.points[0]),P.sub(face.points[2],face.points[0])));
   const fixed=normal.findIndex(x=>Math.abs(x)>.9),u=(fixed+1)%3,v=(fixed+2)%3;
   for(const tilt of [0,.5,-.5]){
    context.project=p=>{const d=5-tilt*p[u]-.3*p[v];return [195+400*(p[u]+.2*p[v])/d,350-400*(p[v]-.1*p[u])/d];};
    for(let axis=0;axis<8;axis++){
     const vertex=config.axes[axis].map(Math.sign);if(P.dot(vertex,normal)<.9)continue;
     const radial=P.norm(P.sub(vertex,normal)),tangent=P.norm(P.cross(config.axes[axis],normal));
     for(const sign of [-1,1])for(const ratio of [.1,.41421356237,.9]){
      // The 0.414 ratio is 22.5 degrees from the perpendicular: sectors 2–3 / 7–8.
      const end=normal.map((x,i)=>x+.4*(ratio*radial[i]+sign*tangent[i]));
      const a=context.project(normal),b=context.project(end),track={x:b[0]-a[0],y:b[1]-a[1]};
      for(const x of [-.3,0,.3])for(const y of [-.3,0,.3]){
       const point=normal.slice();point[u]=x;point[v]=y;
       context.drag={hit:{piece,point,normal},track};vm.runInContext('updatePolyDrag()',context);
       assert.equal(context.drag.turn?.axis,axis,'perpendicular sector selects the same axis at every start point');
       assert.equal(Math.sign(context.drag.turn.angle),sign,'both perpendicular sectors use opposite rotation signs');checked++;
      }
     }
    }
   }
  }
 }
 console.log('PASS center perpendicular sectors: '+checked+' axis/sign checks, all eight sectors, translated starts, perspective and turned states');
}
