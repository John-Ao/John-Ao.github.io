// Run: node game/railroad_ink/browser.test.mjs. Uses local server on port 18769.
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
  await page.goto(baseUrl + "/game/railroad_ink/");
  await page.locator("#dice button").first().click();
  for (let k = 0; k < 4 && !(await page.locator(".cell.legal").count()); k++)
    await page.locator("#rotate").click();
  await page.locator(".cell.legal").first().click();
  await page.locator("#place").click();
  assert.equal(await page.locator(".roundmark").count(), 1);
  await page.locator("#undo").click();
  assert.equal(await page.locator(".roundmark").count(), 0);
  await page.locator("#rules").click();
  assert(await page.locator("dialog").evaluate((e) => e.open));
  await page.getByRole("button", { name: "关闭", exact: true }).click();
  await page.screenshot({
    path: `/tmp/railroad-${viewport.width}.png`,
    fullPage: true,
  });
  assert(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  // Complete a game through actual UI choices, choosing available orientations.
  for (let round = 1; round <= 7; round++) {
    if (round <= 3) {
      await page.locator("details").evaluate((e) => (e.open = true));
      const available = page.locator("#special button:not(:disabled)");
      assert.equal(await available.count(), 7 - round);
      await available.first().click();
      for (
        let r = 0;
        r < 4 && !(await page.locator(".cell.legal").count());
        r++
      )
        await page.locator("#rotate").click();
      await page.locator(".cell.legal").first().click();
      await page.locator("#place").click();
      assert.equal(
        await page.locator("#special button:not(:disabled)").count(),
        0,
      );
      assert(
        (await page.locator("#specialCount").innerText()).includes(
          `已用 ${round} / 3`,
        ),
      );
    } else
      assert.equal(
        await page.locator("#special button:not(:disabled)").count(),
        0,
      );

    for (let tries = 0; tries < 4; tries++) {
      let placed = false,
        count = await page.locator("#dice button").count();
      for (let j = 0; j < count && !placed; j++) {
        await page.locator("#dice button").nth(j).click();
        for (let r = 0; r < 4 && !placed; r++) {
          if (await page.locator(".cell.legal").count()) {
            await page.locator(".cell.legal").first().click();
            await page.locator("#place").click();
            placed = true;
          } else await page.locator("#rotate").click();
        }
      }
      if (!placed) break;
    }
    await page.locator("#next").click();
  }
  assert((await page.locator("#score").innerText()).includes("总分"));
  assert.equal(errors.length, 0);
  await page.close();
}
await browser.close();
console.log(
  "Railroad Ink browser desktop/mobile, undo, rules, full seven-round game: passed",
);
