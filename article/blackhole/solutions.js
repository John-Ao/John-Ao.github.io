/* Geometric units G=c=M=1. All canvases are explanatory coordinate plots.
   No animation loop: diagrams redraw only when a control or viewport changes. */
const $ = id => document.getElementById(id);
const COLORS = {text:'#dce7f2', muted:'#96aabe', grid:'#293b4e', cyan:'#6cdecf', gold:'#ffca78', rose:'#ed8b9c', blue:'#8eafff'};
function setup(id, draw) {
  const canvas = $(id);
  if (!canvas) return;
  const paint = () => {
    const width = Math.max(280, canvas.clientWidth || 600);
    const height = Math.max(250, Math.min(430, width * .61));
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * ratio); canvas.height = Math.round(height * ratio);
    canvas.style.height = `${height}px`;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(ratio,0,0,ratio,0,0);
    ctx.fillStyle = '#101c29'; ctx.fillRect(0,0,width,height);
    ctx.font = '12px system-ui, sans-serif'; ctx.lineWidth = 1.5;
    draw(ctx,width,height);
  };
  new ResizeObserver(paint).observe(canvas);
  canvas.closest('.lab').querySelectorAll('input,select,button').forEach(el => el.addEventListener('input', paint));
  return paint;
}
function line(ctx, points, color, dash=[]) {
  ctx.strokeStyle=color; ctx.setLineDash(dash); ctx.beginPath();
  points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y)); ctx.stroke(); ctx.setLineDash([]);
}
function text(ctx, value,x,y,color=COLORS.text) {ctx.fillStyle=color;ctx.fillText(value,x,y);}
function plot(ctx,w,h,xmin,xmax,ymin,ymax) {
  const left=48,right=w-20,top=30,bottom=h-42;
  const X=x=>left+(x-xmin)/(xmax-xmin)*(right-left);
  const Y=y=>bottom-(y-ymin)/(ymax-ymin)*(bottom-top);
  for(let i=0;i<=5;i++){
    const x=xmin+(xmax-xmin)*i/5, y=ymin+(ymax-ymin)*i/5;
    line(ctx,[[X(x),top],[X(x),bottom]],COLORS.grid);
    line(ctx,[[left,Y(y)],[right,Y(y)]],COLORS.grid);
    text(ctx,x.toFixed(xmax>10?0:1),X(x)-8,bottom+20,COLORS.muted);
    text(ctx,y.toFixed(ymax>10?0:1),6,Y(y)+4,COLORS.muted);
  }
  return {X,Y,left,right,top,bottom};
}
function potential(r,L,kind){return (1-2/r)*((kind==='massive'?1:0)+L*L/(r*r));}
function initializePotential(){
  if(!$('potential'))return;
  const paint=setup('potential',(ctx,w,h)=>{
    const kind=$('particle-kind').value,L=+$('angular-momentum').value,e2=+$('energy-square').value;
    $('angular-value').textContent=L.toFixed(2);$('energy-value').textContent=e2.toFixed(3);
    const vmax=Math.max(1.25, potential(3,L,kind)*1.15,e2*1.15);
    const {X,Y,left,right,top,bottom}=plot(ctx,w,h,2,25,0,vmax);
    ctx.save();ctx.beginPath();ctx.rect(left,top,right-left,bottom-top);ctx.clip();
    const points=[];for(let r=2;r<=25;r+=.04)points.push([X(r),Y(potential(r,L,kind))]);
    line(ctx,points,COLORS.cyan);line(ctx,[[X(2),Y(e2)],[X(25),Y(e2)]],COLORS.gold,[6,4]);
    let answer='没有势垒极值；有质量粒子不能形成稳定圆轨道。';
    if(kind==='photon'){
      line(ctx,[[X(3),top],[X(3),bottom]],COLORS.rose,[3,3]);
      answer=`光子势垒在 r=3M；当前峰值 V=${(L*L/27).toFixed(3)}。E² ${e2>L*L/27?'高于':'低于或等于'}峰值。只有从外侧入射且 E² 高于峰值才会越过势垒。`;
    }else if(L*L>=12){
      const d=Math.sqrt(L**4-12*L*L),ru=(L*L-d)/2,rs=(L*L+d)/2;
      [ru,rs].forEach((r,i)=>{if(r<=25){ctx.fillStyle=i?COLORS.cyan:COLORS.rose;ctx.beginPath();ctx.arc(X(r),Y(potential(r,L,kind)),4,0,2*Math.PI);ctx.fill();}});
      answer=`势垒峰 r=${ru.toFixed(3)}M（不稳定），势阱底 r=${rs.toFixed(3)}M（${d<.001?'临界稳定':'稳定'}）。允许的径向区域满足 E² ≥ V；水平线与曲线相交处是转向点。${rs>25?' 势阱底在当前绘图范围以外。':''}`;
    }
    ctx.restore();text(ctx,'V(r)',12,17);text(ctx,'r / M',w-54,h-8);text(ctx,'青：有效势  黄：E²',w<420?85:w-210,17);
    $('potential-readout').textContent=answer;
  });
  $('particle-kind').addEventListener('change',()=>{const photon=$('particle-kind').value==='photon';$('angular-momentum').value=photon?'5.2':'4';$('energy-square').value=photon?'1':'.96';paint();});
  $('potential-reset').addEventListener('click',()=>{$('particle-kind').value='massive';$('angular-momentum').value='4';$('energy-square').value='.96';paint();});
  paint();
}
// Binet equation for null Schwarzschild geodesics: u''+u=3u².
// u=M/r, b=L/E in units M. Initial data obey the first integral.
export function integrateSchwarzschildRay(b, step=.0025, startRadius=30){
  const startU=1/startRadius;
  if(!(b>0&&step>0&&startRadius>2)||1/(b*b)-startU*startU+2*startU**3<0)throw new RangeError('Initial null ray must have b>0, step>0, r>2 and real inward radial momentum.');
  let u=startU,p=Math.sqrt(1/(b*b)-u*u+2*u*u*u),phi=0,maxError=0;
  const points=[];let outcome='达到积分上限';
  const f=(a,v)=>[v,3*a*a-a];
  for(let i=0;i<16000;i++){
    points.push([-Math.cos(phi)/u,Math.sin(phi)/u]);
    const oldU=u,oldPhi=phi;
    const k1=f(u,p),k2=f(u+step*k1[0]/2,p+step*k1[1]/2),k3=f(u+step*k2[0]/2,p+step*k2[1]/2),k4=f(u+step*k3[0],p+step*k3[1]);
    u+=step*(k1[0]+2*k2[0]+2*k3[0]+k4[0])/6;
    p+=step*(k1[1]+2*k2[1]+2*k3[1]+k4[1])/6;phi+=step;
    maxError=Math.max(maxError,Math.abs((p*p+u*u-2*u*u*u)*b*b-1));
    if(u>=.5){phi=oldPhi+step*(.5-oldU)/(u-oldU);points.push([-2*Math.cos(phi),2*Math.sin(phi)]);outcome='穿过视界，捕获';break;}
    if(u<=startU&&p<0){phi=oldPhi+step*(startU-oldU)/(u-oldU);points.push([-startRadius*Math.cos(phi),startRadius*Math.sin(phi)]);outcome=`返回 r=${startRadius}M，散射`;break;}
    if(!Number.isFinite(u)||u<=0){outcome='积分中止';break;}
  }
  return {points,outcome,maxError,phi};
}
function initializeRay(){
  if(!$('schwarz-ray'))return;
  const paint=setup('schwarz-ray',(ctx,w,h)=>{
    const b=+$('impact').value;$('impact-value').textContent=b.toFixed(3);
    const result=integrateSchwarzschildRay(b),scale=Math.min((w-30)/32,(h-45)/21),cx=w/2,cy=h*.52;
    const X=x=>cx+x*scale,Y=y=>cy-y*scale;
    for(let x=-16;x<=16;x+=4)line(ctx,[[X(x),25],[X(x),h-20]],COLORS.grid);
    for(let y=-8;y<=12;y+=4)line(ctx,[[10,Y(y)],[w-10,Y(y)]],COLORS.grid);
    ctx.fillStyle='#03080d';ctx.beginPath();ctx.arc(cx,cy,2*scale,0,Math.PI*2);ctx.fill();
    ctx.strokeStyle=COLORS.rose;ctx.setLineDash([4,4]);ctx.beginPath();ctx.arc(cx,cy,3*scale,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);
    ctx.save();ctx.beginPath();ctx.rect(5,25,w-10,h-50);ctx.clip();line(ctx,result.points.map(([x,y])=>[X(x),Y(y)]),COLORS.cyan);ctx.restore();
    text(ctx,'赤道平面坐标轨迹 · 网格 4M',14,17);
    text(ctx,'黑：r≤2M  虚线：r=3M',14,h-8);
    $('ray-readout').textContent=`${result.outcome}；累计转角 ${(result.phi/Math.PI).toFixed(3)}π。第一积分相对残差上界 ${result.maxError.toExponential(1)}。临界 b = 3√3 M ≈ 5.196152M。`;
  });
  document.querySelectorAll('[data-impact]').forEach(button=>button.addEventListener('click',()=>{$('impact').value=button.dataset.impact;paint();}));paint();
}
export function kerrRadii(chi){
  const a=Math.abs(chi),root=Math.sqrt(1-a*a),z1=1+Math.cbrt(1-a*a)*(Math.cbrt(1+a)+Math.cbrt(1-a)),z2=Math.sqrt(3*a*a+z1*z1),d=Math.sqrt(Math.max(0,(3-z1)*(3+z1+2*z2)));
  return {outer:1+root,inner:1-root,pro:3+z2-d,retro:3+z2+d,omega:a/(2*(1+root))};
}
function initializeKerr(){
  if(!$('kerr-structure'))return;
  const paint=setup('kerr-structure',(ctx,w,h)=>{
    const a=+$('spin').value,theta=+$('latitude').value*Math.PI/180,R=kerrRadii(a),re=1+Math.sqrt(1-a*a*Math.cos(theta)**2);
    $('spin-value').textContent=a.toFixed(3);$('latitude-value').textContent=`${$('latitude').value}°`;
    const scale=Math.min((w-50)/6,(h-55)/5),cx=w/2,cy=h*.52,X=x=>cx+x*scale,Y=y=>cy-y*scale;
    line(ctx,[[X(-2.6),cy],[X(2.6),cy]],COLORS.grid);line(ctx,[[cx,Y(-2.2)],[cx,Y(2.2)]],COLORS.grid);
    function contour(radius,color,fill){const pts=[];for(let i=0;i<=256;i++){const t=i/256*Math.PI*2,r=typeof radius==='function'?radius(t):radius;pts.push([X(Math.sqrt(r*r+a*a)*Math.sin(t)),Y(r*Math.cos(t))]);}if(fill){ctx.beginPath();pts.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();ctx.fillStyle=fill;ctx.fill();}line(ctx,pts,color);}
    contour(t=>1+Math.sqrt(1-a*a*Math.cos(t)**2),COLORS.gold,'#ffca781b');
    contour(R.outer,COLORS.cyan,'#07131e');if(a>.005)contour(R.inner,COLORS.blue);
    [-a,a].forEach(x=>{ctx.fillStyle=COLORS.rose;ctx.beginPath();ctx.arc(X(x),cy,3,0,2*Math.PI);ctx.fill();});
    const ex=Math.sqrt(re*re+a*a)*Math.sin(theta),ez=re*Math.cos(theta);
    line(ctx,[[cx,cy],[X(ex),Y(ez)]],COLORS.muted,[4,3]);ctx.fillStyle=COLORS.gold;ctx.beginPath();ctx.arc(X(ex),Y(ez),4,0,Math.PI*2);ctx.fill();
    text(ctx,'z / M',cx+8,20);text(ctx,'x / M',w-52,cy-8);
    text(ctx,'黄：静止极限  青：外视界  蓝：内视界',12,h-9);
    $('kerr-readout').textContent=`r₊=${R.outer.toFixed(4)}M，r₋=${R.inner.toFixed(4)}M；所选 θ 的静止极限 rₑ=${re.toFixed(4)}M；ΩH=${R.omega.toFixed(4)} / M。顺行 ISCO=${R.pro.toFixed(4)}M，逆行 ISCO=${R.retro.toFixed(4)}M。`;
  });
  const paintISCO=setup('kerr-isco',(ctx,w,h)=>{
    const a=+$('spin').value,R=kerrRadii(a),{X,Y}=plot(ctx,w,h,0,1,0,10);
    for(const [key,color]of [['pro',COLORS.cyan],['retro',COLORS.gold],['outer',COLORS.blue]]){
      const pts=[];for(let x=0;x<=1.0001;x+=.005)pts.push([X(Math.min(x,1)),Y(kerrRadii(Math.min(x,1))[key])]);line(ctx,pts,color);
      ctx.fillStyle=color;ctx.beginPath();ctx.arc(X(a),Y(R[key]),4,0,Math.PI*2);ctx.fill();
    }
    line(ctx,[[X(a),Y(0)],[X(a),Y(10)]],COLORS.muted,[3,3]);text(ctx,'r / M',12,17);text(ctx,'a*',w-37,h-8);
    text(ctx,'青：顺行 ISCO  黄：逆行 ISCO  蓝：r₊',w<480?48:w-310,17);
  });
  $('spin').addEventListener('input',paintISCO);
  $('spin-reset').addEventListener('click',()=>{$('spin').value='.7';$('latitude').value='90';paint();paintISCO();});paint();paintISCO();
}
if(typeof document!=='undefined'){initializePotential();initializeRay();initializeKerr();}
