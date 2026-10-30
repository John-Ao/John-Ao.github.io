export function mount(game) {
  const $ = (id) => document.getElementById(id),
    key = `${game.id}-v1`;
  const ctx = {
    s: game.initial(),
    mode: "ai",
    history: [],
    selection: null,
    busy: false,
  };
  let timer,
    focusIndex = 0,
    pendingMode = null,
    pendingSize = null;
  try {
    const saved = JSON.parse(localStorage.getItem(key));
    if (saved && game.valid(saved.s)) {
      ctx.s = saved.s;
      ctx.mode = saved.mode === "local" ? "local" : "ai";
      ctx.history = Array.isArray(saved.history)
        ? saved.history.filter(game.valid)
        : [];
    }
  } catch {}
  function save() {
    try {
      localStorage.setItem(
        key,
        JSON.stringify({ s: ctx.s, mode: ctx.mode, history: ctx.history }),
      );
    } catch {}
  }
  function render() {
    const focused = document.activeElement?.closest?.("[data-cell]");
    if (focused) focusIndex = Number(focused.dataset.cell);
    game.draw(ctx, $);
    $("mode").value = ctx.mode;
    if ($("size")) $("size").value = ctx.s.n;
    $("undo").disabled = !ctx.history.length && !ctx.selection;
    $("cancel").hidden = !ctx.selection;
    $("confirmmove").hidden = !game.ready?.(ctx);
    for (const e of $("board").querySelectorAll("[data-cell]"))
      e.tabIndex = Number(e.dataset.cell) === focusIndex ? 0 : -1;
    if (focused)
      $("board")
        .querySelector(`[data-cell="${focusIndex}"]`)
        ?.focus({ preventScroll: true });
    if (ctx.busy) $("status").textContent = "玩家二正在思考…";
  }
  function commit(action) {
    if (ctx.busy) return;
    ctx.history.push(structuredClone(ctx.s));
    try {
      ctx.s = game.move(ctx.s, action);
    } catch (error) {
      ctx.history.pop();
      $("status").textContent = error.message;
      return;
    }
    ctx.selection = null;
    save();
    render();
    startAI();
  }
  function startAI() {
    if (ctx.mode !== "ai" || ctx.s.turn !== 2 || ctx.s.winner || ctx.s.ended)
      return;
    ctx.busy = true;
    render();
    timer = setTimeout(() => {
      const action = game.computer(ctx.s);
      if (action !== null && action !== undefined) {
        ctx.history.push(structuredClone(ctx.s));
        ctx.s = game.move(ctx.s, action);
      }
      ctx.busy = false;
      save();
      render();
    }, 180);
  }
  const api = { render, commit };
  $("board").onclick = (e) => {
    const cell = e.target.closest("[data-cell]");
    if (cell && !ctx.busy && !ctx.s.winner && !ctx.s.ended)
      game.click(ctx, Number(cell.dataset.cell), api);
  };
  $("board").onkeydown = (e) => {
    const cell = e.target.closest("[data-cell]");
    if (!cell) return;
    if (["Enter", " "].includes(e.key)) {
      e.preventDefault();
      cell.click();
      return;
    }
    const n = game.columns(ctx),
      index = Number(cell.dataset.cell);
    let r = Math.floor(index / n),
      c = index % n;
    if (e.key === "ArrowLeft") c = Math.max(0, c - 1);
    else if (e.key === "ArrowRight") c = Math.min(n - 1, c + 1);
    else if (e.key === "ArrowUp") r = Math.max(0, r - 1);
    else if (e.key === "ArrowDown") r = Math.min(n - 1, r + 1);
    else return;
    e.preventDefault();
    cell.tabIndex = -1;
    focusIndex = r * n + c;
    const next = $("board").querySelector(`[data-cell="${focusIndex}"]`);
    if (next) {
      next.tabIndex = 0;
      next.focus();
    }
  };
  $("undo").onclick = () => {
    clearTimeout(timer);
    ctx.busy = false;
    if (ctx.selection) ctx.selection = null;
    else if (ctx.history.length) {
      ctx.s = ctx.history.pop();
      while (ctx.mode === "ai" && ctx.s.turn === 2 && ctx.history.length)
        ctx.s = ctx.history.pop();
    }
    save();
    render();
  };
  $("cancel").onclick = () => {
    ctx.selection = null;
    render();
  };
  $("confirmmove").onclick = () => {
    if (game.ready?.(ctx)) commit(ctx.selection);
  };
  $("rules").onclick = () => $("help").showModal();
  $("close-help").onclick = () => $("help").close();
  function askNew() {
    pendingMode = $("mode").value;
    pendingSize = $("size") ? Number($("size").value) : null;
    $("new-dialog").showModal();
  }
  $("new").onclick = askNew;
  $("mode").onchange = askNew;
  if ($("size")) $("size").onchange = askNew;
  $("cancel-new").onclick = () => $("new-dialog").close();
  $("new-dialog").addEventListener("close", () => {
    $("mode").value = ctx.mode;
    if ($("size")) $("size").value = ctx.s.n;
  });
  $("confirm-new").onclick = () => {
    clearTimeout(timer);
    ctx.busy = false;
    ctx.mode = pendingMode;
    ctx.s = game.initial(pendingSize || undefined);
    ctx.history = [];
    ctx.selection = null;
    focusIndex = 0;
    save();
    render();
    $("new-dialog").close();
  };
  document.addEventListener("keydown", (e) => {
    if (
      e.key === "Escape" &&
      ctx.selection &&
      !document.querySelector("dialog[open]")
    ) {
      ctx.selection = null;
      render();
    }
  });
  if ($("swap")) $("swap").onclick = () => commit("swap");
  render();
  startAI();
}
