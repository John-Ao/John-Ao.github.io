const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE || "playwright"
);
import assert from "node:assert/strict";
const game = "hashi",
  base = process.env.GAMES_URL || "http://127.0.0.1:18769";
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || "/usr/bin/google-chrome",
  headless: true,
  args: ["--no-sandbox"],
});
try {
  for (const width of [1280, 390, 320]) {
    const mobile = width < 600,
      context = await browser.newContext({
        viewport: { width, height: mobile ? 844 : 900 },
        isMobile: mobile,
        hasTouch: mobile,
      }),
      page = await context.newPage(),
      errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(`${base}/game/${game}/`);
    await page.locator("[data-index]").first().waitFor();
    const initial = await page.evaluate(
        (game) => JSON.parse(localStorage.getItem(game + "-v1"))[0],
        game,
      ),
      first = await page.evaluate(async (game) => {
        const { levels } = await import("./levels.mjs");
        return game === "akari"
          ? levels[0].cells.indexOf(-2)
          : game === "sokoban"
            ? levels[0].solution[0]
            : 0;
      }, game);
    const selector =
      game === "sokoban" ? `[data-dir="${first}"]` : `[data-index="${first}"]`;
    if (mobile) await page.locator(selector).tap();
    else await page.locator(selector).click();
    const changed = await page.evaluate(
      (game) => JSON.parse(localStorage.getItem(game + "-v1"))[0],
      game,
    );
    assert.notDeepEqual(changed, initial);
    await page.locator("#undo").click();
    assert.deepEqual(
      await page.evaluate(
        (game) => JSON.parse(localStorage.getItem(game + "-v1"))[0],
        game,
      ),
      initial,
    );
    if (game === "sokoban") {
      await page.locator("[data-index]").first().focus();
      await page.keyboard.press(
        { U: "ArrowUp", R: "ArrowRight", D: "ArrowDown", L: "ArrowLeft" }[
          first
        ],
      );
    } else {
      await page.locator(selector).focus();
      await page.keyboard.press("Space");
    }
    assert.deepEqual(
      await page.evaluate(
        (game) => JSON.parse(localStorage.getItem(game + "-v1"))[0],
        game,
      ),
      changed,
    );
    await page.reload();
    assert.deepEqual(
      await page.evaluate(
        (game) => JSON.parse(localStorage.getItem(game + "-v1"))[0],
        game,
      ),
      changed,
    );
    await page.locator("#reset").click();
    await page.locator("#cancel-reset").click();
    assert.deepEqual(
      await page.evaluate(
        (game) => JSON.parse(localStorage.getItem(game + "-v1"))[0],
        game,
      ),
      changed,
    );
    await page.locator("#reset").click();
    await page.locator("#confirm-reset").click();
    assert.deepEqual(
      await page.evaluate(
        (game) => JSON.parse(localStorage.getItem(game + "-v1"))[0],
        game,
      ),
      initial,
    );
    await page.locator("#help").click();
    assert.equal(await page.locator("#rules").evaluate((e) => e.open), true);
    const close = await page.locator("#close-rules").boundingBox();
    assert.ok(close.y + close.height <= (mobile ? 844 : 900));
    await page.locator("#close-rules").click();
    const maxSize = await page
      .locator("#group option")
      .last()
      .getAttribute("value");
    await page.locator("#group").selectOption(maxSize);
    await page.locator("#level").selectOption("59");
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
    await page.screenshot({
      path: `/tmp/${game}-${width}.png`,
      fullPage: true,
    });
    await page.locator("#zoom").click();
    assert.equal(
      await page.locator("#zoom").getAttribute("aria-pressed"),
      "true",
    );
    if (mobile) {
      const box = await page.locator("#board").boundingBox(),
        session = await context.newCDPSession(page),
        x = Math.min(320, width - 30),
        y = Math.min(box.y + 12, 700);
      await session.send("Input.dispatchTouchEvent", {
        type: "touchStart",
        touchPoints: [{ x, y }],
      });
      for (let xx = x - 20; xx >= x - 200; xx -= 20)
        await session.send("Input.dispatchTouchEvent", {
          type: "touchMove",
          touchPoints: [{ x: xx, y }],
        });
      await session.send("Input.dispatchTouchEvent", {
        type: "touchEnd",
        touchPoints: [],
      });
      assert.ok(
        await page.locator(".board-wrap").evaluate((e) => e.scrollLeft > 30),
      );
      await session.detach();
    }
    await page.locator("#zoom").click();
    // Freshly reset after scrolling, then complete the largest puzzle using real UI input.
    await page.locator("#reset").click();
    await page.locator("#confirm-reset").click();
    const answer = await page.evaluate(async () => {
      const { levels } = await import("./levels.mjs");
      return levels[59].solution;
    });
    if (game === "sokoban") {
      for (const dir of answer)
        await page.locator(`[data-dir="${dir}"]`).click();
    } else
      for (let i = 0; i < answer.length; i++)
        if (answer[i]) {
          const cell = page.locator(`[data-index="${i}"]`);
          if (game === "hashi") {
            await cell.focus();
            await page.keyboard.press(String(answer[i]));
          } else if (game === "galaxies") {
            await cell.focus();
            await page.keyboard.press("Space");
          } else await cell.click();
        }
    assert.match(await page.locator("#status").textContent(), /已完成/);
    await page.screenshot({
      path: `/tmp/${game}-${width}-won.png`,
      fullPage: true,
    });
    await page.locator("#undo").click();
    assert.doesNotMatch(await page.locator("#status").textContent(), /已完成/);
    await page.reload();
    assert.equal(await page.locator("#level").inputValue(), "59");
    assert.equal(await page.locator("#group").inputValue(), maxSize);
    assert.deepEqual(errors, []);
    await context.close();
    console.log(
      `${game} ${width}px: touch, keyboard, undo, save, reset, dialogs, zoom, full solution passed`,
    );
  }
} finally {
  await browser.close();
}
