import { chromium, webkit, devices, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';

const [phase, feature = 'menu'] = process.argv.slice(2);
const base = process.env.PREVIEW_URL || 'http://127.0.0.1:5071';
const dir = 'docs/verification/mobile-safari/' + feature;
await mkdir(dir, { recursive: true });
const results = [];
for (const engine of ['webkit', 'chromium']) {
  if (feature !== 'menu' && engine === 'webkit' && feature !== 'popup') continue;
  const browser = engine === 'webkit' ? await webkit.launch() : await chromium.launch({ channel: 'chrome' });
  try {
    for (const width of [375, 768, 1440]) {
      const profile = engine === 'webkit' ? devices['iPhone 13'] : devices['Pixel 7'];
      const page = await browser.newPage(width === 1440
        ? { viewport: { width, height: 900 } }
        : { ...profile, viewport: { width, height: 844 } });
      await page.route('**/*', route => new URL(route.request().url()).origin === base ? route.continue() : route.abort());
      const ready = async () => {
        await page.goto(base);
        await expect(page.locator('html')).toHaveAttribute('data-analysis-state', 'success');
        await page.evaluate(() => document.fonts.ready);
      };
      await ready();
      if (feature === 'menu' && width < 900) {
        let backdropColor;
        for (const delay of [0, 150, 300, 600]) {
          if (delay) await ready();
          await page.locator('#nav-toggle').tap();
          if (delay) await page.waitForTimeout(delay);
          const snapshot = await page.evaluate(() => {
            const el = document.querySelector('#nav-menu'), rect = el.getBoundingClientRect();
            const parents = [];
            for (let p = el.parentElement; p; p = p.parentElement) {
              const s = getComputedStyle(p);
              parents.push({ id: p.id, class: p.className, backdrop: s.backdropFilter, transform: s.transform,
                filter: s.filter, willChange: s.willChange, z: s.zIndex, inert: p.inert });
            }
            const s = getComputedStyle(el);
            return { x: rect.x, y: rect.y, top: rect.top, right: rect.right, bottom: rect.bottom, width: rect.width,
              height: rect.height, opacity: s.opacity, visibility: s.visibility, clip: s.clipPath,
              hit: el.contains(document.elementFromPoint(rect.left + 25, rect.top + 20)),
              viewport: [innerWidth, innerHeight], parents };
          });
          const shot = await page.screenshot({ path: dir + '/' + phase + '-' + engine + '-' + width + '-' + delay + '.png' });
          if (delay === 600 && snapshot.hit) {
            backdropColor = await page.evaluate(async ({ data, x, y, width }) => {
              const img = new Image();
              img.src = 'data:image/png;base64,' + data;
              await img.decode();
              const canvas = document.createElement('canvas');
              canvas.width = img.width; canvas.height = img.height;
              const ctx = canvas.getContext('2d');
              ctx.drawImage(img, 0, 0);
              const scale = img.width / innerWidth;
              const pixel = (a, b) => [...ctx.getImageData(Math.round(a * scale), Math.round(b * scale), 1, 1).data];
              return [pixel(x + width / 2, y + 6), pixel(x + width / 2, y - 4)];
            }, { data: shot.toString('base64'), x: snapshot.x, y: snapshot.y, width: snapshot.width });
          }
          results.push({ engine, screenWidth: width, delay, ...snapshot, pixels: delay === 600 ? backdropColor : undefined });
        }
        if (phase === 'after') {
          const last = results.at(-1);
          expect(last.parents[0].id).toBe('mobile-navigation');
          expect(last.opacity).toBe('1');
          expect(last.top).toBeGreaterThanOrEqual(0);
          expect(last.bottom).toBeLessThanOrEqual(last.viewport[1]);
          expect(last.right).toBeLessThanOrEqual(last.viewport[0]);
          expect(last.hit).toBe(true);
          expect(backdropColor?.[0]).not.toEqual(backdropColor?.[1]);
          await page.locator('#nav-menu a[href="#saved-section"]').tap();
          await expect(page).toHaveURL(/#saved-section$/);
          await expect(page.locator('#nav-toggle')).toHaveAttribute('aria-expanded', 'false');
        }
      } else if (feature === 'popup') {
        await page.locator('#map').evaluate(el => scrollTo(0, scrollY + el.getBoundingClientRect().top - 95));
        await page.waitForTimeout(350);
        await page.locator('.recommendation-pin').first().click();
        const popup = page.locator('.map-inspection');
        await expect(popup).toBeVisible();
        await page.waitForTimeout(350);
        await page.screenshot({ path: dir + '/' + phase + '-' + engine + '-' + width + '.png' });
        const map = page.locator('#map');
        await ready();
        await page.locator('#map').evaluate(el => scrollTo(0, scrollY + el.getBoundingClientRect().top - 95));
        await page.waitForTimeout(350);
        const size = await map.boundingBox();
        await map.click({ position: { x: size.width * .45, y: size.height * .55 } });
        await expect(popup).toBeVisible();
        await page.waitForTimeout(350);
        await page.screenshot({ path: dir + '/' + phase + '-' + engine + '-' + width + '-point.png' });
        results.push({ engine, width, map: size, popup: await popup.boundingBox(), score: await popup.getAttribute('data-score') });
      } else {
        await page.screenshot({ path: dir + '/' + phase + '-' + engine + '-' + width + '.png' });
      }
      await page.close();
      console.log(feature, phase, engine, width);
    }
  } finally { await browser.close(); }
}
await writeFile(dir + '/' + phase + '.json', JSON.stringify(results, null, 2));
