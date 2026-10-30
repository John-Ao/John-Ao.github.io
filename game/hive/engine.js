(function(root){
'use strict';
const dirs=[[1,0],[0,1],[-1,1],[-1,0],[0,-1],[1,-1]], counts={Q:1,A:3,G:3,B:2,S:2};
const key=(q,r)=>q+','+r, xy=k=>k.split(',').map(Number), near=k=>{let [q,r]=xy(k);return dirs.map(([a,b])=>key(q+a,r+b))}, top=(b,k)=>b[k]?.at(-1), height=(b,k)=>b[k]?.length||0;
const fresh=()=>({board:{},turn:0,turns:[0,0],reserve:[{...counts},{...counts}],result:null,last:null});
const queen=(s,p)=>Object.values(s.board).some(a=>a.some(t=>t.p===p&&t.t==='Q'));
function placements(s,t){if(s.result||!s.reserve[s.turn][t]||(!queen(s,s.turn)&&s.turns[s.turn]>=3&&t!=='Q'))return [];let keys=Object.keys(s.board);if(!keys.length)return ['0,0'];let first=Object.values(s.board).every(a=>a.every(x=>x.p!==s.turn));return [...new Set(keys.flatMap(near))].filter(k=>!s.board[k]&&(first||near(k).filter(n=>s.board[n]).every(n=>top(s.board,n).p===s.turn)));}
function connected(b){let keys=Object.keys(b);if(!keys.length)return true;let seen=new Set([keys[0]]),todo=[keys[0]];while(todo.length)for(let n of near(todo.pop()))if(b[n]&&!seen.has(n)){seen.add(n);todo.push(n)}return seen.size===keys.length;}
function gate(b,a,z,level=1){let common=near(a).filter(n=>near(z).includes(n));return !common.every(n=>height(b,n)>=level);}
function slide(b,a,z){let common=near(a).filter(n=>near(z).includes(n));return !b[z]&&common.some(n=>b[n])&&gate(b,a,z);}
function moves(s,k){let piece=top(s.board,k);if(s.result||!piece||piece.p!==s.turn||!queen(s,s.turn))return [];let b=Object.fromEntries(Object.entries(s.board).map(([k,v])=>[k,[...v]])),originHeight=height(b,k);b[k].pop();if(!b[k].length)delete b[k];if(!connected(b))return [];let found=new Set();
if(piece.t==='G'){let [q,r]=xy(k);for(let [dq,dr] of dirs){let a=q+dq,c=r+dr;if(!b[key(a,c)])continue;while(b[key(a,c)]){a+=dq;c+=dr}found.add(key(a,c));}}
else if(piece.t==='B'){for(let n of near(k))if((b[n]||near(n).some(x=>b[x]))&&gate(b,k,n,Math.max(originHeight,height(b,n)+1)))found.add(n);}
else if(piece.t==='Q'){for(let n of near(k))if(slide(b,k,n))found.add(n);}
else if(piece.t==='A'){let seen=new Set([k]),todo=[k];while(todo.length){let a=todo.pop();for(let n of near(a))if(!seen.has(n)&&slide(b,a,n)){seen.add(n);found.add(n);todo.push(n)}}}
else if(piece.t==='S'){function walk(a,path){if(path.length===4){found.add(a);return}for(let n of near(a))if(!path.includes(n)&&slide(b,a,n))walk(n,[...path,n]);}walk(k,[k]);}
found.delete(k);return [...found];}
function available(s){return Object.keys(counts).some(t=>placements(s,t).length)||Object.keys(s.board).some(k=>moves(s,k).length);}
function outcome(s){let dead=[false,false];for(let [k,a] of Object.entries(s.board))for(let t of a)if(t.t==='Q'&&near(k).every(n=>s.board[n]))dead[t.p]=true;return dead[0]&&dead[1]?'draw':dead[0]?'black':dead[1]?'white':null;}
function play(s,action){let n=JSON.parse(JSON.stringify(s));if(action.pass){if(s.result||available(s))throw Error('仍有合法行动');}else if(action.t){if(!placements(s,action.t).includes(action.to))throw Error('非法放置');n.board[action.to]=[{p:s.turn,t:action.t}];n.reserve[s.turn][action.t]--;}else{if(!moves(s,action.from).includes(action.to))throw Error('非法移动');let p=n.board[action.from].pop();if(!n.board[action.from].length)delete n.board[action.from];(n.board[action.to]??=[]).push(p);}n.last=action;n.turns[s.turn]++;n.turn=1-s.turn;n.result=outcome(n);return n;}
const api={dirs,counts,key,xy,near,top,height,fresh,queen,placements,moves,connected,gate,available,outcome,play};if(typeof module!=='undefined')module.exports=api;root.Hive=api;
})(globalThis);
