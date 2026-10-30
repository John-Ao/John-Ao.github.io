// Offsets are viewed by the blue player at the bottom, forward is negative y.
export const cards=[
 ['虎','Tiger',1,[[0,-2],[0,1]]],['龙','Dragon',-1,[[-2,-1],[2,-1],[-1,1],[1,1]]],
 ['蛙','Frog',-1,[[-2,0],[-1,-1],[1,1]]],['兔','Rabbit',1,[[2,0],[1,-1],[-1,1]]],
 ['蟹','Crab',1,[[-2,0],[0,-1],[2,0]]],['象','Elephant',-1,[[-1,0],[-1,-1],[1,0],[1,-1]]],
 ['鹅','Goose',1,[[-1,0],[-1,-1],[1,0],[1,1]]],['鸡','Rooster',-1,[[-1,0],[-1,1],[1,0],[1,-1]]],
 ['猴','Monkey',1,[[-1,-1],[1,-1],[-1,1],[1,1]]],['螳螂','Mantis',-1,[[-1,-1],[1,-1],[0,1]]],
 ['马','Horse',-1,[[0,-1],[-1,0],[0,1]]],['牛','Ox',1,[[0,-1],[1,0],[0,1]]],
 ['鹤','Crane',1,[[0,-1],[-1,1],[1,1]]],['野猪','Boar',-1,[[-1,0],[0,-1],[1,0]]],
 ['鳗','Eel',1,[[-1,-1],[1,0],[-1,1]]],['眼镜蛇','Cobra',-1,[[1,-1],[-1,0],[1,1]]]
];
export function create(deal){if(!deal){deal=cards.map((_,i)=>i);for(let i=15;i>0;i--){const j=Math.floor(Math.random()*(i+1));[deal[i],deal[j]]=[deal[j],deal[i]];}deal=deal.slice(0,5);}if(deal.length!==5||new Set(deal).size!==5||deal.some(i=>!Number.isInteger(i)||!cards[i]))throw Error('无效牌组');const board=Array(25).fill(0);for(let i=0;i<5;i++){board[i]=i===2?-2:-1;board[20+i]=i===2?2:1;}return {board,hands:{1:deal.slice(0,2),'-1':deal.slice(2,4)},side:deal[4],turn:cards[deal[4]][2],winner:null,last:null,ply:0,deal};}
export function legal(s,card=null,from=null){if(s.winner!==null)return [];const out=[];for(const c of s.hands[s.turn]){if(card!==null&&c!==card)continue;for(let i=0;i<25;i++){if(from!==null&&i!==from||Math.sign(s.board[i])!==s.turn)continue;for(const [dx,dy] of cards[c][3]){const x=i%5+dx*s.turn,y=Math.floor(i/5)+dy*s.turn,j=y*5+x;if(x>=0&&x<5&&y>=0&&y<5&&Math.sign(s.board[j])!==s.turn)out.push({from:i,to:j,card:c});}}}return out;}
export function play(s,m){const pass=m.from===null&&m.to===null;if(s.winner!==null||!s.hands[s.turn].includes(m.card))throw Error('请选择自己的走法牌');if(pass?legal(s).length:!legal(s).some(x=>x.from===m.from&&x.to===m.to&&x.card===m.card))throw Error('无效走法');const t=structuredClone(s);if(!pass){const piece=t.board[m.from],target=t.board[m.to];t.board[m.to]=piece;t.board[m.from]=0;if(Math.abs(target)===2||(Math.abs(piece)===2&&m.to===(s.turn===1?2:22)))t.winner=s.turn;t.last=[m.from,m.to];}else t.last=null;const k=t.hands[s.turn].indexOf(m.card);t.hands[s.turn][k]=t.side;t.side=m.card;t.turn=-s.turn;t.ply++;return t;}
