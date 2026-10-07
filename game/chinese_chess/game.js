export const names={K:'帅',A:'仕',B:'相',N:'马',R:'车',C:'炮',P:'兵',k:'将',a:'士',b:'象',n:'马',r:'车',c:'炮',p:'卒'};
export const color=p=>p?(p===p.toUpperCase()?'r':'b'):null;
export const other=s=>s==='r'?'b':'r';
export const coord=i=>String.fromCharCode(97+i%9)+(9-Math.floor(i/9));
export const index=s=>(9-Number(s[1]))*9+s.charCodeAt(0)-97;
export function initial(){return ['rnbakabnr','.........','.c.....c.','p.p.p.p.p','.........','.........','P.P.P.P.P','.C.....C.','.........','RNBAKABNR'].join('').split('').map(p=>p==='.'?null:p);}
export function pseudo(board,from){
 const p=board[from];if(!p)return [];const side=color(p),x=from%9,y=Math.floor(from/9),out=[];
 const add=(a,b)=>{if(a>=0&&a<9&&b>=0&&b<10&&color(board[b*9+a])!==side)out.push(b*9+a);};
 const palace=(a,b)=>a>=3&&a<=5&&(side==='r'?b>=7&&b<=9:b>=0&&b<=2);
 switch(p.toLowerCase()){
 case 'r':case 'c':
  for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){let screen=false;for(let a=x+dx,b=y+dy;a>=0&&a<9&&b>=0&&b<10;a+=dx,b+=dy){const q=board[b*9+a];if(!screen){if(!q)add(a,b);else{if(p.toLowerCase()==='r'){add(a,b);break;}screen=true;}}else if(q){add(a,b);break;}}}break;
 case 'n':for(const [dx,dy] of [[2,1],[2,-1],[-2,1],[-2,-1],[1,2],[-1,2],[1,-2],[-1,-2]]){const leg=from+(Math.abs(dx)===2?Math.sign(dx):Math.sign(dy)*9);if(!board[leg])add(x+dx,y+dy);}break;
 case 'b':for(const dx of [-2,2])for(const dy of [-2,2]){const b=y+dy;if((side==='r'?b>=5:b<=4)&&!board[from+dy/2*9+dx/2])add(x+dx,b);}break;
 case 'a':for(const dx of [-1,1])for(const dy of [-1,1])if(palace(x+dx,y+dy))add(x+dx,y+dy);break;
 case 'k':for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]])if(palace(x+dx,y+dy))add(x+dx,y+dy);
  for(const dy of [-1,1])for(let b=y+dy;b>=0&&b<10;b+=dy){const q=board[b*9+x];if(q){if(q.toLowerCase()==='k'&&color(q)!==side)add(x,b);break;}}break;
 case 'p':add(x,y+(side==='r'?-1:1));if(side==='r'?y<=4:y>=5){add(x-1,y);add(x+1,y);}break;
 }return out;
}
export function inCheck(board,side){const king=board.indexOf(side==='r'?'K':'k');return king<0||board.some((p,i)=>p&&color(p)!==side&&pseudo(board,i).includes(king));}
export function legalMoves(board,side){const out=[];for(let from=0;from<90;from++)if(color(board[from])===side)for(const to of pseudo(board,from)){const captured=board[to];if(captured?.toLowerCase()==='k')continue;board[to]=board[from];board[from]=null;const ok=!inCheck(board,side);board[from]=board[to];board[to]=captured;if(ok)out.push({from,to});}return out;}
export const key=(board,side)=>board.map(p=>p||'.').join('')+side;
export class Game{
 constructor(){this.board=initial();this.side='r';this.history=[];this.keys=[key(this.board,this.side)];}
 moves(){return legalMoves(this.board,this.side);}
 outcome(){if(!this.moves().length)return `${this.side==='r'?'黑':'红'}方胜 · ${inCheck(this.board,this.side)?'将死':'困毙'}`;if(this.keys.filter(k=>k===this.keys.at(-1)).length>=3)return '和棋 · 三次重复（休闲规则）';return null;}
 move(m){if(this.outcome()||!this.moves().some(v=>v.from===m.from&&v.to===m.to))return false;this.history.push({...m,captured:this.board[m.to]});this.board[m.to]=this.board[m.from];this.board[m.from]=null;this.side=other(this.side);this.keys.push(key(this.board,this.side));return true;}
 undo(){const m=this.history.pop();if(!m)return;this.board[m.from]=this.board[m.to];this.board[m.to]=m.captured;this.side=other(this.side);this.keys.pop();}
}
export const encode=g=>g.history.map(m=>coord(m.from)+coord(m.to)).join('.');
export function replay(text){const g=new Game();if(!text)return g;if(text.length>25000)throw Error('棋谱过长');for(const s of text.split('.')){if(!/^[a-i][0-9][a-i][0-9]$/.test(s)||!g.move({from:index(s.slice(0,2)),to:index(s.slice(2))}))throw Error('非法棋谱');}return g;}
