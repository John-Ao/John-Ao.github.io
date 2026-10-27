(function(root){
'use strict';
const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const axes=[[1,0,0],[0,1,0],[0,0,1]];
function rotate(v,axis,angle){const c=Math.cos(angle),s=Math.sin(angle),n=axes[axis],w=cross(n,v),d=dot(n,v);return v.map((x,i)=>x*c+w[i]*s+n[i]*d*(1-c));}
function validSize(size){return Array.isArray(size)&&size.length===3&&size.every(n=>Number.isInteger(n)&&n>=1&&n<=5);}
function create(size){
 if(!validSize(size))throw Error('尺寸必须为 1–5 的整数');
 const pieces=[];
 for(let x=0;x<size[0];x++)for(let y=0;y<size[1];y++)for(let z=0;z<size[2];z++){
  const grid=[x,y,z],p=grid.map((n,i)=>n-(size[i]-1)/2),stickers=[];
  for(let a=0;a<3;a++)for(const sign of [-1,1])if(grid[a]===(sign<0?0:size[a]-1))stickers.push({n:axes[a].map(v=>v*sign),color:a*2+(sign>0?1:0)});
  pieces.push({id:pieces.length,p,stickers});
 }
 return pieces;
}
function step(size,axis){const other=size.filter((_,i)=>i!==axis);return other[0]===other[1]?Math.PI/2:Math.PI;}
function inLayer(piece,axis,layer){return Math.abs(piece.p[axis]-layer)<1e-6;}
function turn(pieces,size,axis,layer,dir){
 if(!Number.isInteger(axis)||axis<0||axis>2||![-1,1].includes(dir)||!Number.isInteger(layer+(size[axis]-1)/2)||Math.abs(layer)>(size[axis]-1)/2)throw Error('无效转层');
 const angle=step(size,axis)*dir,clean=v=>v.map(x=>Math.round(x*2)/2);
 for(const piece of pieces)if(inLayer(piece,axis,layer)){piece.p=clean(rotate(piece.p,axis,angle));piece.stickers.forEach(s=>s.n=clean(rotate(s.n,axis,angle)));}
}
function solved(pieces){const faces=new Map();for(const p of pieces)for(const s of p.stickers){const key=s.n.join(',');if(faces.has(key)&&faces.get(key)!==s.color)return false;faces.set(key,s.color);}return true;}
// The two axes tangent to the touched face give the layers that can follow a swipe.
function gestureCandidates(point,normal,camera,distance){
 const candidates=[];
 for(let axis=0;axis<3;axis++){
  if(Math.abs(normal[axis])>.5)continue;
  // Follow the row/column on the touched face, not the piece's orbital
  // velocity (which also moves out of that face and can suggest the wrong row).
  const tangent=cross(axes[axis],normal),depth=distance-dot(camera[2],point);
  // Project the line joining this sticker center and its adjacent sticker.
  // Its derivative has exactly the same direction as the projected endpoints,
  // including at boundaries where the row is extended by a virtual neighbor.
  const dz=dot(camera[2],tangent),sx=dot(camera[0],tangent)+dot(camera[0],point)*dz/depth;
  const sy=-(dot(camera[1],tangent)+dot(camera[1],point)*dz/depth),length=Math.hypot(sx,sy);
  if(length<1e-6)continue;
  candidates.push({axis,tangent:[sx/length,sy/length]});
 }
 return candidates;
}
function matchGesture(point,normal,camera,dx,dy,distance=Infinity){
 let best=null;
 for(const candidate of gestureCandidates(point,normal,camera,distance)){
  const score=dot(candidate.tangent,[dx,dy]);
  if(!best||Math.abs(score)>best.score)best={...candidate,dir:score<0?-1:1,score:Math.abs(score)};
 }
 return best;
}
function createTrajectory(){return {x:0,y:0,xx:0,xy:0,yy:0,length:0};}
function extendTrajectory(track,x,y){
 const a=track.x,b=track.y,length=Math.hypot(x-a,y-b);
 // Integrate displacement moments along each segment, weighted by distance
 // rather than event count: dense/coalesced pointer samples give the same fit.
 track.xx+=length*(a*a+a*x+x*x)/3;
 track.xy+=length*(2*a*b+a*y+x*b+2*x*y)/6;
 track.yy+=length*(b*b+b*y+y*y)/3;
 track.length+=length;track.x=x;track.y=y;
}
function matchTrajectory(point,normal,camera,track,distance=Infinity,previousAxis=null){
 if(Math.hypot(track.x,track.y)<=7)return null;
 const candidates=gestureCandidates(point,normal,camera,distance).map(c=>{
  const [x,y]=c.tangent,travel=x*track.x+y*track.y;
  return {...c,score:x*x*track.xx+2*x*y*track.xy+y*y*track.yy,dir:travel<0?-1:1};
 });
 candidates.sort((a,b)=>b.score-a.score);
 const previous=candidates.find(c=>c.axis===previousAxis),best=candidates[0];
 // Keep previews stable near a tie, but allow the full path to correct an early choice.
 if(!previous||!best)return best;
 const separation=1-dot(previous.tangent,best.tangent)**2;
 const margin=.12*Math.max(0,separation)*(track.xx+track.yy);
 return best.score<=previous.score+margin?previous:best;
}
const api={axes,dot,cross,rotate,validSize,create,step,inLayer,turn,solved,matchGesture,createTrajectory,extendTrajectory,matchTrajectory};
if(typeof module!=='undefined')module.exports=api;else root.Cuboid=api;
})(globalThis);
