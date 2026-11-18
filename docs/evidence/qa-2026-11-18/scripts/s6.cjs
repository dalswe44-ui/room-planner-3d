const { open } = require('./lib.cjs');
const L = (...a) => console.log(...a.map((x) => typeof x === 'string' ? x : JSON.stringify(x)));
(async () => {
  const h = await open(); const { page } = h;
  // keyboard only: tab order from load
  const seq = [];
  for (let i = 0; i < 28; i++) { await page.keyboard.press('Tab'); seq.push(await page.evaluate(() => { const e = document.activeElement; const cs = getComputedStyle(e); return (e.getAttribute('data-testid') || e.getAttribute('aria-label') || e.tagName) + (cs.outlineStyle !== 'none' && cs.outlineWidth !== '0px' || cs.boxShadow !== 'none' ? '' : '(!nofocusring)'); })); }
  L('tab order', seq);
  // add via keyboard: focus preset-desk, Enter, Enter
  await h.t('preset-desk').focus(); await page.keyboard.press('Enter'); await page.waitForTimeout(200); L('kbd preset Enter -> draft', !!(await h.snap()).draft); await page.keyboard.press('Enter'); await page.waitForTimeout(200);
  L('items', await h.items(), 'active', await page.evaluate(() => document.activeElement.getAttribute('data-testid') || document.activeElement.tagName));
  // item-row keyboard select
  await h.tap(100, 100);
  await h.t('item-row').first().focus(); L('item-row tag/role', await h.t('item-row').first().evaluate((e) => [e.tagName, e.getAttribute('role'), e.tabIndex, e.getAttribute('aria-pressed'), e.getAttribute('aria-selected'), e.getAttribute('aria-current')]));
  await page.keyboard.press('Enter'); L('row Enter selects', (await h.items())[0].sel);
  await page.keyboard.press('ArrowRight'); await page.keyboard.press('ArrowRight'); L('arrow with focus on row ->', (await h.items())[0].c);
  await page.evaluate(() => document.activeElement.blur()); await page.keyboard.press('ArrowRight'); L('arrow after blur ->', (await h.items())[0].c);
  // tabs: arrow keys
  await h.t('tab-main').focus(); await page.keyboard.press('ArrowRight'); L('tab arrow ->', await page.evaluate(() => document.activeElement.getAttribute('data-testid')), 'tabpanel role count', await page.locator('[role=tabpanel]').count(), 'aria-controls', await h.t('tab-main').getAttribute('aria-controls'));
  // canvas a11y
  L('canvas attrs', await h.t('scene-canvas').evaluate((e) => { const c = e.querySelector('canvas'); return { role: c?.getAttribute('role'), label: c?.getAttribute('aria-label'), tabindex: c?.tabIndex, wrapLabel: e.getAttribute('aria-label') }; }));
  L('live regions', await page.evaluate(() => [...document.querySelectorAll('[aria-live],[role=alert],[role=status]')].map((e) => [e.getAttribute('data-testid'), e.getAttribute('role'), e.getAttribute('aria-live')])));
  await h.enter('room-width', 'abc');
  L('error a11y', await h.t('room-width').evaluate((e) => ({ invalid: e.getAttribute('aria-invalid'), desc: e.getAttribute('aria-describedby') })), await h.t('room-width-error').evaluate((e) => ({ id: e.id, role: e.getAttribute('role'), live: e.getAttribute('aria-live'), color: getComputedStyle(e).color, fs: getComputedStyle(e).fontSize })));
  await h.enter('room-width', '3600');
  // contrast of a few texts
  const contrast = await page.evaluate(() => { const lum = (c) => { const [r, g, b] = c.match(/[\d.]+/g).slice(0, 3).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; }; const bgOf = (e) => { while (e) { const b = getComputedStyle(e).backgroundColor; if (b && !/rgba\(0, 0, 0, 0\)|transparent/.test(b)) return b; e = e.parentElement; } return 'rgb(255,255,255)'; }; const out = []; for (const sel of ['.app-sub', '.app-tab[aria-selected=false]', '.len-unit', '[data-testid=item-nudge-hint]', '.room-hint, .photo-hint, p', '[data-testid=furniture-add]', 'button:disabled']) { const e = document.querySelector(sel); if (!e) continue; const fg = getComputedStyle(e).color, bg = bgOf(e); const a = lum(fg), b = lum(bg); out.push([sel, fg, bg, ((Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)).toFixed(2)]); } return out; });
  L('contrast', contrast);
  // Ctrl+Z inside input vs outside
  // STRUCTURE
  await h.t('tab-structure').click(); await page.waitForTimeout(400);
  L('badge', (await h.t('structure-mode-badge').count()) ? await h.t('structure-mode-badge').innerText() : null, 'hint', (await h.t('structure-hint').count()) ? await h.t('structure-hint').innerText() : null);
  await h.drag({ x: 1800, z: 0 }, { x: 1810, z: 2000 }); await page.waitForTimeout(300);
  L('walls', (await h.snap()).walls);
  // diagonal wall attempt
  await h.drag({ x: 300, z: 300 }, { x: 1200, z: 1200 }); await page.waitForTimeout(300); L('diagonal ->', (await h.snap()).walls.slice(1));
  // tiny wall
  await h.drag({ x: 3000, z: 2500 }, { x: 3030, z: 2500 }); await page.waitForTimeout(300); L('tiny ->', (await h.snap()).walls.length);
  await h.shot('e30-structure');
  L('STRUCT PANEL:\n' + await h.t('panel').innerText());
  // select outer wall 0, add door, window
  await h.tap(900, -50); await page.waitForTimeout(300);
  L('outer wall card', await h.t('outer-wall-card').count());
  if (await h.t('wall-add-door').count()) { await h.t('wall-add-door').first().click(); await page.waitForTimeout(300); L('openings', (await h.snap()).openings); L('opening card:\n' + (await h.t('opening-card').count() ? await h.t('opening-card').innerText() : 'none')); await h.shot('e31-door'); }
  // add 5 doors on same wall -> fit warning?
  await h.tap(900, -50); for (let i = 0; i < 5; i++) { await h.tap(900, -50).catch(() => {}); if (await h.t('wall-add-door').count() && !(await h.t('wall-add-door').first().isDisabled())) await h.t('wall-add-door').first().click(); await page.waitForTimeout(150); }
  L('doors after 6 adds', (await h.snap()).openings.map((o) => [o.wall, o.offset, o.width]), 'fit-warning', (await h.t('opening-fit-warning').count()) ? await h.t('opening-fit-warning').innerText() : null);
  await h.shot('e32-many-doors');
  // shrink room so wall/door no longer fits
  await h.t('tab-main').click(); await h.enter('room-width', '1000'); await page.waitForTimeout(300);
  L('room 1000: walls', (await h.snap()).walls.map((w) => [w.a, w.b]), 'openings', (await h.snap()).openings.map((o) => [o.wall, o.offset, o.width]));
  await h.shot('e33-shrunk-with-structure');
  await h.t('view-3d').click(); await page.waitForTimeout(700); await h.shot('e34-shrunk-3d');
  L('LOGS', h.logs.filter((x) => !/ReadPixels|THREE.Clock/.test(x)));
  await h.browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
