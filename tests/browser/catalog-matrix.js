async page => {
  const assert = (ok, message) => { if (!ok) throw new Error(message); };
  await page.goto(new URL(page.url()).origin);
  await page.locator('[data-testid="recommendation-card"]').first().waitFor({ timeout:70000 });
  const catalog = await page.evaluate(() => fetch('/api/catalog').then(response => response.json()));
  const matrix = [];
  for (const district of catalog.districts) {
    for (const business of catalog.businesses) {
      await page.locator('#district').selectOption(district.key, {force:true});
      await page.locator('#business').selectOption(business.key, {force:true});
      const reply = page.waitForResponse(response => {
        const url = new URL(response.url());
        return url.pathname === '/api/calculate' && url.searchParams.get('district') === district.key && url.searchParams.get('type') === business.key;
      });
      await page.locator('#run').click();
      const response = await reply;
      const data = await response.json();
      await page.locator('#run').waitFor({ state:'visible' });
      await page.waitForFunction(() => !document.getElementById('run').disabled);
      assert(response.ok() && data.status === 'success', district.key + '/' + business.key + ': API error');
      const rendered = await page.evaluate(async () => {
        const { state } = await import('/static/js/state.js');
        return { analysis:state.current?.analysis_id, cards:document.querySelectorAll('[data-testid="recommendation-card"]').length, markers:document.querySelectorAll('[data-testid="recommendation-marker"]').length, residents:document.getElementById('kpi-residents').textContent };
      });
      assert(rendered.analysis === data.analysis_id && rendered.cards === data.recommendations.length && rendered.markers === rendered.cards, district.key + '/' + business.key + ': view mismatch');
      assert(rendered.residents === Math.round(data.stats.residents).toLocaleString('ru-RU'), 'KPI mismatch');
      matrix.push(district.key + '/' + business.key);
    }
  }
  assert(matrix.length === 15, 'Expected fifteen catalog combinations');
  return { passed:matrix };
}
