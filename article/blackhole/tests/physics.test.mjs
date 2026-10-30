import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
import {lorentzTransform, geometricUnits, parallelTriangle} from '../foundations.js';
import {metricTerms, metricDot, cameraTetrad, cameraRay, hamiltonian, phaseDerivative, rk4, traceRay, isco} from '../kerr-renderer.js';
import {integrateSchwarzschildRay, kerrRadii} from '../solutions.js';
const near=(a,b,tolerance=1e-10)=>assert.ok(Math.abs(a-b)<tolerance,`${a} != ${b} (tol=${tolerance})`);
const norm=a=>Math.hypot(...a);

test('Lorentz interval is invariant and inverse boost recovers the event',()=>{
  for(const beta of [-.85,-.4,0,.4,.85]){
    const q=lorentzTransform(1,.6,beta),back=lorentzTransform(q.ct,q.x,-beta);
    near(q.x*q.x-q.ct*q.ct,-.64);near(back.ct,1);near(back.x,.6);
  }
});
test('geometric units recover solar scales and scale linearly with mass',()=>{
  const one=geometricUnits(1),many=geometricUnits(65);
  near(one.length/1000,1.476625,1e-5);near(one.time,4.925491e-6,1e-12);
  near(many.length/one.length,65);near(many.time/one.time,65);
});
test('parallel transport on a spherical triangle gives the angle excess',()=>{
  for(const a of [.1,.5,Math.PI/2,2.5]){
    const v=parallelTriangle(a);near(norm(v),1);near(v[0],0);
    near(v[2],Math.cos(a));near(Math.abs(v[1]),Math.sin(a));
  }
});
test('Kerr-Schild null vector, inverse metric, and camera tetrad identities',()=>{
  for(const a of [0,.5,.95])for(const x of [[18,4,6],[8,-3,5],[-9,3,-6]]){
    const {f,l}=metricTerms(x,a);near(norm(l),1);
    const lc=[-1,...l],lu=[1,...l],eta=[-1,1,1,1];
    const g=lc.map((v,i)=>lc.map((w,j)=>(i===j?eta[i]:0)+f*v*w));
    const inv=lu.map((v,i)=>lu.map((w,j)=>(i===j?eta[i]:0)-f*v*w));
    for(let i=0;i<4;i++)for(let j=0;j<4;j++)near(g[i].reduce((s,v,k)=>s+v*inv[k][j],0),i===j?1:0);
    const {u,basis}=cameraTetrad(x,a),frame=[u,...basis];
    for(let i=0;i<4;i++)for(let j=0;j<4;j++)near(metricDot(x,a,frame[i],frame[j]),i===j?eta[i]:0);
    const ray=cameraRay(x,a,.2,-.1);near(hamiltonian(ray.x,ray.p,a),0);
  }
});
test('analytic Hamilton derivatives match an independent central difference',()=>{
  for(const a of [0,.7,.95])for(const x of [[7,3,2],[-8,5,-4],[12,-2,6]]){
    const p=[-.7,.3,.4],rhs=phaseDerivative(x,p,a),h=1e-4;
    for(let i=0;i<3;i++){
      const xp=x.slice(),xm=x.slice(),pp=p.slice(),pm=p.slice();xp[i]+=h;xm[i]-=h;pp[i]+=h;pm[i]-=h;
      near(rhs.p[i],-(hamiltonian(xp,p,a)-hamiltonian(xm,p,a))/(2*h),1e-8);
      near(rhs.x[i],(hamiltonian(x,pp,a)-hamiltonian(x,pm,a))/(2*h),1e-8);
    }
  }
});
test('Schwarzschild capture boundary agrees with analytic finite-camera shadow angle',()=>{
  const x=[24,0,0],r=24,critical=Math.asin(3*Math.sqrt(3)*Math.sqrt(1-2/r)/r);
  const inside=traceRay(cameraRay(x,0,Math.tan(critical-.001),0),0,{step:.02,maxSteps:2500});
  const outside=traceRay(cameraRay(x,0,Math.tan(critical+.001),0),0,{step:.02,maxSteps:2500});
  assert.equal(inside.fate,'captured');assert.equal(outside.fate,'escaped');
  assert.ok(outside.maxH<1e-5);
});
test('RK4 converges under step halving at fixed affine end time',()=>{
  const initial=cameraRay([18,2,5],.7,.35,.1);
  const run=h=>{let {x,p}=initial;for(let i=0;i<Math.round(8/h);i++)({x,p}=rk4(x,p,.7,h));return [...x,...p];};
  const reference=run(.00625),error=h=>norm(run(h).map((v,i)=>v-reference[i]));
  const e1=error(.4),e2=error(.2),e3=error(.1);
  assert.ok(e1/e2>12&&e1/e2<20,`ratio ${e1/e2}`);assert.ok(e2/e3>10&&e2/e3<23,`ratio ${e2/e3}`);
});
test('independent Binet integrator brackets bcrit and preserves its first integral',()=>{
  for(const b of [4,5.196,5.197,6.5,10]){
    const r=integrateSchwarzschildRay(b);assert.ok(r.maxError<1e-8);
    assert.ok(r.outcome.includes(b<3*Math.sqrt(3)?'捕获':'散射'));
  }
});
test('Kerr spin limits recover Schwarzschild and extremal ISCO values',()=>{
  near(isco(0),6);near(isco(1),1);near(isco(-1),9);
  const r=kerrRadii(0);assert.ok(Object.values(r).every(Number.isFinite));
});
test('all bundled TeX expressions parse with the shipped KaTeX',()=>{
  const root=fileURLToPath(new URL('..',import.meta.url));
  const context={module:{exports:{}},exports:{}};
  vm.runInNewContext(fs.readFileSync(root+'/vendor/katex.min.js','utf8'),context);
  let count=0;
  for(const file of fs.readdirSync(root).filter(x=>x.endsWith('.html'))){
    const html=fs.readFileSync(root+'/'+file,'utf8');
    for(const match of html.matchAll(/\\\[([\s\S]*?)\\\]|\\\(([\s\S]*?)\\\)/g)){
      const tex=(match[1]??match[2]).replaceAll('&amp;','&').replaceAll('&lt;','<').replaceAll('&gt;','>');
      assert.doesNotThrow(()=>context.module.exports.renderToString(tex,{throwOnError:true,strict:'ignore'}),`${file}: ${tex}`);count++;
    }
  }
  assert.ok(count>500,`${count} expressions`);
});
