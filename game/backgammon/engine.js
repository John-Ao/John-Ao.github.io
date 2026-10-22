'use strict';
(function(root){
const clone=s=>JSON.parse(JSON.stringify(s));
function initial(){const points=Array(24).fill(0);for(const [i,n] of [[23,2],[12,5],[7,3],[5,5]]){points[i]=n;points[23-i]=-n;}return {points,bar:[0,0],off:[0,0],turn:0,dice:[],rolled:[],phase:'opening',winner:null,ply:0};}
const sign=p=>p===0?1:-1;
const distance=(p,i)=>p===0?i+1:24-i;
function raw(s,d){const p=s.turn,sg=sign(p),sources=s.bar[p]?[-1]:s.points.map((n,i)=>n*sg>0?i:-2).filter(i=>i>=0),home=!s.bar[p]&&s.points.every((n,i)=>n*sg<=0||distance(p,i)<=6);return sources.flatMap(from=>{const to=from===-1?(p===0?24-d:d-1):from+(p===0?-d:d);if(to>=0&&to<24)return s.points[to]*sg>=-1?[{from,to,die:d}]:[];if(from===-1||!home)return [];const dist=distance(p,from);return d===dist||(d>dist&&!s.points.some((n,i)=>n*sg>0&&distance(p,i)>dist))?[{from,to:24,die:d}]:[];});}
function apply(s,m){const n=clone(s),p=n.turn,sg=sign(p);if(m.from===-1)n.bar[p]--;else n.points[m.from]-=sg;if(m.to===24)n.off[p]++;else{if(n.points[m.to]===-sg){n.points[m.to]=0;n.bar[1-p]++;}n.points[m.to]+=sg;}n.dice.splice(n.dice.indexOf(m.die),1);if(n.off[p]===15){n.winner=p;n.phase='over';}return n;}
function paths(s){if(!s.dice.length||s.winner!==null)return [[]];const out=[];for(const d of new Set(s.dice))for(const m of raw(s,d))for(const rest of paths(apply(s,m)))out.push([m,...rest]);return out.length?out:[[]];}
function legal(s){if(s.phase!=='moving')return [];let seq=paths(s),max=Math.max(...seq.map(a=>a.length));seq=seq.filter(a=>a.length===max);if(max===1){const high=Math.max(...seq.map(a=>a[0].die));seq=seq.filter(a=>a[0].die===high);}return [...new Map(seq.filter(a=>a.length).map(a=>[JSON.stringify(a[0]),a[0]])).values()];}
function roll(s,a,b){if(!['opening','roll'].includes(s.phase)||![a,b].every(d=>Number.isInteger(d)&&d>=1&&d<=6))return null;const n=clone(s);n.rolled=[a,b];if(s.phase==='opening'){if(a===b)return n;n.turn=a>b?0:1;}n.dice=a===b?[a,a,a,a]:[a,b];n.phase='moving';return n;}
function move(s,m){if(!legal(s).some(x=>JSON.stringify(x)===JSON.stringify(m)))return null;return apply(s,m);}
function end(s){if(s.phase!=='moving'||legal(s).length)return null;const n=clone(s);n.turn=1-n.turn;n.dice=[];n.rolled=[];n.phase='roll';n.ply++;return n;}
function score(s){if(s.winner===null)return 0;const loser=1-s.winner;if(s.off[loser])return 1;return s.bar[loser]||s.points.some((n,i)=>n*sign(loser)>0&&distance(s.winner,i)<=6)?3:2;}
const api={initial,legal,roll,move,end,score,distance};if(typeof module!=='undefined')module.exports=api;else root.Backgammon=api;
})(globalThis);
