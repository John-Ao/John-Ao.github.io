import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const url = process.env.VIEWER_URL || 'http://127.0.0.1:5338/';
const output = process.env.RENDER_OUTPUT || path.join(os.tmpdir(), 'endfield-render-check');
await fs.mkdir(output, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.CHROME_EXECUTABLE || undefined,
  headless: true,
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const report = { verifiedAt: new Date().toISOString(), url, characters: [], errors: [] };
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  page.on('pageerror', e => report.errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') report.errors.push(m.text()); });
  page.on('response', r => { if (r.status() >= 400) report.errors.push(`${r.status()} ${r.url()}`); });
  await page.goto(url);
  await page.evaluate(async () => { window.qa = await import('./app.js'); });
  await page.waitForFunction(() => qa.stage?.action && document.querySelector('#loading').hidden, null, { timeout: 90000 });
  const ids = await page.evaluate(() => [...document.querySelectorAll('[data-character]')].map(x => x.dataset.character));
  const representatives = new Set(['perlica', 'jsspsi', 'purrche', 'dapan', 'ember', 'endministrator1', 'antal', 'rossi', 'chen', 'laevatain', 'ardelia', 'zhuangfy', 'tangtang', 'gilberta']);
  let baseline;
  for (const id of ids) {
    await page.evaluate(id => document.querySelector(`[data-character="${id}"]`).click(), id);
    await page.waitForFunction(id => qa.stage?.character?.id === id && qa.stage.action && document.querySelector('#loading').hidden, id, { timeout: 90000 });
    await page.evaluate(() => { qa.stage.playing = false; qa.stage.seek(0.4); });
    const result = await page.evaluate(() => {
      const s = qa.stage, materials = new Set();
      s.model.traverse(o => { if (o.isMesh) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => materials.add(m)); });
      const families = {}, mapCounts = {};
      for (const m of materials) {
        if (m.userData.endfieldLighting) families[m.userData.endfieldLighting] = (families[m.userData.endfieldLighting] || 0) + 1;
        for (const map of m.userData.endfieldMaps || []) mapCounts[map] = (mapCounts[map] || 0) + 1;
      }
      return { id: s.character.id, families, mapCounts, outlines: [...materials].filter(m => m.userData.endfieldOutline).length,
        eyeLayers: [...materials].filter(m => m.userData.endfieldEyeLayer).length,
        triangles: s.renderer.info.render.triangles, stencil: s.renderer.getContext().getContextAttributes().stencil,
        invalidPrograms: s.renderer.info.programs.filter(p => p.diagnostics?.runnable === false).length,
        memory: { ...s.renderer.info.memory } };
    });
    assert(result.triangles > 1000 && result.invalidPrograms === 0 && result.stencil, `${id}: invalid render`);
    assert(result.mapCounts.efRamp > 0, `${id}: source diffuse ramps missing`);
    if (representatives.has(id)) {
      await page.screenshot({ path: path.join(output, `${id}.png`) });
      await page.locator('#view-face').click();
      await page.screenshot({ path: path.join(output, `${id}-face.png`) });
      if (id === 'perlica' || id === 'endministrator1') {
        await page.locator('#view-back').click();
        await page.screenshot({ path: path.join(output, `${id}-back.png`) });
      }
    }
    await page.evaluate(() => qa.stage.clear());
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    result.clearedMemory = await page.evaluate(() => ({ ...qa.stage.renderer.info.memory }));
    baseline ||= result.clearedMemory;
    assert.deepEqual(result.clearedMemory, baseline, `${id}: GPU resources leaked after clear`);
    report.characters.push(result);
    console.log(JSON.stringify({ id, families: result.families, cleared: result.clearedMemory, errors: report.errors.length }));
    await fs.writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
  }
  assert.equal(report.characters.length, 34);
  assert.deepEqual(report.errors, []);
  report.passed = true;
  await fs.writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
  console.log(`PASS: ${report.characters.length} characters; no WebGL errors; stable GPU resource counts.`);
} finally {
  await fs.writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
  await browser.close();
}
