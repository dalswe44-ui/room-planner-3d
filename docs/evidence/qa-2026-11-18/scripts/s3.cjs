const { open } = require('./lib.cjs');
const L = (...a) => console.log(...a.map((x) => typeof x === 'string' ? x : JSON.stringify(x)));
(async () => {
  const h = await open(); const { page } = h;
  // preset draft
  await h.t('preset-bed').click(); await page.waitForTimeout(300);
  L('draft', (await h.snap()).draft && (await h.snap()).draft.size, 'scene-hint', (await h.t('scene-hint').count()) ? await h.t('scene-hint').innerText() : null);
  await h.shot('e07-draft-bed');
  L('draft card text', await h.t('draft-card').innerText());
  await h.t('draft-confirm').click();
  await h.t('preset-desk').click(); await h.t('draft-confirm').click();
  L('items', await h.items());
  // select in scene -> is edit card in viewport?
  const its = await h.items();
  await h.tap(its[0].c[0], its[0].c[1]);
  L('item-name in viewport', await h.t('item-name').evaluate((e) => { const r = e.getBoundingClientRect(); return [Math.round(r.top), innerHeight]; }));
  // drag desk onto bed -> overlap
  await h.drag({ x: its[1].c[0], z: its[1].c[1] }, { x: its[0].c[0] + 200, z: its[0].c[1] + 100 });
  await page.waitForTimeout(200);
  L('overlap', await h.items(), 'status', (await h.t('item-status').count()) ? await h.t('item-status').innerText() : null);
  await h.shot('e08-overlap');
  // drag far outside room (off canvas bounds)
  const d = (await h.items())[1];
  await h.drag({ x: d.c[0], z: d.c[1] }, { x: -900, z: 1500 });
  await page.waitForTimeout(200);
  L('outside', (await h.items())[1], 'status', (await h.t('item-status').count()) ? await h.t('item-status').innerText() : null, 'dists', await Promise.all([0,1,2,3].map((i) => h.t('item-dist-' + i).innerText())));
  await h.shot('e09-outside');
  // drag completely off the canvas (to the panel)
  const p = await h.f2c(-400, 1500); await page.mouse.move(p.x, p.y); await page.mouse.down(); await page.mouse.move(100, 400, { steps: 10 }); await page.mouse.up();
  L('dragged to panel', (await h.items())[1]);
  await h.shot('e10-far-outside');
  // can it be recovered? is it visible on canvas?
  const c = (await h.items())[1].c; L('client of lost item', await h.f2c(c[0], c[1]), 'canvas', await h.t('scene-canvas').boundingBox());
  // rotate via toolbar
  await h.t('undo').click(); await h.t('undo').click();
  // 2D zoom/pan
  const o0 = await h.f2c(0, 0), w0 = await h.f2c(3600, 0);
  const cb = await h.t('scene-canvas').boundingBox(); const cx = cb.x + cb.width / 2, cy = cb.y + cb.height / 2;
  await page.mouse.move(cx, cy); await page.mouse.wheel(0, -600); await page.waitForTimeout(500);
  const o1 = await h.f2c(0, 0), w1 = await h.f2c(3600, 0);
  L('2d wheel zoom: width px', w0.x - o0.x, '->', w1.x - o1.x);
  // pan with drag on empty floor? right-drag?
  await h.tap(3500, 2900);
  const e = await h.f2c(3400, 2800); await page.mouse.move(e.x, e.y); await page.mouse.down(); await page.mouse.move(e.x - 150, e.y - 80, { steps: 8 }); await page.mouse.up(); await page.waitForTimeout(300);
  const o2 = await h.f2c(0, 0); L('2d left-drag empty: origin', o1, '->', o2);
  await page.mouse.move(e.x, e.y); await page.mouse.down({ button: 'right' }); await page.mouse.move(e.x - 150, e.y - 80, { steps: 8 }); await page.mouse.up({ button: 'right' }); await page.waitForTimeout(300);
  L('2d right-drag: origin ->', await h.f2c(0, 0));
  await h.shot('e11-2d-zoomed');
  // reset view? toggle view and back
  await h.t('view-3d').click(); await page.waitForTimeout(600); await h.t('view-2d').click(); await page.waitForTimeout(600);
  const o3 = await h.f2c(0, 0), w3 = await h.f2c(3600, 0); L('after toggle 2d: width px', w3.x - o3.x, 'origin', o3, '(initial', o0, ')');
  L('buttons in scene', await h.t('scene').evaluate((e) => [...e.querySelectorAll('button')].map((b) => b.innerText || b.getAttribute('aria-label') || b.title)));
  // 3D
  await h.t('view-3d').click(); await page.waitForTimeout(800); await h.shot('e12-3d');
  L('3d hint', (await h.t('scene-hint').count()) ? await h.t('scene-hint').innerText() : null);
  const a0 = await h.f2c(0, 0);
  await page.mouse.move(cb.x + 40, cb.y + cb.height - 40); await page.mouse.down(); await page.mouse.move(cb.x + 240, cb.y + cb.height - 100, { steps: 8 }); await page.mouse.up(); await page.waitForTimeout(400);
  const a1 = await h.f2c(0, 0); L('3d orbit', a0, '->', a1);
  await page.mouse.move(cx, cy); await page.mouse.wheel(0, -500); await page.waitForTimeout(400);
  const a2 = await h.f2c(0, 0); L('3d zoom ->', a2);
  await page.mouse.move(cb.x + 40, cb.y + cb.height - 40); await page.mouse.down({ button: 'right' }); await page.mouse.move(cb.x + 140, cb.y + cb.height - 140, { steps: 8 }); await page.mouse.up({ button: 'right' }); await page.waitForTimeout(400);
  L('3d right-drag pan ->', await h.f2c(0, 0));
  await page.mouse.wheel(0, 5000); await page.waitForTimeout(500); await h.shot('e13-3d-zoomed-out');
  await page.mouse.wheel(0, -20000); await page.waitForTimeout(500); await h.shot('e14-3d-zoomed-in');
  // 3D drag furniture
  await h.t('view-2d').click(); await h.t('view-3d').click(); await page.waitForTimeout(600);
  const b = (await h.items())[0]; const bp = await h.f2c(b.c[0], b.c[1]); const tp = await h.f2c(b.c[0] + 500, b.c[1] + 300);
  await page.mouse.move(bp.x, bp.y); await page.mouse.down(); await page.mouse.move(tp.x, tp.y, { steps: 10 }); await page.mouse.up(); await page.waitForTimeout(300);
  L('3d drag item', b.c, '->', (await h.items())[0].c);
  // walk
  await h.t('view-walk').click(); await page.waitForTimeout(800); await h.shot('e15-walk');
  L('walk eye', (await h.snap()).eye, 'hint', (await h.t('scene-hint').count()) ? await h.t('scene-hint').innerText() : null);
  await page.mouse.move(cx, cy); await page.mouse.down(); await page.mouse.move(cx + 300, cy, { steps: 8 }); await page.mouse.up(); await page.waitForTimeout(300);
  L('walk eye after drag', (await h.snap()).eye); await h.shot('e16-walk-turned');
  for (const k of ['ArrowUp', 'w', 'ArrowLeft']) { await page.keyboard.press(k); await page.waitForTimeout(200); L('walk key', k, (await h.snap()).eye); }
  await page.mouse.wheel(0, -500); await page.waitForTimeout(300); L('walk wheel', (await h.snap()).eye);
  // panel in walk mode: can still add furniture?
  await h.t('preset-chair').click(); await page.waitForTimeout(300);
  L('walk + preset: view', (await h.snap()).view, 'draft', !!(await h.snap()).draft, 'items', (await h.items()).length);
  await h.shot('e17-walk-preset');
  L('LOGS', h.logs.filter((x) => !/ReadPixels|THREE.Clock/.test(x)));
  await h.browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
