const test=require('node:test');
const assert=require('node:assert/strict');
const G=require('./gestures');
const rect={left:20,top:30,width:800,height:600};
function harness(){
 let view={x:-400,y:-300,w:800,h:600},taps=[];
 const handlers={},captures=new Set(),element={
  getBoundingClientRect:()=>rect,
  addEventListener:(type,fn)=>handlers[type]=fn,
  setPointerCapture:id=>captures.add(id),hasPointerCapture:id=>captures.has(id),releasePointerCapture:id=>captures.delete(id)
 };
 const controller=G.attach(element,{getView:()=>view,setView:v=>view=v,onTap:e=>taps.push(e)});
 function emit(type,id,x,y){handlers[type]({type,pointerId:id,clientX:x,clientY:y,target:{id:'candidate'},pointerType:'touch',button:0,cancelable:true,preventDefault(){}});}
 return {emit,controller,get view(){return view},taps,handlers};
}
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);
test('双指缩放保持中心世界坐标，移动中点同时平移',()=>{
 const v={x:-400,y:-300,w:800,h:600},from={x:320,y:230},to={x:370,y:270};
 const old=G.worldAt(v,rect,from),next=G.anchored(v,rect,from,to,2),after=G.worldAt(next,rect,to);
 close(next.w,400);close(next.h,300);close(old.x,after.x);close(old.y,after.y);
});
test('单指点击只选择一次，拖动只平移不选牌',()=>{
 const h=harness();h.emit('pointerdown',1,200,200);h.emit('pointerup',1,201,202);assert.equal(h.taps.length,1);
 h.emit('pointerdown',2,200,200);h.emit('pointermove',2,250,240);h.emit('pointerup',2,250,240);
 close(h.view.x,-450);close(h.view.y,-340);assert.equal(h.taps.length,1);
});
test('双指捏合、抬起一指继续拖动均不触发落点，下一次轻点正常',()=>{
 const h=harness();h.emit('pointerdown',1,220,330);h.emit('pointerdown',2,420,330);
 h.emit('pointermove',1,120,330);h.emit('pointermove',2,520,330);
 close(h.view.w,400);close(h.view.h,300);
 const old={...h.view};h.emit('pointerup',2,520,330);h.emit('pointermove',1,160,350);
 close(h.view.x,old.x-20);close(h.view.y,old.y-10);h.emit('pointerup',1,160,350);assert.equal(h.taps.length,0);
 h.emit('pointerdown',3,300,300);h.emit('pointerup',3,300,300);assert.equal(h.taps.length,1);
});
test('pointercancel、失去捕获和窗口失焦均不产生误点击',()=>{
 for(const type of ['pointercancel','lostpointercapture']){const h=harness();h.emit('pointerdown',1,200,200);h.emit(type,1,200,200);h.emit('pointerup',1,200,200);assert.equal(h.taps.length,0);}
 const h=harness();h.emit('pointerdown',1,200,200);h.controller.cancel();h.emit('pointerup',1,200,200);assert.equal(h.taps.length,0);
});
test('第三根手指加入或离开不让镜头跳跃，极端缩放保持有效范围',()=>{
 const h=harness();h.emit('pointerdown',1,220,330);h.emit('pointerdown',2,420,330);h.emit('pointermove',2,620,330);
 const before={...h.view};h.emit('pointerdown',3,500,500);h.emit('pointermove',3,510,500);assert.deepEqual(h.view,before);
 h.emit('pointerup',3,510,500);h.emit('pointermove',2,99999,330);close(h.view.h,75);
});
test('滚轮以鼠标位置缩放且不触发落点',()=>{
 const h=harness(),p={x:300,y:250},old=G.worldAt(h.view,rect,p);
 h.handlers.wheel({clientX:p.x,clientY:p.y,deltaY:-100,deltaMode:0,preventDefault(){}});
 const after=G.worldAt(h.view,rect,p);close(old.x,after.x);close(old.y,after.y);assert.ok(h.view.h<600);assert.equal(h.taps.length,0);
});
