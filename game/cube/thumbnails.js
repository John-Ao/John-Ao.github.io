'use strict';
// Rebuild records independently so previews never replace the active puzzle.
function historyModel(record){
 const type=record.puzzleType,model=type==='clock'?ClockPuzzle.fresh(...record.clockSize):type==='cuboid'?M.create(record.size):P.create(type,record.order);
 for(const [a,l,d] of record.moves.slice(0,record.cursor)){
  if(type==='clock')ClockPuzzle.move(model,a,l,d);else if(type==='cuboid')M.turn(model,record.size,a,l,d);else P.turn(model,type,record.order,a,l,d);
 }
 return model;
}
function drawHistoryThumbnail(target,record){
 const ctx=target.getContext('2d'),size=target.width;ctx.clearRect(0,0,size,size);
 const model=historyModel(record);
 if(record.puzzleType==='clock'){drawClockThumbnail(ctx,size,model);return;}
 let faces;
 if(record.puzzleType==='cuboid'){
  faces=model.flatMap(piece=>piece.stickers.map(sticker=>{
   const n=sticker.n,axis=n.findIndex(x=>Math.abs(x)>.9),u=M.axes[(axis+1)%3],v=M.axes[(axis+2)%3];
   let points=[[-1,-1],[1,-1],[1,1],[-1,1]].map(([a,b])=>piece.p.map((p,i)=>p+n[i]*.5+(u[i]*a+v[i]*b)*.5));
   if(n[axis]<0)points=points.reverse();return {points,color:sticker.color};
  }));
 }else faces=(record.puzzleType==='gear'?[GearCube.core,...model]:model).flatMap(piece=>piece.faces);
 const basis=record.camera||pose(3),projected=faces.map(face=>({...face,points:face.points.map(p=>basis.map(row=>M.dot(row,p)))}));
 const extent=Math.max(...projected.flatMap(f=>f.points.flatMap(p=>[Math.abs(p[0]),Math.abs(p[1])]))),scale=(size-12)/(2*extent);
 const image=ctx.createImageData(size,size),depth=new Float64Array(size*size).fill(-Infinity);
 function triangle(a,b,c,color,bias){
  const area=(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);if(Math.abs(area)<1e-9)return;
  for(let y=Math.max(0,Math.floor(Math.min(a[1],b[1],c[1])));y<=Math.min(size-1,Math.ceil(Math.max(a[1],b[1],c[1])));y++)for(let x=Math.max(0,Math.floor(Math.min(a[0],b[0],c[0])));x<=Math.min(size-1,Math.ceil(Math.max(a[0],b[0],c[0])));x++){
   const u=((b[0]-x-.5)*(c[1]-y-.5)-(b[1]-y-.5)*(c[0]-x-.5))/area,v=((c[0]-x-.5)*(a[1]-y-.5)-(c[1]-y-.5)*(a[0]-x-.5))/area,w=1-u-v;if(Math.min(u,v,w)<-1e-7)continue;
   const z=u*a[2]+v*b[2]+w*c[2]+bias,i=y*size+x;if(z<=depth[i])continue;depth[i]=z;image.data.set([...color,255],i*4);
  }
 }
 function polygon(points,color,bias=0){for(let i=1;i<points.length-1;i++)triangle(points[0],points[i],points[i+1],color,bias);}
 for(const face of projected){
  const normal=P.norm(P.cross(P.sub(face.points[1],face.points[0]),P.sub(face.points[2],face.points[0])));if(normal[2]<=1e-6)continue;
  const points=face.points.map(p=>[size/2+p[0]*scale,size/2-p[1]*scale,p[2]]);polygon(points,[20,23,26]);
  if(face.color>=0){const light=.78+.22*normal[2],color=rgb(colors[P.stickerColorIndex(record.puzzleType,face.color)]).map(n=>Math.round(n*255*light));polygon(face.stickerMesh?points:P.insetProjected(points,.75),color,.0001);}
 }
 ctx.putImageData(image,0,0);
}
function drawClockThumbnail(ctx,size,state){
 const {width:w,height:h}=state,gap=.3,vertical=(size-12)/(Math.max(w,2*h+gap))>(size-12)/Math.max(2*w+gap,h),cols=vertical?w:2*w+gap,rows=vertical?2*h+gap:h,scale=(size-12)/Math.max(cols,rows);
 ctx.save();ctx.translate((size-cols*scale)/2,(size-rows*scale)/2);ctx.scale(scale,scale);ctx.lineCap='round';
 for(let side=0;side<2;side++){
  ctx.save();ctx.translate(vertical?0:side*(w+gap),vertical?side*(h+gap):0);const color=side?'#79a88c':'#779fb8';ctx.fillStyle=color;ctx.globalAlpha=.16;ctx.beginPath();ctx.roundRect(0,0,w,h,.2);ctx.fill();ctx.globalAlpha=1;
  state.faces[side].forEach((value,i)=>{const x=i%w+.5,y=Math.floor(i/w)+.5,angle=value*Math.PI/6;ctx.fillStyle='#fafafa';ctx.strokeStyle=color;ctx.lineWidth=.035;ctx.beginPath();ctx.arc(x,y,.41,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.lineWidth=.065;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+Math.sin(angle)*.29,y-Math.cos(angle)*.29);ctx.stroke();});
  state.pins.forEach((_,i)=>{const up=side?!state.pins[ClockPuzzle.mirror(i,w-1)]:state.pins[i];ctx.fillStyle=up?'#dfb863':'#fafafa';ctx.strokeStyle='#dfb863';ctx.lineWidth=.035;ctx.beginPath();ctx.arc(i%(w-1)+1,Math.floor(i/(w-1))+1,.105,0,Math.PI*2);ctx.fill();ctx.stroke();});ctx.restore();
 }
 ctx.restore();
}
const historyThumbnails=new WeakMap();
const historyThumbnailObserver=new IntersectionObserver(entries=>{
 for(const entry of entries)if(entry.isIntersecting){historyThumbnailObserver.unobserve(entry.target);try{drawHistoryThumbnail(entry.target,historyThumbnails.get(entry.target));}catch{entry.target.setAttribute('aria-label','缩略图不可用');}}
});
