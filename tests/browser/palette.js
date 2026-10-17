async page => {
  await page.goto(new URL(page.url()).origin);
  await page.locator('[data-testid="recommendation-card"]').first().waitFor({ timeout:70000 });
  const measurements = await page.evaluate(async () => {
    const { state } = await import('/static/js/state.js');
    const { drawMap, drawZones } = await import('/static/js/map.js');
    const original = window.getComputedStyle;
    let reads = 0;
    window.getComputedStyle = (...args) => {
      if (args[0] === document.documentElement) reads++;
      return original(...args);
    };
    try {
      drawMap(state.current);
      const mapReads = reads;
      reads = 0;
      drawZones();
      return { houses:state.current.houses.length, gridCells:state.current.grid.scores.length, recommendations:state.current.recommendations.length, mapReads, zoneReads:reads, canvases:document.querySelectorAll('#map canvas').length };
    } finally { window.getComputedStyle = original; }
  });
  if(measurements.mapReads !== measurements.recommendations + 1 || measurements.zoneReads !== 1 || measurements.canvases !== 2) throw new Error(JSON.stringify(measurements));
  return { passed:'CSS palette reads bounded by renders, shared canvas reused', measurements };
}
