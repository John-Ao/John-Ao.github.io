import { protocol } from './online-protocol.mjs';
// A small, game-independent room menu. It never writes local game saves.
export function setupNetwork(adapter, view) {
  const P = protocol(adapter), prefix = adapter.id + '.board-online.';
  const seed = () => crypto.getRandomValues(new Uint32Array(1))[0];
  let room = null, model = null, local = null, portal, peer = false, error = '', status = '', busy = false, intent = 0;
  let invitation = null, share = '', shareUntil = 0;
  const root = document.createElement('div'); root.id = 'board-network';
  root.innerHTML = `<style>#board-network{position:relative;z-index:10000;display:flex;gap:8px;align-items:center;flex-wrap:wrap;padding:6px;background:var(--bg,#eee);color:var(--text,#222)}#board-network dialog{max-width:min(480px,90vw);max-height:85vh;overflow:auto;padding:18px;border:1px solid #999;border-radius:10px;color:#222;background:#fafafa}#board-network button{font:inherit;padding:7px 12px;cursor:pointer}#board-network input{width:100%;box-sizing:border-box}#board-network .net-actions{display:flex;gap:8px;flex-wrap:wrap;margin:12px 0}#board-network [hidden]{display:none!important}</style><button data-net="menu">联网</button><span data-net="status" role="status"></span><dialog data-net="dialog"><h2>联网对战</h2><p data-net="message" role="status"></p><div class="net-actions"><button data-net="create">创建房间</button><button data-net="nearby">面对面扫码配对</button><button data-net="join">加入邀请对局</button><button data-net="resume">恢复房间</button></div><p data-net="help">面对面：双方连接同一 Wi-Fi 或热点，互扫二维码直连。联网按席位隐藏手牌；与 Tacta 一样，仅适用于诚信对战。</p><input data-net="share" readonly aria-label="邀请链接"><div class="net-actions"><button data-net="invite">生成邀请</button><button data-net="copy">复制邀请</button><button data-net="sync">重新同步</button><button data-net="undo">请求悔棋</button><button data-net="restart">请求重开</button><button data-net="resign">认输</button><button data-net="reset">重置访客席位</button><button data-net="closeRoom">关闭房间</button><button data-net="leave">返回本地对局</button></div><p data-net="proposal"></p><div class="net-actions"><button data-net="accept">同意</button><button data-net="reject">拒绝</button></div><button data-net="close">返回游戏</button></dialog>`;
  document.body.prepend(root);
  const el = name => root.querySelector(`[data-net="${name}"]`);
  const dlg = el('dialog');
  function show() { for (const d of document.querySelectorAll('dialog[open]')) if (d !== dlg) d.close(); if (!dlg.open) dlg.showModal(); refresh(); }
  const online = () => !!room;
  const canAct = () => !!room?.ready && !room.pending && !busy && peer && !!model && !error && !model.proposal && model.resigned === null && !adapter.ended(model.board) && adapter.actor(model.board) === room.seat;
  function refresh() {
    const remote = room && room.kind !== 'nearby', host = remote && room.seat === 0;
    el('status').textContent = room ? `${room.kind === 'nearby' ? '面对面 · ' : ''}玩家 ${room.seat + 1} · ${error || status}${peer ? '' : ' · 等待对手'}${room.pending ? ' · 等待确认' : ''}${model?.resigned !== null && model ? ` · 玩家 ${2-model.resigned} 获胜（认输）` : ''}${model?.proposal ? ' · 有协商请求' : ''}` : '';
    el('create').hidden = el('nearby').hidden = !!room || !!invitation;
    el('join').hidden = !!room || !invitation;
    el('resume').hidden = !!room || !!invitation || !sessionStorage.getItem(prefix+'room');
    for (const n of ['sync','undo','restart','resign','leave']) el(n).hidden = !room;
    for (const n of ['invite','reset','closeRoom']) el(n).hidden = !host;
    if (shareUntil < Date.now() || peer) share = '';
    el('share').hidden = el('copy').hidden = !share;
    el('share').value = share;
    for (const n of ['undo','restart','resign']) el(n).disabled = busy || !room?.ready || !!room?.pending || !peer || !model || !!error || !!model?.proposal;
    el('undo').disabled ||= !model?.history.length;
    const q = model?.proposal;
    el('proposal').textContent = q ? `${q.seat === room.seat ? '等待对方同意' : '对方请求'}：${({undo:'悔棋',restart:'重开',next:'下一局',draw:'和局'})[q.operation]}` : '';
    el('accept').hidden = el('reject').hidden = !q || q.seat === room?.seat;
    el('accept').disabled = el('reject').disabled = !room?.ready || !!room?.pending || busy;
  }
  function paint(reset = false) { if (model) view.setState(structuredClone(model.board), reset); view.render(); refresh(); }
  function fail(e) { el('message').textContent = e.message || String(e); show(); }
  async function sdk() { if (!portal) { const m = await import('../../portal/sdk/client.js?v=2'); portal = m.createPortal({gameId:adapter.id}); } return portal; }
  async function send(payload) {
    if (!room?.ready || room.pending || !model || error || (!peer && payload.kind !== 'respond')) return;
    const current = room;
    const p = { version:P.version, base:model.revision, seed:seed(), ...payload };
    try { P.apply(model, {seat:room.seat,id:'preflight',payload:p}); await current.send(p); }
    catch (e) { if (room === current) fail(e); }
    refresh();
  }
  function leave(remember = true) {
    ++intent;
    const old = room; room = null; old?.disconnect();
    sessionStorage.removeItem(prefix+'active'); model = null; peer = false; error = ''; share = '';
    if (!remember || old?.kind === 'nearby') sessionStorage.removeItem(prefix+'room');
    for (const d of document.querySelectorAll('dialog[open]')) d.close();
    if (local) { view.restore(local); local = null; }
    view.render(); refresh();
  }
  async function attach(next) {
    if (room) leave();
    local = view.snapshot(); room = next; model = null; error = ''; peer = false; share = '';
    view.prepare?.();
    for (const d of document.querySelectorAll('dialog[open]')) d.close();
    if (room.kind !== 'nearby') {sessionStorage.setItem(prefix+'room', room.id);sessionStorage.setItem(prefix+'active', room.id);}
    else {sessionStorage.removeItem(prefix+'room');sessionStorage.removeItem(prefix+'active');}
    const current = room;
    const live = () => room === current;
    room.on('sync', data => {
      if (!live()) return;
      try {
        if (data.seq !== data.events.length) throw Error('消息记录不完整');
        const nextModel = P.replay(data.events); model = nextModel; error = ''; paint(true);
        if (!model && data.seat === 0 && !current.pending) current.send({version:P.version,kind:'init',seed:seed(),options:view.options()}).catch(e=>{if(live())fail(e);});
      } catch (e) { error = e.message; refresh(); fail(e); }
    });
    room.on('event', event => {
      if (!live() || error) return;
      try { model = P.apply(model,event); paint(true); if (model.proposal || event.payload.kind === 'resign') show(); }
      catch (e) { error = e.message; refresh(); fail(e); }
    });
    room.on('presence', p => { if (live()) { peer = p.online.includes(1-current.seat); paint(); } });
    room.on('pending', () => { if (live()) paint(); });
    room.on('status', s => { if (!live()) return; status = ({connecting:'连接中',connected:'已连接',disconnected:'已断线，可重新同步',closed:'连接已关闭'})[s] || s; paint(); if (s === 'closed') { leave(false); fail(Error('连接已结束，请重新加入或配对。')); } });
    room.on('error', e => { if (live()) fail(e); });
    paint(); await current.connect();
  }
  async function task(fn) { if (busy) return; busy=true; refresh(); try { await fn(); } catch(e) { fail(e); } finally { busy=false; paint(); } }
  const click = (n, fn) => el(n).onclick = () => task(fn);
  el('menu').onclick=show; el('close').onclick=()=>dlg.close();
  click('nearby', async()=>{const token=++intent;dlg.close();const {pairNearby}=await import('../../portal/nearby/pairing.js');const next=await pairNearby({gameId:adapter.id});if(token!==intent){next?.disconnect();return;}if(next)await attach(next);else show();});
  click('create', async()=>{const token=++intent;const p=await sdk();try{await p.credentials();}catch(e){if(e.status===401){sessionStorage.setItem(prefix+'create','1');await p.login();return;}throw e;}const next=await p.createRoom();if(token!==intent||invitation){next.disconnect();return;}await attach(next);});
  click('join', async()=>{const requested=invitation,token=++intent,p=await sdk();let next;try{next=await p.join(requested.room,requested.invite);}catch(e){if(invitation===requested&&[403,409,410].includes(e.status)){invitation=null;sessionStorage.removeItem(prefix+'invite');}throw e;}if(token!==intent||requested!==invitation){next.disconnect();return;}invitation=null;sessionStorage.removeItem(prefix+'invite');await attach(next);});
  click('resume', async()=>{const p=await sdk(),id=sessionStorage.getItem(prefix+'room');try{await p.credentials(id);}catch(e){if(e.status===401&&e.scope!=='guest'){sessionStorage.setItem(prefix+'active',id);await p.login();return;}throw e;}await attach(p.room(id));});
  click('invite', async()=>{const current=room,r=await (await sdk()).createInvite(current.id);if(room===current){share=r.url;shareUntil=r.expires;}});
  click('copy', async()=>{try{await navigator.clipboard.writeText(share);}catch{el('share').select();}});
  el('sync').onclick=()=>room?.reconnect();
  el('undo').onclick=()=>send({kind:'propose',operation:'undo'});
  el('restart').onclick=()=>send({kind:'propose',operation:'restart',options:model.options});
  el('accept').onclick=()=>send({kind:'respond',proposalId:model.proposal.id,accept:true});
  el('reject').onclick=()=>send({kind:'respond',proposalId:model.proposal.id,accept:false});
  el('resign').onclick=()=>{if(confirm('确认认输？'))send({kind:'resign'});};
  el('leave').onclick=()=>leave();
  click('reset',async()=>{if(confirm('重置访客席位？当前访客会断开，棋局保留。'))await (await sdk()).roomAction(room.id,'reset-guest');});
  click('closeRoom',async()=>{if(confirm('关闭房间并删除联网记录？')){await (await sdk()).roomAction(room.id,'close');leave(false);}});
  async function boot() {
    if (location.protocol === 'file:') return;
    try {
      const params=new URLSearchParams(location.hash.slice(1));
      if(params.has('invite')){if(room)leave();++intent;invitation={room:params.get('room'),invite:params.get('invite')};sessionStorage.setItem(prefix+'invite',JSON.stringify(invitation));history.replaceState(null,'',location.pathname+location.search);}
      else invitation=JSON.parse(sessionStorage.getItem(prefix+'invite')||'null');
      const p=await sdk(),logged=await p.completeLogin();
      if(invitation)show();
      else if(logged&&sessionStorage.getItem(prefix+'create')){sessionStorage.removeItem(prefix+'create');await attach(await p.createRoom());}
      else if(!room&&sessionStorage.getItem(prefix+'active'))await attach(p.room(sessionStorage.getItem(prefix+'active')));
    }catch(e){fail(e);}refresh();
  }
  const api = { get active(){return online();}, get seat(){return room?.seat;}, canAct,
    action(action){if(!canAct())return false;void send({kind:'action',action});return true;},
    propose(operation,action,options){void send({kind:'propose',operation,action,options:options??model?.options});return false;},
    get blocked(){return !model || !!error || model.resigned !== null || !!model.proposal;},
    refresh, show };
  // Boot after the caller stores the API used by its render callbacks.
  queueMicrotask(boot); window.addEventListener('hashchange',boot); refresh();
  return api;
}
