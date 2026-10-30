import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {buildModel,sample,T_SUN} from '../merger-physics.mjs';
const close=(a,b,rtol=1e-5,atol=1e-8)=>assert.ok(Math.abs(a-b)<=atol+rtol*Math.max(Math.abs(a),Math.abs(b)),`${a} != ${b}`);

test('binary mass balance, eta bound, and physical scale covariance',()=>{
  for(const q of [1,1.2,3,8]){
    const m=buildModel(65,q,.68),big=buildModel(130,q,.68);
    close(m.m1+m.m2,65);close(m.m1/m.m2,q);assert.ok(m.eta>0&&m.eta<=.25);
    close(big.duration/m.duration,2);close(big.fq/m.fq,.5);close(big.damp/m.damp,2);
    assert.ok(m.duration<m.merger&&m.merger<m.total);
  }
});
test('inspiral phase derivative and chirp rate agree with independent formulas',()=>{
  const m=buildModel(65,1.2,.68),t=.6*m.duration,eps=m.tm*.01;
  const before=sample(t-eps,m),after=sample(t+eps,m),now=sample(t,m);
  close((after.phase-before.phase)/(2*eps),2*Math.PI*now.f,1e-6);
  const fdot=96/5*Math.PI**(8/3)*(m.chirpMass*T_SUN)**(5/3)*now.f**(11/3);
  close((after.f-before.f)/(2*eps),fdot,1e-6);
  assert.ok(after.x<before.x&&after.f>before.f&&after.a>before.a);
});
test('the explicitly artificial bridge is continuous with matching first derivatives',()=>{
  for(const q of [1,8])for(const spin of [0,.68,.95]){
    const m=buildModel(65,q,spin),eps=m.tm*1e-5;
    for(const t of [m.duration,m.merger]){
      const a=sample(t-eps,m),b=sample(t,m),c=sample(t+eps,m);
      for(const key of ['x','phase','a','h']){
        close(a[key],c[key],1e-3,1e-4);
        close((b[key]-a[key])/eps,(c[key]-b[key])/eps,1e-3,.01);
      }
    }
    for(let i=0;i<=1000;i++){
      const p=sample(m.total*i/1000,m);
      assert.ok(['x','phase','a','f','h'].every(k=>Number.isFinite(p[k])));
      assert.ok(p.x>=-1e-8&&p.a>=0&&p.f>0);
    }
  }
});
test('ringdown obeys the fitted exponential decay rather than a clipped sinusoid',()=>{
  const m=buildModel(65,1.2,.68),a=sample(m.merger,m),b=sample(m.merger+m.damp,m);
  close(b.a/a.a,Math.exp(-1));close(b.phase-a.phase,2*Math.PI*m.fq*m.damp);
  assert.equal(a.stage,'ringdown');assert.throws(()=>buildModel(-1,1,.6),RangeError);
});
test('official GW150914 series preserve physical units and independent sample origins',()=>{
  const data=JSON.parse(fs.readFileSync(new URL('../data/gw150914.json',import.meta.url)));
  assert.equal(data.event,'GW150914');assert.equal(data.strain.unit,'1e-21');
  assert.equal(data.source.archive_sha256,'18784c137497d2b0ad2f95394d4c6f8217ebee7eff6fa45dfc78a42906d560e1');
  assert.equal(Object.keys(data.series).length,11);
  for(const s of Object.values(data.series)){
    close(s.dt,1/16384,0,1e-12);assert.ok(s.n>=3400);
    for(const key of ['y','low','high'])if(s[key]){
      assert.equal(s[key].length,s.n);assert.ok(s[key].every(Number.isFinite));
    }
    if(s.low)assert.ok(s.low.every((v,i)=>v<=s.high[i]));
  }
  assert.notEqual(data.series.observed_h1.t0,data.series.nr_h1.t0);
  assert.notDeepEqual(data.series.observed_h1.y,data.series.nr_h1.y);
  assert.ok(Math.max(...data.series.observed_h1.y)<1.5);
});
test('official alignment uses a 7 ms plotting shift distinct from the inferred 6.9 ms delay',()=>{
  const {series:s}=JSON.parse(fs.readFileSync(new URL('../data/gw150914.json',import.meta.url)));
  const h=s.observed_h1,a=s.aligned_h1;
  close(h.t0+115*h.dt-a.t0,.007,0,1e-12);
  for(let i=0;i<h.n-115;i++)close(a.y[i],-h.y[i+115],0,1e-8);
});
test('published residuals equal observed minus interpolated NR, with original time origins',()=>{
  const {series:s}=JSON.parse(fs.readFileSync(new URL('../data/gw150914.json',import.meta.url)));
  for(const det of ['h1','l1']){
    const h=s['observed_'+det],nr=s['nr_'+det],res=s['residual_'+det];
    for(let i=0;i<h.n;i++){
      const time=h.t0+i*h.dt,j=(time-nr.t0)/nr.dt;
      if(j<0||j>=nr.n-1)continue;
      const k=Math.floor(j),f=j-k,reference=nr.y[k]*(1-f)+nr.y[k+1]*f;
      close(h.y[i]-res.y[i],reference,0,2e-8);
    }
  }
});
