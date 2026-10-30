import * as model from "./model.mjs";
import { mount } from "./ui.mjs";
const names = ["空", "白", "黑", "黄"];
mount({
  id: "qawale",
  ...model,
  valid: (s) =>
    s &&
    Array.isArray(s.board) &&
    s.board.length === 16 &&
    s.board.every(
      (p) => Array.isArray(p) && p.every((v) => [1, 2, 3].includes(v)),
    ) &&
    Array.isArray(s.reserve) &&
    [1, 2].includes(s.turn),
  columns: () => 4,
  ready: (ctx) =>
    ctx.selection &&
    ctx.selection.path.length === ctx.s.board[ctx.selection.from].length + 1,
  click(ctx, i, api) {
    if (!ctx.selection) {
      if (model.starts(ctx.s).includes(i))
        ctx.selection = { from: i, path: [] };
    } else if (
      ctx.selection.path.length < ctx.s.board[ctx.selection.from].length + 1 &&
      model.destinations(ctx.selection.from, ctx.selection.path).includes(i)
    )
      ctx.selection.path.push(i);
    api.render();
  },
  draw({ s, mode, selection, busy }, $) {
    const p = selection
      ? model.preview(s, selection.from, selection.path)
      : { board: s.board, hand: [] };
    const available =
      busy || s.ended
        ? []
        : selection
          ? p.hand.length
            ? model.destinations(selection.from, selection.path)
            : []
          : model.starts(s);
    const win = s.winner ? model.winningLine(s.board, s.winner) : [];
    $("board").className = "square";
    $("board").style.setProperty("--n", 4);
    $("board").innerHTML = p.board
      .map((pile, i) => {
        const top = pile.at(-1),
          visits =
            selection?.path.flatMap((v, k) => (v === i ? [k + 1] : [])) || [];
        return `<button data-cell="${i}" class="${available.includes(i) ? "legal" : ""} ${selection?.from === i ? "selected" : ""} ${win.includes(i) ? "win" : ""}" aria-label="第${Math.floor(i / 4) + 1}行第${(i % 4) + 1}列，${pile.length ? `从底到顶${pile.map((v) => names[v]).join("、")}，共${pile.length}枚` : "空格"}${available.includes(i) ? "，可选" : ""}">${top ? `<span class="piece p${top}">${names[top]}</span><span class="stack-count">${pile.length}枚</span>` : ""}${visits.length ? `<span class="route">${visits.join("·")}</span>` : ""}</button>`;
      })
      .join("");
    $("status").textContent = s.ended
      ? s.winner
        ? `玩家${s.winner === 1 ? "一" : "二"}获胜 · 顶层四连`
        : "平局 · 双方棋子已用完"
      : `玩家${s.turn === 1 ? "一" : "二"} · ${selection ? (p.hand.length ? `继续播撒，剩 ${p.hand.length} 枚` : "检查路线并确认行动") : "选择非空棋堆"}`;
    $("hint").textContent = selection
      ? "绿框为下一步；数字为路线步序。不能立即折返，可绕圈重访。"
      : "选堆后由底到顶播撒；只有顶层四连有效。";
    $("hand").innerHTML = p.hand.length
      ? `下一枚起：<span class="top-order">${p.hand.map((v) => `<span class="mini p${v}">${names[v]}</span>`).join("")}</span>`
      : "";
    $("players").innerHTML = [1, 2]
      .map(
        (v) =>
          `<span class="${s.turn === v ? "active" : ""}">玩家${v === 1 ? "一 · 白" : "二 · 黑"}${mode === "ai" ? (v === 1 ? "（你）" : "（电脑）") : ""} · 余 ${s.reserve[v]}</span>`,
      )
      .join("");
  },
});
