const { open } = require('./lib.cjs');
const L = (...a) => console.log(...a.map((x) => typeof x === 'string' ? x : JSON.stringify(x)));
(async () => {
  const h = await open(); const { page } = h;
  // add form: invalid values
  for (const v of ['', '0', '-5', 'abc', '9', '10001', '60,0', '0.6']) {
    await h.t('furniture-w').fill(v); await h.t('furniture-w').press('Tab');
    const dis = await h.t('furniture-add').isDisabled();
    L('add w', v, 'err', await h.err('furniture-w'), 'addDisabled', dis, 'rows', await h.t('item-row').count());
  }
  await h.shot('e04-furniture-w-error');
  // Enter in add form w/ invalid
  await h.t('furniture-w').fill('abc'); await h.t('furniture-w').press('Enter'); L('enter invalid rows', await h.t('item-row').count());
  await h.t('furniture-w').fill('1200'); await h.t('furniture-d').fill('600'); await h.t('furniture-h').fill('720');
  await h.t('furniture-name').fill('책상'); await h.t('furniture-name').press('Enter');
  L('after Enter add', await h.items());
  L('PANEL:', await h.t('panel').innerText());
  await h.shot('e05-item-added');
  // name edge cases
  const long = '가'.repeat(120);
  await h.t('furniture-name').fill(long); await h.t('furniture-add').click();
  await h.t('furniture-name').fill('<img src=x onerror=alert(1)>'); await h.t('furniture-add').click();
  await h.t('furniture-name').fill('   '); await h.t('furniture-add').click();
  L('names', (await h.t('item-row').allInnerTexts()).map((s) => s.slice(0, 40) + '/' + s.length), (await h.items()).map((i) => [i.c, i.warn]));
  await page.waitForTimeout(300); await h.shot('e06-long-name');
  L('hscroll panel', await h.t('panel').evaluate((e) => [e.scrollWidth, e.clientWidth]), 'body', await page.evaluate(() => [document.documentElement.scrollWidth, innerWidth]));
  // taller than ceiling
  await h.t('furniture-name').fill('키큰장'); await h.t('furniture-h').fill('3000'); await h.t('furniture-add').click();
  L('tall item', (await h.items()).slice(-1), 'status', (await h.t('item-status').count()) ? await h.t('item-status').innerText() : null);
  // delete all via keyboard Delete key?
  const n0 = (await h.items()).length;
  await h.tap(100, 100); // deselect
  L('after bg tap sel', (await h.items()).filter((i) => i.sel).length);
  const it = (await h.items())[0];
  await h.tap(it.c[0], it.c[1]);
  L('tap selects', (await h.items()).filter((i) => i.sel).length);
  await page.keyboard.press('Delete'); L('Delete key ->', (await h.items()).length, 'of', n0);
  await page.keyboard.press('Backspace'); L('Backspace key ->', (await h.items()).length);
  await page.keyboard.press('Escape'); L('Escape -> sel', (await h.items()).filter((i) => i.sel).length);
  await page.keyboard.press('r'); 
  // reset: delete all through list
  while (await h.t('item-row').count()) { await h.t('item-row').first().click(); await h.t('item-delete').click(); }
  L('deleted all; confirm dialog? rows', await h.t('item-row').count());
  // undo count
  let u = 0; while (!(await h.t('undo').isDisabled()) && u < 200) { await h.t('undo').click(); u++; }
  L('undo steps to empty', u, (await h.items()).length);
  let r = 0; while (!(await h.t('redo').isDisabled()) && r < 200) { await h.t('redo').click(); r++; }
  L('redo steps', r, (await h.items()).length);
  L('LOGS', h.logs.filter((x) => !/ReadPixels|THREE.Clock/.test(x)));
  await h.browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
