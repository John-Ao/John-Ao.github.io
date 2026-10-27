/* Validated, versioned local/share data. No DOM or storage side effects. */
(function(root){
'use strict';
const ALPHABET='ABCDEFGHIJKLMNOPQRSTUVWX',MAX_MOVES=20000;
function encodeMoves(moves){return moves.map(([a,d])=>ALPHABET[a*2+(d===1?1:0)]).join('');}
function decodeMoves(text){if(typeof text!=='string'||text.length>MAX_MOVES||/[^A-X]/.test(text))throw Error('转动记录无效');return [...text].map(c=>{const n=ALPHABET.indexOf(c);return [n>>1,n%2?1:-1];});}
function validCamera(camera){
 if(!Array.isArray(camera)||camera.length!==3||!camera.every(v=>Array.isArray(v)&&v.length===3&&v.every(Number.isFinite)))return false;
 const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
 const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
 return camera.every((v,i)=>Math.abs(dot(v,v)-1)<1e-5&&camera.every((w,j)=>i===j||Math.abs(dot(v,w))<1e-5))&&dot(cross(camera[0],camera[1]),camera[2])>.99999;
}
function validate(data){
 if(!data||data.v!==1||!['regular','irregular'].includes(data.shape)||!['idle','ready','running','solved'].includes(data.status))throw Error('不支持的局面格式');
 decodeMoves(data.moves);decodeMoves(data.pending??'');
 if(data.moves.length+(data.pending?.length||0)>MAX_MOVES)throw Error('转动记录过长');
 if(!Number.isFinite(data.elapsed)||data.elapsed<0||data.elapsed>1e12)throw Error('用时无效');
 if(!validCamera(data.camera)||!Number.isFinite(data.zoom)||data.zoom<.55||data.zoom>1.8)throw Error('视角无效');
 if(data.selected!==null&&(!Number.isInteger(data.selected)||data.selected<0||data.selected>=12))throw Error('选中面无效');
 const fastCount=data.fastCount??(data.fast===true?(data.pending||'').length:0);
 if(!Number.isInteger(fastCount)||fastCount<0||fastCount>(data.pending||'').length)throw Error('转动速度记录无效');
 return {v:1,shape:data.shape,moves:data.moves,pending:data.pending||'',fast:fastCount>0,fastCount,elapsed:data.elapsed,status:data.status,camera:data.camera.map(v=>v.slice()),zoom:data.zoom,selected:data.selected};
}
function validateRecord(raw){const state=validate(raw);if(typeof raw.id!=='string'||!raw.id||raw.id.length>100||![raw.created,raw.updated].every(x=>Number.isFinite(x)&&x>0&&x<8e15))throw Error('历史记录无效');if(raw.favorite!==undefined&&typeof raw.favorite!=='boolean')throw Error('收藏状态无效');return {...state,id:raw.id,created:raw.created,updated:raw.updated,...(raw.favorite!==undefined?{favorite:raw.favorite}:{}),...(typeof raw.completed==='boolean'?{completed:raw.completed}:{}),...(typeof raw.solvePending==='boolean'?{solvePending:raw.solvePending}:{})};}
function retainRecords(records){
 let count=0;
 return [...records].sort((a,b)=>b.updated-a.updated).filter(r=>r.favorite||count++<100);
}
function encode(data){return btoa(JSON.stringify(validate(data))).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'');}
function decode(text){if(text.length>70000)throw Error('分享链接过长');return validate(JSON.parse(atob(text.replaceAll('-','+').replaceAll('_','/'))));}
class Stopwatch{
 constructor(now=()=>performance.now()){this.now=now;this.total=0;this.started=null;this.running=false;this.blockers=new Set();}
 elapsed(){return this.total+(this.started===null?0:Math.max(0,this.now()-this.started));}
 settle(){this.total=this.elapsed();this.started=null;}
 start(){this.running=true;if(!this.blockers.size&&this.started===null)this.started=this.now();}
 stop(){this.settle();this.running=false;}
 reset(ms=0){this.stop();this.total=ms;}
 pause(reason){this.settle();this.blockers.add(reason);}
 resume(reason){this.blockers.delete(reason);if(this.running)this.start();}
}
const api={encodeMoves,decodeMoves,validate,validateRecord,retainRecords,encode,decode,Stopwatch};
if(typeof module!=='undefined')module.exports=api;else root.PentafishSession=api;
})(globalThis);
