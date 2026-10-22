async original => {
  const base = new URL(original.url()).origin, results = [], errors = [];
  const assert = (ok, message) => { if (!ok) throw new Error(message); };
  const browser = original.context().browser();
  const noJS = await browser.newContext({ javaScriptEnabled: false, reducedMotion: 'reduce', viewport: { width: 390, height: 844 } });
  try {
    const page = await noJS.newPage(); await page.goto(base);
    assert(await page.locator('#hero-motion-root').count() === 1, 'Progressive hero mount is missing');
    assert(await page.locator('h1').count() === 1 && await page.locator('#page-title').isVisible(), 'No-JS hero title is unavailable');
    assert(await page.locator('.hero-links a[href="#workspace"]').isVisible(), 'No-JS map CTA missing');
    assert(await page.locator('#nav-menu a[href="#saved-section"]').isVisible(), 'No-JS mobile navigation is hidden');
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'No-JS overflow');
    await page.evaluate(() => document.documentElement.style.fontSize = '200%');
    await page.locator('#nav-menu a[href="#workspace"]').click();
    const anchor = await page.evaluate(() => ({ target: document.getElementById('workspace').getBoundingClientRect().top,
      header: document.getElementById('site-header').getBoundingClientRect().bottom }));
    assert(anchor.target >= Math.max(0, anchor.header), `No-JS enlarged header covers anchor: ${JSON.stringify(anchor)}`);
    results.push('no-JS static h1/CTA/navigation');
  } finally { await noJS.close(); }
  const short = await browser.newContext({ viewport: { width: 390, height: 320 }, reducedMotion: 'reduce' });
  try {
    const page = await short.newPage(); await page.goto(base);
    await page.waitForFunction(() => document.querySelector('#site-header')?.dataset.navigationReady === 'true');
    await page.evaluate(() => document.documentElement.style.fontSize = '200%');
    await page.locator('#nav-toggle').click();
    assert(await page.locator('#nav-menu').evaluate(el => el.scrollHeight > el.clientHeight && getComputedStyle(el).flexWrap === 'nowrap'), 'Short menu must scroll vertically instead of wrapping into columns');
    const last = page.locator('#model-button'); await last.scrollIntoViewIfNeeded();
    const rect = await last.boundingBox();
    assert(rect.y >= 0 && rect.y + rect.height <= 320, `Short enlarged menu has an unreachable final action: ${JSON.stringify(rect)}`);
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Short enlarged menu overflows horizontally');
    results.push('short mobile/200% final menu action reachable');
  } finally { await short.close(); }
  for (const width of [1440, 768, 390]) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce', hasTouch: width === 390 });
    const page = await context.newPage(); page.on('pageerror', e => errors.push(e.message));
    try {
      await page.goto(base);
      await page.waitForFunction(() => document.querySelector('#site-header')?.dataset.navigationReady === 'true');
      const toggle = page.locator('#nav-toggle');
      if (width <= 900) {
        assert(await toggle.isVisible(), 'Mobile menu toggle missing');
        await toggle.click(); assert(await toggle.getAttribute('aria-expanded') === 'true', 'Menu did not open');
        await page.keyboard.press('Escape');
        assert(await toggle.getAttribute('aria-expanded') === 'false' && await toggle.evaluate(el => document.activeElement === el), 'Escape does not close/restore focus');
        await toggle.click();
      }
      await page.locator('#nav-menu a[href="#saved-section"]').click();
      await page.waitForFunction(() => {
        const header = document.querySelector('#site-header').getBoundingClientRect();
        const target = document.querySelector('#saved-section').getBoundingClientRect();
        return target.top >= header.bottom && target.top < innerHeight;
      });
      assert(await page.locator('#saved-section').evaluate(el => document.activeElement === el), 'Anchor does not receive keyboard focus');
      assert(await page.locator('#site-header').evaluate(el => el.getBoundingClientRect().top >= 0 && el.getBoundingClientRect().bottom < innerHeight), 'Sticky header scrolled away');
      if (width <= 900) {
        assert(await toggle.getAttribute('aria-expanded') === 'false', 'Navigation leaves mobile menu open');
        await toggle.click();
        await page.locator('#nav-menu button#model-button').click();
        await page.locator('#model-dialog').waitFor(); await page.keyboard.press('Escape');
        assert(await toggle.evaluate(el => document.activeElement === el), 'Dialog returns focus into closed mobile menu');
      }
      await page.locator('#hero-model-button').click(); await page.locator('#model-dialog').waitFor();
      await page.keyboard.press('Escape');
      assert(await page.locator('#hero-model-button').evaluate(el => document.activeElement === el), 'Hero explanation loses focus');
      await page.evaluate(() => document.documentElement.style.fontSize = '200%');
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${width}/200% overflow`);
      results.push(`${width}: sticky, anchors, menu/keyboard/focus, model, 200%`);
    } finally { await context.close(); }
  }
  assert(!errors.length, errors.join('; '));
  return { results, pageErrors: errors };
}
