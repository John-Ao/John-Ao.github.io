'use strict';
const $ = id => document.getElementById(id);
const metrics = new ImageMetrics();
let ready=false, busy=false, running=false, stop=false, original=null, reference=null, pixels=null, optimizer=null;
let iteration=0, history=[], weight=.5, token=0;
const settings=['upload','size','seed','random','rate','steps','weight'];
function status(message) { $('status').textContent=message; }
function controls() {
  for(const id of settings) $(id).disabled=busy || running || !ready;
  $('start').disabled=!pixels || busy || running || iteration>=Number($('steps').value);
  $('start').textContent=iteration>=Number($('steps').value) && pixels ? '已完成' : iteration ? '继续优化' : '开始优化';
  $('pause').disabled=!running || stop;
  $('reset').disabled=!pixels || busy || running;
  $('download').disabled=!pixels || busy || running;
}
function rng(seed) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t ^= t + Math.imul(t ^ t >>> 7, 61 | t); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
function validSettings() {
  for(const id of ['seed','rate','steps']) if(!$(id).checkValidity() || !$(id).value) { $(id).reportValidity(); return false; }
  return true;
}
function drawPixels(data, canvas, width, height) {
  canvas.width=width; canvas.height=height;
  const out=new Uint8ClampedArray(width*height*4);
  for(let i=0;i<width*height;i++) { for(let c=0;c<3;c++) out[i*4+c]=Math.round(Math.min(1,Math.max(0,data[i*3+c]))*255); out[i*4+3]=255; }
  canvas.getContext('2d').putImageData(new ImageData(out,width,height),0,0);
}
function chart() {
  const canvas=$('chart'), rect=canvas.getBoundingClientRect(), dpr=window.devicePixelRatio||1;
  canvas.width=Math.round(rect.width*dpr); canvas.height=Math.round(rect.height*dpr);
  const ctx=canvas.getContext('2d'); ctx.scale(dpr,dpr);
  const w=rect.width,h=rect.height,left=45,right=w-48,top=15,bottom=h-32;
  if(right<=left) return;
  ctx.font='11px system-ui';
  const sMin=history.some(p=>p.ssim<0)?-1:0;
  const maxR=Math.max(.1,...history.map(p=>Math.max(p.lpips,p.loss)))*1.08;
  const steps=Math.max(1,history.at(-1)?.step || 0);
  for(let i=0;i<=4;i++) {
    const y=bottom-(bottom-top)*i/4;
    ctx.strokeStyle='#e6e9ef';ctx.beginPath();ctx.moveTo(left,y);ctx.lineTo(right,y);ctx.stroke();
    ctx.fillStyle='#657083';ctx.textAlign='right';ctx.fillText((sMin+(1-sMin)*i/4).toFixed(2),left-8,y+4);
    ctx.textAlign='left';ctx.fillText((maxR*i/4).toFixed(2),right+8,y+4);
    ctx.textAlign='center';ctx.fillText(String(Math.round(steps*i/4)),left+(right-left)*i/4,bottom+19);
  }
  for(const [key,color] of [['ssim','#235ed4'],['lpips','#bd5c20'],['loss','#8252b1']]) {
    ctx.strokeStyle=color;ctx.lineWidth=1.8;ctx.setLineDash(key==='loss'?[5,4]:[]);ctx.beginPath();
    history.forEach((p,i)=>{const x=left+p.step/steps*(right-left), v=key==='ssim'?(p[key]-sMin)/(1-sMin):p[key]/maxR, y=bottom-v*(bottom-top);if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);});ctx.stroke();
    if(history.length===1) {const p=history[0],v=key==='ssim'?(p[key]-sMin)/(1-sMin):p[key]/maxR;ctx.fillStyle=color;ctx.beginPath();ctx.arc(left,bottom-v*(bottom-top),2.5,0,Math.PI*2);ctx.fill();}
  }
  ctx.setLineDash([]);
}
async function snapshot() {
  const values=tf.tidy(()=>tf.stack([metrics.ssim(reference,pixels),metrics.lpips(pixels)]));
  let scores;
  try { scores=await values.data(); } finally { values.dispose(); }
  const [ssim,lpips]=scores, loss=(1-weight)*(1-ssim)+weight*lpips;
  if(!Number.isFinite(loss)) throw new Error('数值不稳定，请降低学习率后重置');
  history.push({step:iteration,ssim,lpips,loss});
  $('ssim').textContent=ssim.toFixed(5);$('lpips').textContent=lpips.toFixed(5);$('loss').textContent=loss.toFixed(5);
  $('count').textContent=iteration;$('step-label').textContent=`第 ${iteration} 步`;
  drawPixels(await pixels.data(),$('result'),pixels.shape[2],pixels.shape[1]);chart();
}
async function reset() {
  if(!original || busy || running || !validSettings()) return;
  busy=true;controls();status('正在生成噪声和计算初始指标…');
  try {
    await tf.nextFrame();
    const limit=Number($('size').value), scale=Math.min(1,limit/Math.max(original.width,original.height));
    const iw=Math.max(1,Math.round(original.width*scale)), ih=Math.max(1,Math.round(original.height*scale));
    const w=Math.max(32,iw),h=Math.max(32,ih), canvas=$('reference'); canvas.width=w;canvas.height=h;
    const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,w,h);ctx.drawImage(original,Math.floor((w-iw)/2),Math.floor((h-ih)/2),iw,ih);
    tf.dispose([reference,pixels]); optimizer?.dispose();
    reference=tf.tidy(()=>tf.browser.fromPixels(canvas).toFloat().div(255).expandDims());
    const seed=Number($('seed').value)>>>0, random=rng(seed), data=Float32Array.from({length:w*h*3},random);
    pixels=tf.tidy(()=>tf.variable(tf.tensor4d(data,[1,h,w,3])));
    optimizer=tf.train.adam(Number($('rate').value));weight=Number($('weight').value)/100;iteration=0;history=[];
    metrics.setReference(reference);
    drawPixels(data,$('initial'),w,h);
    $('empty').hidden=true;$('dimensions').textContent=`${w} × ${h}`;$('seed-label').textContent=`种子 ${seed}`;
    await snapshot();status(`已就绪 · ${tf.getBackend()} · ${w} × ${h}`);
  } catch(error) {status(`初始化失败：${error.message}`);console.error(error);tf.dispose([reference,pixels]);reference=null;pixels=null;}
  finally {busy=false;controls();}
}
async function run() {
  if(!pixels || running || busy || !validSettings()) return;
  running=true;stop=false;controls();status('正在优化，首次运行需编译计算着色器…');await tf.nextFrame();const started=performance.now(),first=iteration;
  try {
    const max=Number($('steps').value);
    while(iteration<max && !stop) {
      tf.tidy(()=>{optimizer.minimize(()=>metrics.loss(reference,pixels,weight),false,[pixels]);pixels.assign(pixels.clipByValue(0,1));});
      iteration++;
      if(iteration===1 || iteration%5===0 || iteration===max) {
        await snapshot();
        status(`优化中 · ${((performance.now()-started)/(iteration-first)).toFixed(0)} ms/步`);
      }
      await tf.nextFrame();
    }
    if(history.at(-1)?.step!==iteration) await snapshot();
    status(stop?`已暂停 · 第 ${iteration} 步`:`已完成 ${iteration} 步`);
  } catch(error) {status(`优化失败：${error.message}`);console.error(error);}
  finally {running=false;stop=false;controls();}
}
$('upload').addEventListener('change',async event=>{
  const file=event.target.files[0];if(!file)return;
  const request=++token;busy=true;controls();status('正在读取图像…');
  let bitmap;
  try {bitmap=await createImageBitmap(file);if(request!==token){bitmap.close();return;}original?.close();original=bitmap;busy=false;await reset();}
  catch(error){status(`无法读取图像：${error.message}`);}
  finally{busy=false;controls();}
});
$('weight').addEventListener('input',()=>{const w=Number($('weight').value)/100;$('weights').textContent=`${Math.round((1-w)*100)}% / ${Math.round(w*100)}%`;$('formula').textContent=`损失 = ${(1-w).toFixed(2)} × (1 − SSIM) + ${w.toFixed(2)} × LPIPS`;});
for(const id of ['size','seed','rate','steps','weight']) $(id).addEventListener('change',reset);
$('random').onclick=()=>{$('seed').value=crypto.getRandomValues(new Uint32Array(1))[0];reset();};
$('start').onclick=run;$('pause').onclick=()=>{stop=true;status('正在暂停…');controls();};$('reset').onclick=reset;
$('download').onclick=()=>{$('result').toBlob(blob=>{if(!blob)return;const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`image-sim-seed-${$('seed').value}-step-${iteration}.png`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);},'image/png');};
new ResizeObserver(chart).observe($('chart'));
(async()=>{controls();try {if(!globalThis.tf)throw new Error('TensorFlow.js 加载失败');try{await tf.setBackend('webgl');}catch{await tf.setBackend('cpu');}await tf.ready();status('正在加载 LPIPS 模型…');await metrics.load();ready=true;status(`请选择参考图像 · ${tf.getBackend()}`);}catch(error){status(`加载失败：${error.message}。请通过 HTTP 静态服务器打开页面。`);console.error(error);}controls();})();
