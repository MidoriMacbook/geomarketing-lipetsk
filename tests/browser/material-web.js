async page => {
  await page.goto(new URL(page.url()).origin);
  await page.waitForFunction(() => document.documentElement.dataset.materialWeb === 'ready');
  const registered = await page.evaluate(() => ({
    ready: document.documentElement.dataset.materialWeb,
    linearProgress: Boolean(customElements.get('md-linear-progress')),
    actualProgress: document.querySelector('#analysis-progress md-linear-progress') instanceof customElements.get('md-linear-progress'),
    upgradedProgress: Boolean(document.querySelector('#analysis-progress md-linear-progress')?.shadowRoot),
    fallback: Boolean(document.querySelector('#analysis-progress .progress-fallback')),
    nativeSelect: document.querySelector('#business') instanceof HTMLSelectElement,
    nativeDialog: document.querySelector('#model-dialog') instanceof HTMLDialogElement,
  }));

  if (registered.ready !== 'ready') throw new Error('Material Web bundle did not report ready');
  if (!registered.linearProgress || !registered.actualProgress || !registered.upgradedProgress || !registered.fallback || !registered.nativeSelect || !registered.nativeDialog) {
    throw new Error(`Material progress is not used in the analysis UI: ${JSON.stringify(registered)}`);
  }

  return { materialWeb: registered };
}
