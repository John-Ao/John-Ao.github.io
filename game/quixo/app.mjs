import * as model from "./model.mjs";
import { mount } from "./ui.mjs";
mount({
  id: "quixo",
  ...model,
  valid: (s) =>
    s &&
    Array.isArray(s.board) &&
    s.board.length === 25 &&
    s.board.every((v) => [0, 1, 2].includes(v)) &&
    [1, 2].includes(s.turn) &&
    Array.isArray(s.recent),
  columns: () => 5,
  ready: (ctx) => ctx.selection?.to != null,
  click(ctx, i, api) {
    if (!ctx.selection) {
      if (model.ends(ctx.s, i).length) ctx.selection = { from: i };
    } else if (model.ends(ctx.s, ctx.selection.from).includes(i))
      ctx.selection.to = i;
    else if (i === ctx.selection.from) ctx.selection = null;
    api.render();
  },
  draw({ s, mode, selection, busy }, $) {
    const preview = selection?.to != null ? model.move(s, selection) : s,
      available =
        busy || s.winner
          ? []
          : selection
            ? model.ends(s, selection.from)
            : s.board.flatMap((_, i) => (model.ends(s, i).length ? [i] : [])),
      win = s.winner ? model.winningLine(s.board, s.winner) : [];
    $("board").className = "square";
    $("board").style.setProperty("--n", 5);
    $("board").innerHTML = preview.board
      .map(
        (v, i) =>
          `<button data-cell="${i}" class="${available.includes(i) ? "legal" : ""} ${selection?.from === i ? "selected" : ""} ${selection?.to === i ? "target" : ""} ${win.includes(i) ? "win" : ""}" aria-label="第${Math.floor(i / 5) + 1}行第${(i % 5) + 1}列，${v === 1 ? "叉" : v === 2 ? "圈" : "空白"}${selection && available.includes(i) ? "，可从此端推入" : ""}"><span class="symbol p${v}">${v === 1 ? "×" : v === 2 ? "○" : ""}</span>${selection && available.includes(i) ? '<span class="route">推入</span>' : ""}</button>`,
      )
      .join("");
    $("status").textContent = s.winner
      ? `玩家${s.winner === 1 ? "一（×）" : "二（○）"}获胜`
      : `玩家${s.turn === 1 ? "一（×）" : "二（○）"} · ${selection ? (selection.to != null ? "检查滑动结果并确认" : "选择绿框端点推入") : "选择外围空块或己块"}`;
    $("hint").textContent =
      selection?.to != null
        ? `已预览整行/列滑动${preview.winner ? `；确认后玩家${preview.winner === 1 ? "一" : "二"}获胜` : ""}。可改选推入端点或取消。`
        : "绿框可选；不能从原取出口放回。替对手连成五个即输。";
    $("players").innerHTML = [1, 2]
      .map(
        (v) =>
          `<span class="${s.turn === v ? "active" : ""}">玩家${v === 1 ? "一 · ×" : "二 · ○"}${mode === "ai" ? (v === 1 ? "（你）" : "（电脑）") : ""}</span>`,
      )
      .join("");
  },
});
