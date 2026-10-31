/* LPIPS v0.1 (SqueezeNet 1.1) and RGB Gaussian-window SSIM. */
'use strict';
class ImageMetrics {
  async load() {
    const [metaResponse, weightsResponse] = await Promise.all([fetch('model/weights.json'), fetch('model/weights.bin')]);
    if (!metaResponse.ok || !weightsResponse.ok) throw new Error('无法加载本地 LPIPS 权重');
    const specs = await metaResponse.json();
    const buffer = await weightsResponse.arrayBuffer();
    this.weights = {};
    for (const [name, spec] of Object.entries(specs)) {
      this.weights[name] = tf.tensor(new Float32Array(buffer, spec.offset * 4, spec.size), spec.shape);
    }
    this.kernel = tf.tidy(() => {
      const g = Array.from({length:11}, (_, i) => Math.exp(-((i - 5) ** 2) / 4.5));
      const sum = g.reduce((a,b) => a+b);
      const values = [];
      for (let y=0;y<11;y++) for(let x=0;x<11;x++) for(let c=0;c<3;c++) values.push(g[y]*g[x]/(sum*sum));
      return tf.tensor4d(values,[11,11,3,1]);
    });
  }
  conv(x, name, stride=1, pad='valid') {
    return tf.conv2d(x,this.weights[name+'.weight'],stride,pad).add(this.weights[name+'.bias']).relu();
  }
  pool(x) {
    // PyTorch MaxPool2d(3, 2, ceil_mode=True): add only bottom/right padding.
    const bottom = x.shape[1] % 2 === 0 ? 1 : 0;
    const right = x.shape[2] % 2 === 0 ? 1 : 0;
    return tf.maxPool(tf.pad(x,[[0,0],[0,bottom],[0,right],[0,0]],-1e30),3,2,'valid');
  }
  fire(x, i) {
    const base = 'features.'+i+'.';
    const s = this.conv(x,base+'squeeze');
    return tf.concat([this.conv(s,base+'expand1x1'),this.conv(s,base+'expand3x3',1,'same')],3);
  }
  features(input) {
    return tf.tidy(() => {
      let x = input.mul(2).sub(1).sub(tf.tensor1d([-.030,-.088,-.188])).div(tf.tensor1d([.458,.448,.450]));
      const result=[];
      const take = () => result.push(x.div(x.square().sum(3,true).sqrt().add(1e-10)));
      x=this.conv(x,'features.0',2); take();
      x=this.pool(x); x=this.fire(x,3); x=this.fire(x,4); take();
      x=this.pool(x); x=this.fire(x,6); x=this.fire(x,7); take();
      x=this.pool(x);
      for (let i=9;i<=12;i++) { x=this.fire(x,i); take(); }
      return result;
    });
  }
  setReference(x) {
    tf.dispose(this.referenceFeatures);
    this.referenceFeatures=this.features(x);
  }
  lpips(y) {
    return tf.tidy(() => tf.addN(this.features(y).map((feature,i) => feature.sub(this.referenceFeatures[i]).square().mul(this.weights[`lin${i}.model.1.weight`].reshape([1,1,1,-1])).sum(3).mean())));
  }
  ssim(x,y) {
    return tf.tidy(() => {
      const blur = z => tf.depthwiseConv2d(z,this.kernel,1,'valid');
      const mx=blur(x), my=blur(y), xx=mx.square(), yy=my.square(), xy=mx.mul(my);
      const vx=blur(x.square()).sub(xx), vy=blur(y.square()).sub(yy), cov=blur(x.mul(y)).sub(xy);
      return xy.mul(2).add(.0001).mul(cov.mul(2).add(.0009)).div(xx.add(yy).add(.0001).mul(vx.add(vy).add(.0009))).mean();
    });
  }
  loss(x,y,weight) {
    return tf.tidy(() => {
      if (weight===0) return tf.scalar(1).sub(this.ssim(x,y));
      if (weight===1) return this.lpips(y);
      return this.lpips(y).mul(weight).add(tf.scalar(1).sub(this.ssim(x,y)).mul(1-weight));
    });
  }
}
globalThis.ImageMetrics=ImageMetrics;
