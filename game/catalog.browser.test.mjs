// Integration audit for the ten additions; per-game tests cover game mechanics.
import assert from "node:assert/strict";
const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE || "playwright"
);
const base = (process.env.GAMES_URL || "http://127.0.0.1:18769").replace(
  /\/$/,
  "",
);
const groups = [
  ["单人解谜", ["hashi", "galaxies", "sokoban", "akari"]],
  ["棋类", ["hex", "qawale", "quixo"]],
  ["桌游", ["lost_cities", "sushi_go", "azul"]],
];
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || "/usr/bin/google-chrome",
  headless: true,
  args: ["--no-sandbox"],
});
try {
  for (const id of groups.flatMap(([, ids]) => ids)) {
    const page = await browser.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("response", (response) => {
      if (response.status() >= 400)
        errors.push(`${response.status()} ${response.url()}`);
    });
    for (const [label, width, height] of [
      ["desktop", 1280, 850],
      ["mobile", 390, 844],
      ["small", 320, 640],
      ["landscape", 844, 390],
    ]) {
      await page.setViewportSize({ width, height });
      const response = await page.goto(`${base}/game/${id}/`);
      assert.equal(response.status(), 200, `${id} entry`);
      await page.locator("main").waitFor();
      await page.waitForTimeout(150);
      assert(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        `${id}: ${label} horizontal overflow`,
      );
      assert((await page.locator("button").count()) > 2, `${id} controls`);
      await page.screenshot({
        path: `/tmp/${id}-integration-${label}.png`,
        fullPage: true,
      });
    }
    assert.deepEqual(errors, [], `${id} runtime or asset errors`);
    await page.close();
    console.log(`${id}: entry, assets, runtime, four viewports passed`);
  }
  const page = await browser.newPage({
    viewport: { width: 1280, height: 850 },
  });
  await page.goto(`${base}/#game`);
  for (const [category, ids] of groups) {
    await page.getByRole("tab", { name: category, exact: true }).click();
    for (const id of ids)
      assert.equal(
        await page.locator(`a[href="/game/${id}/"]`).count(),
        1,
        `${id} catalog link`,
      );
  }
  console.log("Home: all ten new entries are in their expected categories");
} finally {
  await browser.close();
}
