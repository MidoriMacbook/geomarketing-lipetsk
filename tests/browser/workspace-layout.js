async original => {
  const context = await original.context().browser().newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
  const page = await context.newPage(), failures = [], sizes = [];
  const check = (ok, message) => { if (!ok) failures.push(message); };
  const base = new URL(original.url()).origin;
  try {
    await page.goto(base);
    await page.waitForFunction(() => document.documentElement.dataset.analysisState === 'success', null, { timeout: 70000 });
    const originalData = await page.evaluate(async () => (await import('/static/js/state.js')).state.current);
    for (const [width, scale] of [[1440, 1], [1024, 1], [768, 1], [390, 1], [1440, 2], [1024, 2], [768, 2], [390, 2]]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.evaluate(scale => { document.documentElement.style.fontSize = `${scale * 100}%`; }, scale);
      for (const count of [0, 1, 3]) {
        await page.evaluate(async ({ data, count }) => {
          const { showResult } = await import('/static/js/recommendations.js');
          const copy = structuredClone(data);
          copy.recommendations = data.recommendations.slice(0, count);
          while (copy.recommendations.length < count) copy.recommendations.push({ ...data.recommendations[0], rank: copy.recommendations.length + 1 });
          showResult(copy);
        }, { data: originalData, count });
        for (const expanded of [false, true]) {
          await page.evaluate(expanded => {
            document.querySelectorAll('#recommendation-list details').forEach(details => { details.open = expanded; });
          }, expanded);
          await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
          const result = await page.evaluate(() => {
            const rect = id => { const r = document.getElementById(id).getBoundingClientRect(); return { top: r.top, left: r.left, bottom: r.bottom, height: r.height }; };
            const result = document.getElementById('result'), list = document.getElementById('recommendation-list');
            return { map: rect('map-card'), canvas: rect('map'), recommendations: rect('recommendations'), settings: rect('settings'), workspace: rect('workspace'), overflow: document.documentElement.scrollWidth > innerWidth, scroll: result.scrollHeight > result.clientHeight + 1, resultOverflow: getComputedStyle(result).overflowY, lastCardBottom: list.lastElementChild?.getBoundingClientRect().bottom, resultBottom: result.getBoundingClientRect().bottom };
          });
          const name = `${width}px/${scale * 100}%/${count}/${expanded ? 'expanded' : 'closed'}`;
          check(!result.overflow, `${name}: horizontal overflow`);
          check(result.canvas.height >= 300, `${name}: map minimum lost`);
          if (width >= 1024) {
            check(Math.abs(result.map.top - result.recommendations.top) < 2, `${name}: map and recommendations must share a row`);
            check(result.map.height + 1 >= result.recommendations.height, `${name}: map shorter than recommendations`);
            check(Math.abs(result.workspace.bottom - result.map.bottom) < 2, `${name}: empty remainder under map`);
            if (result.scroll) check(['auto', 'scroll'].includes(result.resultOverflow), `${name}: capped recommendations inaccessible`);
            check(result.map.height <= Math.max(76 * 16 * scale, 1000 * 1.1) + 2, `${name}: workspace exceeds comfortable cap`);
          }
          if (width === 390) check(result.settings.top < result.map.top && result.map.top < result.recommendations.top, `${name}: mobile order`);
          if (result.scroll && width >= 1024 && count === 3 && expanded) {
            await page.locator('#result').focus();
            await page.keyboard.press('End');
            await page.waitForFunction(() => { const result = document.getElementById('result'); return result.scrollTop + result.clientHeight >= result.scrollHeight - 2; });
            check(await page.locator('#result').evaluate(el => el === document.activeElement), `${name}: keyboard scroll lost focus`);
          }
          sizes.push({ name, ...result });
        }
      }
    }
    const structure = await page.evaluate(() => {
      const data = document.getElementById('data-section'), saved = document.getElementById('saved-section'), research = document.getElementById('scenarios-section'), footer = document.querySelector('.page-footer'), details = document.getElementById('data-details');
      return { order: Boolean(saved.compareDocumentPosition(research) & Node.DOCUMENT_POSITION_FOLLOWING) && Boolean(research.compareDocumentPosition(data) & Node.DOCUMENT_POSITION_FOLLOWING) && data.nextElementSibling === footer, nativeDetails: details?.tagName === 'DETAILS', closed: details && !details.open, saveOutside: !research.contains(document.getElementById('scenario-save')), trust: ['trust-status', 'trust-summary', 'trust-details-link', 'data-summary'].every(id => !!document.getElementById(id)) };
    });
    check(structure.order, 'Data section must follow saved/research immediately before footer');
    check(structure.nativeDetails && structure.closed, 'Data disclosure must be native and closed by default');
    check(structure.saveOutside, 'First research save action must be outside hidden section');
    check(structure.trust, 'Compact trust/disclosure hooks missing');
    await page.setViewportSize({ width: 390, height: 844 });
    await page.evaluate(() => { document.documentElement.style.fontSize = '100%'; });
    const targets = await page.locator('#scenario-save, #trust-details-link, #data-summary, .place-actions .button, .leaflet-control-zoom a').evaluateAll(elements => elements.map(el => ({ id: el.id || el.className, height: el.getBoundingClientRect().height })));
    check(targets.every(item => item.height >= 44), 'Interactive targets below 44px: ' + JSON.stringify(targets));
    const noScript = await original.context().browser().newContext({ javaScriptEnabled: false, viewport: { width: 390, height: 844 } });
    try {
      const tab = await noScript.newPage();
      await tab.goto(base);
      check(await tab.locator('#settings').isVisible() && await tab.locator('#map-card').isVisible() && await tab.locator('#recommendations').isVisible(), 'Workspace depends on JS to be visible');
      check(await tab.locator('#data-section').isVisible(), 'Static model limitations must remain accessible without JS');
      check(await tab.locator('#data-details').count() === 1 && !await tab.locator('#data-details').getAttribute('open'), 'No-JS data details missing/default open');
      await tab.locator('#data-summary').click();
      check(await tab.locator('#source').isVisible() && await tab.locator('#refresh-data').isVisible(), 'Native disclosure cannot expose static data without JS');
      check(await tab.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'No-JS horizontal overflow');
    } finally { await noScript.close(); }
    if (failures.length) throw new Error(failures.join('\n'));
    return { cases: sizes.length, sizes: sizes.map(({ name, map, recommendations, scroll, overflow }) => ({ name, mapHeight: map.height, recommendationsHeight: recommendations.height, scroll, overflow })), structure, targets };
  } finally { await context.close(); }
}
