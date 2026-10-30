import assert from "node:assert/strict";
const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE || "playwright"
);
const game = new URL(".", import.meta.url).pathname
  .split("/")
  .filter(Boolean)
  .at(-1);
const base = process.env.GAMES_URL || "http://127.0.0.1:18769";
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || "/usr/bin/google-chrome",
  headless: true,
  args: ["--no-sandbox"],
});
try {
  for (const viewport of [
    { width: 1280, height: 800 },
    { width: 390, height: 844 },
    { width: 320, height: 844 },
    { width: 844, height: 390 },
  ]) {
    const page = await browser.newPage({
      viewport,
      hasTouch: viewport.width <= 390,
    });
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(`${base}/game/${game}/`);
    await page.locator("#mode").selectOption("local");
    await page.locator("#confirm-new").click();
    const cell = (i) => page.locator(`[data-cell="${i}"]`);
    const stored = () =>
      page.evaluate(
        (key) => JSON.parse(localStorage.getItem(key)),
        `${game}-v1`,
      );
    if (viewport.width <= 390) {
      await cell(0).tap();
      if (game === "hex") await page.locator("#undo").click();
      else await page.locator("#cancel").click();
    }
    async function stagedMove() {
      await cell(0).focus();
      await page.keyboard.press("Enter");
      assert.equal(
        await page.evaluate(() => document.activeElement.dataset.cell),
        "0",
      );
      if (game === "hex") return;
      await page.keyboard.press("ArrowRight");
      await page.keyboard.press("Enter");
      if (game === "qawale") {
        await page.keyboard.press("ArrowRight");
        await page.keyboard.press("Enter");
        await page.keyboard.press("ArrowRight");
        await page.keyboard.press("Enter");
      } else {
        await page.keyboard.press("ArrowRight");
        await page.keyboard.press("ArrowRight");
        await page.keyboard.press("ArrowRight");
        await page.keyboard.press("Enter");
      }
    }
    if (game !== "hex") {
      await cell(0).click();
      await cell(1).click();
      assert.equal((await stored()).s.moves, 0);
      await page.reload();
      assert(await page.locator("#cancel").isHidden());
    }
    await stagedMove();
    if (game !== "hex") {
      assert(await page.locator("#confirmmove").isVisible());
      assert.equal((await stored()).s.moves, 0);
      await page.screenshot({
        path: `/tmp/${game}-preview-${viewport.width}.png`,
        fullPage: true,
      });
      await page.locator("#confirmmove").click();
    }
    assert.equal((await stored()).s.moves, 1);
    await page.reload();
    assert.equal((await stored()).s.moves, 1);
    if (game === "hex") {
      await page.locator("#swap").click();
      assert.deepEqual((await stored()).s.owners, [0, 2, 1]);
      assert.equal((await stored()).s.board[0], 1);
      await cell(0).focus();
      await page.keyboard.press("ArrowRight");
      await page.keyboard.press("Space");
      assert.equal((await stored()).s.board[1], 2);
      await page.locator("#undo").click();
      await page.locator("#undo").click();
    }
    await page.locator("#undo").click();
    assert.equal((await stored()).s.moves, 0);
    await page.locator("#rules").click();
    assert(await page.locator("#help").isVisible());
    await page.locator("#close-help").click();
    assert(await page.locator("#help").isHidden());
    await page.locator("#new").click();
    await page.locator("#cancel-new").click();
    assert.equal((await stored()).s.moves, 0);
    if (game === "hex") {
      for (const size of ["9", "11"]) {
        await page.locator("#size").selectOption(size);
        await page.locator("#confirm-new").click();
        assert.equal(
          await page.locator("[data-cell]").count(),
          Number(size) ** 2,
        );
      }
      await page.locator("#zoom").click();
      assert(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      );
      await page.locator("#zoom").click();
    }
    assert(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
    await page.screenshot({
      path: `/tmp/${game}-${viewport.width}.png`,
      fullPage: true,
    });
    await page.locator("#mode").selectOption("ai");
    await page.locator("#confirm-new").click();
    if (game === "hex") {
      const n = (await stored()).s.n;
      await cell(Math.floor((n * n) / 2)).click();
    } else {
      await stagedMove();
      await page.locator("#confirmmove").click();
    }
    await page.waitForFunction((key) => {
      const data = JSON.parse(localStorage.getItem(key));
      return data.s.moves >= 2 && data.s.turn === 1;
    }, `${game}-v1`);
    await page.locator("#undo").click();
    assert.equal((await stored()).s.moves, 0);
    if (viewport.width === 1280) {
      await page.evaluate(async (game) => {
        const model = await import("./model.mjs");
        const s = model.initial();
        if (game === "hex") {
          for (let r = 0; r < 6; r++) s.board[r * 7] = 1;
        } else if (game === "qawale") {
          s.board = Array.from({ length: 16 }, () => []);
          for (const i of [1, 2, 3, 4]) s.board[i] = [1];
          s.reserve[1] = 4;
        } else {
          for (const i of [1, 2, 3, 4]) s.board[i] = 1;
          for (const i of [6, 7, 8, 9]) s.board[i] = 2;
          s.board[5] = 1;
          s.board[10] = 2;
        }
        localStorage.setItem(
          `${game}-v1`,
          JSON.stringify({ s, mode: "local", history: [] }),
        );
      }, game);
      await page.reload();
      if (game === "hex") await cell(42).click();
      else {
        if (game === "qawale") {
          await cell(4).click();
          await cell(0).click();
          await cell(1).click();
        } else {
          await cell(0).click();
          await cell(20).click();
        }
        await page.locator("#confirmmove").click();
      }
      assert.match(
        await page.locator("#status").innerText(),
        game === "quixo" ? /玩家二.*获胜/ : /玩家一.*获胜/,
      );
      await page.reload();
      assert.match(await page.locator("#status").innerText(), /获胜/);
      await page.locator("#undo").click();
      assert.doesNotMatch(await page.locator("#status").innerText(), /获胜/);
    }
    assert.deepEqual(errors, []);
    await page.close();
    console.log(
      `${game} ${viewport.width}×${viewport.height}: keyboard, preview, save, undo, rules, AI and layout passed`,
    );
  }
} finally {
  await browser.close();
}
