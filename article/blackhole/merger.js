// Educational inspiral + explicitly artificial merger bridge + fitted QNM.
// This does not evolve Einstein's field equations. See merger.html for scope.
import {buildModel as makePhysicsModel, sample as evaluate} from "./merger-physics.mjs";
const $ = (id) => document.getElementById(id);
const inputs = ["total-mass", "mass-ratio", "remnant-spin"].map($);
const orbit = $("merger-orbit"), wave = $("merger-wave");
let model, time = 0, playing = false, previous = 0, raf = 0;
const colors = {inspiral:"#70c7e2", merger:"#ffcb77", ringdown:"#c9a2ff", grid:"#314252", text:"#cfdae4", muted:"#8cabbf"};

function fitCanvas(canvas) {
  const rect = canvas.getBoundingClientRect(), dpr = Math.min(devicePixelRatio || 1, 2);
  const w = Math.max(280, rect.width), h = rect.height || 260;
  if (canvas.width !== Math.round(w*dpr) || canvas.height !== Math.round(h*dpr)) {
    canvas.width = Math.round(w*dpr); canvas.height = Math.round(h*dpr);
  }
  const ctx=canvas.getContext("2d"); ctx.setTransform(dpr,0,0,dpr,0,0);
  return {ctx,w,h};
}
function buildModel() {
  const M=+inputs[0].value, q=+inputs[1].value, spin=+inputs[2].value;
  model=makePhysicsModel(M,q,spin);
  $("mass-value").textContent=M+" M☉"; $("ratio-value").textContent=q.toFixed(1);
  $("spin-value").textContent=spin.toFixed(2);
  time=0; playing=false; $("merger-play").textContent="播放"; $("merger-time").value=0;
  draw();
}
function sample(t) {
  return evaluate(t,model);
}
function background(ctx,w,h) {
  ctx.fillStyle="#101c29";ctx.fillRect(0,0,w,h);ctx.font="12px system-ui,sans-serif";
}
function drawOrbit(s) {
  const {ctx,w,h}=fitCanvas(orbit);background(ctx,w,h);
  const cx=w/2, cy=h/2+8, scale=Math.min((w-55)/36,(h-80)/33);
  ctx.strokeStyle=colors.grid;ctx.lineWidth=1;
  ctx.beginPath();ctx.moveTo(25,cy);ctx.lineTo(w-25,cy);ctx.moveTo(cx,38);ctx.lineTo(cx,h-30);ctx.stroke();
  ctx.fillStyle=colors.muted;ctx.fillText("轨道平面 · 坐标位置示意",16,22);
  ctx.fillText("距离单位：GMz/c²",16,h-13);
  const m=model;
  function point(t, which) {
    const p=sample(Math.max(0,t)), f=which===1 ? 1/(1+m.q) : -m.q/(1+m.q);
    return [cx+f*p.x*Math.cos(p.phase/2)*scale,cy+f*p.x*Math.sin(p.phase/2)*scale];
  }
  if(s.stage!=="ringdown") {
    const period=2/Math.max(1,s.f), start=Math.max(0,time-1.3*period);
    for(const [which,color] of [[1,colors.inspiral],[2,colors.merger]]) {
      ctx.beginPath();ctx.lineWidth=1.5;ctx.strokeStyle=color+"88";
      for(let i=0;i<=150;i++){const p=point(start+(time-start)*i/150,which);if(i===0)ctx.moveTo(...p);else ctx.lineTo(...p);}
      ctx.stroke();
      const p=point(time,which), frac=which===1?m.q/(1+m.q):1/(1+m.q);
      const radius=Math.max(5,2*frac*scale);
      ctx.fillStyle="#070d15";ctx.strokeStyle=color;ctx.lineWidth=2;
      ctx.beginPath();ctx.arc(...p,radius,0,2*Math.PI);ctx.fill();ctx.stroke();
      ctx.fillStyle=color;
      ctx.fillText("m"+which+" = "+(m.M*frac).toFixed(1)+" M☉",p[0]+radius+4,p[1]+(which===1?-12:20));
    }
  } else {
    const wobble=.18*Math.exp(-(time-m.merger)/m.damp)*Math.cos(s.phase);
    ctx.save();ctx.translate(cx,cy);ctx.rotate(s.phase/2);
    ctx.beginPath();ctx.ellipse(0,0,2.3*scale*(1+wobble),2.3*scale*(1-wobble),0,0,2*Math.PI);
    ctx.fillStyle="#070d15";ctx.fill();ctx.strokeStyle=colors.ringdown;ctx.lineWidth=2.5;ctx.stroke();ctx.restore();
    ctx.fillStyle=colors.ringdown;ctx.fillText("假定残骸 · 图形形变仅示意",Math.max(16,cx-96),cy+45);
  }
  ctx.fillStyle=colors[s.stage];ctx.textAlign="right";
  ctx.fillText({inspiral:"四极矩旋近",merger:"人工过渡",ringdown:"单模态振铃"}[s.stage],w-16,22);ctx.textAlign="left";
}
function drawWave() {
  const {ctx,w,h}=fitCanvas(wave);background(ctx,w,h);
  const left=54,right=18,top=28,bottom=42,pw=w-left-right,ph=h-top-bottom,m=model;
  const lo=$("merger-window").value==="late"?Math.max(0,m.merger-.35):0,span=m.total-lo;
  const xa=t=>left+(t-lo)/span*pw, ymax=m.ap*1.35;
  const ya=y=>top+ph/2-y/(2*ymax)*ph;
  ctx.fillStyle=colors.merger+"14";ctx.fillRect(xa(m.duration),top,Math.max(2,xa(m.merger)-xa(m.duration)),ph);
  ctx.fillStyle=colors.ringdown+"14";ctx.fillRect(xa(m.merger),top,xa(m.total)-xa(m.merger),ph);
  ctx.strokeStyle=colors.grid;ctx.lineWidth=1;
  for(let j=-1;j<=1;j++) {
    const y=ya(j*ymax*.75);ctx.beginPath();ctx.moveTo(left,y);ctx.lineTo(w-right,y);ctx.stroke();
    ctx.fillStyle=colors.muted;ctx.textAlign="right";ctx.fillText((j*ymax*.75).toFixed(2),left-7,y+4);
  }
  const count=Math.min(16000,Math.max(1800,Math.ceil(span*m.fq*14)));
  let oldStage="";
  for(let i=0;i<=count;i++) {
    const t=lo+span*i/count,p=sample(t),x=xa(t),y=ya(p.h);
    if(p.stage!==oldStage){if(i)ctx.stroke();ctx.beginPath();ctx.strokeStyle=colors[p.stage];ctx.lineWidth=1.2;ctx.moveTo(x,y);oldStage=p.stage;}
    else ctx.lineTo(x,y);
  }ctx.stroke();
  if(time>=lo){ctx.strokeStyle="#f4f3e8";ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(xa(time),top);ctx.lineTo(xa(time),h-bottom);ctx.stroke();}
  ctx.fillStyle=colors.text;ctx.textAlign="left";ctx.fillText("h+ / 10⁻²¹  · 正面观测，400 Mpc",left,17);
  ctx.fillStyle=colors.muted;ctx.textAlign="center";
  for(let i=0;i<=4;i++){const t=lo+i/4*span;ctx.fillText((t-m.merger).toFixed(2),xa(t),h-bottom+19);}
  ctx.fillText("相对人工振铃起点的时间 / s",left+pw/2,h-7);
  ctx.textAlign="left";
}
function draw() {
  if(!model)return;
  const s=sample(time);drawOrbit(s);drawWave();
  const mc=model.M*model.eta**.6, p=time-model.merger;
  $("merger-readout").textContent="t = "+p.toFixed(4)+" s　·　"+
    (s.stage==="inspiral"?"r/M = "+s.x.toFixed(2)+"　·　":"")+
    "fGW = "+s.f.toFixed(1)+" Hz　·　ℳz = "+mc.toFixed(2)+" M☉　·　"+
    "f220 = "+model.fq.toFixed(1)+" Hz，τ220 = "+(model.damp*1000).toFixed(2)+" ms";
}
function tick(stamp) {
  if(!playing){raf=0;return;}
  if(previous)time=Math.min(model.total,time+(stamp-previous)/1000*(+$("merger-speed").value));
  previous=stamp;$("merger-time").value=Math.round(time/model.total*1000);draw();
  if(time>=model.total){playing=false;$("merger-play").textContent="重新播放";previous=0;raf=0;return;}
  raf=requestAnimationFrame(tick);
}
$("merger-play").addEventListener("click",()=>{
  playing=!playing;previous=0;
  if(playing&&time>=model.total)time=0;
  $("merger-play").textContent=playing?"暂停":"播放";
  if(playing&&!raf)raf=requestAnimationFrame(tick);
});
$("merger-time").addEventListener("input",()=>{
  playing=false;previous=0;$("merger-play").textContent="播放";
  time=model.total*(+$("merger-time").value)/1000;draw();
});
$("merger-reset").addEventListener("click",buildModel);
$("merger-window").addEventListener("input",draw);
inputs.forEach(input=>input.addEventListener("input",buildModel));
new ResizeObserver(()=>draw()).observe(orbit);
document.addEventListener("visibilitychange",()=>{
  if(document.hidden){playing=false;previous=0;$("merger-play").textContent="播放";}
});
buildModel();

// Exposed only for reproducible numerical checks, not a dependency for other pages.
window.blackholeMergerModel = {sample: t=>sample(t), parameters: ()=>({...model})};
