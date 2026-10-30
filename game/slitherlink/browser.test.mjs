const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE || "playwright"
);
import assert from "node:assert/strict";
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
  for (const device of ["desktop", "mobile", "small"]) {
    const mobile = device !== "desktop";
    const context = await browser.newContext({
      viewport: mobile
        ? { width: device === "small" ? 320 : 390, height: 844 }
        : { width: 1280, height: 850 },
      hasTouch: mobile,
      isMobile: mobile,
    });
    const page = await context.newPage(),
      errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(`${base}/game/slitherlink/`);
    const edge = () => page.locator('[data-edge="0"]');
    if (mobile) await edge().tap();
    else await edge().click();
    assert.equal(await edge().getAttribute("aria-pressed"), "true");
    await page.locator("#undo").click();
    assert.equal(await edge().getAttribute("aria-pressed"), "false");
    await edge().focus();
    await page.keyboard.press("Space");
    await page.reload();
    assert.equal(await edge().getAttribute("aria-pressed"), "true");
    await page.locator("#reset").click();
    await page.locator("#cancel-reset").click();
    assert.equal(await edge().getAttribute("aria-pressed"), "true");
    await page.locator("#reset").click();
    await page.locator("#confirm-reset").click();
    assert.equal(await edge().getAttribute("aria-pressed"), "false");
    await page.locator("#help").click();
    assert(await page.locator("#rules").evaluate((el) => el.open));
    await page.locator("[data-close]").click();
    // Existing numeric save keys and first eight level indices remain stable.
    await page.locator("#level").selectOption("7");
    await edge().click();
    await page.reload();
    assert.equal(await page.locator("#group").inputValue(), "legacy");
    assert.equal(await page.locator("#level").inputValue(), "7");
    assert.equal(await edge().getAttribute("aria-pressed"), "true");
    for (const [group, index] of [
      ["4", 8],
      ["5", 40],
      ["6", 72],
    ]) {
      await page.locator("#group").selectOption(group);
      assert.equal(await page.locator("#level option").count(), 32);
      assert.equal(await page.locator("#level").inputValue(), String(index));
      assert(!(await page.locator("#board").innerText()).includes("null"));
      const puzzle = await page.evaluate(
        async (i) => (await import("./model.mjs")).levels[i],
        index,
      );
      assert.equal(
        await page.locator("text.clue").count(),
        puzzle.clues.filter((v) => v != null).length,
      );
      assert.equal(await page.locator("text.clue.bad").count(), 0);
      await edge().click();
      await page.reload();
      assert.equal(await page.locator("#group").inputValue(), group);
      assert.equal(await page.locator("#level").inputValue(), String(index));
      assert.equal(await edge().getAttribute("aria-pressed"), "true");
      assert(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      );
      await page.locator("#reset").click();
      await page.locator("#confirm-reset").click();
      await page.screenshot({
        path: `/tmp/slitherlink-${group}-${device}.png`,
        fullPage: true,
      });
      // Play both smallest and largest generated boards, including omitted clues.
      if (group !== "5") {
        for (let i = 0; i < puzzle.solution.length; i++)
          if (puzzle.solution[i]) {
            const target = page.locator(`[data-edge="${i}"]`);
            if (mobile) await target.tap();
            else await target.click();
          }
        assert.match(await page.locator("#status").innerText(), /已完成/);
        await page.reload();
        assert.match(await page.locator("#status").innerText(), /已完成/);
        // Reset preserves other levels' progress.
        await page.locator("#reset").click();
        await page.locator("#confirm-reset").click();
        await edge().click();
        await page.locator("#undo").click();
        assert.equal(await edge().getAttribute("aria-pressed"), "false");
      }
    }
    await page.locator("#group").selectOption("legacy");
    await page.locator("#level").selectOption("7");
    assert.equal(await edge().getAttribute("aria-pressed"), "true");
    // Restored old save data can still complete its original puzzle.
    await page.locator("#level").selectOption("0");
    const solution = await page.evaluate(
      async () => (await import("./model.mjs")).levels[0].solution,
    );
    for (let i = 0; i < solution.length; i++)
      if (solution[i]) await page.locator(`[data-edge="${i}"]`).click();
    assert.match(await page.locator("#status").innerText(), /已完成/);
    await page.locator("#undo").click();
    assert.doesNotMatch(await page.locator("#status").innerText(), /已完成/);
    assert.deepEqual(errors, []);
    await context.close();
    console.log(
      `${mobile ? "Mobile" : "Desktop"}: legacy saves, grouped selection, all sizes, omitted clues, interactions and full generated completions passed`,
    );
  }
} finally {
  await browser.close();
}
