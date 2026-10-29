/* Current piece orientations only: length is independent of move history. */
(function(root){
'use strict';
const P=typeof module!=='undefined'?require('./polyhedra'):root.PolyPuzzle;
const M=typeof module!=='undefined'?require('./model'):root.Cuboid;
const C=typeof module!=='undefined'?require('./clock-model'):root.ClockPuzzle;
const G=typeof module!=='undefined'?require('./gear'):root.GearCube;
const types=['cuboid','pyraminx','skewb','megaminx','sq1','octahedron','icosahedron','gear','clock','helicopter','mixup'];
const basis=[[1,0,0],[0,1,0],[0,0,1]],cache=new Map();
const fail=()=>{throw Error('无效魔方状态');};
const hash=bytes=>bytes.reduce((h,b)=>Math.imul(h^b,16777619)>>>0,2166136261);
const same=(a,b)=>a.every((v,i)=>v.every((x,j)=>Math.abs(x-b[i][j])<1e-6));
const transform=(v,frame)=>basis.map((_,i)=>v.reduce((sum,x,j)=>sum+x*frame[j][i],0));
function orientations(type){
 const key=['cuboid','skewb','octahedron','gear'].includes(type)?'cube':type;
 if(cache.has(key))return cache.get(key);
 const config=key==='cube'?{axes:basis,step:Math.PI/2}:P.config(type,3),frames=[basis];
 for(let i=0;i<frames.length;i++)for(let axis=0;axis<config.axes.length;axis++){
  const angle=type==='sq1'&&axis===2?Math.PI:config.step;
  const next=frames[i].map(v=>P.rotate(v,config.axes[axis],angle));
  if(!frames.some(f=>same(f,next)))frames.push(next);
  if(frames.length>60)fail();
 }
 cache.set(key,frames);return frames;
}
function pieceFrames(type,piece){
 const frames=orientations(type);
 if(type!=='gear'||piece.kind!=='gear')return frames;
 const key='gear:'+piece.home.join();if(cache.has(key))return cache.get(key);
 const n=P.norm(piece.home),result=[];
 for(const frame of frames)for(let spin=0;spin<6;spin++)result.push(basis.map(v=>transform(P.rotate(v,n,spin*Math.PI/3),frame)));
 cache.set(key,result);return result;
}
function info(type,dimensions){
 if(type==='cuboid'){if(!M.validSize(dimensions))fail();return {puzzleType:type,order:3,size:dimensions,clockSize:[3,3]};}
 if(type==='clock'){if(!C.validSize(dimensions))fail();return {puzzleType:type,order:3,size:[3,3,3],clockSize:dimensions};}
 if(!P.valid(type,dimensions[0]))fail();return {puzzleType:type,order:dimensions[0],size:[3,3,3],clockSize:[3,3]};
}
function fresh(s){return s.puzzleType==='cuboid'?M.create(s.size):s.puzzleType==='clock'?C.fresh(...s.clockSize):P.create(s.puzzleType,s.order);}
function encode(s){
 const type=types.indexOf(s.puzzleType);if(type<0)fail();
 const dimensions=type===0?s.size:type===8?s.clockSize:[s.order];info(s.puzzleType,dimensions);
 const bytes=[type,...dimensions],uint=v=>{do{const b=v%128;v=Math.floor(v/128);bytes.push(b+(v?128:0));}while(v);};
 if(type===8){
  const values=s.pieces.faces.flat();if(values.length!==2*s.clockSize[0]*s.clockSize[1]||values.some(v=>!Number.isInteger(v)||v<0||v>11))fail();
  for(let i=0;i<values.length;i+=2)bytes.push(values[i]|(values[i+1]<<4));
  for(let i=0;i<s.pieces.pins.length;i+=8){let bits=0;for(let j=0;j<8;j++)if(s.pieces.pins[i+j])bits|=1<<j;bytes.push(bits);}
 }else if(['helicopter','mixup'].includes(s.puzzleType)){
  // These shape-changing puzzles are not restricted to a finite rotation group.
  bytes.push(2);const buffer=new ArrayBuffer(8),view=new DataView(buffer);
  for(const piece of s.pieces){if(!validFrame(piece.frame))fail();for(const row of piece.frame)for(const value of row){view.setFloat64(0,value,true);bytes.push(...new Uint8Array(buffer));}}
 }else{
  const codes=s.pieces.map(p=>{const code=pieceFrames(s.puzzleType,p).findIndex(f=>same(f,p.frame));if(code<0)fail();return code;});
  const runs=[];for(let i=0;i<codes.length;){let end=i+1;while(end<codes.length&&codes[end]===codes[i])end++;runs.push([end-i,codes[i]]);i=end;}
  const runSize=runs.reduce((sum,[n])=>sum+1+(n<128?1:n<16384?2:3),0);
  if(runSize<codes.length){bytes.push(1);for(const [n,code] of runs){uint(n);bytes.push(code);}}
  else bytes.push(0,...codes);
 }
 const checksum=hash(bytes);for(let i=0;i<4;i++)bytes.push((checksum>>>(i*8))&255);
 let binary='';for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.slice(i,i+8192));
 return btoa(binary).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}
function validFrame(frame){
 return Array.isArray(frame)&&frame.length===3&&frame.every(v=>Array.isArray(v)&&v.length===3&&v.every(Number.isFinite)&&Math.abs(P.dot(v,v)-1)<1e-6)&&
  Math.abs(P.dot(frame[0],frame[1]))<1e-6&&Math.abs(P.dot(frame[0],frame[2]))<1e-6&&Math.abs(P.dot(frame[1],frame[2]))<1e-6&&Math.abs(P.dot(P.cross(frame[0],frame[1]),frame[2])-1)<1e-6;
}
function decode(text){
 if(typeof text!=='string'||text.length>100000||!/^[A-Za-z0-9_-]+$/.test(text)||text.length%4===1)fail();
 const bytes=Uint8Array.from(atob(text.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));
 if(bytes.length<8)fail();const end=bytes.length-4,view=new DataView(bytes.buffer);if(hash(bytes.subarray(0,end))!==view.getUint32(end,true))fail();
 let offset=0;const byte=()=>{if(offset>=end)fail();return bytes[offset++];},uint=()=>{let value=0,m=1;for(let i=0;i<3;i++){const b=byte();value+=(b&127)*m;if(b<128)return value;m*=128;}fail();};
 const type=types[byte()];if(!type)fail();const dimensions=Array.from({length:type==='cuboid'?3:type==='clock'?2:1},byte),s=info(type,dimensions),pieces=fresh(s);
 if(type==='clock'){
  const count=s.clockSize[0]*s.clockSize[1],values=[];
  for(let i=0;i<count;i++){const b=byte();if((b&15)>11||(b>>4)>11)fail();values.push(b&15,b>>4);}
  pieces.faces=[values.slice(0,count),values.slice(count)];
  for(let i=0;i<pieces.pins.length;i+=8){const b=byte();for(let j=0;j<8&&i+j<pieces.pins.length;j++)pieces.pins[i+j]=!!(b&(1<<j));}
 }else{
  const mode=byte(),free=['helicopter','mixup'].includes(type);if(free?mode!==2:mode>1)fail();let codes=[],frames;
  if(free){frames=pieces.map(()=>{const frame=basis.map(()=>basis.map(()=>{if(offset+8>end)fail();const value=view.getFloat64(offset,true);offset+=8;return value;}));if(!validFrame(frame))fail();return frame;});}
  else
  if(mode===0)codes=pieces.map(()=>byte());else while(codes.length<pieces.length){const n=uint(),code=byte();if(!n||codes.length+n>pieces.length)fail();for(let i=0;i<n;i++)codes.push(code);}
  pieces.forEach((p,i)=>{
   const frame=frames?frames[i]:pieceFrames(type,p)[codes[i]];if(!frame)fail();p.frame=frame.map(v=>v.slice());
   if(type==='cuboid'){p.p=transform(p.p,frame).map(x=>Math.round(x*2)/2);for(const sticker of p.stickers)sticker.n=transform(sticker.n,frame).map(Math.round);}
   else{for(const face of p.faces)face.points=face.points.map(v=>transform(v,frame));if(p.anchor)p.anchor=transform(p.anchor,frame);if(type==='gear')p.p=transform(p.home,frame).map(Math.round);}
  });
 }
 if(offset!==end)fail();return {...s,pieces};
}
function describe(text){const bytes=Uint8Array.from(atob(text.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0)),type=types[bytes[0]];if(!type)fail();return info(type,[...bytes.slice(1,type==='cuboid'?4:type==='clock'?3:2)]);}
const api={encode,decode,describe};if(typeof module!=='undefined')module.exports=api;else root.CubeState=api;
})(globalThis);
