async original => {
  const context = await original.context().browser().newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage(), base = new URL(original.url()).origin, errors = [];
  const assert = (ok, message) => { if (!ok) throw new Error(message); };
  const trackMap = tab => tab.route('**/vendor/leaflet/leaflet.js', async route => {
    const response = await route.fetch();
    await route.fulfill({ response, body: `${await response.text()}\n;L.Map.addInitHook(function(){window.__workspaceMap=this;const invalidate=this.invalidateSize;this.invalidateSize=function(options){window.__workspaceInvalidations=(window.__workspaceInvalidations||0)+1;window.__workspaceResizeOptions=options;return invalidate.call(this,options);};});` });
  });
  page.on('pageerror', error => errors.push(error.message));
  let calls = 0;
  page.on('request', request => { if (request.url().includes('/api/calculate')) calls++; });
  try {
    await trackMap(page);
    await page.goto(base);
    await page.waitForFunction(() => document.documentElement.dataset.analysisState === 'success');
    assert(await page.locator('#trust-summary').count() === 1, 'Compact trust summary is missing');
    assert(await page.locator('#data-details').getAttribute('open') === null, 'Full data details intrude before opening');
    assert(!await page.locator('#scenarios-section').isVisible(), 'Empty research section is visible');
    assert(await page.locator('#scenario-save').isVisible() && await page.locator('#scenario-save').isEnabled(), 'First research save is unreachable');
    const beforeCalls = calls, before = await page.evaluate(async () => (await import('/static/js/state.js')).state.selectedRank);
    const cards = page.getByTestId('recommendation-card'), second = cards.nth(1);
    await page.waitForFunction(() => !document.getAnimations().some(a => a.id === 'gm:recommendation'));
    await second.hover();
    await page.waitForFunction(() => {
      const card = document.querySelectorAll('[data-testid="recommendation-card"]')[1];
      const transform = new DOMMatrix(getComputedStyle(card).transform);
      return transform.m42 <= -3 && transform.m42 >= -6;
    });
    assert(await page.evaluate(async () => (await import('/static/js/state.js')).state.selectedRank) === before, 'Hover changes selection');
    assert(await page.locator('.recommendation-pin.is-preview').count() === 1, 'Fine pointer hover does not preview marker');
    await cards.first().hover();
    await page.waitForFunction(() => getComputedStyle(document.querySelector('.recommendation.selected')).transform === 'none');
    assert(await page.locator('.recommendation-pin.is-preview').count() === 0, 'Selected marker retains hover preview');
    const layerReplay = await page.evaluate(async () => {
      const seen = [], animate = Element.prototype.animate;
      Element.prototype.animate = function(...args) { const effect = animate.apply(this, args); queueMicrotask(() => seen.push(effect.id)); return effect; };
      try {
        document.querySelector('#layer-zones').click(); document.querySelector('#layer-zones').click();
        await new Promise(resolve => requestAnimationFrame(resolve));
        return seen.filter(id => ['gm:section', 'gm:recommendation'].includes(id));
      } finally { Element.prototype.animate = animate; }
    });
    assert(layerReplay.length === 0, 'Layer toggle replays panel or result entrance');
    const details = second.locator('.explanation-block details'), summary = details.locator('summary');
    await summary.focus(); await page.keyboard.press('Enter');
    await page.waitForFunction(() => !document.getAnimations().some(a => a.id === 'gm:disclosure'));
    assert(await details.getAttribute('open') !== null && await summary.evaluate(el => document.activeElement === el), 'Keyboard disclosure loses focus');
    assert((await details.innerText()).includes('жителей') && (await details.innerText()).includes('Ограничение модели'), 'Explanation omits base facts or model limit');
    await page.keyboard.press('Space'); await page.keyboard.press('Enter'); await page.keyboard.press('Space');
    await page.waitForFunction(() => !document.getAnimations().some(a => a.id === 'gm:disclosure'));
    assert(await details.getAttribute('open') === null, 'Rapid toggle does not reach final closed state');
    await summary.click();
    await details.locator('.disclosure-content').evaluate(content => {
      const note = document.createElement('p'); note.textContent = 'Динамические сведения. '.repeat(30); content.append(note);
    });
    await page.waitForFunction(() => !document.getAnimations().some(a => a.id === 'gm:disclosure'));
    assert(await details.evaluate(el => Math.abs(el.querySelector('.disclosure-body').getBoundingClientRect().height - el.querySelector('.disclosure-content').getBoundingClientRect().height) < 1), 'Dynamic content is clipped after opening');
    await summary.click();
    assert(await page.evaluate(() => document.getAnimations().some(a => a.id === 'gm:disclosure')), 'Runtime reduce fixture has no active disclosure');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.waitForFunction(() => !document.getAnimations().some(a => a.id === 'gm:disclosure'));
    assert(await details.evaluate(el => !el.open && !el.querySelector('.disclosure-body').inert), 'Runtime reduce did not finalize closing disclosure');
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.locator('#trust-details-link').click();
    assert(await page.locator('#data-details').getAttribute('open') !== null, 'Trust link does not open details');
    assert(await page.locator('#data-summary').evaluate(el => document.activeElement === el), 'Trust link has no focus destination');
    assert(calls === beforeCalls, 'Disclosure or hover makes calculation requests');
    const disclosureResize = await page.evaluate(async () => {
      const { state } = await import('/static/js/state.js'), { showResult } = await import('/static/js/recommendations.js');
      const original = state.current, settings = document.querySelector('#settings'), map = window.__workspaceMap;
      state.current = { ...original, recommendations: original.recommendations.slice(0, 1) };
      settings.style.maxHeight = '450px'; showResult(state.current);
      for (let i = 0; i < 4; i++) await new Promise(requestAnimationFrame);
      const beforeHeight = map.getSize().y, center = map.getCenter(), rank = state.selectedRank;
      window.__workspaceInvalidations = 0;
      document.querySelector('.explanation-block summary').click();
      for (let i = 0; i < 120; i++) {
        await new Promise(requestAnimationFrame);
        if (i > 2 && !document.getAnimations().some(a => a.id === 'gm:disclosure')) break;
      }
      for (let i = 0; i < 3; i++) await new Promise(requestAnimationFrame);
      const result = { beforeHeight, afterHeight: map.getSize().y, count: window.__workspaceInvalidations, sizeMatches: map.getSize().y === map.getContainer().clientHeight, sameSelection: rank === state.selectedRank, centerPixels: map.project(center).distanceTo(map.project(map.getCenter())) };
      state.current = original; settings.style.maxHeight = ''; showResult(original);
      return result;
    });
    assert(disclosureResize.count > 0 && disclosureResize.beforeHeight !== disclosureResize.afterHeight && disclosureResize.sizeMatches && disclosureResize.sameSelection && disclosureResize.centerPixels <= 1, `Disclosure resize failed: ${JSON.stringify(disclosureResize)}`);
    const resize = await page.evaluate(async () => {
      const { state } = await import('/static/js/state.js');
      const map = window.__workspaceMap, rank = state.selectedRank, zoom = map.getZoom(), center = map.getCenter();
      window.__workspaceInvalidations = 0;
      const element = document.querySelector('#map');
      element.style.minHeight = `${element.getBoundingClientRect().height + 80}px`;
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      await new Promise(resolve => requestAnimationFrame(resolve));
      return { count: window.__workspaceInvalidations, options: window.__workspaceResizeOptions, sameSelection: rank === state.selectedRank, sameZoom: zoom === map.getZoom(), centerDistance: center.distanceTo(map.getCenter()), sizeMatches: Math.abs(map.getSize().y - element.clientHeight) <= 1 && Math.abs(map.getSize().x - element.clientWidth) <= 1 };
    });
    assert(resize.count > 0 && resize.sameSelection && resize.sameZoom && resize.sizeMatches && resize.centerDistance < 1, `Map container resize reset view or did not invalidate: ${JSON.stringify(resize)}`);
    await page.evaluate(() => { document.querySelector('#map').style.minHeight = ''; });
    await page.route('**/api/calculate?**', async route => { await new Promise(resolve => setTimeout(resolve, 300)); await route.abort(); });
    await page.locator('#refresh-data').click();
    assert((await page.locator('#trust-summary').innerText()).includes('предыдущий расчёт'), 'Refresh presents old results as new');
    await page.waitForFunction(() => document.documentElement.dataset.analysisState === 'error');
    assert((await page.locator('#trust-summary').innerText()).includes('Обновление не удалось'), 'Failed refresh has no trust status');
    await page.unroute('**/api/calculate?**');
    await page.locator('#scenario-save').click();
    await page.locator('#scenario-name').fill('Проверка рабочего потока');
    await page.locator('#scenario-submit').click();
    await page.getByTestId('scenario-card').waitFor();
    assert(await page.locator('#scenarios-section').isVisible(), 'First save does not reveal research');
    await page.reload(); await page.getByTestId('scenario-card').waitFor();
    assert(await page.locator('#scenarios-section').isVisible(), 'Old research is inaccessible');
    await page.getByTestId('scenario-open').click();
    assert((await page.locator('#trust-summary').innerText()).includes('Сохранённый'), 'Archive trust is shown as current');
    await page.evaluate(() => { window.print = () => {}; });
    await page.locator('#print-report').click();
    assert(await page.locator('#print-report-content details:not([open])').count() === 0, 'Print explanations remain closed');
    await page.getByTestId('scenario-delete').click(); await page.locator('#scenario-delete-confirm').click();
    await page.waitForFunction(() => document.querySelector('#scenarios-section').hidden);
    await page.waitForFunction(() => document.activeElement === document.querySelector('#scenario-save'));
    await page.getByTestId('save-place').first().click();
    const saved = page.getByTestId('saved-card').first(); await saved.waitFor();
    const plainSavedBackground = await saved.evaluate(el => getComputedStyle(el).backgroundColor);
    await saved.locator('[data-testid="field-checks"] summary').click();
    await saved.locator('input[data-check-index="0"]').check();
    await page.waitForFunction(() => JSON.parse(localStorage.getItem('geomarketing.field-checks.v1')).records[0].checks[0]);
    assert(await saved.getByTestId('compare-place').isChecked() === false && await saved.evaluate(el => getComputedStyle(el).backgroundColor) === plainSavedBackground, 'Checklist mark applies comparison highlight');
    await saved.getByTestId('compare-place').check();
    await page.waitForFunction(background => getComputedStyle(document.querySelector('[data-testid="saved-card"]')).backgroundColor !== background, plainSavedBackground);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.waitForFunction(() => !document.getAnimations().some(a => a.id.startsWith('gm:')));
    const dynamic = await page.evaluate(async () => {
      const { initDisclosure } = await import('/static/js/ui.js');
      const details = document.querySelector('.explanation-block details');
      const count = details.querySelectorAll('.disclosure-body').length;
      initDisclosure(details); initDisclosure(details);
      details.querySelector('summary').click();
      details.querySelector('.disclosure-content').append(document.createElement('p'));
      return count === details.querySelectorAll('.disclosure-body').length && details.open && !details.querySelector('.disclosure-body').inert;
    });
    assert(dynamic, 'Repeated disclosure initialization or reduced-motion dynamic content failed');
    await page.evaluate(() => localStorage.setItem('geomarketing.scenarios.v1', '{broken'));
    await page.reload(); await page.locator('#scenario-repair').waitFor();
    assert(await page.locator('#scenarios-section').isVisible(), 'Research recovery is hidden');
    assert((await page.locator('#scenario-status').innerText()).includes('поврежден'), 'Recovery diagnosis is missing');
    await page.evaluate(() => localStorage.setItem('geomarketing.scenarios.v1', '{"schema_version":99,"scenarios":[]}'));
    await page.reload(); await page.locator('#scenario-repair').waitFor();
    assert(await page.locator('#scenarios-section').isVisible() && (await page.locator('#scenario-status').innerText()).includes('не поддерживается'), 'Unknown research version hides recovery');
    const fallbackContext = await original.context().browser().newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
    try {
      const touch = await fallbackContext.newPage();
      touch.on('pageerror', error => errors.push(error.message));
      await touch.addInitScript(() => { window.ResizeObserver = undefined; Element.prototype.animate = undefined; });
      await trackMap(touch); await touch.goto(base);
      await touch.waitForFunction(() => document.documentElement.dataset.analysisState === 'success');
      const touchSummary = touch.locator('.explanation-block summary').first();
      await touchSummary.tap();
      assert(await touch.locator('.explanation-block details').first().getAttribute('open') !== null, 'Touch/no-WAAPI disclosure does not open');
      assert(await touch.locator('.recommendation-pin.is-preview').count() === 0, 'Touch depends on hover preview');
      await touch.evaluate(() => { window.__workspaceInvalidations = 0; });
      await touch.setViewportSize({ width: 430, height: 844 });
      await touch.waitForFunction(() => window.__workspaceInvalidations > 0);
      assert(await touch.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Fallback mobile overflows');
    } finally { await fallbackContext.close(); }
    assert(errors.length === 0, `Browser errors: ${errors.join('; ')}`);
    return { ok: true, calls, checks: 'trust/refresh/error, keyboard/rapid/dynamic disclosures, marker preview, ResizeObserver, first save/old research, archive, print, corrupt/unknown recovery, reduced motion, touch/no-WAAPI/resize fallback' };
  } finally { await context.close(); }
}
