import * as model from "./model.mjs";
import { mount } from "./ui.mjs";
mount({
  id: "hex",
  ...model,
  valid: (s) =>
    s &&
    [7, 9, 11].includes(s.n) &&
    Array.isArray(s.board) &&
    s.board.length === s.n * s.n &&
    s.board.every((v) => [0, 1, 2].includes(v)) &&
    [1, 2].includes(s.turn) &&
    Array.isArray(s.owners),
  columns: (ctx) => ctx.s.n,
  click(ctx, i, api) {
    if (!ctx.s.board[i]) api.commit(i);
  },
  draw({ s, mode, busy }, $) {
    const n = s.n,
      R = 20,
      W = Math.sqrt(3) * R,
      pad = 32,
      cx = (r, c) => pad + c * W + (r * W) / 2,
      cy = (r) => pad + r * 30,
      width = cx(n - 1, n - 1) + pad,
      height = cy(n - 1) + pad;
    const winColor = s.winner ? s.owners.indexOf(s.winner) : 0,
      path = winColor ? model.connection(s.board, n, winColor) : [];
    let svg = `<svg viewBox="0 0 ${width} ${height}" role="group" aria-label="六角棋棋盘，红连上下，蓝连左右"><path class="goal red" d="M${pad - 10},${pad - 24} L${cx(0, n - 1) + 10},${pad - 24} M${cx(n - 1, 0) - 10},${cy(n - 1) + 24} L${cx(n - 1, n - 1) + 10},${cy(n - 1) + 24}"/><path class="goal blue" d="M${pad - 24},${pad} L${cx(n - 1, 0) - 24},${cy(n - 1)} M${cx(0, n - 1) + 24},${pad} L${cx(n - 1, n - 1) + 24},${cy(n - 1)}"/>`;
    for (let i = 0; i < s.board.length; i++) {
      const r = Math.floor(i / n),
        c = i % n,
        x = cx(r, c),
        y = cy(r),
        v = s.board[i];
      const points = Array.from({ length: 6 }, (_, k) => {
        const a = ((60 * k - 30) * Math.PI) / 180;
        return `${x + (R - 1) * Math.cos(a)},${y + (R - 1) * Math.sin(a)}`;
      }).join(" ");
      svg += `<g data-cell="${i}" role="button" aria-label="第${r + 1}行第${c + 1}列，${v === 1 ? "红棋" : v === 2 ? "蓝棋" : "空格可落子"}" class="hexcell c${v} ${path.includes(i) ? "win" : ""}"><polygon points="${points}"/>${v ? `<text x="${x}" y="${y}">${v === 1 ? "●" : "◆"}</text>` : ""}</g>`;
    }
    $("board").innerHTML = svg + "</svg>";
    const color = s.owners.indexOf(s.turn);
    $("status").textContent = s.winner
      ? `玩家${s.winner === 1 ? "一" : "二"}获胜 · 已连通目标边`
      : `玩家${s.turn === 1 ? "一" : "二"} · ${color === 1 ? "红棋连接上下" : "蓝棋连接左右"}`;
    $("hint").textContent = model.canSwap(s)
      ? "玩家二可落子，或交换双方颜色与目标边。"
      : "点击空格落子；放大后可滚动棋盘。";
    $("swap").hidden = !model.canSwap(s) || busy;
    $("players").innerHTML = [1, 2]
      .map(
        (p) =>
          `<span class="${s.turn === p ? "active" : ""}">玩家${p === 1 ? "一" : "二"}${mode === "ai" ? (p === 1 ? " · 你" : " · 电脑") : ""}：${s.owners[1] === p ? "● 红 ↕" : "◆ 蓝 ↔"}</span>`,
      )
      .join("");
  },
});
const zoom = document.getElementById("zoom");
zoom.onclick = () => {
  const enabled = document.getElementById("board").classList.toggle("zoom");
  zoom.setAttribute("aria-pressed", String(enabled));
  zoom.textContent = enabled ? "缩回棋盘" : "放大棋盘";
};
