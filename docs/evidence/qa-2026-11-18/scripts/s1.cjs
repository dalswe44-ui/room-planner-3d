const { open } = require('./lib.cjs');
(async () => {
  const t0 = Date.now();
  const h = await open(); const { page } = h;
  console.log('load ms', Date.now() - t0);
  await page.waitForTimeout(800);
  await h.shot('e01-first-screen-desktop');
  console.log('PANEL TEXT:\n' + await h.t('panel').innerText());
  console.log('SCENE TEXT:\n' + await h.t('scene').innerText());
  console.log('focus on load:', await page.evaluate(() => document.activeElement?.tagName));
  // room inputs
  const vals = ['', '0', '-100', 'abc', '1m20cm', '3.5', '99999999', '1e3', '３６００', '3,600', '3600mm', '360 cm', '12ft', '3600.4', '3600.5', ' 4.6 M ', '4000'];
  for (const v of vals) {
    await h.enter('room-width', v);
    const s = await h.snap();
    console.log(JSON.stringify(v), '-> probe', s.room.width, '| field', JSON.stringify(await h.t('room-width').inputValue()), '| err', await h.err('room-width'), '| warn', (await h.t('room-unit-warning').count()) ? await h.t('room-unit-warning').innerText() : null);
    if (v === 'abc') await h.shot('e02-room-width-error');
  }
  await h.enter('room-width', '800'); await h.shot('e03-unit-warning');
  console.log('warn800:', await h.t('room-unit-warning').innerText());
  // error state then blur: does field keep invalid text?
  await h.t('room-width').fill('abc'); await h.t('room-depth').focus();
  console.log('after blur invalid: field', await h.t('room-width').inputValue(), 'err', await h.err('room-width'));
  await page.keyboard.press('Escape');
  await h.enter('room-width', '3600');
  // height vs furniture height
  await h.enter('room-height', '1800');
  // units
  for (const u of ['cm', 'm', 'mm']) { await h.t('unit-' + u).click(); console.log(u, await h.t('room-width').inputValue(), await h.t('room-depth').inputValue(), await h.t('room-height').inputValue(), await h.t('room-dim-width').innerText()); }
  await h.t('unit-m').click(); await h.enter('room-width', '3600'); console.log('m 3600 err:', await h.err('room-width'));
  await h.enter('room-width', '4'); console.log('m 4 ->', (await h.snap()).room.width);
  await h.t('unit-mm').click();
  // attributes of input
  console.log('input attrs', await h.t('room-width').evaluate((e) => ({ type: e.type, inputmode: e.inputMode, label: e.labels?.[0]?.innerText, ariaInvalid: e.getAttribute('aria-invalid'), describedby: e.getAttribute('aria-describedby'), ph: e.placeholder })));
  console.log('LOGS', h.logs);
  await h.browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
