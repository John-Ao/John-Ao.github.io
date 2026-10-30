// Uses only the local copy of the published LIGO Figure 1 data.
// No filtering, fitted signal, synthetic noise, or normalization is added here.
const $=id=>document.getElementById(id), canvas=$("gw-plot");
const palette={h:"#70c7e2",l:"#ffbd79",nr:"#cbb2ff",grid:"#314252",text:"#d6e1eb",muted:"#91a8bc"};
let data=null, pointerTime=null, geometry=null;
const ui={det:$("gw-detector"),kind:$("gw-kind"),window:$("gw-window"),nr:$("gw-nr"),
  band:$("gw-band"),delay:$("gw-delay"),invert:$("gw-invert")};
function interval(){return ui.window.value==="peak"?[.39,.46]:ui.window.value==="late"?[.34,.46]:[.25,.46];}
function curves() {
  if(!data)return [];
  const out=[],residual=ui.kind.value==="residual",aligned=ui.det.value==="aligned";
  const add=(key,color,label,shift=0,sign=1)=>out.push({s:data.series[key],key,color,label,shift,sign});
  if(aligned) {
    const delay=+ui.delay.value/1000, invert=ui.invert.checked;
    if(residual)add("residual_h1",palette.h,"H1 残差",-delay,invert?-1:1);
    // The published aligned ASCII series uses a 7.0 ms display advance.
    // This differs from the inferred ~6.9 ms arrival delay quoted in the paper.
    else add("aligned_h1",palette.h,"H1（已变换）",.007-delay,invert?1:-1);
    add(residual?"residual_l1":"observed_l1",palette.l,residual?"L1 残差":"L1");
  } else {
    const det=ui.det.value.toLowerCase(), label=ui.det.value;
    add((residual?"residual_":"observed_")+det,det==="h1"?palette.h:palette.l,label+(residual?" 残差":" 观测"));
    if(!residual&&ui.nr.checked)add("nr_"+det,palette.nr,"官方 NR");
  }
  return out;
}
function interpolate(c,t) {
  const x=(t-c.shift-c.s.t0)/c.s.dt;
  if(x<0||x>c.s.n-1)return null;
  const i=Math.floor(x),j=Math.min(i+1,c.s.n-1),f=x-i;
  return c.sign*(c.s.y[i]*(1-f)+c.s.y[j]*f);
}
function correlation(items) {
  if(items.length!==2)return null;
  const [a,b]=items,[lo,hi]=interval(),pairs=[];
  for(let i=0;i<b.s.n;i++) {
    const t=b.s.t0+i*b.s.dt+b.shift;
    if(t<lo||t>hi)continue;
    const av=interpolate(a,t);
    if(av!==null)pairs.push([av,b.s.y[i]*b.sign]);
  }
  const n=pairs.length;if(n<3)return null;
  const am=pairs.reduce((s,p)=>s+p[0],0)/n,bm=pairs.reduce((s,p)=>s+p[1],0)/n;
  let aa=0,bb=0,ab=0;
  for(const [a,b] of pairs){aa+=(a-am)**2;bb+=(b-bm)**2;ab+=(a-am)*(b-bm);}
  return {r:ab/Math.sqrt(aa*bb),n};
}
function controls() {
  const aligned=ui.det.value==="aligned",residual=ui.kind.value==="residual";
  $("gw-alignment-controls").hidden=!aligned;
  $("gw-alignment-controls").style.display=aligned?"grid":"none";
  ui.nr.disabled=aligned||residual;ui.band.disabled=aligned||residual;
  $("gw-delay-value").textContent=(+ui.delay.value).toFixed(1)+" ms";
}
function fitCanvas() {
  const rect=canvas.getBoundingClientRect(),dpr=Math.min(devicePixelRatio||1,2);
  const w=Math.max(280,rect.width),h=rect.height||380;
  if(canvas.width!==Math.round(w*dpr)||canvas.height!==Math.round(h*dpr)) {
    canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);
  }
  const ctx=canvas.getContext("2d");ctx.setTransform(dpr,0,0,dpr,0,0);
  return {ctx,w,h};
}
function draw() {
  if(!data)return;
  controls();
  const {ctx,w,h}=fitCanvas(),[lo,hi]=interval(),items=curves();
  const left=w<430?43:55,right=16,top=57,bottom=47,pw=w-left-right,ph=h-top-bottom,ymax=1.4;
  const x=t=>left+(t-lo)/(hi-lo)*pw,y=v=>top+ph/2-v/(2*ymax)*ph;
  geometry={left,right,top,bottom,pw,ph,w,h,lo,hi,x,y};
  ctx.fillStyle="#101c29";ctx.fillRect(0,0,w,h);
  ctx.font="12px system-ui,sans-serif";
  ctx.strokeStyle=palette.grid;ctx.lineWidth=1;
  for(let j=-1;j<=1.01;j+=.5) {
    ctx.beginPath();ctx.moveTo(left,y(j));ctx.lineTo(w-right,y(j));ctx.stroke();
    ctx.fillStyle=palette.muted;ctx.textAlign="right";ctx.fillText(j.toFixed(1),left-7,y(j)+4);
  }
  const ticks=w<500?3:5;
  for(let i=0;i<=ticks;i++) {
    const t=lo+(hi-lo)*i/ticks;
    ctx.beginPath();ctx.moveTo(x(t),top);ctx.lineTo(x(t),h-bottom);ctx.stroke();
    ctx.textAlign="center";ctx.fillText(t.toFixed(2),x(t),h-bottom+20);
  }
  ctx.textAlign="left";ctx.fillStyle=palette.text;ctx.fillText("应变 / 10⁻²¹",left,19);
  let lx=left;
  for(const c of items) {
    ctx.strokeStyle=c.color;ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(lx,37);ctx.lineTo(lx+18,37);ctx.stroke();
    ctx.fillStyle=c.color;ctx.fillText(c.label,lx+24,41);lx+=ctx.measureText(c.label).width+46;
  }
  const showBand=ui.band.checked&&!ui.band.disabled;
  if(showBand&&w>580){ctx.fillStyle="#cbb2ff77";ctx.fillRect(lx,31,16,10);ctx.fillStyle=palette.text;ctx.fillText("90% 模板区间",lx+22,41);}
  ctx.save();ctx.beginPath();ctx.rect(left,top,pw,ph);ctx.clip();
  if(showBand) {
    const s=data.series["template_"+ui.det.value.toLowerCase()],points=[];
    for(let i=0;i<s.n;i++){const t=s.t0+i*s.dt;if(t>=lo&&t<=hi)points.push([t,s.low[i],s.high[i]]);}
    if(points.length) {
      ctx.beginPath();ctx.moveTo(x(points[0][0]),y(points[0][1]));
      for(const p of points)ctx.lineTo(x(p[0]),y(p[1]));
      for(let i=points.length-1;i>=0;i--)ctx.lineTo(x(points[i][0]),y(points[i][2]));
      ctx.closePath();ctx.fillStyle="#cbb2ff33";ctx.fill();
    }
  }
  for(const c of items) {
    ctx.beginPath();ctx.strokeStyle=c.color;ctx.lineWidth=c.key.startsWith("nr_")?2:1.35;
    let started=false;
    for(let i=0;i<c.s.n;i++) {
      const t=c.s.t0+i*c.s.dt+c.shift;
      if(t<lo-c.s.dt||t>hi+c.s.dt)continue;
      const px=x(t),py=y(c.s.y[i]*c.sign);
      if(!started){ctx.moveTo(px,py);started=true;}else ctx.lineTo(px,py);
    }ctx.stroke();
  }
  if(pointerTime!==null&&pointerTime>=lo&&pointerTime<=hi) {
    ctx.strokeStyle="#dce8f0aa";ctx.setLineDash([4,4]);ctx.lineWidth=1;
    ctx.beginPath();ctx.moveTo(x(pointerTime),top);ctx.lineTo(x(pointerTime),h-bottom);ctx.stroke();ctx.setLineDash([]);
    for(const c of items){const val=interpolate(c,pointerTime);if(val!==null){ctx.fillStyle=c.color;ctx.beginPath();ctx.arc(x(pointerTime),y(val),3,0,2*Math.PI);ctx.fill();}}
  }
  ctx.restore();
  ctx.fillStyle=palette.muted;ctx.textAlign="center";ctx.fillText("时间 / s（保持原论文的时间零点）",left+pw/2,h-8);ctx.textAlign="left";
  const aligned=ui.det.value==="aligned";
  if(aligned) {
    const corr=correlation(items);
    $("gw-readout").textContent=corr?"当前窗口 Pearson r = "+corr.r.toFixed(3)+"，共同采样点 "+corr.n+"。这是未按噪声 PSD 加权的相关系数，不是匹配滤波 SNR 或发现显著性。":"当前窗口没有足够共同采样点。";
  } else {
    $("gw-readout").textContent=ui.det.value+" · 官方"+(ui.kind.value==="residual"?"残差":"滤波应变")+
      " · 原发布采样率 16,384 Hz · 35–350 Hz 带通与谱线带阻 · 固定纵轴 ±1.4 × 10⁻²¹"+
      (showBand?" · 阴影为模板重建的 90% 可信区间":"");
  }
  if(pointerTime!==null) {
    const vals=items.map(c=>{const v=interpolate(c,pointerTime);return c.label+": "+(v===null?"超出数据范围":v.toFixed(4)+" × 10⁻²¹");});
    $("gw-pointer").textContent="t = "+pointerTime.toFixed(5)+" s　·　"+vals.join("　·　");
  } else $("gw-pointer").textContent="移动鼠标或触摸图像可读数；用 Tab 聚焦图像后，左右键每次移动 1 ms，Home / End 跳到窗口端点。数据来自本地文件。";
}
for(const input of Object.values(ui))input.addEventListener("input",()=>{pointerTime=null;draw();});
$("gw-official-alignment").addEventListener("click",()=>{ui.delay.value="7.0";ui.invert.checked=true;draw();});
function inspect(event) {
  if(!geometry)return;
  const rect=canvas.getBoundingClientRect(),g=geometry;
  const px=(event.clientX-rect.left)*g.w/rect.width;
  pointerTime=g.lo+Math.max(0,Math.min(1,(px-g.left)/g.pw))*(g.hi-g.lo);draw();
}
canvas.addEventListener("pointermove",inspect);canvas.addEventListener("pointerdown",inspect);
canvas.addEventListener("pointerleave",()=>{pointerTime=null;draw();});
canvas.addEventListener("focus",()=>{if(pointerTime===null)pointerTime=interval()[0];draw();});
canvas.addEventListener("keydown",event=>{
  if(!["ArrowLeft","ArrowRight","Home","End"].includes(event.key))return;
  event.preventDefault();
  const [lo,hi]=interval(),current=pointerTime===null?lo:pointerTime;
  pointerTime=event.key==="Home"?lo:event.key==="End"?hi:
    Math.max(lo,Math.min(hi,current+(event.key==="ArrowRight"?.001:-.001)));
  draw();
});
new ResizeObserver(()=>draw()).observe(canvas);
try {
  const response=await fetch(new URL("./data/gw150914.json",import.meta.url));
  if(!response.ok)throw new Error("HTTP "+response.status);
  data=await response.json();
  if(data.schema!=="blackhole-tutorial-gw150914-v1")throw new Error("Unexpected data schema");
  draw();
} catch(error) {
  $("gw-readout").textContent="数据读取失败。请使用静态 HTTP 服务或部署的网站打开本页；也可直接下载下方 JSON 与官方数据。";
  console.error("GW150914 data could not be loaded:",error);
}
