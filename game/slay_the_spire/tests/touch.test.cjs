'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert');
const source=fs.readFileSync(path.join(__dirname,'../game.js'),'utf8');
const events={},calls=[];let now=1000;
const state={phase:'combat',round:1,node:'0-3'};
const ctx={S:state,Map,Math,JSON,Date:{now:()=>now},document:{addEventListener(name,fn){events[name]=fn},documentElement:{setPointerCapture(){}}},dispatch:(action,args)=>calls.push([action,args])};
vm.createContext(ctx);vm.runInContext(source.slice(source.indexOf('const touches=new Map()'),source.indexOf('\ntry{const stored=')),ctx);
function button(action,args){return {dataset:{action,args:JSON.stringify(args)},disabled:false}}
function event(pointerId,b,x=0,y=0,type='touch'){return {pointerId,pointerType:type,clientX:x,clientY:y,target:{closest:()=>b},preventDefault(){}}}
const a=button('play',[0,17]),b=button('play',[1,32]);
events.pointerdown(event(1,a));events.pointerdown(event(2,b));
events.pointerup(event(1,null)); // DOM of the other player's button is replaced here.
events.pointerup(event(2,null));
assert.deepEqual(calls,[['play',[0,17]],['play',[1,32]]]);
console.log('PASS two independent touches survive a DOM replacement');
events.click(event(1,a));assert.equal(calls.length,2);console.log('PASS synthetic touch click does not double-play');
events.pointerdown(event(3,a));events.pointerup(event(3,a,80,0));assert.equal(calls.length,2);console.log('PASS horizontal hand swipe does not play card');
events.pointerdown(event(4,a));state.round++;events.pointerup(event(4,null));assert.equal(calls.length,2);console.log('PASS old-round touch cannot act in new round');
events.pointerdown(event(5,b));events.pointercancel(event(5,b));events.pointerup(event(5,b));assert.equal(calls.length,2);console.log('PASS cancelled touch is discarded');
now+=1000;events.click(event(6,b,0,0,'mouse'));assert.equal(calls.length,3);console.log('PASS mouse and keyboard-style click remain usable');
