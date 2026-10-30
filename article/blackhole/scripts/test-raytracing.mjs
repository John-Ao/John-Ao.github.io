/* Independent physical checks for the tutorial's float64 reference.
 * Run from any directory: node article/blackhole/scripts/test-raytracing.mjs
 */
import fs from 'node:fs';
import assert from 'node:assert/strict';
const source=fs.readFileSync(new URL('../kerr-renderer.js',import.meta.url),'utf8');
const m=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
let maxTetradError=0,maxGradientError=0;
for(const a of [0,.7,.95]) {
  const camera=[23,4,8],t=m.cameraTetrad(camera,a),basis=[t.u,...t.basis];
  for(let i=0;i<4;i++)for(let j=0;j<4;j++)
    maxTetradError=Math.max(maxTetradError,Math.abs(m.metricDot(camera,a,basis[i],basis[j])-(i===j?(i===0?-1:1):0)));
  for(const screenX of [0,.15,.32]) {
    const ray=m.cameraRay(camera,a,screenX,.1);
    assert.ok(Math.abs(m.hamiltonian(ray.x,ray.p,a))<2e-14,'camera ray must start null');
  }
  for(const x of [[7,3,2],[4,-2,1],[23,4,8]]) {
    const p=[-.8,.3,.1],force=m.phaseDerivative(x,p,a).p;
    for(let i=0;i<3;i++) {
      const xp=x.slice(),xm=x.slice(),eps=1e-5;xp[i]+=eps;xm[i]-=eps;
      const fd=-(m.hamiltonian(xp,p,a)-m.hamiltonian(xm,p,a))/(2*eps);
      maxGradientError=Math.max(maxGradientError,Math.abs(fd-force[i]));
    }
  }
}
assert.ok(maxTetradError<2e-14,'orthonormal camera frame');
assert.ok(maxGradientError<1e-9,'analytic gradient versus independent finite difference');
assert.equal(m.isco(0),6);
let lower=.1,upper=.3;
for(let i=0;i<30;i++) {
  const slope=(lower+upper)/2;
  const ray=m.traceRay(m.cameraRay([24,0,0],0,slope,0),0,{step:.012,maxSteps:4000});
  assert.ok(['captured','escaped'].includes(ray.fate),'critical ray needs a definite classification');
  if(ray.fate==='captured')lower=slope;else upper=slope;
}
const slope=(lower+upper)/2;
const measuredB=24*slope/Math.sqrt(1+slope*slope)/Math.sqrt(1-2/24);
assert.ok(Math.abs(measuredB-3*Math.sqrt(3))<2e-6,'Schwarzschild analytic critical impact parameter');
const errors=[.04,.02,.01].map(step=>{
  const trace=m.traceRay(m.cameraRay([24,0,8],.7,.32,0),.7,{step,maxSteps:4000});
  assert.equal(trace.fate,'escaped');
  return trace.maxH;
});
for(let i=1;i<errors.length;i++)assert.ok(errors[i-1]/errors[i]>12&&errors[i-1]/errors[i]<20,'fourth-order convergence away from the critical orbit');
console.log(JSON.stringify({status:'passed',maxTetradError,maxGradientError,measuredB,analyticB:3*Math.sqrt(3),rk4MaxHamiltonian:errors},null,2));
