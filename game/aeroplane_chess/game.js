export const COLORS=['朱红','湖蓝','麦黄','松绿'];
export const INKS=['#d95747','#417cc1','#dcb333','#409669'];
export function createGame(count=2){if(![2,3,4].includes(count))throw Error('人数无效');return {version:2,players:count===2?[0,2]:Array.from({length:count},(_,i)=>i),pieces:Array.from({length:4},()=>Array.from({length:4},()=>({pos:-1,done:false}))),turn:0,die:null,ranks:[],over:false,last:null};}
export const current=g=>g.players[g.turn];
export const target=(g,p)=>56-g.pieces[p].filter(x=>x.done).length;
export const key=(p,pos)=>pos<0?null:pos===0?`start${p}`:pos<=50?`ring${(p*13+pos)%52}`:`home${p}-${pos}`;
export const cellColor=i=>(i+2)%4;
export function nextTurn(g){do{g.turn=(g.turn+1)%g.players.length;}while(g.ranks.includes(current(g)));}
export function options(g){if(g.over||g.die===null)return [];return g.pieces[current(g)].flatMap((x,i)=>!x.done&&(x.pos>=0||g.die===6)?[i]:[]);}
export function roll(g,die){if(g.over||g.die!==null||!Number.isInteger(die)||die<1||die>6)throw Error('无法掷骰');g.die=die;g.last=null;return g;}
export function skip(g){if(g.die===null||options(g).length||g.over)throw Error('不能跳过');g.last={player:current(g),die:g.die,text:`${COLORS[current(g)]}掷出 ${g.die}，无可走棋子`};const extra=g.die===6;g.die=null;if(!extra)nextTurn(g);return g;}
export function move(g,i){if(!options(g).includes(i))throw Error('非法走法');const p=current(g),piece=g.pieces[p][i],from=piece.pos,end=target(g,p),die=g.die,path=[from],hits=[];let pos=from<0?0:from+die;const bounce=pos>end;if(bounce)pos=end-(pos-end);
 if(from>=0){let step=from,dir=1;for(let n=0;n<die;n++){if(step===end)dir=-1;step+=dir;path.push(step);}}else path.push(0);
 function collide(at){let hit=false;const k=key(p,at);for(const q of g.players)g.pieces[q].forEach((x,j)=>{if(q===p&&j===i||x.done||x.pos<0)return;if(key(q,x.pos)===k){hits.push({player:q,piece:j});x.pos=-1;hit=true;}});return hit;}
 let special='';const hit=collide(pos);
 if(!bounce&&!hit&&pos>0&&pos<50){if(pos===18){pos=30;special='飞行';path.push(pos);collide(pos);}else if(cellColor((p*13+pos)%52)===p&&pos+4<=end){pos+=4;special='跳跃';path.push(pos);collide(pos);}}
 piece.pos=pos;piece.done=pos===end;if(piece.done&&g.pieces[p].every(x=>x.done))g.ranks.push(p);
 g.over=g.ranks.length===g.players.length-1;g.last={player:p,die,piece:i,path,hits,bounce,special,text:`${COLORS[p]} · ${from<0?'起飞':bounce?'反弹':special||`前进 ${die} 格`}${hits.length?` · 撞回 ${hits.length} 架`:''}${piece.done?' · 到达终点':''}`};g.die=null;
 if(!g.over&&(die!==6||g.ranks.includes(p)))nextTurn(g);return g;
}
export function preview(g,i){const next=structuredClone(g);move(next,i);return next;}
export function validate(g){try{if(g.version!==2)return false;if(![2,3,4].includes(g.players.length)||new Set(g.players).size!==g.players.length||g.players.some(p=>!Number.isInteger(p)||p<0||p>3))return false;if(!Number.isInteger(g.turn)||g.turn<0||g.turn>=g.players.length||!(g.die===null||Number.isInteger(g.die)&&g.die>=1&&g.die<=6))return false;if(g.pieces.length!==4||g.pieces.some(row=>row.length!==4||row.some(x=>!Number.isInteger(x.pos)||x.pos< -1||x.pos>56||typeof x.done!=='boolean')))return false;if(g.last!==null&&(!g.last||typeof g.last.text!=='string'||g.last.path&&(!g.players.includes(g.last.player)||!Number.isInteger(g.last.piece)||g.last.piece<0||g.last.piece>3||!Array.isArray(g.last.path)||g.last.path.some(x=>!Number.isInteger(x)||x< -1||x>56))))return false;if(!Array.isArray(g.ranks)||new Set(g.ranks).size!==g.ranks.length||g.ranks.some(p=>!g.players.includes(p)))return false;for(const p of g.players){const finished=g.pieces[p].filter(x=>x.done).map(x=>x.pos).sort((a,b)=>b-a);if(finished.some((x,i)=>x!==56-i)||g.pieces[p].some(x=>!x.done&&x.pos>=57-finished.length))return false;if(g.ranks.includes(p)!==(finished.length===4))return false;}const keys=g.players.flatMap(p=>g.pieces[p].filter(x=>x.pos>=0).map(x=>key(p,x.pos)));return new Set(keys).size===keys.length&&g.over===(g.ranks.length===g.players.length-1)&& (g.over||!g.ranks.includes(current(g)));}catch{return false;}}
