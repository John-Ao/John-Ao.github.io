/* Rectangular extension of the magic_clock mechanism: each pin engages a 2×2 zone. */
(function(root){
'use strict';
const mod=n=>(n%12+12)%12;
function validSize(size){return Array.isArray(size)&&size.length===2&&size.every(n=>Number.isInteger(n)&&n>=2&&n<=6);}
function fresh(width=3,height=3){if(!validSize([width,height]))throw Error('Invalid clock size');return {width,height,faces:[Array(width*height).fill(0),Array(width*height).fill(0)],pins:Array((width-1)*(height-1)).fill(true)};}
function mirror(i,width){return Math.floor(i/width)*width+width-1-i%width;}
function turn(state,side,wheel,amount){
 if(![0,1].includes(side)||!Number.isInteger(wheel)||wheel<0||wheel>3||!Number.isInteger(amount))throw Error('Invalid clock turn');
 const {width:w,height:h,pins}=state,pw=w-1,ph=h-1,physical=side?wheel^1:wheel;
 const pin=(physical<2?0:ph-1)*pw+(physical%2?pw-1:0),engaged=pins[pin],active=engaged?0:1;
 const affected=[new Set(),new Set()],corners=[0,w-1,w*(h-1),w*h-1];
 pins.forEach((up,p)=>{if(up!==engaged)return;const q=active?mirror(p,pw):p,x=q%pw,y=Math.floor(q/pw);
  for(const i of [y*w+x,y*w+x+1,(y+1)*w+x,(y+1)*w+x+1]){affected[active].add(i);if(corners.includes(i))affected[1-active].add(mirror(i,w));}
 });
 for(let s=0;s<2;s++)for(const i of affected[s])state.faces[s][i]=mod(state.faces[s][i]+(s===side?amount:-amount));
 return affected;
}
function move(state,axis,layer,dir){
 if(axis===2){if(!Number.isInteger(layer)||layer<0||layer>=state.pins.length||![-1,1].includes(dir))throw Error('Invalid pin');state.pins[layer]=!state.pins[layer];}
 else turn(state,axis,layer,dir);
}
const api={fresh,turn,move,mirror,validSize,solved:s=>s.faces.every(f=>f.every(n=>n===0))};
if(typeof module!=='undefined')module.exports=api;else root.ClockPuzzle=api;
})(globalThis);
