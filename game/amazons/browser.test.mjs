// Run with: node game/amazons/browser.test.mjs (local server on port 18769).
const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE || "playwright"
);
const gamesUrl = (process.env.GAMES_URL || "http://127.0.0.1:18769").replace(/\/$/, "") + "/game";
import assert from "node:assert/strict";
const browser = await chromium.launch({
  executablePath: "/usr/bin/google-chrome",
  headless: true,
  args: ["--no-sandbox"],
});
try {
  for (const viewport of [
    { width: 1280, height: 800 },
    { width: 390, height: 844 },
    { width: 844, height: 390 },
  ]) {
    const page = await browser.newPage({ viewport });
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("dialog", (d) => d.accept());
    for (const game of ["amazons", "kalah"]) {
      await page.goto(`${gamesUrl}/${game}/`);
      await page.locator("#mode").selectOption("local");
      if (game === "amazons") {
        await page.locator("#board button").nth(60).focus();
        await page.keyboard.press("Enter");
        assert.equal(
          await page.evaluate(() => document.activeElement.dataset.index),
          "60",
        );
        assert.match(await page.locator("#status").innerText(), /移动位置/);
        await page.keyboard.press("ArrowUp");
        await page.keyboard.press("Enter");
        assert.equal(
          await page.evaluate(() => document.activeElement.dataset.index),
          "50",
        );
        assert.match(await page.locator("#status").innerText(), /射箭位置/);
        await page.keyboard.press("ArrowDown");
        await page.keyboard.press("Space");
        assert.match(await page.locator("#status").innerText(), /黑方/);
        assert.equal(
          await page.locator("#board button").nth(60).innerText(),
          "×",
        );
        await page.reload();
        assert.equal(
          await page.locator("#board button").nth(60).innerText(),
          "×",
        );
        await page.locator("#undo").click();
        assert.equal(
          await page.locator("#board button").nth(60).innerText(),
          "●",
        );
      } else {
        await page
          .getByRole("button", { name: "玩家1 第3坑，4颗", exact: true })
          .click();
        assert.equal(
          await page.evaluate(() => document.activeElement.dataset.index),
          "2",
        );
        assert.match(await page.locator("#status").innerText(), /额外回合/);
        await page.reload();
        assert.match(await page.locator("#status").innerText(), /额外回合/);
        await page.locator("#undo").click();
        assert.equal(
          await page
            .getByRole("button", { name: "玩家1 第3坑，4颗", exact: true })
            .innerText(),
          "4",
        );
      }
      await page.locator("#rules").click();
      assert(await page.locator("#help").isVisible());
      await page.locator("#close").click();
      assert(!(await page.locator("#help").isVisible()));
      if (game === "amazons") {
        const geometry = await page
          .locator("#board button.white")
          .first()
          .evaluate((el) => {
            const cell = el.getBoundingClientRect();
            const piece = getComputedStyle(el, "::before");
            return {
              ratio: parseFloat(piece.width) / cell.width,
              square: Math.abs(cell.width - cell.height),
              pageHeight: document.documentElement.scrollHeight,
            };
          });
        assert(geometry.ratio > 0.55 && geometry.ratio < 0.65);
        assert(geometry.square < 1);
        if (viewport.width === 844)
          assert(geometry.pageHeight <= viewport.height);
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
      if (game === "amazons") {
        await page.locator("#board button").nth(60).click();
        await page.locator("#board button").nth(50).click();
        await page.locator("#board button").nth(60).click();
        await page.waitForFunction(() =>
          document.querySelector("#status").textContent.includes("白方"),
        );
      } else {
        await page
          .getByRole("button", { name: "玩家1 第1坑，4颗", exact: true })
          .click();
        await page.waitForFunction(() =>
          document.querySelector("#status").textContent.includes("玩家一"),
        );
      }
      await page.locator("#undo").click();
    }
    assert.deepEqual(errors, []);
    await page.close();
  }
  console.log(
    "Both games: desktop/mobile moves, AI, undo, persistence, dialogs and overflow passed.",
  );
} finally {
  await browser.close();
}
