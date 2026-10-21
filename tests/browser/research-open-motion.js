async original => {
  const base = new URL(original.url()).origin, errors = [], passed = [];
  const assert = (ok, message) => { if (!ok) throw new Error(message); };
  for (const [width, reducedMotion] of [[1440, 'reduce'], [390, 'reduce'], [1440, 'no-preference'], [390, 'no-preference']]) {
    const context = await original.context().browser().newContext({
      viewport: { width, height: 900 }, reducedMotion, hasTouch: width === 390, isMobile: width === 390
    });
    const page = await context.newPage();
    let calculations = 0;
    context.on('request', request => { if (new URL(request.url()).pathname === '/api/calculate') calculations++; });
    page.on('pageerror', error => errors.push(error.message));
    try {
      await page.goto(base);
      await page.waitForFunction(() => document.documentElement.dataset.analysisState === 'success');
      await page.locator('#recommendation-list .place-select').nth(1).click();
      await page.locator('#scenario-save').click();
      await page.locator('#scenario-name').fill('Исследование для повторного открытия');
      await page.locator('#scenario-submit').click();
      await page.getByTestId('scenario-card').waitFor();
      await page.waitForFunction(() => !document.querySelector('#scenario-dialog').open);
      const raw = await page.evaluate(() => localStorage.getItem('geomarketing.scenarios.v1'));
      const saved = JSON.parse(raw).scenarios[0];
      const card = page.getByTestId('scenario-card');
      if (width === 1440 && reducedMotion === 'no-preference') {
        await card.scrollIntoViewIfNeeded();
        await page.mouse.move(0, 0);
        await page.waitForFunction(() => !document.querySelector('[data-testid="scenario-card"]').getAnimations().length);
        await card.hover();
        await page.waitForFunction(() => {
          const styles = getComputedStyle(document.querySelector('[data-testid="scenario-card"]'));
          return styles.transform !== 'none' && new DOMMatrixReadOnly(styles.transform).m42 < -2.5;
        }, null, { timeout: 2000 }).catch(() => { throw new Error('Research card has no hover lift matching saved places'); });
        await page.getByTestId('scenario-compare').click();
        assert(await card.evaluate(el => getComputedStyle(el).boxShadow.includes('inset')), 'Hover erases research comparison state');
        await page.emulateMedia({ reducedMotion: 'reduce' });
        await page.waitForFunction(() => getComputedStyle(document.querySelector('[data-testid="scenario-card"]')).transform === 'none');
        assert(await card.evaluate(el => getComputedStyle(el).transitionDuration.split(',').every(value => parseFloat(value) === 0)), 'Runtime reduced motion leaves research transitions active');
        await page.emulateMedia({ reducedMotion: 'no-preference' });
        passed.push('research hover, comparison emphasis and runtime reduced motion');
      }
      await page.locator('#business-trigger').click();
      await page.getByRole('option', { name: 'Аптека', exact: true }).click();
      await page.locator('#run').click();
      await page.waitForFunction(business => document.documentElement.dataset.analysisState === 'success'
        && document.getElementById('business').value === business, 'pharmacy');
      const before = calculations;
      const open = page.getByTestId('scenario-open');
      await open.scrollIntoViewIfNeeded();
      assert(await open.innerText() === 'Открыть на карте', 'Open label does not explain its destination');
      if (width === 390) await open.tap();
      else if (reducedMotion === 'reduce') { await open.focus(); await page.keyboard.press('Enter'); }
      else await open.click();
      await page.waitForFunction(() => document.getElementById('scenario-snapshot-notice').hidden === false, null, { timeout: 3000 })
        .catch(async () => { throw new Error(`Open failed: ${await page.locator('#scenario-status').textContent()}`); });
      const restored = await page.evaluate(async () => {
        const { state } = await import('/static/js/state.js');
        const r = document.getElementById('map-title').getBoundingClientRect();
        return { id: state.openedScenarioId, analysis: state.current.analysis_id, rank: state.selectedRank,
          business: document.getElementById('business').value, focus: document.activeElement.id,
          top: r.top, bottom: r.bottom, height: innerHeight };
      });
      assert(restored.id === saved.id && restored.analysis === saved.analysis.analysis_id
        && restored.rank === 2 && restored.business === saved.selection.business, `Snapshot restore: ${JSON.stringify(restored)}`);
      assert(calculations === before, 'Opening a research starts another calculation');
      assert(await page.evaluate(() => localStorage.getItem('geomarketing.scenarios.v1')) === raw, 'Opening rewrites saved research');
      assert(restored.focus === 'map-title', 'Opening does not move keyboard focus to the restored map');
      await page.waitForFunction(() => {
        const r = document.getElementById('map-title').getBoundingClientRect();
        return r.top >= 0 && r.bottom <= innerHeight;
      }, null, { timeout: 3000 }).catch(() => { throw new Error(`Open restores data but leaves the map off screen (${width}/${reducedMotion}): ${JSON.stringify(restored)}`); });
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${width}: overflow`);
      passed.push(`${width}/${reducedMotion}: visible restore, focus, unchanged storage, no calculation`);
    } catch (error) {
      const details = await page.evaluate(() => ({ analysisState: document.documentElement.dataset.analysisState,
        business: document.getElementById('business').value, error: document.getElementById('error').textContent,
        status: document.getElementById('scenario-status').textContent }));
      throw new Error(`${error.message}; ${JSON.stringify(details)}`);
    } finally { await context.close(); }
  }
  assert(errors.length === 0, errors.join('\n'));
  return { passed, pageErrors: errors };
}
