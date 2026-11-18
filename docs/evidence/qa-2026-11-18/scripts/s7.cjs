const { open } = require('./lib.cjs');
const L = (...a) => console.log(...a.map((x) => typeof x === 'string' ? x : JSON.stringify(x)));
(async () => {
  const h = await open(); const { page } = h;
  await h.t('tab-structure').click(); await page.waitForTimeout(300);
  await h.tap(900, -50); await page.waitForTimeout(200);
  await h.t('wall-add-door').first().click(); await page.waitForTimeout(200);
  await h.tap(900, -50); await page.waitForTimeout(200);
  L('after reselect wall: add-door present', await h.t('wall-add-door').count(), 'outer card', await h.t('outer-wall-card').count(), 'opening card', await h.t('opening-card').count());
  if (await h.t('wall-add-door').count()) await h.t('wall-add-door').first().click(); await page.waitForTimeout(200);
  L('openings', (await h.snap()).openings.map((o) => [o.type, o.from, o.to]));
  // opening width too large
  const inputs = await h.t('opening-card').locator('input').evaluateAll((es) => es.map((e) => e.getAttribute('data-testid')));
  L('opening inputs', inputs);
  const wId = inputs[0];
  await h.enter(wId, '5000'); await page.waitForTimeout(200);
  L('door width 5000 -> err', await h.err(wId), 'fit', (await h.t('opening-fit-warning').count()) ? await h.t('opening-fit-warning').innerText() : null, (await h.snap()).openings.map((o) => [o.from, o.to]));
  await h.enter(wId, '3600'); await page.waitForTimeout(200);
  L('door width 3600 ->', await h.err(wId), 'fit', (await h.t('opening-fit-warning').count()) ? await h.t('opening-fit-warning').innerText() : null, (await h.snap()).openings.map((o) => [o.from, o.to]));
  await h.shot('e35-door-wide');
  await h.enter(inputs[1], '-500'); L('offset -500 err', await h.err(inputs[1]), (await h.snap()).openings.map((o) => [o.from, o.to]));
  // label
  await h.t('label-add').click(); await page.waitForTimeout(200);
  L('label card', (await h.t('label-card').count()) ? await h.t('label-card').innerText() : null, (await h.snap()).labels);
  if (await h.t('label-name').count()) { await h.t('label-name').fill(''); await h.t('label-name').press('Enter'); L('empty label ->', (await h.snap()).labels); }
  await h.t('tab-main').click();
  // room shrink then door: where
  await h.enter('room-width', '1000'); await page.waitForTimeout(300);
  L('room 1000 openings', (await h.snap()).openings.map((o) => [o.from, o.to]));
  await h.t('tab-structure').click(); await page.waitForTimeout(300); L('struct panel after shrink:\n' + await h.t('panel').innerText()); await h.shot('e36-structure-after-shrink');
  await h.t('tab-main').click(); await h.enter('room-width', '3600');
  // ceiling vs furniture
  await h.t('furniture-name').fill('키큰장'); await h.t('furniture-h').fill('3000'); await h.t('furniture-h').press('Tab'); await h.t('furniture-add').click(); await page.waitForTimeout(200);
  L('tall 3000 in 2400 ceiling: warn', (await h.items()).slice(-1)[0].warn, 'status', await h.t('item-status').count());
  await h.t('view-3d').click(); await page.waitForTimeout(600); await h.shot('e37-tall-3d');
  // walk + draft
  await h.t('view-walk').click(); await page.waitForTimeout(500);
  await h.t('preset-chair').click(); await page.waitForTimeout(300);
  L('walk: draft', !!(await h.snap()).draft, 'draft-toolbar visible', await h.t('draft-toolbar').count(), 'draft-card', await h.t('draft-card').count());
  await h.t('draft-card-confirm').click(); await page.waitForTimeout(300);
  L('walk: confirm -> items', (await h.items()).length, 'selected', (await h.items()).filter((i) => i.sel).length, 'item-toolbar', await h.t('item-toolbar').count(), 'view', (await h.snap()).view);
  // in walk, arrow keys move selected item?
  const c0 = (await h.items()).slice(-1)[0].c; await page.evaluate(() => document.activeElement.blur()); await page.keyboard.press('ArrowRight'); L('walk arrow moves selected item', c0, '->', (await h.items()).slice(-1)[0].c);
  await h.shot('e38-walk-after-add');
  // perf: 60 items
  await h.t('view-2d').click();
  const t0 = Date.now();
  for (let i = 0; i < 40; i++) { await h.t('furniture-add').click(); }
  L('40 adds ms', Date.now() - t0, 'count', (await h.items()).length, 'warns', (await h.items()).filter((i) => i.warn).length);
  await page.waitForTimeout(500); await h.shot('e39-many-items');
  const fps = async () => page.evaluate(() => new Promise((res) => { let n = 0; const t = performance.now(); const f = () => { n++; if (performance.now() - t < 1000) requestAnimationFrame(f); else res(n); }; requestAnimationFrame(f); }));
  L('rAF fps 2d (swiftshader)', await fps());
  await h.t('view-3d').click(); await page.waitForTimeout(800); L('rAF fps 3d', await fps());
  const it = (await h.items())[0]; const t1 = Date.now(); await h.t('view-2d').click(); await page.waitForTimeout(300); await h.drag({ x: it.c[0], z: it.c[1] }, { x: it.c[0] + 300, z: it.c[1] + 200 }, 20); L('drag w/ 42 items ms', Date.now() - t1 - 300);
  L('storage size', await page.evaluate(() => localStorage.getItem('room-planner-3d/project').length));
  // corrupted / partial storage
  for (const bad of ['{', 'null', '{"version":1}', '{"version":99,"project":{}}', JSON.stringify({ version: 1, displayUnit: 'mm', room: { ceilingHeight: 2400, corners: [{ x: 0, z: 0 }, { x: -5, z: 0 }], openings: [], photos: [] }, items: [{ id: 'a', name: 'x', w: 'NaN', d: 1, h: 1, x: 0, z: 0 }] })]) {
    await page.evaluate((b) => localStorage.setItem('room-planner-3d/project', b), bad);
    const n = h.logs.length; await page.reload(); await page.waitForFunction(() => { try { return !!window.__sceneProbe.snapshot().room; } catch { return false; } }, null, { timeout: 8000 }).catch(() => L('PROBE NOT READY for', bad.slice(0, 30)));
    L('bad storage', bad.slice(0, 40), '->', (await h.snap().catch(() => ({ room: 'ERR' }))).room, 'new logs', h.logs.slice(n).filter((x) => !/ReadPixels|THREE.Clock/.test(x)));
  }
  L('LOGS', h.logs.filter((x) => !/ReadPixels|THREE.Clock/.test(x)));
  await h.browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
