import { chromium, devices, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';

const [theme = 'before'] = process.argv.slice(2);
const base = process.env.PREVIEW_URL || 'http://127.0.0.1:5071';
const dir = 'docs/verification/palette';
await mkdir(dir, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome' });

const luminance = rgb => rgb.map(n => {
  const c = n / 255;
  return c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4;
}).reduce((sum, n, i) => sum + n * [.2126, .7152, .0722][i], 0);
const rgb = hex => hex.slice(1).match(/../g).map(n => parseInt(n, 16));
const contrast = (a, b) => {
  const values = [luminance(rgb(a)), luminance(rgb(b))].sort((x,y) => y-x);
  return +((values[0] + .05) / (values[1] + .05)).toFixed(2);
};
const pairs = theme === 'before' ? [] : [
  ['Основной', '#2D3A47', theme === 'B' ? '#FFF7E6' : '#F8EEDB'],
  ['Приглушённый', theme === 'B' ? '#2D3A47' : '#5B6672', theme === 'B' ? '#FFF7E6' : '#F8EEDB'],
  ['Мелкий акцент', '#8F4A53', theme === 'B' ? '#FFF7E6' : '#F8EEDB'],
  ['Метка', '#2D3A47', '#F7C8D3'],
  ['Действие', theme === 'C' ? '#2D3A47' : '#FFF7E6', theme === 'C' ? '#F7C8D3' : '#8F4A53'],
  ...(theme === 'C' ? [['Тёмные настройки', '#FFF7E6', '#2D3A47']] : []),
].map(([label, ink, fill]) => ({ label, ink, fill, ratio: contrast(ink, fill) }));
expect(pairs.every(pair => pair.ratio >= 4.5)).toBe(true);
if (pairs.length) await writeFile(dir + '/' + theme + '-contrast.json', JSON.stringify(pairs, null, 2));

try {
  for (const width of [375, 768, 1440]) {
    const page = await browser.newPage(width === 375
      ? { ...devices['Pixel 7'], viewport: { width, height: 900 }, reducedMotion:'reduce' }
      : { viewport: { width, height: 1000 }, reducedMotion:'reduce' });
    await page.route('**/*', route => {
      const url = new URL(route.request().url());
      if (url.host === 'tile.openstreetmap.org') {
        // Identical neutral tile background in every comparison.
        return route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect width="256" height="256" fill="#eee9db"/></svg>'});
      }
      return url.origin === base ? route.continue() : route.abort();
    });
    await page.goto(base + (theme === 'before' ? '' : '/?theme=' + theme));
    await expect(page.locator('html')).toHaveAttribute('data-analysis-state', 'success');
    if (theme !== 'before') await expect(page.locator('html')).toHaveAttribute('data-theme',theme);
    await page.evaluate(() => document.fonts.ready);
    const shot = async name => page.screenshot({path:dir+'/'+theme+'-'+width+'-'+name+'.png',scale:'css'});
    const at = async selector => page.locator(selector).evaluate(el => scrollTo({top:scrollY+el.getBoundingClientRect().top-90,behavior:'instant'}));
    await shot('hero');
    await at('#workspace');
    await shot('workspace');
    if (width === 375) {
      await page.locator('#mobile-settings-open').click();
      await shot('settings');
      await page.locator('#mobile-settings-close').click();
    }
    await at('#map');
    await page.waitForTimeout(350);
    await shot('map');
    await page.locator('.recommendation-pin').first().click();
    await expect(page.locator('.map-inspection')).toBeVisible();
    await shot('popup');
    await page.keyboard.press('Escape');
    await page.evaluate(async () => {
      const { state } = await import('/static/js/state.js');
      const { savePlace } = await import('/static/js/saved-places.js');
      for (const rec of state.current.recommendations.slice(0,2)) await savePlace(rec,{compare:true});
    });
    if (width === 375) await page.locator('.mobile-secondary-details>summary').filter({hasText:'Сохранённые места'}).click();
    await at('#comparison');
    await shot('comparison');
    await page.close();
    console.log(theme,width);
  }
} finally { await browser.close(); }

