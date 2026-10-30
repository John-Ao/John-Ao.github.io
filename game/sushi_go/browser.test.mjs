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
  await page.goto(base + "/game/sushi_go/");
  assert.equal(await page.locator("#hand button").count(), 9);
  await page.locator("#hand button").first().click();
  await page.locator("#clear").click();
  assert(await page.locator("#confirm").isDisabled());
  await page.screenshot({ path: `/tmp/sushi-go-${width}.png`, fullPage: true });
  for (let round = 1; round <= 3; round++) {
    while (await page.locator("#choose").isVisible()) {
      const choice = await page.evaluate(async () => {
        const { aiChoice } = await import("./model.mjs");
        return aiChoice(JSON.parse(localStorage.getItem("sushi-go-v1")), 0);
      });
      for (let i of choice) await page.locator("#hand button").nth(i).click();
      await page.locator("#confirm").click();
    }
    assert(await page.locator("#result").isVisible());
    if (round < 3) {
      await page.reload();
      await page.locator("#next").click();
    }
  }
  assert((await page.locator("#message").innerText()).includes("获胜"));
  await page.locator("#new").click();
  await page.selectOption("#count", "5");
  await page.locator("#start").click();
  assert.equal(await page.locator("#hand button").count(), 7);
  assert.equal(await page.locator(".player").count(), 5);
  await page.evaluate(async () => {
    const { fresh, turn } = await import("./model.mjs");
    const s = fresh(3, () => 0);
    turn(s, [[4], [0], [1]]);
    localStorage.setItem("sushi-go-v1", JSON.stringify(s));
  });
  await page.reload();
  await page.locator("#hand button").nth(0).click();
  await page.locator("#hand button").nth(1).click();
  assert.equal(await page.locator(".card.selected").count(), 2);
  assert.deepEqual(
    await page.locator(".card.selected .order").allTextContents(),
    ["1", "2"],
  );
  await page.locator("#confirm").click();
  assert(
    await page.evaluate(() =>
      JSON.parse(localStorage.getItem("sushi-go-v1")).hands[1].some(
        (c) => c.type === "chopsticks",
      ),
    ),
  );
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
  "PASS Sushi Go 1280/390/320, cancel, full three rounds, restore, five-player new game.",
);
