import assert from 'node:assert/strict';
import { chromium, expect, webkit } from '@playwright/test';

const url = process.argv[2] || 'http://127.0.0.1:5123';
const repeat = Number(process.argv[3] || 5);
const output = [];
for (const engine of [chromium, webkit]) {
  const browser = await engine.launch(engine === chromium ? { channel: 'chrome' } : {});
  try {
    for (let index = 0; index < repeat; index += 1) {
      const page = await browser.newPage({ viewport: { width: 375, height: 812 } });
      try {
        await page.route('**/*', route => new URL(route.request().url()).origin === url ? route.continue() : route.abort());
        await page.goto(url);
        await expect(page.locator('html')).toHaveAttribute('data-analysis-state', 'success');
        await page.locator('#map-card').scrollIntoViewIfNeeded();
        const sheet = page.locator('#recommendations');
        await sheet.locator('.sheet-handle').click();
        await expect(sheet).toHaveAttribute('data-snap', 'expanded');
        await expect(sheet).not.toHaveAttribute('data-moving', 'true');
        const measurement = await sheet.evaluate(async sheet => {
          const result = sheet.querySelector('#result');
          const map = document.querySelector('#map');
          const read = () => ({
            result: result.getBoundingClientRect().height,
            map: map.getBoundingClientRect().height,
            visibility: getComputedStyle(result).visibility,
          });
          const start = performance.now();
          const before = read();
          const samples = [];
          sheet.querySelector('.sheet-close').click();
          while (sheet.hasAttribute('data-closing')) {
            samples.push({ ...read(), ms: performance.now() - start });
            await new Promise(requestAnimationFrame);
          }
          return { before, samples, after: read(), settledAt: performance.now() - start };
        });
        assert.ok(measurement.samples.length >= 2);
        for (const sample of measurement.samples) {
          assert.equal(sample.visibility, 'visible');
          assert.ok(Math.abs(sample.result - measurement.before.result) < 0.5);
          assert.ok(Math.abs(sample.map - measurement.before.map) < 0.5);
        }
        output.push({ engine: engine.name(), samples: measurement.samples.length,
          lastMovingMs: measurement.samples.at(-1).ms, settledAt: measurement.settledAt,
          before: measurement.before, after: measurement.after });
      } finally {
        await page.close();
      }
    }
  } finally {
    await browser.close();
  }
}
console.log(JSON.stringify(output, null, 2));
