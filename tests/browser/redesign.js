async page => {
  const base = new URL(page.url()).origin;
  const assert = (value, message) => { if (!value) throw new Error(message); };
  const errors = [];
  const metrics = { viewports: [], contrast: [], motion: {} };
  page.on('pageerror', error => errors.push(error.message));
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.setViewportSize({ width: 1440, height: 1000 });
  // Observe real browser animations without replacing their timing or behavior.
  await page.addInitScript(() => {
    if (window.__urbanObserverVersion === 2) return;
    window.__urbanObserverVersion = 2;
    localStorage.removeItem('geomarketing.saved.v1');
    window.__urbanMotion = [];
    window.__urbanAllMotion = [];
    const original = Element.prototype.animate;
    Element.prototype.animate = function (...args) {
      const animation = original.apply(this, args);
      queueMicrotask(() => {
        if (!animation.id.startsWith('gm:')) return;
        const record = {
          observerVersion: 2,
          id: animation.id, target: this.id || this.className,
          rank: this.dataset.rank, keyframes: animation.effect.getKeyframes(),
          timing: animation.effect.getTiming(),
          saved: JSON.parse(localStorage.getItem('geomarketing.saved.v1') || '[]').length,
        };
        window.__urbanMotion.push(record);
        window.__urbanAllMotion.push(record);
      });
      return animation;
    };
    document.addEventListener('DOMContentLoaded', () => requestAnimationFrame(() => {
      window.__urbanIntro = document.getAnimations().filter(animation =>
        animation instanceof CSSAnimation && animation.effect.target.closest('.intro'))
        .map(animation => ({ name: animation.animationName, timing: animation.effect.getTiming() }));
    }), { once: true });
  });
  // Reuse a real API response; fixture variants exercise only presentation states.
  const payload = await page.evaluate(async () => {
    const response = await fetch('/api/calculate?district=eleytsky&type=cafe');
    if (!response.ok) throw new Error('Cannot prepare real calculation fixture');
    return response.json();
  });
  assert(payload.recommendations.length >= 2, 'Real fixture needs two recommendations for selection/comparison');
  let sequence = 0, mode = 'success', sameId = false, lastId;
  let release = null, requestStarted = null;
  const holdRequest = () => {
    let signal;
    const started = new Promise(resolve => { signal = resolve; });
    const held = new Promise(resolve => { release = resolve; });
    requestStarted = () => { signal(); return held; };
    return started;
  };
  await page.route('**/api/calculate?**', async route => {
    const wait = requestStarted;
    requestStarted = null;
    if (wait) await wait();
    const status = mode === 'failure' ? 503 : 200;
    if (!sameId || !lastId) lastId = `urban-browser-${++sequence}`;
    const body = mode === 'failure' ? { status: 'error', message: 'Временная ошибка проверки' } : {
      ...payload, analysis_id: lastId, recommendations: mode === 'empty' ? [] : payload.recommendations,
      notice: 'Проверьте выбранное место на местности.',
    };
    await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) }).catch(() => {});
  });
  try {
  // Version filtering also ignores old unguarded observers retained by a named
  // browser from before this harness acquired its per-document install guard.
  const trace = () => page.evaluate(() => window.__urbanMotion.filter(item => item.observerVersion === 2));
  const clearTrace = () => page.evaluate(() => { window.__urbanMotion = []; });
  const nextFrame = () => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const ready = () => page.waitForFunction(() => document.documentElement.dataset.analysisState === 'success'
    && !document.getElementById('run').disabled);
  const initialRequest = holdRequest();
  await page.goto(base);
  await initialRequest;
  const hooks = await page.evaluate(() => ({
    progress: Boolean(document.querySelector('#analysis-progress md-linear-progress')),
    fallback: Boolean(document.querySelector('#analysis-progress .progress-fallback')),
    status: Boolean(document.getElementById('analysis-status')),
    context: Boolean(document.getElementById('analysis-context')),
    sentinel: Boolean(document.getElementById('header-sentinel')),
    state: document.documentElement.dataset.analysisState,
  }));
  assert(hooks.progress && hooks.fallback && hooks.status && hooks.context && hooks.sentinel && hooks.state,
    `Urban analysis UI hooks missing: ${JSON.stringify(hooks)}`);
  assert(hooks.state === 'calculating', 'Initial request must expose calculating state');
  assert(await page.locator('#analysis-progress').isVisible(), 'Progress is hidden during initial calculation');
  assert(await page.locator('#map').getAttribute('aria-busy') === 'true', 'Map does not announce busy state');
  assert(await page.locator('#result-empty').isVisible(), 'Initial calculation has no calm preparation state');
  await page.waitForFunction(() => document.documentElement.dataset.materialWeb === 'ready');
  assert(await page.locator('#analysis-progress md-linear-progress').isVisible(), 'Real Material progress is not displayed while busy');
  release();
  await ready();
  await nextFrame();
  assert(await page.locator('#analysis-progress').isHidden(), 'Progress remained after successful calculation');
  assert(await page.locator('#map').getAttribute('aria-busy') === 'false', 'Busy state remained after success');
  assert(await page.locator('#kpi-residents').innerText() !== '—', 'Final KPI values are delayed behind motion');
  // Entrances now wait until the user can see their content.
  await page.locator('#recommendation-list').scrollIntoViewIfNeeded();
  await page.waitForFunction(() => window.__urbanMotion.filter(item => item.observerVersion === 2 && item.id === 'gm:recommendation').length === document.querySelectorAll('[data-testid="recommendation-card"]').length);
  await page.locator('#data-warning').scrollIntoViewIfNeeded();
  await nextFrame();
  const initialTrace = await trace();
  metrics.motion.initial = initialTrace;
  assert(await page.evaluate(() => window.__urbanIntro.length > 0), 'First-screen CSS reveal did not run');
  assert(initialTrace.some(item => /map/.test(item.id)), 'Initialized Leaflet map has no reveal');
  assert(initialTrace.some(item => /map-points|map-zones/.test(item.id) && item.keyframes.every(frame => !frame.transform || frame.transform === 'none')), 'Map layers must reveal using opacity without coordinate transforms');
  assert(initialTrace.some(item => /kpi/.test(item.id)), 'Final KPIs have no reveal');
  const stagger = initialTrace.filter(item => item.id === 'gm:recommendation');
  assert(stagger.length === payload.recommendations.length, `New analysis must reveal each recommendation once: ${JSON.stringify(stagger)}`);
  const delays = stagger.map(item => item.timing.delay).sort((a, b) => a - b);
  assert(delays[0] === 0 && delays.slice(1).every((delay, index) => delay - delays[index] >= 60 && delay - delays[index] <= 90), `Recommendation stagger is not 60–90ms: ${delays}`);
  assert(initialTrace.some(item => /notice/.test(item.id)), 'Inline notice has no reveal');
  assert(await page.locator('#data-warning').isVisible(), 'Notice reveal delayed or hid warning text');

  // Rank changes pulse only the inner marker; they must never replay result reveals.
  await clearTrace();
  await page.locator('[data-testid="recommendation-card"]').nth(1).getByRole('button', { name: /Показать/ }).click();
  assert(await page.locator('[data-testid="recommendation-card"]').nth(1).locator('.place-select').getAttribute('aria-pressed') === 'true', 'Selection did not immediately update ARIA');
  assert(await page.locator('.recommendation-pin.is-selected').innerText() === '2', 'Selected card and map marker disagree');
  let selectionTrace = await trace();
  assert(selectionTrace.some(item => /marker.*pulse|pulse.*marker/.test(item.id)), 'Rank change did not pulse the marker');
  assert(!selectionTrace.some(item => item.id === 'gm:recommendation'), 'Selection replayed recommendation stagger');
  assert(!selectionTrace.some(item => /marker.*pulse|pulse.*marker/.test(item.id) && String(item.target).includes('leaflet-marker-icon')), 'Pulse transforms Leaflet coordinate wrapper');
  await clearTrace();
  await page.locator('[data-testid="recommendation-card"]').nth(1).getByRole('button', { name: /Показать/ }).click();
  assert(!(await trace()).some(item => /marker.*pulse|pulse.*marker/.test(item.id)), 'Selecting the same rank repeated the marker pulse');
  sameId = true;
  await clearTrace();
  await page.locator('#run').click(); await ready();
  assert(!(await trace()).some(item => item.id === 'gm:recommendation'), 'Same analysis_id replayed recommendation stagger');
  sameId = false;

  // Storage is held behind its real Web Lock: no success/reveal may precede write.
  await page.evaluate(() => { navigator.locks.request('geomarketing.saved.v1.write', () => new Promise(resolve => { window.__urbanUnlock = resolve; })); });
  await page.waitForFunction(() => typeof window.__urbanUnlock === 'function');
  await clearTrace();
  await page.locator('[data-testid="save-place"]').first().click();
  assert(await page.locator('[data-testid="saved-card"]').count() === 0, 'Queued save showed an unwritten saved card');
  assert(!(await trace()).some(item => /save/.test(item.id)), 'Queued save animated success before storage write');
  await page.evaluate(() => window.__urbanUnlock());
  await page.locator('[data-testid="saved-card"]').first().waitFor();
  await page.waitForFunction(() => window.__urbanMotion.some(item => /save/.test(item.id)));
  const savedTrace = (await trace()).filter(item => /save/.test(item.id));
  assert(savedTrace.every(item => item.saved >= 1), 'Saved feedback happened before successful persistence');
  await page.locator('[data-testid="save-place"]').nth(1).click();
  await page.waitForFunction(() => document.querySelectorAll('[data-testid="saved-card"]').length === 2);
  await clearTrace();
  await page.locator('[data-testid="compare-place"]').first().check();
  assert(await page.locator('#comparison').isVisible() && await page.locator('#comparison tbody tr').count() === 1, 'Comparison waits for its animation to become usable');
  assert((await trace()).some(item => /comparison/.test(item.id)), 'Comparison opening has no motion');
  await page.locator('[data-testid="compare-place"]').first().uncheck();
  assert(await page.locator('#comparison').isHidden(), 'Comparison close animation delays hidden state');
  await page.locator('[data-testid="compare-place"]').first().check();
  await page.locator('[data-testid="compare-place"]').nth(1).check();
  await clearTrace();
  await page.locator('[data-testid="saved-card"]').first().getByRole('button', { name: /Удалить/ }).click();
  await page.waitForFunction(() => document.querySelectorAll('[data-testid="saved-card"]').length === 1);
  assert(await page.locator('#comparison tbody tr').count() === 1, 'Deleted record remains in comparison during exit');
  assert(await page.evaluate(() => JSON.parse(localStorage.getItem('geomarketing.saved.v1')).length) === 1, 'Delete motion delays storage mutation');
  assert((await trace()).some(item => /exit|remove|flip/.test(item.id)), 'Deletion has no exit/neighbor feedback');
  assert(await page.evaluate(() => [...document.querySelectorAll('[data-motion-snapshot],.motion-snapshot')].every(node => node.inert && node.getAttribute('aria-hidden') === 'true' && !node.matches('[id],[data-testid]') && !node.querySelector('[id],[data-testid]'))), 'Motion snapshots duplicate interactive contracts');
  await page.evaluate(() => {
    window.__urbanOriginalSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === 'geomarketing.saved.v1') throw new DOMException('blocked', 'SecurityError');
      return window.__urbanOriginalSetItem.call(this, key, value);
    };
  });
  await clearTrace();
  await page.locator('[data-testid="save-place"]').first().click();
  await page.waitForFunction(() => document.getElementById('storage-status').textContent.includes('недоступно'));
  assert(await page.locator('[data-testid="saved-card"]').count() === 1, 'Failed storage write displayed a saved card');
  assert(!(await trace()).some(item => /save-feedback|saved-enter/.test(item.id)), 'Failed write animated a successful save');
  await page.evaluate(() => { Storage.prototype.setItem = window.__urbanOriginalSetItem; });

  // Native dialog close and focus restoration must happen before exit completes.
  await clearTrace();
  await page.locator('#model-button').click();
  assert(await page.locator('#model-dialog').evaluate(node => node.open && node.contains(document.activeElement)), 'Dialog did not immediately move focus inside');
  await page.keyboard.press('Escape');
  assert(await page.locator('#model-dialog').isHidden(), 'Native Escape waits for an exit animation');
  assert(await page.locator('#model-button').evaluate(node => node === document.activeElement), 'Escape did not restore trigger focus');
  assert((await trace()).some(item => /dialog.*(enter|open)/.test(item.id)), 'Dialog has no entrance');
  assert((await trace()).some(item => /dialog.*(exit|close)/.test(item.id)), 'Dialog has no exit feedback');
  await page.locator('#model-button').click();
  const rapidDialog = await page.evaluate(() => {
    document.getElementById('close-model').click();
    document.getElementById('model-button').click();
    const dialog = document.getElementById('model-dialog');
    return dialog.open && dialog.contains(document.activeElement);
  });
  assert(rapidDialog, 'Rapid close/open leaves dialog hidden or focus outside');
  await page.keyboard.press('Escape');

  await clearTrace();
  await page.locator('#district').selectOption('custom', {force:true});
  assert(await page.locator('#custom-box').isVisible(), 'Custom expansion delays visibility');
  assert(await page.locator('#district').getAttribute('aria-expanded') === 'true', 'Custom expansion lacks ARIA state');
  assert((await trace()).some(item => /custom.*(open|enter|expand)/.test(item.id)), 'Custom area has no expansion feedback');
  await page.locator('#district').selectOption('eleytsky', {force:true});
  assert(await page.locator('#custom-box').isHidden(), 'Custom collapse delays hidden state');
  assert(await page.locator('#district').getAttribute('aria-expanded') === 'false', 'Custom collapse leaves ARIA expanded');
  assert((await trace()).some(item => /custom.*(close|exit|collapse)/.test(item.id)), 'Custom area has no collapse feedback');
  await page.locator('#run').click(); await ready();

  // A failed refresh retains all of the previous result while progress stops.
  const previous = await page.locator('#recommendation-list').innerText();
  mode = 'failure';
  const failedRequest = holdRequest();
  await page.locator('#refresh-data').click(); await failedRequest;
  assert(await page.evaluate(() => document.documentElement.dataset.analysisState) === 'refreshing', 'Refresh lacks its distinct state');
  assert(await page.locator('#analysis-progress').isVisible() && await page.locator('#recommendation-list').innerText() === previous, 'Refresh hid the previous result');
  assert(await page.locator('#print-report').isEnabled(), 'Refresh disabled successful-result report');
  release();
  await page.locator('#error').waitFor();
  assert(await page.evaluate(() => document.documentElement.dataset.analysisState) === 'error', 'Failure does not expose error state');
  assert(await page.locator('#analysis-progress').isHidden() && await page.locator('#recommendation-list').innerText() === previous, 'Failed refresh retained busy UI or discarded result');
  mode = 'empty'; await clearTrace();
  await page.locator('#run').click(); await ready();
  assert(await page.locator('#result').isHidden() && await page.locator('#result-empty').isVisible(), 'Empty result is not immediately readable');
  await page.locator('#result-empty').scrollIntoViewIfNeeded();
  await page.waitForFunction(() => window.__urbanMotion.some(item => item.observerVersion === 2 && /empty/.test(item.id)));
  assert((await trace()).some(item => /empty/.test(item.id)), 'Empty/result transition has no feedback');
  mode = 'success';
  const obsolete = holdRequest();
  await page.locator('#run').click(); await obsolete;
  await page.locator('#district').selectOption('center', {force:true});
  release(); await nextFrame();
  assert(await page.locator('#analysis-progress').isHidden() && await page.locator('#run').isEnabled(), 'Cancelled request left loading active');
  assert(await page.locator('#result').isHidden(), 'Obsolete result reappeared after a filter change');
  await page.locator('#district').selectOption('eleytsky', {force:true});
  await page.locator('#run').click(); await ready();

  // Runtime preference changes cancel effects that are already running.
  await page.locator('#model-button').click();
  assert(await page.evaluate(() => document.getAnimations().some(animation => animation.id.startsWith('gm:') && animation.playState === 'running')), 'No active effect available for reduced-motion cancellation');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.waitForFunction(() => !document.getAnimations().some(animation => animation.id.startsWith('gm:') && animation.playState === 'running'));
  await page.keyboard.press('Escape');
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await clearTrace();
  const reducedRequest = holdRequest();
  await page.locator('#refresh-data').click(); await reducedRequest;
  await page.waitForFunction(() => {
    const progress = document.querySelector('#analysis-progress md-linear-progress');
    return progress.indeterminate && progress.shadowRoot?.getAnimations({ subtree: true }).some(animation => animation.playState === 'running');
  });
  metrics.motion.materialProgressRunning = await page.locator('#analysis-progress md-linear-progress').evaluate(node =>
    node.shadowRoot.getAnimations({ subtree: true }).filter(animation => animation.playState === 'running').length);
  assert(await page.locator('#analysis-progress md-linear-progress').isVisible(), 'Held refresh has no visible Material indeterminate progress');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.locator('#analysis-progress md-linear-progress').evaluate(async node => {
    await node.updateComplete;
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  });
  assert(await page.locator('#analysis-progress md-linear-progress').evaluate(node =>
    !node.shadowRoot.getAnimations({ subtree: true }).some(animation => animation.playState === 'running')),
  'Runtime reduced motion leaves Material ShadowRoot animations running');
  assert(await page.locator('#analysis-progress .progress-fallback').isVisible(), 'Reduced motion has no static waiting indicator');
  assert(await page.locator('#analysis-progress .progress-fallback').getAttribute('aria-valuenow') === null, 'Waiting indicator invents a progress percentage');
  assert(await page.locator('#analysis-progress md-linear-progress').isHidden(), 'Reduced motion still shows indeterminate Material motion');
  release(); await ready(); await nextFrame();
  assert((await trace()).length === 0, 'Reduced motion created programmatic effects');
  assert(await page.evaluate(() => !document.getAnimations().some(animation => animation.playState === 'running')), 'Reduced motion leaves CSS animations running');
  await page.emulateMedia({ reducedMotion: 'no-preference' });

  // Actual rendered colors: light text, primary action, and dark analytical strip.
  const contrast = await page.evaluate(() => {
    const rgb = value => (value.match(/[\d.]+/g) || []).map(Number);
    const blend = (front, back) => {
      const alpha = front.length < 4 ? 1 : front[3];
      return front.slice(0, 3).map((channel, index) => channel * alpha + back[index] * (1 - alpha));
    };
    const background = node => {
      const chain = [];
      for (let current = node; current; current = current.parentElement) chain.unshift(current);
      return chain.reduce((color, current) => blend(rgb(getComputedStyle(current).backgroundColor), color), [255, 255, 255]);
    };
    const luminance = color => color.map(value => value / 255).map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4).reduce((sum, value, index) => sum + value * [.2126, .7152, .0722][index], 0);
    const text = ['#page-title', '#area-hint', '#run', '#analysis-status', '#map-context'].map(selector => {
      const node = document.querySelector(selector), style = getComputedStyle(node), bg = background(node);
      const values = [luminance(blend(rgb(style.color), bg)), luminance(bg)].sort((a, b) => b - a);
      return { selector, kind: 'text', minimum: 4.5, ratio: (values[0] + .05) / (values[1] + .05) };
    });
    const borders = ['#business-trigger', '#district-trigger'].map(selector => {
      const node = document.querySelector(selector), style = getComputedStyle(node), bg = background(node);
      const values = [luminance(blend(rgb(style.borderTopColor), bg)), luminance(bg)].sort((a, b) => b - a);
      return { selector, kind: 'control-boundary', minimum: 3, ratio: (values[0] + .05) / (values[1] + .05) };
    });
    return [...text, ...borders];
  });
  assert(contrast.every(item => item.ratio >= item.minimum), `Rendered contrast below required ratio: ${JSON.stringify(contrast)}`);
  metrics.contrast = contrast;
  const button = page.locator('#run');
  const restLayout = await button.evaluate(node => ({ width: node.offsetWidth, height: node.offsetHeight }));
  await button.hover();
  await page.mouse.down();
  await page.waitForFunction(() => {
    const node = document.getElementById('run');
    return getComputedStyle(node).transform !== 'none' && !node.getAnimations().some(animation => animation.playState === 'running');
  });
  const pressed = await button.evaluate(node => {
    const rect = node.getBoundingClientRect();
    return { layoutWidth: node.offsetWidth, layoutHeight: node.offsetHeight, targetWidth: rect.width, targetHeight: rect.height };
  });
  assert(pressed.layoutWidth === restLayout.width && pressed.layoutHeight === restLayout.height, `Button press changes layout: ${JSON.stringify({ restLayout, pressed })}`);
  assert(pressed.targetWidth >= 44 && pressed.targetHeight >= 44, `Settled button press shrinks target below 44px: ${JSON.stringify(pressed)}`);
  metrics.press = pressed;
  // Release away from the button to avoid triggering an unrelated calculation.
  await page.mouse.move(0, 0); await page.mouse.up();

  await page.evaluate(() => document.fonts.ready);
  for (const width of [390, 768, 1440]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
    await page.locator('#map').scrollIntoViewIfNeeded();
    await page.waitForFunction(() => {
      const tiles = [...document.querySelectorAll('#map img.leaflet-tile')];
      return tiles.length > 0 && tiles.every(tile => tile.complete);
    }, null, { timeout: 20000 });
    await nextFrame();
    const geometry = await page.evaluate(() => {
      const map = document.getElementById('map').getBoundingClientRect();
      const rect = selector => document.querySelector(selector).getBoundingClientRect();
      const controls = [...document.querySelectorAll('.site-header nav a,button,select,input[type="range"],.place-actions a,.layers label,.saved-card-actions label,.leaflet-control-zoom a')]
        .filter(node => node.getClientRects().length && !node.disabled && !node.closest('[inert]'))
        .map(node => ({ name: node.id || node.getAttribute('aria-label') || node.textContent.trim(), width: node.getBoundingClientRect().width, height: node.getBoundingClientRect().height }));
      const tiles = [...document.querySelectorAll('#map img.leaflet-tile')];
      return { width: innerWidth, scrollWidth: document.documentElement.scrollWidth, mapWidth: map.width, mapHeight: map.height,
        settingsWidth: rect('#settings').width, recommendationsWidth: rect('#recommendations').width,
        tiles: { count: tiles.length, loaded: tiles.filter(tile => tile.complete && tile.naturalWidth > 0).length, failed: tiles.filter(tile => tile.complete && !tile.naturalWidth).length },
        smallTargets: controls.filter(target => target.width < 43.9 || target.height < 43.9),
      };
    });
    assert(geometry.scrollWidth <= width + 1, `${width}px horizontal overflow: ${JSON.stringify(geometry)}`);
    assert(geometry.mapHeight >= 420, `${width}px map is too short`);
    assert(geometry.tiles.loaded > 0, `${width}px map has no loaded tiles: ${JSON.stringify(geometry.tiles)}`);
    assert(geometry.smallTargets.length === 0, `${width}px targets below 44px: ${JSON.stringify(geometry.smallTargets)}`);
    if (width === 1440) assert(geometry.mapWidth > geometry.settingsWidth && geometry.mapWidth > geometry.recommendationsWidth, 'Desktop map does not dominate side panels');
    metrics.viewports.push(geometry);
    await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
    await nextFrame();
    await page.screenshot({ path: `tests/artifacts/urban-final-${width}.png`, fullPage: true });
  }
  await page.setViewportSize({ width: 390, height: 844 });
  const originalText = await page.evaluate(() => {
    const size = getComputedStyle(document.documentElement).fontSize;
    document.documentElement.style.fontSize = `${parseFloat(size) * 2}px`;
    return size;
  });
  await nextFrame();
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'Mobile 200% text causes page overflow');
  assert(await page.locator('#run').isVisible() && await page.locator('#map').isVisible(), '200% text obscures analysis controls');
  await page.setViewportSize({ width: 1440, height: 1000 });
  await nextFrame();
  const metricHelpers = await page.locator('.place-metrics small').evaluateAll(nodes => nodes.map(node => ({
    text: node.textContent, width: node.clientWidth, scrollWidth: node.scrollWidth,
  })));
  assert(metricHelpers.length >= 4, 'Desktop 200% text check has no rendered metric helpers');
  assert(metricHelpers.every(node => node.scrollWidth <= node.width), `Desktop 200% metric helper text escapes its column: ${JSON.stringify(metricHelpers)}`);
  metrics.textScale = { mobilePageWidth: 390, desktopPageWidth: 1440, scale: 2, metricHelpers };
  await page.evaluate(size => { document.documentElement.style.fontSize = size; }, originalText);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => { window.print = () => { window.__urbanPrinted = true; }; });
  await page.locator('#print-report').click();
  await page.evaluate(() => {
    document.getElementById('model-button').click();
    document.getElementById('close-model').click();
  });
  await page.emulateMedia({ media: 'print' });
  assert(await page.locator('#print-report-content').isVisible() && await page.locator('#workspace').isHidden(), 'Print CSS does not isolate report');
  assert(await page.evaluate(() => window.__urbanPrinted && document.getElementById('print-report-content').textContent.includes('OpenStreetMap')), 'Print report lost data attribution');
  assert(await page.evaluate(() => [...document.querySelectorAll('[data-motion-snapshot],.motion-snapshot')].every(node => !node.getClientRects().length)), 'Print includes motion snapshots');
  await page.emulateMedia({ media: 'screen' });

  // A fresh document with the local bundle blocked must still calculate normally.
  const fallback = await page.context().newPage();
  fallback.on('pageerror', error => errors.push(error.message));
  let finishFallback;
  try {
    await fallback.route('**/static/vendor/material-web/material-components.js', route => route.abort());
    const fallbackHeld = new Promise(resolve => { finishFallback = resolve; });
    await fallback.route('**/api/calculate?**', async route => {
      await fallbackHeld;
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(payload) }).catch(() => {});
    });
    await fallback.goto(base);
    await fallback.waitForFunction(() => document.documentElement.dataset.analysisState === 'calculating');
    assert(await fallback.locator('#analysis-progress .progress-fallback').isVisible(), 'Missing Material bundle hides busy feedback');
    assert(await fallback.locator('#analysis-progress .progress-fallback').getAttribute('aria-valuenow') === null, 'Fallback invents percent');
    finishFallback();
    await fallback.locator('[data-testid="recommendation-card"]').first().waitFor();
    assert(await fallback.locator('#run').isEnabled() && await fallback.locator('#business').isEnabled(), 'Material bundle failure breaks native controls/API');
  } finally { finishFallback?.(); await fallback.close(); }
  assert(errors.length === 0, `Page errors: ${errors.join('; ')}`);
  metrics.motion.ids = await page.evaluate(() => [...new Set(window.__urbanAllMotion.filter(item => item.observerVersion === 2).map(item => item.id))]);
  return { hooks, ...metrics, pageErrors: errors };
  } finally {
    release?.();
    await page.unroute('**/api/calculate?**');
    await page.mouse.up().catch(() => {});
    await page.evaluate(() => {
      window.__urbanUnlock?.();
      if (window.__urbanOriginalSetItem) Storage.prototype.setItem = window.__urbanOriginalSetItem;
      document.documentElement.style.removeProperty('font-size');
    }).catch(() => {});
    await page.emulateMedia({ media: 'screen', reducedMotion: 'no-preference' });
  }
}
