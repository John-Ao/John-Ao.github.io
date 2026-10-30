const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE || "playwright"
);
import assert from "node:assert/strict";
const game = "nonogram";
const base =
  process.env.GAMES_URL ||
  process.env.GAME_BASE_URL ||
  "http://127.0.0.1:18769";
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || "/usr/bin/google-chrome",
  headless: true,
  args: ["--no-sandbox"],
});
try {
  for (const width of [1280, 390, 320]) {
    const mobile = width < 600;
    const context = await browser.newContext({
      viewport: { width, height: mobile ? 844 : 850 },
      hasTouch: mobile,
      isMobile: mobile,
    });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(`${base}/game/${game}/`);
    const selector =
      game === "nonogram" ? '[data-cell="0"]' : '[data-edge="0"]';
    if (mobile) await page.locator(selector).tap();
    else await page.locator(selector).click();
    assert.equal(
      await page.locator(selector).getAttribute("aria-pressed"),
      "true",
    );
    await page.locator("#undo").click();
    assert.equal(
      await page.locator(selector).getAttribute("aria-pressed"),
      "false",
    );
    await page.locator(selector).focus();
    await page.keyboard.press("Space");
    assert.equal(
      await page.locator(selector).getAttribute("aria-pressed"),
      "true",
    );
    await page.reload();
    assert.equal(
      await page.locator(selector).getAttribute("aria-pressed"),
      "true",
    );
    await page.locator("#reset").click();
    await page.locator("#cancel-reset").click();
    assert.equal(
      await page.locator(selector).getAttribute("aria-pressed"),
      "true",
    );
    await page.locator("#reset").click();
    await page.locator("#confirm-reset").click();
    assert.equal(
      await page.locator(selector).getAttribute("aria-pressed"),
      "false",
    );
    await page.locator("#help").click();
    assert.equal(await page.locator("#rules").evaluate((el) => el.open), true);
    await page.locator("[data-close]").click();
    await page.locator("#level").selectOption("7");
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
    await page.screenshot({
      path: `/tmp/${game}-${mobile ? (width === 320 ? "mobile-320" : "mobile") : "desktop"}.png`,
      fullPage: true,
    });
    if (game === "nonogram") {
      await page.locator("#zoom").click();
      assert.equal(
        await page.locator("#zoom").getAttribute("aria-pressed"),
        "true",
      );
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      );
      if (mobile) {
        const box = await page.locator(".column").first().boundingBox();
        const session = await context.newCDPSession(page);
        const y = box.y + box.height / 2;
        const startX = Math.min(320, width - 30);
        await session.send("Input.dispatchTouchEvent", {
          type: "touchStart",
          touchPoints: [{ x: startX, y }],
        });
        for (let x = startX - 20; x >= startX - 220; x -= 20)
          await session.send("Input.dispatchTouchEvent", {
            type: "touchMove",
            touchPoints: [{ x, y }],
          });
        await session.send("Input.dispatchTouchEvent", {
          type: "touchEnd",
          touchPoints: [],
        });
        assert.ok(
          await page
            .locator(".board-wrap")
            .evaluate((el) => el.scrollLeft > 100),
        );
        await session.detach();
      }
      await page.locator("#zoom").click();
      // A drag is one undoable action, even across multiple cells.
      await page.locator("#level").selectOption("0");
      const a = await page.locator('[data-cell="0"]').boundingBox(),
        b = await page.locator('[data-cell="1"]').boundingBox();
      await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
      await page.mouse.down();
      await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
      await page.mouse.up();
      assert.equal(
        await page.locator('[data-cell="1"]').getAttribute("aria-pressed"),
        "true",
      );
      await page.locator("#undo").click();
      assert.equal(
        await page.locator('[data-cell="0"]').getAttribute("aria-pressed"),
        "false",
      );
      assert.equal(
        await page.locator('[data-cell="1"]').getAttribute("aria-pressed"),
        "false",
      );
    }
    // Erasing from a blank cell must still save history when the drag reaches a filled cell.
    if (game === "nonogram") {
      await page.locator('[data-cell="1"]').click();
      await page.locator("#erase").click();
      const a = await page.locator('[data-cell="0"]').boundingBox(),
        b = await page.locator('[data-cell="1"]').boundingBox();
      await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
      await page.mouse.down();
      await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
      await page.mouse.up();
      assert.equal(
        await page.locator('[data-cell="1"]').getAttribute("aria-pressed"),
        "false",
      );
      await page.locator("#undo").click();
      assert.equal(
        await page.locator('[data-cell="1"]').getAttribute("aria-pressed"),
        "true",
      );
      await page.locator("#reset").click();
      await page.locator("#confirm-reset").click();
      await page.locator("#fill").click();
    }
    // Complete a full puzzle through the same UI actions a player uses.
    await page.locator("#level").selectOption("0");
    const answer = await page.evaluate(async () => {
      const m = await import("./model.mjs");
      return m.levels[0].solution || m.levels[0].grid.flat();
    });
    for (let i = 0; i < answer.length; i++)
      if (answer[i] === 1)
        await page
          .locator(`[data-${game === "nonogram" ? "cell" : "edge"}="${i}"]`)
          .click();
    assert.match(await page.locator("#status").textContent(), /已完成/);
    await page.locator("#undo").click();
    assert.doesNotMatch(await page.locator("#status").textContent(), /已完成/);
    // Import the pre-expansion save format, including progress on every old index.
    await page.evaluate(() => {
      const old = { level: 7 };
      [25, 25, 49, 49, 25, 49, 49, 100].forEach((length, index) => {
        old[index] = Array(length).fill(0);
        old[index][index] = 1;
        old[index][index + 1] = 2;
      });
      localStorage.setItem("nonogram-v1", JSON.stringify(old));
    });
    await page.reload();
    assert.equal(await page.locator("#group").inputValue(), "0");
    assert.equal(await page.locator("#level").inputValue(), "7");
    for (let index = 0; index < 8; index++) {
      await page.locator("#level").selectOption(String(index));
      assert.equal(
        await page
          .locator(`[data-cell="${index}"]`)
          .getAttribute("aria-pressed"),
        "true",
      );
      assert.equal(
        await page.locator(`[data-cell="${index + 1}"]`).textContent(),
        "×",
      );
    }
    // Last generated 10×10 puzzle: grouped navigation, persistence, layout and victory.
    await page.locator("#group").selectOption("6");
    assert.equal(await page.locator("#level option").count(), 20);
    await page.locator("#level").selectOption("127");
    assert.equal(await page.locator(".cell").count(), 100);
    if (mobile) await page.locator('[data-cell="0"]').tap();
    else await page.locator('[data-cell="0"]').click();
    await page.reload();
    assert.equal(await page.locator("#group").inputValue(), "6");
    assert.equal(await page.locator("#level").inputValue(), "127");
    assert.equal(
      await page.locator('[data-cell="0"]').getAttribute("aria-pressed"),
      "true",
    );
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
    await page.screenshot({
      path: `/tmp/nonogram-generated-${mobile ? (width === 320 ? "mobile-320" : "mobile") : "desktop"}.png`,
      fullPage: true,
    });
    await page.locator("#reset").click();
    await page.locator("#confirm-reset").click();
    const generatedAnswer = await page.evaluate(async () => {
      const m = await import("./model.mjs");
      return m.levels[127].grid.flat();
    });
    for (let index = 0; index < generatedAnswer.length; index++)
      if (generatedAnswer[index])
        await page.locator(`[data-cell="${index}"]`).click();
    assert.match(await page.locator("#status").textContent(), /已完成/);
    assert.deepEqual(errors, []);
    await context.close();
    console.log(
      `${game} ${mobile ? (width === 320 ? "mobile-320" : "mobile") : "desktop"}: interactions, save, reset, rules, layout, completion passed`,
    );
  }
} finally {
  await browser.close();
}
