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
   }else if(order===2){
    const face=piece.faces.find(f=>f.color>=0),center=P.average(face.points);
    const normal=P.norm(P.cross(P.sub(face.points[1],face.points[0]),P.sub(face.points[2],face.points[0])));
    for(let axis=0;axis<8;axis++){
     const corner=config.axes[axis].map(Math.sign);if(Math.abs(P.dot(corner,normal)-1)>1e-5)continue;
     const point=center.map((x,i)=>x+.35*(corner[i]-x));
     check(pieces,order,piece,face,point,axis);
    }
   }
  }
 }
}
console.log('PASS skewb click targeting: '+checked+' checks; corner ownership, all four center regions, both signs, orders 2–7 and turned states');
// Check the whole center diamond, especially near its dividing lines.
// The four regions must be unchanged under any screen projection.
{
 const pieces=P.create('skewb',2),config=P.config('skewb',2);
 const projections=[
  p=>[p[0],p[1]],
  p=>[(p[0]-.7*p[2])/(4-p[0]-p[2]),(p[1]-.8*p[2])/(4-p[0]-p[2])],
  p=>[-p[2]*100,p[0]*.01+p[1]*100]
 ];
 let regions=0;
 for(let state=0;state<2;state++){
  if(state)P.turn(pieces,'skewb',2,5,0,-1);
  for(const piece of pieces){
   const faces=piece.faces.filter(f=>f.color>=0);if(faces.length!==1)continue;
   const face=faces[0],normal=P.norm(P.cross(P.sub(face.points[1],face.points[0]),P.sub(face.points[2],face.points[0])));
   const fixed=normal.findIndex(x=>Math.abs(x)>.9),u=(fixed+1)%3,v=(fixed+2)%3;
   const candidates=P.legalMoves(pieces,'skewb',2).filter(([a,l])=>P.selection(pieces,'skewb',2,a,l).includes(piece.id)).map(([axis,layer])=>({axis,layer}));
   for(const x of [-.6,-.1,-.001,.001,.1,.6])for(const y of [-.3,-.001,.001,.3]){
    const point=normal.slice();point[u]=x;point[v]=y;
    const expected=config.axes.findIndex(n=>Math.sign(n[fixed])===Math.sign(normal[fixed])&&Math.sign(n[u])===Math.sign(x)&&Math.sign(n[v])===Math.sign(y));
    for(const project of projections){
     context.project=project;
     const selected=context.skewbClickCandidates({piece,point,normal},candidates,config);
     assert(selected.length);assert(selected.every(c=>c.axis===expected),'center quadrant is fixed in face space');
     regions++;
    }
   }
  }
 }
 console.log('PASS center regions: '+regions+' checks near boundaries, multiple cameras, all six faces and turned states');
}
