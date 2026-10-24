// Game-specific interpretation lives exclusively in the browser, never in Portal.
export const GAME_VERSION = 'quoridor-net-v1';
const validRound = v => typeof v === 'string' && /^[\w-]{16,80}$/.test(v);
const check = (condition, message) => { if (!condition) throw new Error(message); };
export function applyEvent(Q, model, event) {
  const p = event.payload, seat = event.seat;
  check(p && p.version === GAME_VERSION && [0,1].includes(seat), '游戏版本或玩家身份不一致');
  if (!model) {
    check(p.kind === 'init' && seat === 0 && validRound(p.roundId) && [0,1].includes(p.turn), '无效的初始化消息');
    return { board: Q.initial(p.turn), history: [], roundId: p.roundId, revision: 0, proposal: null };
  }
  check(p.roundId === model.roundId && p.base === model.revision, '操作对应的局面与本地不一致');
  const n = { ...model, history: [...model.history] };
  if (p.kind === 'action') {
    check(!model.proposal, '协商尚未结束');
    check(model.board.turn === seat, '不是发送者的回合');
    check(p.action && ['move', 'wall'].includes(p.action.type), '未知棋步');
    const board = Q.play(model.board, p.action); check(board, '对方发送了非法走棋或放墙操作');
    n.history.push(model.board); n.board = board; n.revision++;
  } else if (p.kind === 'propose') {
    check(!model.proposal && ['undo', 'restart'].includes(p.operation), '协商请求无效');
    if (p.operation === 'undo') check(model.history.length > 0, '当前没有可以撤回的操作');
    else check(validRound(p.nextRound) && p.nextRound !== model.roundId && [0,1].includes(p.turn), '新局参数无效');
    n.proposal = { id: event.id, seat, operation: p.operation, nextRound: p.nextRound, turn: p.turn };
  } else if (p.kind === 'respond') {
    const proposal = model.proposal;
    check(proposal && proposal.seat !== seat && p.proposalId === proposal.id && typeof p.accept === 'boolean', '协商回复无效');
    if (p.accept) {
      if (proposal.operation === 'undo') { n.board = n.history.pop(); n.revision++; }
      else { n.board = Q.initial(proposal.turn); n.history = []; n.roundId = proposal.nextRound; n.revision = 0; }
    }
    n.proposal = null;
  } else if (p.kind === 'resign') {
    check(model.board.winner === null && !model.proposal, '当前不能认输');
    n.history.push(model.board); n.board = { ...model.board, winner: 1 - seat }; n.revision++;
  } else check(false, '未知游戏操作');
  return n;
}
export function replay(Q, events) {
  let model = null, seq = 0;
  for (const event of events) { check(event.seq === ++seq, '消息记录不连续'); model = applyEvent(Q, model, event); }
  return model;
}
