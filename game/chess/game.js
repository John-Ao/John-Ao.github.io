import { Chess } from './vendor/chess.js';
export { Chess };
export function uci(move) { return move.from + move.to + (move.promotion || ''); }
export function replay(encoded = '') {
 const game = new Chess();
 if (!encoded) return game;
 if (encoded.length > 15000) throw new Error('棋谱过长');
 for (const token of encoded.split('.')) {
  if (!/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(token) || game.isGameOver()) throw new Error('无效棋谱');
  game.move({from:token.slice(0,2),to:token.slice(2,4),promotion:token[4]});
 }
 return game;
}
export function encode(game) { return game.history({verbose:true}).map(uci).join('.'); }
export function status(game) {
 const side = game.turn() === 'w' ? '白' : '黑';
 if (game.isCheckmate()) return `${side === '白' ? '黑' : '白'}方获胜 · 将死`;
 if (game.isStalemate()) return '和棋 · 逼和';
 if (game.isInsufficientMaterial()) return '和棋 · 子力不足';
 if (game.isThreefoldRepetition()) return '和棋 · 三次重复局面';
 if (game.isDrawByFiftyMoves()) return '和棋 · 五十回合规则';
 return `${side}方走棋 · 第 ${game.moveNumber()} 回合${game.isCheck() ? ' · 将军' : ''}`;
}
