import assert from "node:assert/strict";
const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE || "playwright"
);
const base = process.env.GAMES_URL || "http://127.0.0.1:18769";
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || "/usr/bin/google-chrome",
  headless: true,
  args: ["--no-sandbox"],
});
for (const width of [1280, 390, 320]) {
  const page = await browser.newPage({ viewport: { width, height: 850 } }),
    errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(base + "/game/lost_cities/");
  await page.locator("#hand button").first().click();
  await page.locator("#discard").click();
  assert(await page.locator("#undo").isEnabled());
  await page.locator("#undo").click();
  assert.equal(await page.locator("#hand button").count(), 8);
  await page.locator("#hand button").first().click();
  await page.locator("#discard").click();
  await page.locator("#draw").click();
  await page.waitForFunction(() => {
    const s = JSON.parse(localStorage.getItem("lost-cities-v1"));
    return s.player === 0 && s.phase === "play";
  });
  assert.equal(await page.locator("#hand button").count(), 8);
  await page.locator("#new").click();
  await page.selectOption("#mode", "local");
  await page.locator("#start").click();
  assert(await page.locator("#gate").isVisible());
  assert.equal(await page.locator("#hand button").count(), 0);
  await page.locator("#reveal").click();
  assert.equal(await page.locator("#hand button").count(), 8);
  await page.screenshot({
    path: `/tmp/lost-cities-${width}.png`,
    fullPage: true,
  });
  // Play a complete round through real buttons; choose each action from the public/own-hand AI policy.
  let turns = 0;
  while (await page.locator("#next").isHidden()) {
    if (await page.locator("#gate").isVisible())
      await page.locator("#reveal").click();
    const m = await page.evaluate(async () => {
      const { aiPlay } = await import("./model.mjs");
      return aiPlay(JSON.parse(localStorage.getItem("lost-cities-v1")));
    });
    await page.locator("#hand button").nth(m.index).click();
    await page.locator(m.discard ? "#discard" : "#expedition").click();
    await page.locator("#draw").click();
    assert.equal(await page.locator("#hand button").count(), 0);
    assert(++turns <= 44);
  }
  assert.equal(turns, 44);
  await page.reload();
  assert(await page.locator("#result").isVisible());
  await page.locator("#next").click();
  assert(await page.locator("#gate").isVisible());
  await page.reload();
  assert.equal(await page.locator("#hand button").count(), 0);
  await page.locator("#rules").click();
  await page.getByRole("button", { name: "关闭", exact: true }).click();
  assert(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  assert.deepEqual(errors, []);
  await page.close();
}
await browser.close();
console.log(
  "PASS Lost Cities 1280/390/320, undo, hidden handoff/reload, new game, 44-turn round, next round.",
);
