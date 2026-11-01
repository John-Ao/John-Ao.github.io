// Ordered action log shared by the two transports. Rules remain in each adapter.
export function seeded(seed, fn) {
  let n = seed >>> 0;
  const previous = Math.random;
  Math.random = () => { n += 0x6D2B79F5; let t = n; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  try { return fn(); } finally { Math.random = previous; }
}
const check = (ok, message) => { if (!ok) throw Error(message); };
const validSeed = n => Number.isInteger(n) && n >= 0 && n <= 0xffffffff;
export function protocol(adapter) {
  const version = adapter.id + '-net-v1';
  function apply(model, event) {
    const p = event?.payload, seat = event?.seat;
    check(p?.version === version && [0, 1].includes(seat), '游戏版本或席位不匹配');
    if (!model) {
      check(p.kind === 'init' && seat === 0 && validSeed(p.seed), '无效开局');
      return { board: seeded(p.seed, () => adapter.create(p.options)), options: p.options, revision: 0, history: [], proposal: null, resigned: null };
    }
    check(p.base === model.revision, '局面版本已改变，请重新同步');
    const next = { ...model, history: [...model.history] };
    if (p.kind === 'action') {
      check(!model.proposal && model.resigned === null && !adapter.ended(model.board), '当前不能行动');
      check(adapter.actor(model.board) === seat, '不是你的回合');
      check(validSeed(p.seed), '随机种子无效');
      next.board = seeded(p.seed, () => adapter.act(structuredClone(model.board), p.action));
      check(JSON.stringify(next.board) !== JSON.stringify(model.board), '操作未改变局面');
      next.history.push(model.board);
    } else if (p.kind === 'propose') {
      check(!model.proposal && ['undo', 'restart', 'next', 'draw'].includes(p.operation), '协商无效');
      check(validSeed(p.seed), '随机种子无效');
      if (p.operation === 'undo') check(model.history.length && model.resigned === null, '没有可撤回的操作');
      if (['next','draw'].includes(p.operation)) check(adapter.canAgree?.(model.board, p.operation), '当前不能进行此协商');
      if(p.operation==='restart')seeded(p.seed,()=>adapter.create(p.options));
      if(['next','draw'].includes(p.operation))seeded(p.seed,()=>adapter.agree(structuredClone(model.board),p.operation,p.action));
      check(typeof event.id==='string'&&event.id.length>0,'协商 ID 无效');
      next.proposal = { id: event.id, seat, operation: p.operation, seed: p.seed, options: p.options, action: p.action };
    } else if (p.kind === 'respond') {
      const q = model.proposal;
      check(q && q.seat !== seat && p.proposalId === q.id && typeof p.accept === 'boolean', '协商回复无效');
      if (p.accept) {
        if (q.operation === 'undo') next.board = next.history.pop();
        else if (q.operation === 'restart') { next.board = seeded(q.seed, () => adapter.create(q.options)); next.options = q.options; next.history = []; next.resigned = null; }
        else { next.board = seeded(q.seed, () => adapter.agree(structuredClone(model.board), q.operation, q.action)); next.history = []; }
      }
      next.proposal = null;
    } else if (p.kind === 'resign') {
      check(model.resigned === null && !adapter.ended(model.board) && !model.proposal, '当前不能认输');
      next.resigned = seat;
    } else check(false, '未知操作');
    next.revision++;
    return next;
  }
  function replay(events) {
    check(Array.isArray(events), '消息记录无效');
    let model = null, seq = 0; const ids = new Set();
    for (const event of events) {
      check(event.seq === ++seq && typeof event.id === 'string' && !ids.has(event.id), '消息顺序或 ID 无效');
      ids.add(event.id); model = apply(model, event);
    }
    return model;
  }
  return { version, apply, replay };
}
