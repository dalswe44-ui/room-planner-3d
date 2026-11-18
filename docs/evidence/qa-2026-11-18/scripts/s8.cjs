const { chromium } = require(process.cwd() + '/node_modules/playwright');
(async () => {
  const b = await chromium.launch({ channel: 'chrome' }); const p = await (await b.newContext()).newPage();
  await p.goto('https://claude.ai/artifact/52mEdP9k2etoYxmRqK8wHr', { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(8000);
  console.log('url', p.url()); console.log('title', await p.title()); console.log('text', (await p.locator('body').innerText()).slice(0, 400));
  console.log('frames', p.frames().map((f) => f.url().slice(0, 80)));
  let found = false; for (const f of p.frames()) { if (await f.locator('[data-testid=scene-canvas]').count().catch(() => 0)) found = true; }
  console.log('scene-canvas found', found);
  await p.screenshot({ path: process.cwd() + '/docs/evidence/qa-2026-11-18/x01-artifact-no-login.png' });
  await b.close();
})();
