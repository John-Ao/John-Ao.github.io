import {NearbyRoom} from './room.js';
import {encodeSignal, SignalReader} from './signaling.js';

let libraries;
function loadLibraries() {
  return libraries ||= Promise.all(['qrcode.js', 'jsQR.js'].map(file => new Promise((resolve, reject) => {
    const script = document.createElement('script'); script.src = new URL(`vendor/${file}`, import.meta.url);
    script.onload = resolve; script.onerror = () => reject(Error('扫码组件加载失败，请重新打开页面'));
    document.head.append(script);
  }))).catch(e => { libraries = null; throw e; });
}

// Resolves only once the data channel opens. Cancellation resolves null.
export async function pairNearby({gameId}) {
  if (!globalThis.isSecureContext || !globalThis.RTCPeerConnection) throw Error('面对面连接需要支持 WebRTC 的 HTTPS 浏览器');
  await loadLibraries();
  if (!document.querySelector('link[data-nearby-style]')) {
    const css = document.createElement('link'); css.rel = 'stylesheet'; css.href = new URL('pairing.css', import.meta.url); css.dataset.nearbyStyle = ''; document.head.append(css);
  }
  const dialog = document.createElement('dialog'); dialog.className = 'nearby-pairing';
  dialog.setAttribute('aria-label', '面对面扫码配对');
  dialog.innerHTML = `<button type="button" class="nearby-close" aria-label="取消配对">×</button>
    <h2>面对面扫码配对</h2>
    <p>两台手机连接同一 Wi-Fi 或手机热点，并在游戏内扫码。刷新或关闭页面后需重新配对。</p>
    <div class="nearby-choices"><button type="button" data-action="host">创建面对面房间</button><button type="button" data-action="join">扫描房主二维码</button></div>
    <p class="nearby-status" role="status" aria-live="polite"></p>
    <section class="nearby-code" hidden><canvas aria-label="配对二维码"></canvas><p class="nearby-page"></p><div class="nearby-buttons"><button type="button" data-action="previous">上一张</button><button type="button" data-action="next">下一张</button></div></section>
    <section class="nearby-input" hidden><button type="button" data-action="camera">开启相机扫描</button><button type="button" data-action="stop" hidden>停止相机</button><video muted playsinline hidden></video>
    <p class="nearby-progress" role="status"></p><label class="nearby-file">读取二维码图片<input type="file" accept="image/*" multiple aria-label="读取二维码图片"></label></section>
    <button type="button" data-action="reset" hidden>重新配对</button>`;
  document.body.append(dialog);
  const $ = selector => dialog.querySelector(selector), action = name => $(`[data-action="${name}"]`);
  let room, reader = new SignalReader(), frames = [], frame = 0, stream, scanTimer, qrTimer, deadline, generation = 0, cameraGeneration = 0, finished = false, busy = false, scanning = false, mode;
  const status = message => { $('.nearby-status').textContent = message; };
  function stopCamera() {
    cameraGeneration++; action('camera').disabled = false;
    scanning = false; clearTimeout(scanTimer); stream?.getTracks().forEach(track => track.stop()); stream = null;
    $('video').srcObject = null; $('video').hidden = true; action('stop').hidden = true; action('camera').hidden = false;
  }
  function reset() {
    generation++; stopCamera(); clearInterval(qrTimer); clearTimeout(deadline); room?.disconnect(); room = null; busy = false;
    reader.reset(); frames = []; mode = null;
    $('.nearby-choices').hidden = false; $('.nearby-code').hidden = $('.nearby-input').hidden = action('reset').hidden = true;
    $('.nearby-progress').textContent = ''; $('input').value = ''; status('');
    for (const button of $('.nearby-choices').querySelectorAll('button')) button.disabled = false;
  }
  function draw() {
    const qr = globalThis.qrcode(0, 'M'); qr.addData(frames[frame], 'Byte'); qr.make();
    const canvas = $('canvas'), n = qr.getModuleCount(), scale = 5;
    canvas.width = canvas.height = (n + 8) * scale;
    const ctx = canvas.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.fillStyle = '#000';
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (qr.isDark(y, x)) ctx.fillRect((x + 4) * scale, (y + 4) * scale, scale, scale);
    $('.nearby-page').textContent = frames.length > 1 ? `第 ${frame + 1} / ${frames.length} 张 · 自动轮播，请保持扫描直到收齐` : '请让对方在游戏内扫描此码';
    action('previous').hidden = action('next').hidden = frames.length === 1;
  }
  async function showCode(signal, ticket) {
    const encoded = await encodeSignal(signal); if (ticket !== generation || finished) return;
    frames = encoded; frame = 0; $('.nearby-code').hidden = false; draw();
    clearInterval(qrTimer); qrTimer = setInterval(() => { frame = (frame + 1) % frames.length; draw(); }, 1100);
  }
  const result = new Promise(resolve => {
    function finish(value) {
      if (finished) return; finished = true; generation++;
      stopCamera(); clearInterval(qrTimer); clearTimeout(deadline);
      if (!value) room?.disconnect(); dialog.close(); dialog.remove(); resolve(value);
    }
    function watch(next) {
      room = next;
      next.on('paired', () => { if (room === next) finish(next); });
      next.on('error', error => { if (room === next) status(error.message); });
      next.on('status', state => { if (room === next && state === 'disconnected') status('连接中断，请检查 Wi-Fi 后重新配对'); });
    }
    function expire(ms, message) {
      clearTimeout(deadline); deadline = setTimeout(() => {
        if (finished) return; generation++; stopCamera(); clearInterval(qrTimer); room?.disconnect(); room = null;
        $('.nearby-code').hidden = $('.nearby-input').hidden = true; status(message); action('reset').hidden = false;
      }, ms);
    }
    async function consume(text) {
      if (busy || finished) return; busy = true; const ticket = generation;
      try {
        const signal = await reader.add(text); if (ticket !== generation || finished) return;
        $('.nearby-progress').textContent = `已扫描 ${reader.parts.size} / ${reader.count} 张`;
        if (!signal) return;
        if (signal.game !== gameId) throw Error('这不是当前游戏的配对码');
        if (signal.description.type !== (mode === 'host' ? 'answer' : 'offer')) throw Error('请扫描对方的配对码');
        stopCamera(); $('.nearby-input').hidden = true;
        if (mode === 'join') {
          watch(new NearbyRoom({gameId, seat: 1, id: signal.id}));
          await room.accept(signal);
          const answer = await room.description('answer'); if (ticket !== generation || finished) return;
          await showCode(answer, ticket);
          status('请让房主扫描你的应答码，完成后自动进入对局。');
          expire(120000, '配对超时，请检查同一 Wi-Fi／热点及设备隔离设置后重试');
        } else {
          await room.accept(signal); if (ticket !== generation || finished) return;
          clearInterval(qrTimer); $('.nearby-code').hidden = true;
          status('正在建立直连…'); expire(30000, '未能直连，请检查同一 Wi-Fi／热点及设备隔离设置后重试');
        }
      } catch (error) {
        if (ticket !== generation || finished) return;
        reader.reset(); status(error.message); $('.nearby-progress').textContent = '';
        if (room?.pc.remoteDescription) { stopCamera(); $('.nearby-input').hidden = true; action('reset').hidden = false; }
        else $('.nearby-input').hidden = false;
      } finally { if (ticket === generation) busy = false; }
    }
    async function start(modeName) {
      reset(); mode = modeName; action('reset').hidden = false; $('.nearby-choices').hidden = true; const ticket = generation;
      if (mode === 'join') { $('.nearby-input').hidden = false; status('扫描房主的全部二维码。'); return; }
      status('正在生成配对码…');
      try {
        watch(new NearbyRoom({gameId})); const offer = await room.description('offer');
        if (ticket !== generation || finished) return;
        await showCode(offer, ticket); if (ticket !== generation || finished) return;
        $('.nearby-input').hidden = false;
        status('先让对方扫描上方二维码，再扫描对方生成的应答码。');
        expire(10 * 60 * 1000, '配对码已过期，请重新创建');
      } catch (e) { if (ticket === generation && !finished) status(e.message); }
    }
    action('host').onclick = () => start('host'); action('join').onclick = () => start('join'); action('reset').onclick = reset;
    $('.nearby-close').onclick = () => finish(null);
    dialog.addEventListener('cancel', e => { e.preventDefault(); finish(null); });
    dialog.addEventListener('close', () => finish(null));
    action('previous').onclick = () => { clearInterval(qrTimer); frame = (frame + frames.length - 1) % frames.length; draw(); };
    action('next').onclick = () => { clearInterval(qrTimer); frame = (frame + 1) % frames.length; draw(); };
    action('stop').onclick = stopCamera;
    action('camera').onclick = async () => {
      stopCamera(); const ticket = generation, cameraTicket = cameraGeneration;
      action('camera').disabled = true;
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw Error('浏览器无法使用相机，可读取二维码图片');
        const media = await navigator.mediaDevices.getUserMedia({video: {facingMode: {ideal: 'environment'}, width: {ideal: 1280}}, audio: false});
        if (ticket !== generation || cameraTicket !== cameraGeneration || finished || $('.nearby-input').hidden) { media.getTracks().forEach(t => t.stop()); return; }
        stream = media; const video = $('video'); video.srcObject = stream; video.hidden = false;
        await video.play(); if (ticket !== generation || cameraTicket !== cameraGeneration || finished) return;
        scanning = true; action('camera').hidden = true; action('stop').hidden = false;
        const canvas = document.createElement('canvas'), ctx = canvas.getContext('2d', {willReadFrequently: true});
        const scan = async () => {
          if (!scanning || ticket !== generation || cameraTicket !== cameraGeneration || finished) return;
          try {
            if (video.readyState >= 2 && video.videoWidth) {
              const ratio = Math.min(1, 1000 / video.videoWidth); canvas.width = Math.round(video.videoWidth * ratio); canvas.height = Math.round(video.videoHeight * ratio);
              ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
              const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height), code = globalThis.jsQR(pixels.data, pixels.width, pixels.height, {inversionAttempts: 'dontInvert'});
              if (code) await consume(code.data);
            }
          } catch (e) { status(e.message); }
          if (scanning && cameraTicket === cameraGeneration) scanTimer = setTimeout(scan, 180);
        }; scan();
      } catch (e) { if (ticket === generation && cameraTicket === cameraGeneration && !finished) { stopCamera(); status(e.name === 'NotAllowedError' ? '未获相机权限，请允许相机访问，或读取二维码图片。' : e.message); } }
      finally { if (!finished && cameraTicket === cameraGeneration) action('camera').disabled = false; }
    };
    $('input').onchange = async event => {
      const ticket = generation;
      for (const file of event.target.files) {
        if (ticket !== generation || finished || $('.nearby-input').hidden) break;
        const url = URL.createObjectURL(file);
        try {
          const img = new Image(); img.src = url; await img.decode();
          if (ticket !== generation || finished) break;
          const ratio = Math.min(1, 1600 / Math.max(img.width, img.height));
          const canvas = document.createElement('canvas'); canvas.width = Math.round(img.width * ratio); canvas.height = Math.round(img.height * ratio);
          const ctx = canvas.getContext('2d'); ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height), code = globalThis.jsQR(pixels.data, pixels.width, pixels.height);
          if (!code) throw Error('图片中未识别到二维码，请选择清晰的二维码图片');
          await consume(code.data);
        } catch (e) { if (!finished && ticket === generation) status(e.message); }
        finally { URL.revokeObjectURL(url); }
      }
      if (!finished) event.target.value = '';
    };
  });
  dialog.showModal(); return result;
}
