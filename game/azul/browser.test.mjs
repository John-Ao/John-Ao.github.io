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
  await page.goto(base + "/game/azul/");
  await page.locator("#factories button").first().click();
  assert((await page.locator(".pattern.legal").count()) > 0);
  await page.locator("#cancel").click();
  assert.equal(await page.locator(".pattern.legal").count(), 0);
  await page.locator("#factories button").first().click();
  await page.locator(".pattern.legal").first().click();
  await page.waitForFunction(() => {
    const s = JSON.parse(localStorage.getItem("azul-v1"));
    return s.player === 0 && s.phase === "take";
  });
  await page.locator("#new").click();
  await page.selectOption("#mode", "local");
  await page.locator("#start").click();
  await page.screenshot({ path: `/tmp/azul-${width}.png`, fullPage: true });
  let turns = 0;
  while (await page.locator("#next").isHidden()) {
    const { m, p } = await page.evaluate(async () => {
      const { aiMove } = await import("./model.mjs");
      const s = JSON.parse(localStorage.getItem("azul-v1"));
      return { m: aiMove(s), p: s.player };
    });
    const container =
      m.source === 5
        ? page.locator("#center")
        : page.locator(".factory").nth(m.source);
    await container
      .getByRole("button")
      .filter({ has: page.locator(".t" + m.color) })
      .click();
    const board = page.locator(".player-board").nth(p);
    await (
      m.row === -1
        ? board.locator(".floor-action")
        : board.locator(".pattern").nth(m.row)
    ).click();
    assert(++turns < 30);
  }
  assert((await page.locator("#result").innerText()).includes("铺墙"));
  await page.reload();
  assert(await page.locator("#next").isVisible());
  await page.locator("#next").click();
  assert.equal(await page.locator(".factory").count(), 5);
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
  "PASS Azul 1280/390/320, cancel, local new game, full round, scoring, restore and refill.",
);
