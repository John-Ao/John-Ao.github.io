// Run: node exp/image_sim/tests/metrics.cjs
// Golden values independently computed with torchvision SqueezeNet 1.1,
// official LPIPS v0.1 calibration, and PyTorch RGB Gaussian SSIM.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
global.tf = require(path.join(root, 'vendor/tf.min.js'));
require(path.join(root, 'metrics.js'));
global.fetch = async url => {
  const bytes = fs.readFileSync(path.join(root, url));
  return {ok:true, json:async()=>JSON.parse(bytes), arrayBuffer:async()=>bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength)};
};
(async()=>{
  await tf.setBackend('cpu');
  const metrics=new ImageMetrics();await metrics.load();
  const shape=[1,35,36,3], count=35*36*3;
  const a=Float32Array.from({length:count},(_,i)=>(i*37%251)/250);
  const b=Float32Array.from({length:count},(_,i)=>(i*17%241)/240);
  const x=tf.tensor4d(a,shape),initial=tf.tensor4d(b,shape),y=tf.variable(initial);
  metrics.setReference(x);
  const scalar = fn => tf.tidy(()=>fn().dataSync()[0]);
  assert.ok(Math.abs(scalar(()=>metrics.lpips(y))-.12521231174468994)<2e-6,'LPIPS must match PyTorch');
  assert.ok(Math.abs(scalar(()=>metrics.ssim(x,y))-.02217056043446064)<2e-6,'SSIM must match PyTorch');
  assert.ok(Math.abs(scalar(()=>metrics.ssim(x,x))-1)<1e-6);
  assert.equal(scalar(()=>metrics.lpips(x)),0);
  for(const weight of [0,.5,1]) {
    y.assign(initial);const optimizer=tf.train.adam(.01);
    const before=scalar(()=>metrics.loss(x,y,weight));
    const step=()=>tf.tidy(()=>{optimizer.minimize(()=>metrics.loss(x,y,weight),false,[y]);y.assign(y.clipByValue(0,1));});
    step(); const allocated=tf.memory().numTensors;
    for(let i=0;i<3;i++)step();
    assert.equal(tf.memory().numTensors,allocated,'Training must not leak tensors');
    const after=scalar(()=>metrics.loss(x,y,weight));
    assert.ok(after<before,`Gradient descent must reduce loss at weight ${weight}`);
    console.log(`weight=${weight}: ${before.toFixed(6)} → ${after.toFixed(6)}`);
    optimizer.dispose();
  }
  tf.dispose([x,initial,y,metrics.referenceFeatures,metrics.weights,metrics.kernel]);
  assert.equal(tf.memory().numTensors,0);
  console.log('PASS: reference parity, identity, gradients, three objectives, tensor lifecycle');
})().catch(error=>{console.error(error);process.exitCode=1;});
