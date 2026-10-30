/* Independent educational implementation of Kerr–Schild null geodesics.
 * Equations and conventions are explained in raytracing.html. No upstream
 * application source is included. Outgoing Kerr–Schild chart, past-directed rays. Units: G=c=M=1, signature (-,+,+,+).
 * The exported float64 routines are a small CPU reference for validation.
 */
const dot = (a, b) => a.reduce((s, x, i) => s + x * b[i], 0);
const add = (a, b, scale = 1) => a.map((x, i) => x + scale * b[i]);
const unit = a => a.map(x => x / Math.hypot(...a));
const cross = (a, b) => [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];

export function metricTerms(x, a) {
  const aa=a*a, rho2=dot(x,x), A=rho2-aa;
  const B=Math.sqrt(A*A+4*aa*x[2]*x[2]);
  const r=Math.sqrt(Math.max((A+B)/2, 1e-16));
  const C=r*r+aa, D=r**4+aa*x[2]*x[2];
  return {r, B, C, D, f:2*r**3/D,
    l:[(r*x[0]-a*x[1])/C, (r*x[1]+a*x[0])/C, x[2]/r]};
}
export function metricDot(x, a, u, v) {
  const {f,l}=metricTerms(x,a), lc=[-1,...l];
  return -u[0]*v[0]+dot(u.slice(1),v.slice(1))+f*dot(lc,u)*dot(lc,v);
}
export function hamiltonian(x,p,a,pt=1) {
  const {f,l}=metricTerms(x,a), q=pt+dot(l,p);
  return 0.5*(-pt*pt+dot(p,p)-f*q*q);
}
export function phaseDerivative(x,p,a,pt=1) {
  const {r,B,C,D,f,l}=metricTerms(x,a), aa=a*a;
  const dr=[x[0]*r/B,x[1]*r/B,x[2]*(r*r+aa)/(r*B)];
  const df=dr.map((v,i)=>f*(3*v/r-(4*r**3*v+(i===2?2*aa*x[2]:0))/D));
  const S=x[0]*p[0]+x[1]*p[1];
  const N=r*S-a*(x[1]*p[0]-x[0]*p[1]);
  const dN=dr.map((v,i)=>S*v+(i===0?r*p[0]+a*p[1]:i===1?r*p[1]-a*p[0]:0));
  const dlp=dr.map((v,i)=>(dN[i]*C-2*r*N*v)/(C*C)+p[2]*((i===2?1:0)/r-x[2]*v/(r*r)));
  const q=pt+dot(l,p);
  return {x:p.map((v,i)=>v-f*q*l[i]),p:df.map((v,i)=>0.5*q*q*v+f*q*dlp[i])};
}
export function rk4(x,p,a,h,pt=1) {
  const k1=phaseDerivative(x,p,a,pt);
  const k2=phaseDerivative(add(x,k1.x,h/2),add(p,k1.p,h/2),a,pt);
  const k3=phaseDerivative(add(x,k2.x,h/2),add(p,k2.p,h/2),a,pt);
  const k4=phaseDerivative(add(x,k3.x,h),add(p,k3.p,h),a,pt);
  return {x:x.map((v,i)=>v+h*(k1.x[i]+2*k2.x[i]+2*k3.x[i]+k4.x[i])/6),
    p:p.map((v,i)=>v+h*(k1.p[i]+2*k2.p[i]+2*k3.p[i]+k4.p[i])/6)};
}
export function cameraTetrad(x,a) {
  const {f}=metricTerms(x,a);
  if(f>=1) throw new Error('Static observer must be outside the ergosphere.');
  const u=[1/Math.sqrt(1-f),0,0,0];
  const forward=unit(x.map(v=>-v));
  const right=unit(cross(forward,[0,0,1]));
  const up=unit(cross(right,forward));
  const basis=[];
  for(const seed of [right,up,forward]) {
    let v=[0,...seed];
    v=add(v,u,metricDot(x,a,u,v));
    for(const b of basis) v=add(v,b,-metricDot(x,a,b,v));
    v=v.map(c=>c/Math.sqrt(metricDot(x,a,v,v)));
    basis.push(v);
  }
  return {u,basis};
}
export function cameraRay(x,a,screenX,screenY) {
  const {u,basis}=cameraTetrad(x,a), n=unit([screenX,screenY,1]);
  let k=u.map(v=>-v);
  basis.forEach((b,i)=>k=add(k,b,n[i]));
  const {f,l}=metricTerms(x,a), lc=[-1,...l], lk=dot(lc,k);
  const pc=k.map((v,i)=>(i===0?-v:v)+f*lc[i]*lk);
  return {x:x.slice(),p:pc.slice(1).map(v=>v/pc[0]),pt:1};
}
export function traceRay(initial,a,{step=0.035,maxSteps=1200,escape=70}={}) {
  let {x,p,pt=1}=initial, maxH=Math.abs(hamiltonian(x,p,a,pt)), steps=0;
  const horizon=1+Math.sqrt(1-a*a);
  while(steps++<maxSteps) {
    const {r}=metricTerms(x,a);
    if(r<horizon*1.002) return {x,p,steps,maxH,fate:'captured'};
    if(r>escape) return {x,p,steps,maxH,fate:'escaped'};
    ({x,p}=rk4(x,p,a,Math.min(0.85,Math.max(0.018,step*r)),pt));
    maxH=Math.max(maxH,Math.abs(hamiltonian(x,p,a,pt)));
    if(!x.every(Number.isFinite)||!p.every(Number.isFinite)) return {x,p,steps,maxH,fate:'invalid'};
  }
  return {x,p,steps,maxH,fate:'budget'};
}
export function isco(a) {
  const z1=1+Math.cbrt(1-a*a)*(Math.cbrt(1+a)+Math.cbrt(1-a));
  const z2=Math.sqrt(3*a*a+z1*z1);
  return 3+z2-Math.sign(a)*Math.sqrt((3-z1)*(3+z1+2*z2));
}

const vertexSource=`#version 300 es
in vec2 position;
void main(){gl_Position=vec4(position,0.0,1.0);}`;
const fragmentSource=`#version 300 es
precision highp float;
out vec4 fragColor;
uniform vec2 size;
uniform vec3 camera;
uniform vec4 e0,e1,e2,e3;
uniform float spin,innerEdge,stepScale;
uniform int budget,viewMode;
uniform bool diskOn;
const float PI=3.141592653589793;
struct Geometry{float r;float B;float C;float D;float f;vec3 l;};
Geometry geometry(vec3 x){
 float a2=spin*spin;float A=dot(x,x)-a2;
 float B=sqrt(A*A+4.0*a2*x.z*x.z);float r=sqrt(max(0.5*(A+B),1e-12));
 float C=r*r+a2;float D=r*r*r*r+a2*x.z*x.z;
 return Geometry(r,B,C,D,2.0*r*r*r/D,vec3(r*x.x-spin*x.y,r*x.y+spin*x.x,C*x.z/r)/C);
}
void derivative(vec3 x,vec3 p,out vec3 dx,out vec3 dp){
 Geometry g=geometry(x);float r=g.r,a2=spin*spin;
 vec3 dr=vec3(x.xy*r/g.B,x.z*(r*r+a2)/(r*g.B));
 vec3 df=g.f*(3.0*dr/r-(4.0*r*r*r*dr+vec3(0.0,0.0,2.0*a2*x.z))/g.D);
 float S=dot(x.xy,p.xy),N=r*S-spin*(x.y*p.x-x.x*p.y);
 vec3 dN=S*dr+vec3(r*p.x+spin*p.y,r*p.y-spin*p.x,0.0);
 vec3 dlp=(dN*g.C-2.0*r*N*dr)/(g.C*g.C)+p.z*(vec3(0,0,1)/r-x.z*dr/(r*r));
 float q=1.0+dot(g.l,p);dx=p-g.f*q*g.l;dp=0.5*q*q*df+g.f*q*dlp;
}
void advance(inout vec3 x,inout vec3 p,float h){
 vec3 x1,p1,x2,p2,x3,p3,x4,p4;
 derivative(x,p,x1,p1);derivative(x+0.5*h*x1,p+0.5*h*p1,x2,p2);
 derivative(x+0.5*h*x2,p+0.5*h*p2,x3,p3);derivative(x+h*x3,p+h*p3,x4,p4);
 x+=h*(x1+2.0*x2+2.0*x3+x4)/6.0;p+=h*(p1+2.0*p2+2.0*p3+p4)/6.0;
}
float residual(vec3 x,vec3 p){Geometry g=geometry(x);float q=1.0+dot(g.l,p);
 return abs(-1.0+dot(p,p)-g.f*q*q)/(1.0+dot(p,p)+abs(g.f*q*q));}
float hash(vec2 x){return fract(sin(dot(x,vec2(127.1,311.7)))*43758.5453);}
vec3 sky(vec3 n){
 n=normalize(n);vec2 uv=vec2(atan(n.y,n.x)/(2.0*PI)+0.5,acos(clamp(n.z,-1.0,1.0))/PI);
 vec3 c=vec3(0.018,0.032,0.055);
 // A coordinate grid makes bending observable without inventing astronomical data.
 vec2 line=abs(fract(uv*vec2(24.0,12.0)+0.5)-0.5);
 float grid=1.0-smoothstep(0.008,0.025,min(line.x,line.y));
 c+=grid*vec3(0.055,0.095,0.13);
 vec2 cell=floor(uv*vec2(440,220)),q=fract(uv*vec2(440,220));float rnd=hash(cell);
 float star=(1.0-smoothstep(0.035,0.17,length(q-0.5)))*step(0.993,rnd);
 c+=star*mix(vec3(0.4,0.65,0.9),vec3(1.0,0.75,0.4),hash(cell+7.0));
 return c;
}
vec3 diskColor(vec3 x,vec3 p){
 float r=geometry(x).r;float L=x.x*p.y-x.y*p.x;
 float om=1.0/(pow(r,1.5)+spin);
 float ut=(1.0+spin/pow(r,1.5))/sqrt(max(1e-5,1.0-3.0/r+2.0*spin/pow(r,1.5)));
 float obs=1.0/sqrt(1.0-geometry(camera).f);
 float shift=clamp(obs/(ut*(1.0+om*L)),0.05,3.5);
 float radial=pow(innerEdge/r,2.6)*max(0.0,1.0-sqrt(innerEdge/r));
 float rings=0.83+0.17*sin(4.5*r+2.0*sin(atan(x.y,x.x)*5.0));
 vec3 base=mix(vec3(1.0,0.22,0.035),vec3(0.75,0.88,1.0),clamp(shift-0.55,0.0,1.0));
 return 16.0*radial*rings*pow(shift,4.0)*base;
}
void main(){
 vec2 uv=(2.0*gl_FragCoord.xy-size)/size.y;
 vec3 n=normalize(vec3(uv*0.30,1.0));
 vec4 k=-e0+n.x*e1+n.y*e2+n.z*e3;
 Geometry g=geometry(camera);vec4 lc=vec4(-1.0,g.l);
 vec4 cov=vec4(-k.x,k.yzw)+g.f*lc*dot(lc,k);
 vec3 x=camera,p=cov.yzw/cov.x,color=vec3(0.0);
 float maxError=residual(x,p),horizon=1.0+sqrt(1.0-spin*spin);int fate=2;
 bool hitDisk=false;
 for(int i=0;i<1100;i++){
  if(i>=budget)break;
  float r=geometry(x).r;
  if(r<horizon*1.002){fate=0;break;}
  if(r>70.0){fate=1;color=sky(x);break;}
  vec3 oldX=x,oldP=p;float h=clamp(stepScale*r,0.018,0.85);
  advance(x,p,h);maxError=max(maxError,residual(x,p));
  if(any(isnan(x))||any(isnan(p))||length(p)>10000.0){fate=3;break;}
  if(diskOn&&oldX.z*x.z<0.0){
   float s=oldX.z/(oldX.z-x.z);vec3 at=mix(oldX,x,s),ap=mix(oldP,p,s);float rr=geometry(at).r;
   if(rr>innerEdge&&rr<14.0){color=diskColor(at,ap);fate=4;hitDisk=true;break;}
  }
 }
 if(fate==2||fate==3)color=vec3(0.5,0.015,0.43);
 if(viewMode==1){
  float v=clamp((log(max(maxError,1e-9))/log(10.0)+7.0)/5.0,0.0,1.0);
  color=mix(vec3(0.025,0.12,0.2),vec3(1.0,0.22,0.07),v);
 }else if(viewMode==2){
  color=fate==0?vec3(0.005,0.008,0.015):fate==1?vec3(0.12,0.55,0.62):fate==4?vec3(0.8,0.4,0.10):vec3(0.55,0.04,0.55);
 }else{color=vec3(1.0)-exp(-color);color=pow(color,vec3(1.0/2.2));}
 fragColor=vec4(color,1.0);
}`;

function shader(gl,type,source){
 const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);
 if(!gl.getShaderParameter(s,gl.COMPILE_STATUS)){const msg=gl.getShaderInfoLog(s);gl.deleteShader(s);throw new Error(msg);}
 return s;
}
function attachLab(root){
 const canvas=root.querySelector('canvas'),status=root.querySelector('[data-kerr-status]');
 const controls=Object.fromEntries([...root.querySelectorAll('[data-kerr-control]')].map(n=>[n.dataset.kerrControl,n]));
 const gl=canvas.getContext('webgl2',{alpha:false,antialias:false,preserveDrawingBuffer:true});
 if(!gl){status.textContent='当前浏览器没有可用的 WebGL 2。下方公式、流程图和 CPU 验证仍可阅读；本交互需要开启硬件加速。';return;}
 let program;
 try{
  program=gl.createProgram();gl.attachShader(program,shader(gl,gl.VERTEX_SHADER,vertexSource));gl.attachShader(program,shader(gl,gl.FRAGMENT_SHADER,fragmentSource));gl.linkProgram(program);
  if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(program));
 }catch(error){status.textContent='着色器未能编译，当前设备无法运行此实验。';console.error(error);return;}
 gl.useProgram(program);
 const buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),gl.STATIC_DRAW);
 const loc=gl.getAttribLocation(program,'position');gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,2,gl.FLOAT,false,0,0);
 const names=['size','camera','e0','e1','e2','e3','spin','innerEdge','stepScale','budget','viewMode','diskOn'];
 const uniforms=Object.fromEntries(names.map(n=>[n,gl.getUniformLocation(program,n)]));
 let azimuth=0.4,elevation=0.32,pending=false,drag=null,lost=false;
 function schedule(){if(!pending&&!lost){pending=true;requestAnimationFrame(render);}}
 function render(){
  pending=false;if(lost)return;
  const a=+controls.spin.value,q=+controls.quality.value;
  const qualities=[{width:300,step:0.065,n:480},{width:440,step:0.035,n:780},{width:620,step:0.020,n:1080}];
  const quality=qualities[q]||qualities[1];
  canvas.width=Math.min(quality.width,Math.max(240,Math.round(canvas.clientWidth||440)));canvas.height=Math.round(canvas.width*0.60);
  const radius=+controls.distance.value;
  const camera=[radius*Math.cos(elevation)*Math.cos(azimuth),radius*Math.cos(elevation)*Math.sin(azimuth),radius*Math.sin(elevation)];
  const tetrad=cameraTetrad(camera,a);
  gl.viewport(0,0,canvas.width,canvas.height);gl.useProgram(program);
  gl.uniform2f(uniforms.size,canvas.width,canvas.height);gl.uniform3fv(uniforms.camera,camera);
  gl.uniform4fv(uniforms.e0,tetrad.u);tetrad.basis.forEach((v,i)=>gl.uniform4fv(uniforms['e'+(i+1)],v));
  gl.uniform1f(uniforms.spin,a);gl.uniform1f(uniforms.innerEdge,isco(a));gl.uniform1f(uniforms.stepScale,quality.step);
  gl.uniform1i(uniforms.budget,quality.n);gl.uniform1i(uniforms.viewMode,+controls.mode.value);gl.uniform1i(uniforms.diskOn,controls.disk.checked?1:0);
  gl.drawArrays(gl.TRIANGLES,0,3);
  root.querySelector('[data-kerr-spin]').textContent=a.toFixed(2);
  root.querySelector('[data-kerr-distance]').textContent=radius.toFixed(0);
  status.textContent=`a/M = ${a.toFixed(2)} · r₊ = ${(1+Math.sqrt(1-a*a)).toFixed(3)} M · 顺行 ISCO = ${isco(a).toFixed(3)} M · ${canvas.width} × ${canvas.height} 像素 · 每条光线最多 ${quality.n} 步`;
  canvas.dataset.rendered='true';canvas.dataset.spin=String(a);
 }
 Object.values(controls).forEach(node=>node.addEventListener('input',schedule));
 root.querySelector('[data-kerr-reset]')?.addEventListener('click',()=>{azimuth=0.4;elevation=0.32;controls.spin.value='0.7';controls.distance.value='24';controls.mode.value='0';controls.disk.checked=true;schedule();});
 canvas.addEventListener('pointerdown',e=>{drag={x:e.clientX,y:e.clientY};canvas.setPointerCapture(e.pointerId);});
 canvas.addEventListener('pointermove',e=>{if(!drag)return;azimuth-=(e.clientX-drag.x)*0.008;elevation=Math.max(0.05,Math.min(1.45,elevation+(e.clientY-drag.y)*0.006));drag={x:e.clientX,y:e.clientY};schedule();});
 const release=()=>{drag=null;};canvas.addEventListener('pointerup',release);canvas.addEventListener('pointercancel',release);
 canvas.addEventListener('keydown',e=>{if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))return;e.preventDefault();azimuth+=(e.key==='ArrowLeft'?0.12:e.key==='ArrowRight'?-0.12:0);elevation=Math.max(0.05,Math.min(1.45,elevation+(e.key==='ArrowUp'?0.1:e.key==='ArrowDown'?-0.1:0)));schedule();});
 canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();lost=true;status.textContent='WebGL 上下文已丢失，请重新加载本页恢复实验。';});
 if(typeof ResizeObserver!=='undefined')new ResizeObserver(schedule).observe(root);
 schedule();
}
if(typeof document!=='undefined')document.querySelectorAll('[data-kerr-lab]').forEach(attachLab);
