export const DIRS=[[1,0],[0,1],[-1,1],[-1,0],[0,-1],[1,-1]];
export const COLORS=['#bd6254','#ba9037','#66936b','#528c99','#6d79b4','#a16c9b'];
export const NAMES=['朱红','琥珀','松绿','湖蓝','靛青','梅紫'];
export const MODES={2:[0,3],3:[0,2,4],4:[0,1,3,4],6:[0,1,2,3,4,5]};
export const key=(q,r)=>`${q},${r}`;
export const rotate=([q,r])=>[-r,q+r];
export const distance=(a,b)=>(Math.abs(a.q-b.q)+Math.abs(a.r-b.r)+Math.abs(a.q+a.r-b.q-b.r))/2;
const points=new Map();
for(let q=-4;q<=4;q++)for(let r=-4;r<=4;r++)if(Math.abs(q+r)<=4)points.set(key(q,r),{q,r,home:-1});
for(let home=0;home<6;home++)for(let r=-8;r<-4;r++)for(let q=-r-4;q<=4;q++){
 let p=[q,r];for(let i=0;i<home;i++)p=rotate(p);
 points.set(key(...p),{q:p[0],r:p[1],home});
}
export const CELLS=[...points.values()].sort((a,b)=>a.r-b.r||a.q-b.q).map((p,id)=>({...p,id}));
const lookup=new Map(CELLS.map(p=>[key(p.q,p.r),p.id]));
export const HOMES=Array.from({length:6},(_,h)=>CELLS.filter(p=>p.home===h).map(p=>p.id));
export const NEIGHBORS=CELLS.map(p=>DIRS.map(([q,r])=>lookup.get(key(p.q+q,p.r+r))??-1));
// Rays stop at the board edge: a long hop may not cross missing holes.
const RAYS=CELLS.map(p=>DIRS.map(([dq,dr])=>{
 const ray=[];let q=p.q+dq,r=p.r+dr;
 while(lookup.has(key(q,r))){ray.push(lookup.get(key(q,r)));q+=dq;r+=dr;}
 return ray;
}));
export function createGame(count=2){
 if(!Object.hasOwn(MODES,count))throw new Error('人数无效');
 const players=[...MODES[count]],board=Array(121).fill(-1);
 for(const p of players)for(const id of HOMES[p])board[id]=p;
 return {count:Number(count),players,board,turn:0,winner:null,history:[]};
}
// A destination is a complete move. BFS retains one shortest legal hop path per endpoint.
// The starting hole is empty throughout a hop chain; all other marbles stay in place.
export function legalMoves(board,from){
 if(!Number.isInteger(from)||from<0||from>=121||board[from]===-1)return [];
 const moves=new Map();
 for(const to of NEIGHBORS[from])if(to>=0&&board[to]===-1)moves.set(to,{from,to,path:[from,to],kind:'step'});
 const visited=new Set([from]),queue=[[from]];
 const occupied=id=>id>=0&&id!==from&&board[id]!==-1;
 for(let i=0;i<queue.length;i++){
  const path=queue[i],at=path.at(-1);
  for(let d=0;d<6;d++){
   const ray=RAYS[at][d],pivot=ray.findIndex(occupied);
   if(pivot<0)continue;
   // The first occupied hole is the midpoint; the entire far half must be empty.
   const landing=2*pivot+1,to=ray[landing];
   if(to===undefined||visited.has(to)||ray.slice(pivot+1,landing+1).some(occupied))continue;
   visited.add(to);const next=[...path,to];queue.push(next);
   if(!moves.has(to))moves.set(to,{from,to,path:next,kind:'jump'});
  }
 }
 return [...moves.values()];
}
export function allMoves(board,player){return board.flatMap((p,id)=>p===player?legalMoves(board,id):[]);}
export function hasWon(board,player){return HOMES[(player+3)%6].every(id=>board[id]===player);}
export function play(game,from,to){
 if(game.winner!==null||game.board[from]!==game.players[game.turn])return false;
 const move=legalMoves(game.board,from).find(m=>m.to===to);if(!move)return false;
 const player=game.players[game.turn];game.board[from]=-1;game.board[to]=player;
 game.history.push({...move,player,turn:game.turn});
 if(hasWon(game.board,player))game.winner=player;
 else game.turn=(game.turn+1)%game.players.length;
 return true;
}
export function pass(game){
 if(game.winner!==null||allMoves(game.board,game.players[game.turn]).length)return false;
 game.history.push({kind:'pass',turn:game.turn,player:game.players[game.turn]});game.turn=(game.turn+1)%game.players.length;return true;
}
export function undo(game){
 const move=game.history.pop();if(!move)return false;
 if(move.kind!=='pass'){game.board[move.from]=move.player;game.board[move.to]=-1;}
 game.turn=move.turn;game.winner=null;return true;
}
export const encode=game=>game.history.map(m=>m.kind==='pass'?'p':`${m.from.toString(36)}-${m.to.toString(36)}`).join('.');
export function replay(count,moves=''){
 if(moves.length>60000)throw new Error('棋谱过长');
 const game=createGame(count);if(!moves)return game;
 for(const token of moves.split('.')){
  if(token==='p'){if(!pass(game))throw new Error('非法跳过');continue;}
  if(!/^[0-9a-z]{1,2}-[0-9a-z]{1,2}$/.test(token))throw new Error('非法棋谱');
  const [from,to]=token.split('-').map(s=>parseInt(s,36));if(!play(game,from,to))throw new Error('非法走子');
 }
 return game;
}
