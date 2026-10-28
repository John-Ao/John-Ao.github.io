const assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),P=require('./polyhedra');
const context=vm.createContext({P,Math,puzzleType:'skewb',width:390,height:700,dirty:false,turnStep:()=>2*Math.PI/3});
vm.runInContext(fs.readFileSync(__dirname+'/types.js','utf8'),context);
for(const order of [3,4,5,6,7]){
 let directionChanges=0;
 const pieces=P.create('skewb',order),config=P.config('skewb',order),cuts=config.cuts.slice().sort((a,b)=>a-b);
 Object.assign(context,{order,pieces});
 for(let axis=0;axis<8;axis++)for(let slice=0;slice<order-2;slice++){
  const layer=config.cuts.length+slice,ids=P.selection(pieces,'skewb',order,axis,layer);
  assert(ids?.length);
  const expected=pieces.filter(p=>{const h=P.dot(P.average(p.faces.flatMap(f=>f.points)),config.axes[axis]);return h>cuts[slice]&&h<cuts[slice+1];}).map(p=>p.id);
  assert.deepEqual(ids,expected,'select only the region between consecutive cuts');
  const copy=structuredClone(pieces);
  P.turn(copy,'skewb',order,axis,layer,1);
  copy.forEach((p,i)=>{if(!ids.includes(p.id))assert.deepEqual(p,pieces[i],'both outer regions remain stationary');});
  P.turn(copy,'skewb',order,axis,layer,-1);assert(P.solved(copy,'skewb',order));
 }
 // Exercise actual gesture selection on all visible stickers, before and after turns.
 for(let state=0;state<2;state++){
  if(state)P.turn(pieces,'skewb',order,0,config.cuts.length,1);
  const legal=P.legalMoves(pieces,'skewb',order).map(([axis,layer])=>({axis,layer,ids:P.selection(pieces,'skewb',order,axis,layer)})),reached=new Set();
  for(const piece of pieces)for(const face of piece.faces.filter(f=>f.color>=0)){
   const center=P.average(face.points),normal=P.norm(P.cross(P.sub(face.points[1],face.points[0]),P.sub(face.points[2],face.points[0])));
   const u=P.norm(P.sub(face.points[1],face.points[0])),v=P.cross(normal,u);
   context.project=p=>[195+100*P.dot(p,u),350-100*P.dot(p,v)];
   for(const point of [center,...face.points.map(p=>p.map((x,i)=>.8*x+.2*center[i]))]){
    const hit={piece,normal,point},eligible=context.skewbClickCandidates(hit,legal.filter(c=>c.ids.includes(piece.id)),config);
    const inner=eligible.filter(c=>c.layer>=config.cuts.length);
    if(inner.length)assert.deepEqual(Array.from(eligible,c=>[c.axis,c.layer]),Array.from(context.skewbClickCandidates({...hit,point:center},legal.filter(c=>c.ids.includes(piece.id)),config),c=>[c.axis,c.layer]),'click position does not choose the inner axis');
    const chosen=new Set();
    context.drag={hit,polyCandidates:legal.filter(c=>c.ids.includes(piece.id)).map(c=>({...c,count:c.ids.length}))};
    for(const candidate of inner){
     const a=context.project(P.rotate(candidate.gesturePoint||point,config.axes[candidate.axis],-1e-4)),b=context.project(P.rotate(candidate.gesturePoint||point,config.axes[candidate.axis],1e-4));
     const dx=b[0]-a[0],dy=b[1]-a[1],length=Math.hypot(dx,dy);if(length<1e-7)continue;
     // A projection can make two axes indistinguishable at a particular point.
     if(inner.some(other=>{
      if(other.axis===candidate.axis)return false;
      const oa=context.project(P.rotate(other.gesturePoint||point,config.axes[other.axis],-1e-4)),ob=context.project(P.rotate(other.gesturePoint||point,config.axes[other.axis],1e-4));
      const ox=ob[0]-oa[0],oy=ob[1]-oa[1];
      return Math.abs((dx*ox+dy*oy)/(length*Math.hypot(ox,oy)))>1-1e-6;
     }))continue;
     for(const sign of [-1,1]){
      context.drag.track={x:sign*dx/length*80,y:sign*dy/length*80};
      vm.runInContext('updatePolyDrag()',context);
      assert.equal(context.drag.turn.axis,candidate.axis);assert.equal(context.drag.turn.layer,candidate.layer);assert.equal(Math.sign(context.drag.turn.angle),sign);
     }
     reached.add(`${candidate.axis}:${candidate.layer}`);chosen.add(candidate.axis);
    }
    if(chosen.size>1)directionChanges++;
   }
  }
  assert.equal(reached.size,4*(order-2),'every inner slice is reachable from a sticker gesture');
 }
 assert(directionChanges>0,'changing direction at the same touch point selects different inner axes');
 console.log(`PASS skewb ${order}: every inner slice reachable, stationary outer regions, inverse and turned-state gestures`);
}
