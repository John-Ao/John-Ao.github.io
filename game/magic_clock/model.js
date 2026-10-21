/* Mechanism: https://www.jaapsch.net/puzzles/clock.htm */
(function(root){
'use strict';
const corners=[0,2,6,8],zones=[[0,1,3,4],[1,2,4,5],[3,4,6,7],[4,5,7,8]];
const mirror=i=>Math.floor(i/3)*3+2-i%3,mod=n=>(n%12+12)%12;
function fresh(){return {faces:[Array(9).fill(0),Array(9).fill(0)],pins:[true,true,true,true]};}
function turn(state,side,wheel,amount){
 const physical=side?wheel^1:wheel,engaged=state.pins[physical],active=engaged?0:1;
 const group=[0,1,2,3].filter(i=>state.pins[i]===engaged);
 const affected=[new Set(),new Set()];
 for(const p of group){const q=active?p^1:p;for(const i of zones[q])affected[active].add(i);affected[active].add(corners[q]);affected[1-active].add(mirror(corners[q]));}
 for(let s=0;s<2;s++)for(const i of affected[s])state.faces[s][i]=mod(state.faces[s][i]+(s===side?amount:-amount));
 return affected;
}
function valid(s){return s&&Array.isArray(s.pins)&&s.pins.length===4&&s.pins.every(p=>typeof p==='boolean')&&Array.isArray(s.faces)&&s.faces.length===2&&s.faces.every(f=>Array.isArray(f)&&f.length===9&&f.every(n=>Number.isInteger(n)&&n>=0&&n<12))&&corners.every(i=>mod(s.faces[0][i]+s.faces[1][mirror(i)])===0);}
const api={fresh,turn,valid,solved:s=>s.faces.every(f=>f.every(n=>n===0))};
if(typeof module!=='undefined')module.exports=api;else root.ClockModel=api;
})(globalThis);
