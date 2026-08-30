// 音频引擎：Web Audio 合成节拍器与音符声音（无外部音频文件）
window.AudioEngine = (function () {
  let ctx = null;
  let master = null;

  function ensure() {
    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain();
      master.gain.value = 0.9;
      master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  // 节拍器：强拍高音「滴」，弱拍低音「答」
  function click(atTime, strong) {
    ensure();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.value = strong ? 1150 : 750;
    gain.gain.setValueAtTime(0.0001, atTime);
    gain.gain.exponentialRampToValueAtTime(strong ? 0.5 : 0.35, atTime + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.0001, atTime + 0.06);
    osc.connect(gain).connect(master);
    osc.start(atTime);
    osc.stop(atTime + 0.08);
  }

  // 音符：固定音高 B4 短音
  function note(atTime) {
    ensure();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.value = 493.88;
    gain.gain.setValueAtTime(0.0001, atTime);
    gain.gain.exponentialRampToValueAtTime(0.55, atTime + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.0001, atTime + 0.22);
    osc.connect(gain).connect(master);
    osc.start(atTime);
    osc.stop(atTime + 0.25);
  }

  return {
    ensure,
    click,
    note,
    now() { return ensure().currentTime; },
    get ctx() { return ctx; }
  };
})();
