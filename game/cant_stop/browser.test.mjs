const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE || "playwright"
);
const baseUrl = process.env.GAMES_URL || "http://127.0.0.1:18769";
import assert from "node:assert/strict";
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || "/usr/bin/google-chrome",
  headless: true,
  args: ["--no-sandbox"],
});
for (const viewport of [
  { width: 1280, height: 850 },
  { width: 390, height: 844 },
]) {
  const page = await browser.newPage({ viewport });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(baseUrl + "/game/cant_stop/");
  await page.locator("#roll").click();
  assert((await page.locator("#choices button").count()) > 0);
  await page.locator("#choices button").first().click();
  assert(await page.locator("#stop").isEnabled());
  await page.locator("#undo").click();
  assert((await page.locator("#choices button").count()) > 0);
  await page.locator("#choices button").first().click();
  await page.locator("#stop").click();
  assert(
    (await page.locator("#players .active").innerText()).includes("玩家 2"),
  );
  await page.reload();
  assert(
    (await page.locator("#players .active").innerText()).includes("玩家 2"),
  );
  await page.locator("#rules").click();
  await page.getByRole("button", { name: "关闭", exact: true }).click();
  await page.screenshot({
    path: `/tmp/cant-stop-${viewport.width}.png`,
    fullPage: true,
  });
  assert(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  assert.equal(errors.length, 0);
  await page.close();
}
await browser.close();
console.log(
  "Can’t Stop browser desktop/mobile, pairing, undo, turn, restore: passed",
);
