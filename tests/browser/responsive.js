async page => {
  const assert = (ok, message) => { if (!ok) throw new Error(message); };
  const base = new URL(page.url()).origin;
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const legacy = [{"id":"legacy-before-modules:1","analysis_id":"legacy-before-modules","business":"cafe","business_name":"Кофейня","district":"eleytsky","district_name":"мкр. Елецкий","saved_at":"2026-10-12T15:00:00.000Z","source":"cache","data_date":"2026-10-11T12:00:00.000Z","warning":"","parameters":{"radius_m":350,"alpha":1.5},"recommendation":{"rank":1,"lat":52.5961,"lng":39.48729,"score":1,"residents_in_radius":7862,"radius_m":350,"competitors_in_radius":0,"nearest_competitor_m":448}}];
  await page.goto(base);
  await page.evaluate(records => localStorage.setItem('geomarketing.saved.v1', JSON.stringify(records)), legacy);
  await page.reload();
  await page.locator('[data-testid="recommendation-card"]').first().waitFor({ timeout: 70000 });
  assert(await page.locator('[data-testid="saved-card"]').count() === legacy.length, 'Previous v1 records not restored');
  assert(await page.evaluate(() => JSON.parse(localStorage.getItem('geomarketing.saved.v1'))[0].id) === legacy[0].id, 'Previous v1 record changed');
  await page.locator('[data-testid="compare-place"]').first().check();
  const save = page.locator('[data-testid="save-place"]').first();
  const saveAppearance = () => save.evaluate(el => {
    const styles = getComputedStyle(el);
    const rgb = color => color.match(/[\d.]+/g).map(Number);
    const blend = (front, back) => front.slice(0,3).map((v,i)=>v*(front[3]??1)+back[i]*(1-(front[3]??1)));
    const chain=[];for(let current=el;current;current=current.parentElement)chain.unshift(current);
    const surface=chain.reduce((color,current)=>blend(rgb(getComputedStyle(current).backgroundColor),color),[255,255,255]);
    const luminance = color => {
      const channels = color.map(value => {
        const channel = value / 255;
        return channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4;
      });
      return channels[0] * .2126 + channels[1] * .7152 + channels[2] * .0722;
    };
    const foreground = luminance(blend(rgb(styles.color),surface)), background = luminance(surface);
    return { contrast:(Math.max(foreground, background) + .05) / (Math.min(foreground, background) + .05), foreground:styles.color, background:styles.backgroundColor, transform:styles.transform, focusVisible:el.matches(':focus-visible'), outlineStyle:styles.outlineStyle, outlineWidth:parseFloat(styles.outlineWidth), saved:el.classList.contains('is-saved'), pressed:el.getAttribute('aria-pressed') };
  });
  await page.mouse.move(0, 0);
  await page.keyboard.press('Tab');
  await save.focus();
  const unsavedFocus = await saveAppearance();
  assert(unsavedFocus.contrast >= 4.5 && unsavedFocus.focusVisible && unsavedFocus.outlineStyle !== 'none' && unsavedFocus.outlineWidth >= 3, 'Unsaved focus-visible contrast/outline');
  await save.hover();
  await page.waitForTimeout(180);
  const hoveredSave = await saveAppearance();
  assert(hoveredSave.contrast >= 4.5, 'Save hover contrast below 4.5: ' + hoveredSave.contrast);
  await page.mouse.down();
  try {
    const pressedSave = await saveAppearance();
    assert(pressedSave.contrast >= 4.5 && pressedSave.transform !== 'none', 'Save pressed appearance is unclear');
  } finally { await page.mouse.up(); }
  await page.waitForFunction(() => document.querySelector('[data-testid="save-place"]').classList.contains('is-saved'));
  await page.waitForTimeout(180);
  const savedAppearance = await saveAppearance();
  assert(savedAppearance.contrast >= 4.5 && savedAppearance.saved && savedAppearance.pressed === 'true', 'Saved action appearance/pressed state');
  await page.mouse.move(0, 0);
  await page.keyboard.press('Tab');
  await save.focus();
  const savedFocus = await saveAppearance();
  assert(savedFocus.contrast >= 4.5 && savedFocus.focusVisible && savedFocus.outlineStyle !== 'none' && savedFocus.outlineWidth >= 3, 'Saved focus-visible contrast/outline');
  await save.hover();
  await page.mouse.down();
  try {
    const savedPressed = await saveAppearance();
    assert(savedPressed.saved && savedPressed.contrast >= 4.5 && savedPressed.transform !== 'none', 'Saved pressed appearance is unclear: ' + JSON.stringify(savedPressed));
  } finally { await page.mouse.up(); }
  const widths = [360, 390, 768, 1024, 1280, 1440];
  const matrix = [];
  for (const width of widths) {
    await page.setViewportSize({ width, height: 1000 });
    await page.waitForTimeout(800);
    // Capture only after the whole current tile set settles; failed or pending
    // tiles are reported separately, because a single loaded tile is insufficient.
    await page.waitForFunction(() => {
      const tiles = [...document.querySelectorAll('#map img.leaflet-tile')];
      return tiles.length > 0 && tiles.every(tile => tile.complete);
    }, null, { timeout:12000 }).catch(() => {});
    const geometry = await page.evaluate(() => {
      const box = id => { const r = document.getElementById(id).getBoundingClientRect(); return { top:r.top, bottom:r.bottom, width:r.width, height:r.height }; };
      const selectors = '.button,.choice-trigger,.place-select,.place-actions a,.icon-button,.linkbtn,.saved-card-actions button,.saved-card-actions label,.layers label,.site-header nav a,.site-header nav button,select,.leaflet-control-zoom a,.recommendation-pin';
      const smallTargets = [...document.querySelectorAll(selectors)].filter(el => el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden').filter(el => el.getBoundingClientRect().height < 43.9 || el.getBoundingClientRect().width < 43.9).map(el => el.id || el.className);
      const scroll = document.querySelector('.table-scroll');
      const clippedActions = [...document.querySelectorAll('.place-actions button')].filter(el => el.scrollWidth > el.clientWidth).map(el => el.textContent);
      const tiles = [...document.querySelectorAll('#map img.leaflet-tile')];
      const tileState = { total:tiles.length, loaded:tiles.filter(tile => tile.complete && tile.naturalWidth > 0).length, pending:tiles.filter(tile => !tile.complete).length, failed:tiles.filter(tile => tile.complete && !tile.naturalWidth).length, notice:!document.getElementById('map-status').hidden };
      return { pageWidth:document.documentElement.scrollWidth, settings:box('settings'), map:box('map-card'), canvas:box('map'), recommendations:box('recommendations'), smallTargets, clippedActions, tableWidth:scroll.clientWidth, tableContent:scroll.scrollWidth, tileState };
    });
    assert(geometry.pageWidth <= width, width + ': page overflow');
    assert(geometry.canvas.height >= 420, width + ': map too short');
    assert(!geometry.smallTargets.length, width + ': targets under 44px: ' + geometry.smallTargets.join(','));
    assert(!geometry.clippedActions.length, width + ': clipped action labels: ' + geometry.clippedActions.join(','));
    if (width <= 900) assert(geometry.settings.bottom <= geometry.map.top && geometry.map.bottom <= geometry.recommendations.top, width + ': mobile order/overlap');
    if (width >= 1280) assert(geometry.map.width > geometry.settings.width && geometry.map.width > geometry.recommendations.width, width + ': map does not dominate');
    if (width <= 768) assert(geometry.tableContent > geometry.tableWidth, width + ': comparison scroll missing');
    await page.screenshot({ path:'tests/artifacts/redesign-' + width + '.png', fullPage:true });
    matrix.push({ width, mapHeight:geometry.canvas.height, overflow:false, targets44:true, tiles:geometry.tileState });
  }
  const resizedText = [];
  try {
    await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
    for (const width of [360, 390, 1024, 1280]) {
      await page.setViewportSize({ width, height:1000 });
      const textGeometry = await page.evaluate(() => {
        const clippedActions = [...document.querySelectorAll('button,.place-actions a,.site-header nav a')]
          .filter(el => el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden')
          .filter(el => el.scrollWidth > el.clientWidth || el.scrollHeight > el.clientHeight)
          .map(el => el.id || el.textContent.trim());
        return { pageWidth:document.documentElement.scrollWidth, clippedActions };
      });
      assert(textGeometry.pageWidth <= width, width + ': 200% text page overflow: ' + textGeometry.pageWidth);
      assert(!textGeometry.clippedActions.length, width + ': 200% text clipped actions: ' + textGeometry.clippedActions.join(','));
      await page.screenshot({ path:'tests/artifacts/redesign-text200-' + width + '.png', fullPage:true });
      resizedText.push({ width, textSize:'200%', overflow:false, actionLabelsFit:true });
    }
  } finally {
    await page.evaluate(() => { document.documentElement.style.fontSize = ''; });
  }
  await page.setViewportSize({ width:360, height:1000 });
  await page.locator('.table-scroll').focus();
  const scrollFocus = await page.locator('.table-scroll').evaluate(el => document.activeElement === el);
  assert(scrollFocus, 'Comparison not keyboard focusable');
  await page.keyboard.press('ArrowRight');
  await page.waitForFunction(() => document.querySelector('.table-scroll').scrollLeft > 0);
  await page.setViewportSize({ width:1440, height:1000 });
  await page.locator('#model-button').focus();
  await page.keyboard.press('Enter');
  assert(await page.locator('#model-dialog').isVisible(), 'Keyboard cannot open model');
  await page.keyboard.press('Escape');
  assert(!await page.locator('#model-dialog').isVisible(), 'Escape cannot close model');
  assert(await page.locator('#model-button').evaluate(el => el === document.activeElement), 'Dialog does not restore focus');
  await page.emulateMedia({ reducedMotion:'reduce' });
  assert(await page.evaluate(() => getComputedStyle(document.documentElement).scrollBehavior) === 'auto', 'Reduced motion ignored');
  await page.locator('[data-testid="recommendation-card"]').nth(1).locator('.place-select').click();
  assert(await page.locator('[data-testid="recommendation-card"]').nth(1).locator('.place-select').getAttribute('aria-pressed') === 'true', 'Reduced-motion selection failed');
  await page.evaluate(() => { window.print = () => { window.__printed = true; }; });
  await page.locator('#print-report').click();
  assert(await page.evaluate(() => window.__printed), 'Print report not requested');
  await page.emulateMedia({ media:'print' });
  assert(await page.locator('#print-report-content').isVisible() && !await page.locator('main').isVisible() && !await page.locator('#map').isVisible(), 'Print visibility');
  assert(await page.locator('#print-report-content .report-place').count() >= 3, 'Print content incomplete');
  await page.screenshot({ path:'tests/artifacts/redesign-print.png', fullPage:true });
  await page.emulateMedia({ media:'screen', reducedMotion:'no-preference' });
  await page.route('**/static/vendor/leaflet/leaflet.js', route => route.abort());
  await page.reload();
  await page.locator('[data-testid="recommendation-card"]').first().waitFor({ timeout:70000 });
  assert(await page.locator('#map-status').isVisible(), 'Missing Leaflet fallback hidden');
  assert(/модуль карты/.test(await page.locator('#map-message').innerText()), 'Missing Leaflet message');
  assert(!await page.locator('#error').isVisible(), 'Missing Leaflet broke API');
  await page.unroute('**/static/vendor/leaflet/leaflet.js');
  await page.reload();
  await page.locator('[data-testid="recommendation-card"]').first().waitFor({ timeout:70000 });
  assert(!errors.length, errors.join('\n'));
  return { matrix, resizedText, saveStates:{ hover:hoveredSave, saved:savedAppearance, unsavedFocus, savedFocus }, passed:['legacy-v1','save-hover-focus-pressed-saved-contrast','comparison-internal-scroll','44px-targets','200%-text-resizing','keyboard-Escape-focus','reduced-motion','print-CSS','missing-Leaflet-API'], pageErrors:errors };
}
