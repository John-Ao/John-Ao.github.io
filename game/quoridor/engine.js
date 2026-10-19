(function(root){
'use strict';
const inside=(r,c)=>r>=0&&r<9&&c>=0&&c<9;
const dirs=[[-1,0],[1,0],[0,-1],[0,1]];
function initial(turn=0){return {pawns:[{r:8,c:4},{r:0,c:4}],walls:[],remaining:[10,10],turn,winner:null,ply:0};}
function clear(s,a,b){
 if(!inside(b.r,b.c))return false;
 return !s.walls.some(w=>a.r!==b.r?w.o==='h'&&w.r===Math.min(a.r,b.r)&&(a.c===w.c||a.c===w.c+1):w.o==='v'&&w.c===Math.min(a.c,b.c)&&(a.r===w.r||a.r===w.r+1));
}
function moves(s){
 if(s.winner!==null)return [];
 const a=s.pawns[s.turn],other=s.pawns[1-s.turn],out=[];
 for(const [dr,dc] of dirs){
  const b={r:a.r+dr,c:a.c+dc};if(!clear(s,a,b))continue;
  if(b.r!==other.r||b.c!==other.c){out.push(b);continue;}
  const behind={r:b.r+dr,c:b.c+dc};
  if(clear(s,b,behind))out.push(behind);
  else for(const [sr,sc] of dirs.filter(([r,c])=>r*dr+c*dc===0)){
   const side={r:b.r+sr,c:b.c+sc};if(clear(s,b,side))out.push(side);
  }
 }
 return out;
}
function reachable(s,p){
 const seen=new Set(),queue=[s.pawns[p]],goal=p===0?0:8;
 for(let i=0;i<queue.length;i++){
  const a=queue[i];if(a.r===goal)return true;
  for(const [dr,dc] of dirs){const b={r:a.r+dr,c:a.c+dc},key=b.r*9+b.c;if(clear(s,a,b)&&!seen.has(key)){seen.add(key);queue.push(b);}}
 }
 return false;
}
function wallError(s,w){
 if(s.winner!==null)return '本局已结束';
 if(!s.remaining[s.turn])return '你的墙已用完，请走棋';
 if(!w||!Number.isInteger(w.r)||!Number.isInteger(w.c)||w.r<0||w.r>7||w.c<0||w.c>7||!['h','v'].includes(w.o))return '请选择棋盘内的墙位';
 if(s.walls.some(v=>v.o!==w.o?v.r===w.r&&v.c===w.c:w.o==='h'?v.r===w.r&&Math.abs(v.c-w.c)<2:v.c===w.c&&Math.abs(v.r-w.r)<2))return '墙不能重叠或交叉';
 const next={...s,walls:[...s.walls,w]};
 if(!reachable(next,0)||!reachable(next,1))return '必须给双方各留一条通往终点的路';
 return '';
}
function play(s,action){
 if(s.winner!==null)return null;
 const n=JSON.parse(JSON.stringify(s));
 if(action.type==='move'){
  if(!moves(s).some(p=>p.r===action.r&&p.c===action.c))return null;
  n.pawns[s.turn]={r:action.r,c:action.c};
  if(action.r===(s.turn===0?0:8))n.winner=s.turn;
 }else if(action.type==='wall'){
  if(wallError(s,action))return null;
  n.walls.push({r:action.r,c:action.c,o:action.o});n.remaining[s.turn]--;
 }else return null;
 n.ply++;if(n.winner===null)n.turn=1-s.turn;return n;
}
const api={initial,moves,reachable,wallError,play};
if(typeof window!=='undefined')window.Quoridor=api;
else if(typeof module!=='undefined')module.exports=api;
})(globalThis);
