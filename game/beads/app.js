const {exchanges,solvedState,rotate,isSolved}=Puzzle;
const board=document.querySelector('#board'),NS='http://www.w3.org/2000/svg';
const R=80,D=R/Math.tan(Math.PI/8),BIG=Math.hypot(R,D),STEP=Math.PI/4;
const centers=[[320,320-D],[320+D,320],[320,320+D],[320-D,320]];
const palette=['#dc806c','#e4bc64','#79a88c','#779fb8'];
const names=['上方','右方','下方','左方'];
let state=solvedState(),drag=null,busy=false,version=0;
const beads=[];
function el(tag,attrs,parent=board){const node=document.createElementNS(NS,tag);for(const [k,v]of Object.entries(attrs))node.setAttribute(k,v);parent.appendChild(node);return node;}
const defs=el('defs',{});
palette.forEach((color,i)=>{const g=el('radialGradient',{id:`bead-${i}`,cx:'32%',cy:'25%',r:'80%'},defs);el('stop',{offset:'0%','stop-color':color},g);el('stop',{offset:'100%','stop-color':color,'stop-opacity':'.89'},g);});
centers.forEach(([cx,cy],r)=>{
  for(const radius of [R-32,R+32])el('circle',{cx,cy,r:radius,class:'rail home-rail',style:`--home-color:${palette[r]}`});
  const target=el('circle',{cx,cy,r:R,class:'hit ring-key',tabindex:0,role:'button','aria-label':`${names[r]}导轨，左右方向键旋转`});
  target.addEventListener('pointerdown',e=>begin(e,r));target.addEventListener('keydown',e=>key(e,r));
});
for(const radius of [BIG-32,BIG+32])el('circle',{cx:320,cy:320,r:radius,class:'rail global-rail'});
const globalHit=el('circle',{cx:320,cy:320,r:BIG,class:'hit',tabindex:0,role:'button','aria-label':'虚拟导轨，拖动或左右方向键旋转'});
globalHit.addEventListener('pointerdown',e=>begin(e,4));globalHit.addEventListener('keydown',e=>key(e,4));
for(let id=0;id<32;id++){
  const bead=el('circle',{r:29.8,fill:`url(#bead-${Math.floor(id/8)})`,stroke:palette[Math.floor(id/8)],class:'bead'});
  bead.addEventListener('pointerdown',e=>{const ring=state.findIndex(row=>row.some(b=>b.id===id));begin(e,ring);});beads.push(bead);
}
function draw(ring=-1,angle=0){
  state.forEach((row,r)=>row.forEach((bead,s)=>{
    let a=s*STEP,x=centers[r][0]+R*Math.cos(a),y=centers[r][1]+R*Math.sin(a);
    if(r===ring){a+=angle;x=centers[r][0]+R*Math.cos(a);y=centers[r][1]+R*Math.sin(a);}
    else if(ring===4&&exchanges.some(([rr,ss])=>rr===r&&ss===s)){
      const dx=x-320,dy=y-320;x=320+dx*Math.cos(angle)-dy*Math.sin(angle);y=320+dx*Math.sin(angle)+dy*Math.cos(angle);
    }
    beads[bead.id].setAttribute('cx',x);beads[bead.id].setAttribute('cy',y);
  }));
}
function point(e){return new DOMPoint(e.clientX,e.clientY).matrixTransform(board.getScreenCTM().inverse());}
function begin(e,ring){if(busy||drag||e.button!==0)return;e.preventDefault();const p=point(e),c=ring===4?[320,320]:centers[ring];drag={ring,center:c,last:Math.atan2(p.y-c[1],p.x-c[0]),angle:0,id:e.pointerId};board.setPointerCapture(e.pointerId);}
board.addEventListener('pointermove',e=>{if(!drag||drag.id!==e.pointerId)return;const p=point(e),a=Math.atan2(p.y-drag.center[1],p.x-drag.center[0]);let delta=a-drag.last;delta=Math.atan2(Math.sin(delta),Math.cos(delta));drag.angle+=delta;drag.last=a;draw(drag.ring,drag.angle);});
function end(e,cancel=false){if(!drag||drag.id!==e.pointerId)return;const d=drag;drag=null;if(board.hasPointerCapture(e.pointerId))board.releasePointerCapture(e.pointerId);animate(d.ring,cancel?0:Math.round(d.angle/STEP),d.angle);}
board.addEventListener('pointerup',e=>end(e));board.addEventListener('pointercancel',e=>end(e,true));board.addEventListener('lostpointercapture',e=>{if(drag)end(e,true);});
function animate(ring,steps,from=0){
  if(busy)return;busy=true;const token=version,start=performance.now(),to=steps*STEP;
  const duration=matchMedia('(prefers-reduced-motion: reduce)').matches?0:Math.min(300,140+Math.abs(to-from)*80);
  function frame(now){if(token!==version)return;const t=duration?Math.min(1,(now-start)/duration):1;draw(ring,from+(to-from)*(1-(1-t)**3));
    if(t<1)requestAnimationFrame(frame);else{state=rotate(state,ring,steps);busy=false;draw();}}
  requestAnimationFrame(frame);
}
function key(e,ring){if(e.key==='ArrowRight'||e.key==='ArrowLeft'){e.preventDefault();if(!drag)animate(ring,e.key==='ArrowRight'?1:-1);}}
function fresh(shuffle){version++;busy=false;const old=drag;drag=null;if(old&&board.hasPointerCapture(old.id))board.releasePointerCapture(old.id);state=solvedState();
  if(shuffle){do{for(let i=0;i<80;i++)state=rotate(state,i%2?4:Math.floor(Math.random()*4),Math.random()<.5?1:-1);}while(isSolved(state));}
  draw();
}
document.querySelector('#reset').onclick=()=>fresh(false);document.querySelector('#shuffle').onclick=()=>fresh(true);draw();
