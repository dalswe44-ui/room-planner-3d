const { open, URL } = require('./lib.cjs');
(async () => {
  const h = await open(); const { page } = h;
  for (let i = 0; i < 3; i++) {
    const t0 = Date.now(); await page.goto(URL); await page.waitForFunction(() => { try { return !!window.__sceneProbe.snapshot().room; } catch { return false; } });
    const nav = await page.evaluate(() => { const n = performance.getEntriesByType('navigation')[0]; const p = performance.getEntriesByType('paint').map((e) => [e.name, Math.round(e.startTime)]); const r = performance.getEntriesByType('resource').map((e) => [e.name.split('/').pop(), e.transferSize, Math.round(e.duration)]); return { dcl: Math.round(n.domContentLoadedEventEnd), load: Math.round(n.loadEventEnd), p, r }; });
    console.log('probe-ready ms', Date.now() - t0, JSON.stringify(nav));
  }
  await h.browser.close();
})();
