const { open } = require('./lib.cjs');
(async () => {
  for (const vp of [{ width: 1280, height: 800 }, { width: 360, height: 740 }]) {
    const h = await open({ viewport: vp }); const { page } = h;
    await h.enter('room-width', '6000'); await h.enter('room-depth', '4000');
    await h.t('view-walk').click(); await page.waitForFunction(() => window.__sceneProbe.snapshot().eye);
    await page.waitForTimeout(500);
    const e0 = (await h.snap()).eye; const c = await h.f2c(5900, e0.z); await page.mouse.click(c.x, c.y);
    const samples = []; for (let i = 0; i < 8; i++) { await page.waitForTimeout(150); samples.push((await h.snap()).eye.x); }
    await page.waitForTimeout(1500);
    console.log(JSON.stringify(vp), 'eye0', JSON.stringify(e0), 'x samples every 150ms', samples.join(','), 'final', JSON.stringify((await h.snap()).eye));
    await h.browser.close();
  }
})().catch((e) => { console.error(e); process.exit(1); });
