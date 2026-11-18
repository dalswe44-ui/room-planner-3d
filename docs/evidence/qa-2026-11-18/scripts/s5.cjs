const { open } = require('./lib.cjs');
const L = (...a) => console.log(...a.map((x) => typeof x === 'string' ? x : JSON.stringify(x)));
(async () => {
  const h = await open({ viewport: { width: 400, height: 800 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 }); const { page } = h;
  await page.waitForTimeout(800);
  await h.shot('m01-first-screen-mobile');
  L('doc scroll', await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: innerWidth, sh: document.documentElement.scrollHeight, ih: innerHeight })));
  const box = async (id) => { const b = await h.t(id).boundingBox(); return b && [Math.round(b.x), Math.round(b.y), Math.round(b.width), Math.round(b.height)]; };
  L('layout: header-sub visible', await page.locator('.app-sub').isVisible(), 'panel', await box('panel'), 'scene', await box('scene'), 'canvas', await box('scene-canvas'));
  // touch target sizes
  const small = await page.evaluate(() => [...document.querySelectorAll('button, input, select, [role=tab]')].filter((e) => e.offsetParent).map((e) => { const r = e.getBoundingClientRect(); return [e.getAttribute('data-testid') || e.innerText.slice(0, 8) || e.tagName, Math.round(r.width), Math.round(r.height)]; }).filter((x) => x[1] < 44 || x[2] < 44));
  L('targets < 44px', small);
  // add furniture via preset on mobile
  await h.t('preset-desk').tap(); await page.waitForTimeout(400);
  await h.shot('m02-draft-mobile');
  L('draft toolbar', await box('draft-toolbar'), 'draft-card in view', await h.t('draft-card').evaluate((e) => { const r = e.getBoundingClientRect(); return [Math.round(r.top), Math.round(r.bottom)]; }));
  await h.t('draft-confirm').tap(); await page.waitForTimeout(300);
  await h.shot('m03-item-selected-mobile');
  L('items', await h.items(), 'toolbar', await box('item-toolbar'));
  // touch drag via CDP
  const cdp = await h.ctx.newCDPSession(page);
  const touchDrag = async (a, b, steps = 10) => {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: a.x, y: a.y }] });
    for (let i = 1; i <= steps; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: a.x + (b.x - a.x) * i / steps, y: a.y + (b.y - a.y) * i / steps }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  };
  let it = (await h.items())[0];
  const sy0 = await page.evaluate(() => [scrollY, document.querySelector('[data-testid=panel]').scrollTop]);
  await touchDrag(await h.f2c(it.c[0], it.c[1]), await h.f2c(1000, 800)); await page.waitForTimeout(300);
  L('touch drag ->', (await h.items())[0].c, 'scroll before/after', sy0, await page.evaluate(() => [scrollY, document.querySelector('[data-testid=panel]').scrollTop]));
  // pinch zoom on canvas
  const cb = await h.t('scene-canvas').boundingBox(); const cx = cb.x + cb.width / 2, cy = cb.y + cb.height / 2;
  const w0 = (await h.f2c(3600, 0)).x - (await h.f2c(0, 0)).x;
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: cx - 30, y: cy + 100, id: 1 }, { x: cx + 30, y: cy + 100, id: 2 }] });
  for (let i = 1; i <= 8; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: cx - 30 - i * 8, y: cy + 100, id: 1 }, { x: cx + 30 + i * 8, y: cy + 100, id: 2 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await page.waitForTimeout(400);
  const w1 = (await h.f2c(3600, 0)).x - (await h.f2c(0, 0)).x;
  L('pinch: room px width', w0, '->', w1, 'visualViewport scale', await page.evaluate(() => visualViewport.scale));
  await h.shot('m04-after-pinch');
  // edit selected item on mobile: where is the card
  await h.t('view-2d').tap(); 
  it = (await h.items())[0]; const p = await h.f2c(it.c[0], it.c[1]); await page.touchscreen.tap(p.x, p.y); await page.waitForTimeout(300);
  L('selected', (await h.items())[0].sel, 'item-name top', await h.t('item-name').evaluate((e) => Math.round(e.getBoundingClientRect().top)), 'panel box', await box('panel'), 'panel scrollTop/Height', await h.t('panel').evaluate((e) => [e.scrollTop, e.scrollHeight, e.clientHeight]));
  // focus an input: keyboard would cover? just screenshot
  await h.t('room-width').tap(); await page.waitForTimeout(300); await h.shot('m05-input-focus-mobile');
  L('room-width font-size', await h.t('room-width').evaluate((e) => getComputedStyle(e).fontSize));
  for (const tab of ['structure', 'photo', 'suggest']) { await h.t('tab-' + tab).tap(); await page.waitForTimeout(500); await h.shot('m06-tab-' + tab + '-mobile'); L(tab, 'doc sw', await page.evaluate(() => document.documentElement.scrollWidth)); if (tab === 'structure') L('STRUCT PANEL:\n' + await h.t('panel').innerText()); }
  await h.t('tab-main').tap();
  await h.t('view-3d').tap(); await page.waitForTimeout(700); await h.shot('m07-3d-mobile');
  await h.t('view-walk').tap(); await page.waitForTimeout(700); await h.shot('m08-walk-mobile');
  // landscape-ish small height
  await page.setViewportSize({ width: 800, height: 400 }); await page.waitForTimeout(600); await h.shot('m09-landscape');
  L('landscape canvas', await box('scene-canvas'), 'panel', await box('panel'));
  await page.setViewportSize({ width: 320, height: 568 }); await h.t('view-2d').tap(); await page.waitForTimeout(600); await h.shot('m10-320');
  L('320: doc sw', await page.evaluate(() => document.documentElement.scrollWidth), 'canvas', await box('scene-canvas'), 'tabs', await page.evaluate(() => [...document.querySelectorAll('[role=tab]')].map((e) => Math.round(e.getBoundingClientRect().width))));
  L('LOGS', h.logs.filter((x) => !/ReadPixels|THREE.Clock/.test(x)));
  await h.browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
