const { open } = require('./lib.cjs');
(async () => {
  const h = await open(); const { page } = h;
  for (let i = 0; i < 2; i++) { await h.t('furniture-name').fill('B'); await h.t('furniture-w').fill('1000'); await h.t('furniture-d').fill('1000'); await h.t('furniture-h').fill('500'); await h.t('furniture-h').press('Tab'); await h.t('furniture-add').click(); }
  const its = await h.items(); await h.drag({ x: its[1].c[0], z: its[1].c[1] }, { x: 1800, z: 1500 }); await page.waitForTimeout(300);
  console.log(JSON.stringify(await h.items()), await h.t('item-status').innerText());
  await h.shot('v08-W1-overlap-2d');
  await h.t('view-3d').click(); await page.waitForTimeout(800); await h.shot('v09-V4-overlap-3d');
  await h.t('view-2d').click(); await h.t('tab-structure').click(); await page.waitForTimeout(300);
  await h.tap(600, -50); await h.t('wall-add-window').first().click(); await page.waitForTimeout(300);
  await h.t('view-3d').click(); await page.waitForTimeout(900); await h.shot('v10-WN1-window-3d');
  await h.browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
