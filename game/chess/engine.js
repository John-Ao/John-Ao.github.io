export function parseInfo(line) {
 if (!line.startsWith('info ') || /\b(?:upperbound|lowerbound)\b/.test(line)) return null;
 const depth = line.match(/\bdepth (\d+)/), rank = line.match(/\bmultipv (\d+)/);
 const score = line.match(/\bscore (cp|mate) (-?\d+)/), pv = line.match(/\bpv (.+)$/);
 if (!depth || !score || !pv || !/^[a-h][1-8][a-h][1-8][qrbn]?(?: |$)/.test(pv[1])) return null;
 const match = line.match(/\bwdl (\d+) (\d+) (\d+)/);
 const values = match ? match.slice(1).map(Number) : null;
 const wdl = values && values.every(n=>n<=1000) && values.reduce((a,b)=>a+b,0)===1000 ? values : null;
 return {wdl,depth:Number(depth[1]),rank:Number(rank?.[1] || 1),type:score[1],score:Number(score[2]),move:pv[1].split(' ')[0],pv:pv[1]};
}
// UCI WDL is relative to the side to move; the UI always uses white/draw/black.
export function whiteWdl(wdl,turn) {
 return wdl ? (turn==='w' ? [...wdl] : [wdl[2],wdl[1],wdl[0]]) : null;
}
export function scoreLabel(item) {
 if (item.type === 'mate') return item.score > 0 ? `${item.score} 步内将杀` : item.score < 0 ? `${-item.score} 步内被将杀` : '将死';
 return `${item.score > 0 ? '+' : ''}${(item.score/100).toFixed(2)}`;
}
// Browser memory is a coarse, privacy-limited estimate, not available RAM.
// Reserve two logical CPUs and allocate ~1/16 of reported RAM to the hash.
export function recommendedSettings(device = globalThis.navigator || {}) {
 const cores = Number(device.hardwareConcurrency);
 const memory = Number(device.deviceMemory);
 return {
  threads: Number.isFinite(cores) && cores >= 1 ? Math.min(32, Math.max(1, Math.floor(cores) - 2)) : 1,
  hash: Number.isFinite(memory) && memory > 0 ? Math.max(64, Math.min(512, 2 ** Math.floor(Math.log2(memory * 64)))) : 128,
  multiPV: 1
 };
}
export class Analysis {
 constructor(onResults,onError) {
  this.onResults=onResults; this.onError=onError;
  this.phase='idle'; this.pending=null; this.generation=0;
 }
 // Stop searching while retaining the compiled engine, NNUE network and hash.
 stop() {
  this.generation++; this.pending=null;
  if(this.phase==='searching') {
   this.phase='stopping'; this.worker.postMessage('stop');
   this.armTimeout(10000);
  }
 }
 dispose() {
  clearTimeout(this.timer);this.generation++;this.pending=null;
  this.worker?.terminate();this.worker=null;this.phase='idle';
 }
 fail(message='AI 分析失败，请检查引擎文件、可用内存及服务器配置后重试') {
  this.dispose();this.onError(message);
 }
 armTimeout(ms) {
  clearTimeout(this.timer);
  this.timer=setTimeout(()=>this.fail(),ms);
 }
 prepare() {
  if(this.worker)return;
  const threaded=globalThis.crossOriginIsolated && typeof SharedArrayBuffer!=='undefined';
  this.settings=recommendedSettings();
  if(!threaded)this.settings.threads=1;
  let worker;
  try { worker=new Worker(new URL(threaded?'./vendor/stockfish-19.js':'./vendor/stockfish-19-single.js',import.meta.url)); }
  catch { this.fail('无法启动分析引擎，请检查浏览器是否支持 WebAssembly');return; }
  this.worker=worker;this.phase='initializing';this.armTimeout(120000);
  worker.onerror=worker.onmessageerror=()=>{if(this.worker===worker)this.fail();};
  worker.onmessage=({data})=>{
   if(this.worker!==worker || typeof data!=='string')return;
   for(const line of data.split('\n')) {
    if(line==='uciok' && this.phase==='initializing') {
     worker.postMessage(`setoption name Threads value ${this.settings.threads}`);
     worker.postMessage(`setoption name Hash value ${this.settings.hash}`);
     worker.postMessage('setoption name MultiPV value 1');
     worker.postMessage('setoption name UCI_ShowWDL value true');
     worker.postMessage('setoption name Skill Level value 20');
     worker.postMessage('setoption name UCI_LimitStrength value false');
     this.phase='syncing';worker.postMessage('isready');
    } else if(line==='readyok' && this.phase==='syncing') {
     clearTimeout(this.timer);this.phase='ready';this.launch();
    } else if(line.startsWith('bestmove ') && (this.phase==='stopping'||this.phase==='searching')) {
     // Drain the previous search completely before assigning output to a new position.
     this.phase='syncing';this.armTimeout(10000);worker.postMessage('isready');
    }
    if(this.phase!=='searching'||this.activeGeneration!==this.generation)continue;
    const item=parseInfo(line);
    if(!item || item.rank!==1 || item.depth<this.publishedDepth)continue;
    this.publishedDepth=item.depth;this.onResults([item]);
   }
  };
  worker.postMessage('uci');
 }
 start(game) {
  this.stop();
  if(game.isGameOver())return;
  const history=game.history({verbose:true});
  const moves=history.map(m=>m.from+m.to+(m.promotion||'')).join(' ');
  const initial=history[0]?.before || game.fen();
  this.pending=`position fen ${initial}${moves?' moves '+moves:''}`;
  this.prepare();this.launch();
 }
 launch() {
  if(this.phase!=='ready'||!this.pending)return;
  const position=this.pending;this.pending=null;
  this.phase='searching';this.activeGeneration=this.generation;this.publishedDepth=-1;
  this.worker.postMessage(position);this.worker.postMessage('go infinite');
 }
}
