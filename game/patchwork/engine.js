/* Pure game rules. Coordinates use a normalized bounding-box origin. */
(function(root){
'use strict';
const pieces=typeof module!=='undefined'?require('./pieces.js'):PATCHES;
const INCOME=[5,11,17,23,29,35,41,47,53], LEATHER=[20,26,32,44,50];
const tile=id=>id===34?{id:34,cost:0,time:0,income:0,cells:[[0,0]]}:pieces.find(p=>p.id===id);
function normalize(c){const x=Math.min(...c.map(p=>p[0])),y=Math.min(...c.map(p=>p[1]));return c.map(p=>[p[0]-x,p[1]-y]).sort((a,b)=>a[1]-b[1]||a[0]-b[0]);}
const rotate=c=>normalize(c.map(([x,y])=>[-y,x]));
const flip=c=>normalize(c.map(([x,y])=>[-x,y]));
function orientations(c){let out=[],keys=new Set();for(let f=0;f<2;f++){let a=f?flip(c):normalize(c);for(let r=0;r<4;r++){let k=JSON.stringify(a);if(!keys.has(k)){out.push(a);keys.add(k);}a=rotate(a);}}return out;}
function create(random=Math.random){let market=pieces.slice(1).map(p=>p.id);for(let i=market.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[market[i],market[j]]=[market[j],market[i]];}market.push(1);return {version:1,players:[0,1].map(()=>({board:Array(81).fill(0),buttons:5,income:0,pos:0,bonus:0})),market,active:0,leather:LEATHER.slice(),pending:0,bonusOwner:null,first:null,over:false,log:['玩家 1 先手。']};}
function valid(board,c,x,y){return Number.isInteger(x)&&Number.isInteger(y)&&c.every(([a,b])=>x+a>=0&&x+a<9&&y+b>=0&&y+b<9&&!board[(y+b)*9+x+a]);}
function fit(board,c){return orientations(c).some(a=>{for(let y=0;y<9;y++)for(let x=0;x<9;x++)if(valid(board,a,x,y))return true;return false;});}
function bonus(s){if(s.bonusOwner!==null)return;const p=s.players[s.active];for(let y=0;y<=2;y++)for(let x=0;x<=2;x++){let full=true;for(let dy=0;dy<7;dy++)for(let dx=0;dx<7;dx++)if(!p.board[(y+dy)*9+x+dx])full=false;if(full){p.bonus=7;s.bonusOwner=s.active;s.log.push(`玩家 ${s.active+1} 首先铺满 7×7，获得 7 分奖励。`);return;}}}
function next(s){if(s.pending && s.players[s.active].board.every(Boolean)){s.log.push('棋盘已满，未能放置的皮革补丁弃置。');s.pending=0;}if(s.pending)return;s.over=s.players.every(p=>p.pos===53);if(!s.over){const [a,b]=s.players;if(a.pos!==b.pos)s.active=a.pos<b.pos?0:1;}s.log=s.log.slice(-30);}
function move(s,steps){const p=s.players[s.active],old=p.pos;p.pos=Math.min(53,old+steps);const income=INCOME.filter(v=>v>old&&v<=p.pos).length*p.income;p.buttons+=income;if(income)s.log.push(`玩家 ${s.active+1} 获得 ${income} 枚收入纽扣。`);const claimed=s.leather.filter(v=>v>old&&v<=p.pos);s.leather=s.leather.filter(v=>!claimed.includes(v));s.pending+=claimed.length;if(claimed.length)s.log.push(`玩家 ${s.active+1} 获得 ${claimed.length} 块皮革补丁，请放置。`);if(p.pos===53&&s.first===null)s.first=s.active;next(s);}
function advance(s){if(s.over||s.pending)throw Error('请先完成当前操作。');const p=s.players[s.active],steps=Math.min(53,s.players[1-s.active].pos+1)-p.pos;if(steps<=0)throw Error('无法前进。');p.buttons+=steps;s.log.push(`玩家 ${s.active+1} 前进 ${steps} 格，获得 ${steps} 枚纽扣。`);move(s,steps);}
function place(s,id,c,x,y){if(s.over)throw Error('对局已经结束。');const p=s.players[s.active],t=tile(id);if(!t)throw Error('无效布片。');if(!orientations(t.cells).some(a=>JSON.stringify(a)===JSON.stringify(normalize(c))))throw Error('布片形状不正确。');c=normalize(c);if(!valid(p.board,c,x,y))throw Error('布片不能重叠或超出棋盘。');if(s.pending){if(id!==34)throw Error('请先放置皮革补丁。');}else{if(!s.market.slice(0,3).includes(id))throw Error('只能购买接下来的三块布片。');if(t.cost>p.buttons)throw Error('纽扣不足。');}
 c.forEach(([a,b])=>p.board[(y+b)*9+x+a]=id);bonus(s);
 if(s.pending){s.pending--;next(s);return;}
 p.buttons-=t.cost;p.income+=t.income;const i=s.market.indexOf(id);s.market=[...s.market.slice(i+1),...s.market.slice(0,i)];s.log.push(`玩家 ${s.active+1} 购买 #${id}，花费 ${t.cost} 纽扣 / ${t.time} 时间。`);move(s,t.time);
}
const score=p=>p.buttons+p.bonus-2*p.board.filter(x=>!x).length;
const winner=s=>score(s.players[0])===score(s.players[1])?s.first:score(s.players[0])>score(s.players[1])?0:1;
const api={pieces,INCOME,LEATHER,tile,normalize,rotate,flip,orientations,create,valid,fit,advance,place,score,winner};
if(typeof module!=='undefined')module.exports=api;else root.Game=api;
})(typeof window!=='undefined'?window:globalThis);
