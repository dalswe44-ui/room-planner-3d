const { open } = require('./lib.cjs');
const L = (...a) => console.log(...a.map((x) => typeof x === 'string' ? x : JSON.stringify(x)));
(async () => {
  const h = await open(); const { page } = h;
  const reqs = []; page.on('request', (r) => { if (!r.url().includes('/assets/')) reqs.push(r.method() + ' ' + r.url()); });
  // undo coalescing
  await h.t('preset-desk').click(); await h.t('draft-confirm').click();
  let c = (await h.items())[0].c;
  await h.drag({ x: c[0], z: c[1] }, { x: 1000, z: 1000 }); await page.waitForTimeout(500);
  await h.drag({ x: 1000, z: 1000 }, { x: 2500, z: 2200 }); await page.waitForTimeout(300);
  L('after 2 drags (0.5s apart)', (await h.items())[0].c);
  await h.t('undo').click(); L('undo1 ->', (await h.items()).map((i) => i.c));
  await h.t('redo').click();
  await page.waitForTimeout(1500);
  c = (await h.items())[0].c;
  await h.drag({ x: c[0], z: c[1] }, { x: 1000, z: 1000 }); await page.waitForTimeout(1600);
  await h.drag({ x: 1000, z: 1000 }, { x: 1500, z: 2000 }); await page.waitForTimeout(300);
  await h.t('undo').click(); L('2 drags 1.6s apart, undo1 ->', (await h.items()).map((i) => i.c));
  // persistence
  await h.enter('room-width', '4200'); await h.t('unit-cm').click(); await h.t('view-3d').click();
  await page.waitForTimeout(600);
  const before = await h.snap();
  await page.reload(); await page.waitForFunction(() => { try { return !!window.__sceneProbe.snapshot().room; } catch { return false; } }); await page.waitForTimeout(500);
  const after = await h.snap();
  L('reload: room', before.room, after.room, 'items same', JSON.stringify(before.items.map((i) => [i.center, i.size])) === JSON.stringify(after.items.map((i) => [i.center, i.size])), 'view', after.view, 'unit cm pressed', await h.t('unit-cm').getAttribute('aria-pressed'), 'undo disabled', await h.t('undo').isDisabled());
  L('localStorage keys', await page.evaluate(() => Object.keys(localStorage).map((k) => [k, localStorage.getItem(k).length])));
  await h.t('unit-mm').click();
  // PHOTO tab
  await h.t('tab-photo').click(); await page.waitForTimeout(800);
  L('PHOTO PANEL:\n' + await h.t('panel').innerText());
  await h.shot('e20-photo-tab');
  L('reqs so far', reqs);
  const fi = h.t('photo-file');
  L('file input', await fi.evaluate((e) => ({ accept: e.accept, multiple: e.multiple, visible: e.offsetParent !== null, label: e.labels?.[0]?.innerText || e.getAttribute('aria-label') })));
  for (const f of ['notimage.txt', 'fake.png', 'small.png', 'big.png']) {
    const t0 = Date.now();
    await fi.setInputFiles(__dirname + '/' + f); await page.waitForTimeout(1500);
    L('upload', f, 'preview', await h.t('photo-preview').count(), 'status', (await h.t('photo-read-status').count()) ? await h.t('photo-read-status').innerText() : null, 'storage-failed', await h.t('photo-storage-failed').count(), 'panel err text', (await h.t('panel').innerText()).split('\n').filter((s) => /없|실패|오류|지원|크/.test(s)).slice(0, 4));
    if (f === 'fake.png') await h.shot('e21-photo-fake');
  }
  await h.shot('e22-photo-uploaded');
  await page.reload(); await page.waitForFunction(() => { try { return !!window.__sceneProbe.snapshot().room; } catch { return false; } });
  await h.t('tab-photo').click(); await page.waitForTimeout(1000);
  L('photo after reload', await h.t('photo-preview').count(), 'tab persisted? (had to click again)');
  // manual JSON
  const sample = JSON.stringify({ format: 'room-layout', version: 1, unit: 'mm', room: { width: 3400, depth: 2800 }, items: [{ name: '침대', w: 1000, d: 2000, x: 500, z: 1000 }] });
  if (await h.t('layout-json').count()) {
    await h.t('layout-json').fill('{"format":'); await page.waitForTimeout(300); L('broken json err', (await h.t('layout-error').count()) ? await h.t('layout-error').innerText() : null);
    await h.t('layout-json').fill(sample); await page.waitForTimeout(300);
    L('sample -> preview', await h.t('layout-preview').count(), 'err', (await h.t('layout-error').count()) ? await h.t('layout-error').innerText() : null);
    if (await h.t('layout-preview').count()) { L('preview text', await h.t('layout-preview').innerText()); await h.shot('e23-layout-preview'); await h.t('layout-apply').click(); await page.waitForTimeout(300); L('confirm text', await h.t('panel').innerText().then((s) => s.split('\n').slice(-12))); await h.shot('e24-layout-confirm'); if (await h.t('layout-apply-confirm').count()) await h.t('layout-apply-confirm').click(); await page.waitForTimeout(300); L('applied', (await h.snap()).room, (await h.items()).length, 'undo enabled', !(await h.t('undo').isDisabled())); await h.t('undo').click(); L('undo apply ->', (await h.snap()).room, (await h.items()).length); }
  }
  await h.t('photo-remove').click().catch(() => L('no photo-remove')); await page.waitForTimeout(300);
  L('after remove', await h.t('photo-preview').count());
  // SUGGEST tab
  await h.t('tab-suggest').click(); await page.waitForTimeout(800);
  L('SUGGEST PANEL:\n' + await h.t('panel').innerText()); await h.shot('e25-suggest-tab');
  if (await h.t('suggest-goal').count()) { await h.t('suggest-goal').fill('공부하기 좋게'); await page.waitForTimeout(200); L('run', (await h.t('suggest-run').count()) ? await h.t('suggest-run').isDisabled() : 'no run btn', 'manual', await h.t('suggest-manual').count(), 'blocker', (await h.t('suggest-blocker').count()) ? await h.t('suggest-blocker').innerText() : null); }
  if (await h.t('suggest-paste').count()) { await h.t('suggest-paste').fill('아무말'); await h.t('suggest-paste-apply').click(); await page.waitForTimeout(300); L('paste garbage ->', (await h.t('suggest-error').count()) ? await h.t('suggest-error').innerText() : null); await h.shot('e26-suggest-error'); }
  L('all non-asset reqs', reqs);
  L('LOGS', h.logs.filter((x) => !/ReadPixels|THREE.Clock/.test(x)));
  await h.browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
