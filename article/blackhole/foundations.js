export const LIGHT_SPEED = 299792458;
export const SOLAR_GM = 1.3271244e20;
export function lorentzTransform(ct, x, beta) {
  const gamma = 1 / Math.sqrt(1 - beta * beta);
  return { ct: gamma * (ct - beta * x), x: gamma * (x - beta * ct), gamma };
}
export function geometricUnits(mass) {
  return { length: SOLAR_GM * mass / LIGHT_SPEED ** 2, time: SOLAR_GM * mass / LIGHT_SPEED ** 3 };
}
const dot = (a,b) => a.reduce((s,x,i)=>s+x*b[i],0);
const cross = (a,b) => [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const norm = a => a.map(x=>x/Math.hypot(...a));
export function rotate(v, axis, angle) {
  const c=Math.cos(angle),s=Math.sin(angle),w=cross(axis,v),p=dot(axis,v);
  return v.map((x,i)=>x*c+w[i]*s+axis[i]*p*(1-c));
}
export function parallelTriangle(alpha) {
  const A=[1,0,0],N=[0,0,1],B=[Math.cos(alpha),Math.sin(alpha),0];
  let v=[0,0,1];
  for (const [a,b] of [[A,N],[N,B],[B,A]]) v=rotate(v,norm(cross(a,b)),Math.acos(Math.max(-1,Math.min(1,dot(a,b)))));
  return v;
}
function setup(canvas, mode="standard") {
  const width=Math.max(280,canvas.clientWidth||800),height=mode==="sphere"&&width<600?560:380,dpr=Math.min(window.devicePixelRatio||1,2);
  canvas.style.height=height+"px";
  canvas.width=width*dpr;canvas.height=height*dpr;
  const c=canvas.getContext('2d');c.scale(dpr,dpr);
  return {c,width,height};
}
function clear(c,w,h){c.fillStyle='#101c29';c.fillRect(0,0,w,h);c.lineWidth=1;c.font='14px system-ui';}
function line(c,points,color,width=2,dash=[]){c.strokeStyle=color;c.lineWidth=width;c.setLineDash(dash);c.beginPath();points.forEach((p,i)=>i?c.lineTo(...p):c.moveTo(...p));c.stroke();c.setLineDash([]);}
function arrow(c,a,b,color,width=2){line(c,[a,b],color,width);const t=Math.atan2(b[1]-a[1],b[0]-a[0]);line(c,[[b[0]-9*Math.cos(t-.45),b[1]-9*Math.sin(t-.45)],b,[b[0]-9*Math.cos(t+.45),b[1]-9*Math.sin(t+.45)]],color,width);}
function label(c,text,x,y,color='#b8cbd0'){c.fillStyle=color;c.fillText(text,x,y);}
function initLorentz(){
 const canvas=document.getElementById('lorentz-canvas');if(!canvas)return;
 const slider=document.getElementById('boost');
 const draw=()=>{const {c,width:w,height:h}=setup(canvas);const beta=+slider.value,q=lorentzTransform(1,.6,beta);clear(c,w,h);
 const scale=Math.min(105,(w-45)/6.6),ox=w/2,oy=320,p=(x,t)=>[ox+x*scale,oy-t*scale];
 for(let x=-3;x<=3;x++)line(c,[p(x,0),p(x,2.8)],'#243744',1);
 for(let t=0;t<3;t+=.5)line(c,[p(-3.2,t),p(3.2,t)],'#243744',1);
 arrow(c,p(-3.3,0),p(3.3,0),'#718e9d',1);arrow(c,p(0,-.1),p(0,2.8),'#718e9d',1);
 line(c,[p(-2.6,2.6),p(0,0),p(2.6,2.6)],'#526776',1,[5,5]);
 const hyper=[];for(let x=-2.4;x<=2.4;x+=.02)hyper.push(p(x,Math.sqrt(.64+x*x)));line(c,hyper,'#42636b',1);
 arrow(c,p(0,0),p(.6,1),'#ffbc78',2);arrow(c,p(0,0),p(q.x,q.ct),'#77d7da',2);
 for(const [x,t,color] of [[.6,1,'#ffbc78'],[q.x,q.ct,'#77d7da']]){c.beginPath();c.arc(...p(x,t),5,0,Math.PI*2);c.fillStyle=color;c.fill();}
 label(c,'x / x′',w-75,oy+28);label(c,'ct / ct′',ox+12,oy-2.8*scale);label(c,'原坐标 (0.600, 1.000)',32,32,'#ffbc78');label(c,`新坐标 (${q.x.toFixed(3)}, ${q.ct.toFixed(3)})`,32,58,'#77d7da');label(c,'−(ct)² + x² = −0.640',24,h-10);
 document.getElementById('boost-value').textContent=beta.toFixed(2);
 document.getElementById('boost-readout').textContent=`γ = ${q.gamma.toFixed(4)}　|　原间隔² = −0.640000　|　变换后 = ${(q.x*q.x-q.ct*q.ct).toFixed(6)}　|　运动钟 dτ / dt = ${(1/q.gamma).toFixed(4)}`;
 };slider.addEventListener('input',draw);window.addEventListener('resize',draw);draw();
}
function initUnits(){
 const input=document.getElementById('mass');if(!input)return;
 const display=document.getElementById('unit-readout');
 const f=x=>x<.01||x>1e8?x.toExponential(5):x.toLocaleString('zh-CN',{maximumFractionDigits:5});
 const draw=()=>{const m=+input.value;if(!Number.isFinite(m)||m<1||m>1e10){display.textContent='请输入 1–10000000000 之间的质量。';return;}const u=geometricUnits(m);display.textContent=`1M = ${f(u.length/1000)} km = ${f(u.time)} s　|　无自旋视界 2M = ${f(2*u.length/1000)} km　|　ISCO 6M = ${f(6*u.length/1000)} km　|　100M = ${f(100*u.time)} s`;};
 input.addEventListener('input',draw);document.getElementById('unit-preset').addEventListener('change',e=>{input.value=e.target.value;draw();});draw();
}
function initSphere(){
 const canvas=document.getElementById('transport-canvas');if(!canvas)return;
 const angle=document.getElementById('triangle-angle'),progress=document.getElementById('transport-progress');
 const view=norm([2,2,1.7]),right=norm([-view[1],view[0],0]),up=cross(view,right);
 let center=[270,192],radius=145;
 const project=v=>[center[0]+radius*dot(v,right),center[1]-radius*dot(v,up)];
 const arc=(a,b,part=1)=>{let axis=norm(cross(a,b)),t=Math.acos(Math.max(-1,Math.min(1,dot(a,b))))*part;return Array.from({length:65},(_,i)=>rotate(a,axis,t*i/64));};
 const draw=()=>{const {c,width:w,height:h}=setup(canvas,'sphere'),small=w<600;center=[small?w/2:w*.33,small?172:192];radius=Math.min(145,w*.4);clear(c,w,h);const alpha=+angle.value*Math.PI/180,step=+progress.value/100,vertices=[[1,0,0],[0,0,1],[Math.cos(alpha),Math.sin(alpha),0],[1,0,0]];
 c.beginPath();c.arc(...center,radius,0,2*Math.PI);c.fillStyle='#152c39';c.fill();c.strokeStyle='#54717f';c.stroke();
 for(let lat=-60;lat<=60;lat+=30){const t=lat*Math.PI/180;line(c,Array.from({length:101},(_,i)=>project([Math.cos(t)*Math.cos(i*Math.PI/50),Math.cos(t)*Math.sin(i*Math.PI/50),Math.sin(t)])),'#2c4858',1);}
 for(let lon=0;lon<180;lon+=30){const l=lon*Math.PI/180;line(c,Array.from({length:101},(_,i)=>project([Math.cos(i*Math.PI/50)*Math.cos(l),Math.cos(i*Math.PI/50)*Math.sin(l),Math.sin(i*Math.PI/50)])),'#294653',1);}
 for(let i=0;i<3;i++)line(c,arc(vertices[i],vertices[i+1]).map(v=>project(v)),'#ffbc78',2.2);
 let v=[0,0,1],pos=vertices[0],lengths=[Math.PI/2,Math.PI/2,alpha],remaining=step*(Math.PI+alpha);
 for(let i=0;i<3;i++){let part=Math.min(remaining/lengths[i],1),axis=norm(cross(vertices[i],vertices[i+1]));v=rotate(v,axis,lengths[i]*part);pos=rotate(vertices[i],axis,lengths[i]*part);remaining-=lengths[i];if(part<1)break;}
 const tip=pos.map((x,i)=>x+.32*v[i]);arrow(c,project(pos),project(tip),'#77d7da',3);
 for(const [p,text] of [[vertices[0],'A'],[vertices[1],'N'],[vertices[2],'B']]){const xy=project(p);c.beginPath();c.arc(...xy,3,0,Math.PI*2);c.fillStyle='#ffbc78';c.fill();label(c,text,xy[0]+9,xy[1]-6,'#ffbc78');}
 const final=parallelTriangle(alpha),origin=[small?w/2:w*.76,small?460:200];arrow(c,origin,[origin[0],origin[1]-80],'#ffbc78',2);arrow(c,origin,[origin[0]+80*final[1],origin[1]-80*final[2]],'#77d7da',3);
 label(c,'回到 A 的切平面',small?24:w*.61,small?355:48);label(c,'出发',origin[0]+12,origin[1]-76,'#ffbc78');label(c,`净转角 ${angle.value}°`,small?24:w*.62,small?535:325,'#77d7da');label(c,'球面大圆三角形',small?24:60,small?24:h-16);
 document.getElementById('triangle-angle-value').textContent=angle.value+'°';document.getElementById('transport-progress-value').textContent=progress.value+'%';document.getElementById('transport-readout').textContent=`球面 K = 1/R²　|　三角形面积 = ${alpha.toFixed(4)} R²　|　内角和 = ${180+(+angle.value)}°　|　平行移动净转角 = ${angle.value}°（取绝对值）`;
 };angle.addEventListener('input',draw);progress.addEventListener('input',draw);window.addEventListener('resize',draw);draw();
}
function initTidal(){
 const canvas=document.getElementById('tidal-canvas');if(!canvas)return;
 const r=document.getElementById('tidal-radius'),t=document.getElementById('tidal-time');
 const draw=()=>{const {c,width:w,height:h}=setup(canvas);clear(c,w,h);let radius=+r.value,delta=+t.value,k=1/radius**3;let radial=1+k*delta**2,tangent=1-.5*k*delta**2;
 const center=[w*.6,190],scale=Math.min(83,w*.16);for(let i=0;i<24;i++){const theta=i*Math.PI/12,a=[center[0]+scale*Math.cos(theta),center[1]+scale*Math.sin(theta)],b=[center[0]+radial*scale*Math.cos(theta),center[1]+tangent*scale*Math.sin(theta)];c.beginPath();c.arc(...a,2,0,2*Math.PI);c.fillStyle='#6d808e';c.fill();arrow(c,a,b,'#77d7da',1);c.beginPath();c.arc(...b,4,0,2*Math.PI);c.fillStyle='#77d7da';c.fill();}
 c.beginPath();c.arc(w*.13,190,Math.min(44,w*.08),0,2*Math.PI);c.fillStyle='#03090e';c.fill();c.strokeStyle='#ffbc78';c.stroke();line(c,[[w*.22,190],[w*.94,190]],'#465b69',1,[5,6]);label(c,'中心质量',15,262,'#ffbc78');label(c,'径向 x',w-60,178);label(c,'切向 y',w*.6,66);label(c,'小球团的局部形变（放大）',14,30);
 document.getElementById('tidal-radius-value').textContent=radius.toFixed(1)+' M';document.getElementById('tidal-time-value').textContent=delta.toFixed(1)+' M';
 document.getElementById('tidal-readout').textContent=`潮汐特征值 / M⁻²：(+${(2*k).toFixed(6)}, −${k.toFixed(6)}, −${k.toFixed(6)})　|　迹 = 0　|　δx/δx₀ ≈ ${radial.toFixed(4)}；δy/δy₀ ≈ ${tangent.toFixed(4)}`;
 };r.addEventListener('input',draw);t.addEventListener('input',draw);window.addEventListener('resize',draw);draw();
}
if(typeof document!=='undefined'){initLorentz();initUnits();initSphere();initTidal();}
