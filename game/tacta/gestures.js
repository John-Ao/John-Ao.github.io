/* Camera gestures are independent of game state: moving the view never plays a card. */
(function(root) {
  'use strict';
  const midpoint=(a,b)=>({x:(a.x+b.x)/2,y:(a.y+b.y)/2});
  const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
  const worldAt=(view,rect,p)=>({x:view.x+(p.x-rect.left)*view.w/rect.width,y:view.y+(p.y-rect.top)*view.h/rect.height});
  function anchored(view,rect,from,to,factor) {
    const anchor=worldAt(view,rect,from),w=view.w/factor,h=view.h/factor;
    return {x:anchor.x-(to.x-rect.left)*w/rect.width,y:anchor.y-(to.y-rect.top)*h/rect.height,w,h};
  }
  function attach(element,{getView,setView,onTap}) {
    const pointers=new Map();let baseline=null,blocked=false;
    function rebase() {
      const values=[...pointers.values()];
      baseline=values.length?{view:{...getView()},rect:element.getBoundingClientRect(),points:values.map(p=>({...p}))}:null;
    }
    function limitedFactor(view,factor){return view.h/Math.max(75,Math.min(6000,view.h/factor));}
    function down(e) {
      if(e.pointerType==='mouse'&&e.button!==0)return;
      if(!pointers.size)blocked=false;
      pointers.set(e.pointerId,{x:e.clientX,y:e.clientY,target:e.target,startX:e.clientX,startY:e.clientY});
      if(pointers.size>1)blocked=true;
      element.setPointerCapture(e.pointerId);rebase();
    }
    function move(e) {
      const point=pointers.get(e.pointerId);if(!point||!baseline)return;
      point.x=e.clientX;point.y=e.clientY;
      const values=[...pointers.values()];
      if(values.length>=2) {
        blocked=true;
        const from=midpoint(...baseline.points.slice(0,2)),to=midpoint(...values.slice(0,2));
        const factor=limitedFactor(baseline.view,distance(...values.slice(0,2))/Math.max(1,distance(...baseline.points.slice(0,2))));
        setView(anchored(baseline.view,baseline.rect,from,to,factor));
      } else {
        if(Math.hypot(point.x-point.startX,point.y-point.startY)>5)blocked=true;
        if(blocked)setView(anchored(baseline.view,baseline.rect,baseline.points[0],point,1));
      }
      if(e.cancelable)e.preventDefault();
    }
    function end(e) {
      const point=pointers.get(e.pointerId);if(!point)return;
      const tap=e.type==='pointerup'&&!blocked&&pointers.size===1&&Math.hypot(e.clientX-point.startX,e.clientY-point.startY)<=5;
      pointers.delete(e.pointerId);
      if(e.type!=='pointerup')blocked=true;
      if(element.hasPointerCapture(e.pointerId))element.releasePointerCapture(e.pointerId);
      rebase();
      if(tap)onTap({target:point.target,clientX:e.clientX,clientY:e.clientY});
    }
    function wheel(e) {
      e.preventDefault();if(pointers.size)return;
      const view=getView(),rect=element.getBoundingClientRect(),p={x:e.clientX,y:e.clientY};
      const delta=e.deltaY*(e.deltaMode===1?16:e.deltaMode===2?rect.height:1);
      setView(anchored(view,rect,p,p,limitedFactor(view,Math.exp(-Math.max(-250,Math.min(250,delta))*.002))));
    }
    element.addEventListener('pointerdown',down);
    element.addEventListener('pointermove',move,{passive:false});
    for(const type of ['pointerup','pointercancel','lostpointercapture'])element.addEventListener(type,end);
    element.addEventListener('wheel',wheel,{passive:false});
    return {cancel(){pointers.clear();baseline=null;blocked=true;}};
  }
  const api={attach,anchored,worldAt};
  if(typeof module!=='undefined')module.exports=api;else root.TactaGestures=api;
})(typeof window==='undefined'?globalThis:window);
