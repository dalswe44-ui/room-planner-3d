const { open } = require('./lib.cjs');
const L = (...a) => console.log(...a.map((x) => typeof x === 'string' ? x : JSON.stringify(x)));
(async () => {
  const h = await open(); const { page } = h;
  // V-4: W-1 state in 3D
  for (let i = 0; i < 2; i++) { await h.t('furniture-name').fill('B'); await h.t('furniture-w').fill('1000'); await h.t('furniture-d').fill('1000'); await h.t('furniture-h').fill('500'); await h.t('furniture-h').press('Tab'); await h.t('furniture-add').click(); }
  L('two B', await h.items(), 'status', (await h.t('item-status').count()) ? await h.t('item-status').innerText() : null);
  // SPEC says "B를 두 번 추가(둘 다 방 가운데) → 둘 다 warning true"
  await h.t('view-3d').click(); await page.waitForTimeout(800); await h.shot('v01-V4-3d');
  await h.t('view-2d').click(); await page.waitForTimeout(400);
  // F-5 color
  if (await h.t('item-color').count()) { L('color input', await h.t('item-color').evaluate((e) => [e.tagName, e.type, e.value])); await h.t('item-color').evaluate((e) => { const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; set.call(e, '#ff0000'); e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); }); await page.waitForTimeout(300); L('probe color', (await h.snap()).items.map((i) => i.color)); await h.shot('v02-F5-color'); }
  // structure visuals
  await h.t('tab-structure').click(); await page.waitForTimeout(300);
  await h.tap(900, -50); await h.t('wall-add-door').first().click(); await page.waitForTimeout(300);
  await h.tap(3650, 1500); await page.waitForTimeout(300); L('wall1 card', await h.t('outer-wall-card').count());
  await h.t('wall-add-window').first().click(); await page.waitForTimeout(300);
  await h.shot('v03-door-window-2d');
  await h.t('view-3d').click(); await page.waitForTimeout(900); await h.shot('v04-door-window-3d');
  await h.t('view-walk').click(); await page.waitForTimeout(900);
  const cb = await h.t('scene-canvas').boundingBox(); const cx = cb.x + cb.width / 2, cy = cb.y + cb.height / 2;
  await h.shot('v05-walk-initial');
  await page.mouse.move(cx, cy); await page.mouse.down(); await page.mouse.move(cx, cy - 200, { steps: 8 }); await page.mouse.up(); await page.waitForTimeout(400); await h.shot('v06-walk-look-vertical'); L('eye after vertical drag', (await h.snap()).eye);
  for (let i = 0; i < 3; i++) { await page.mouse.move(cx, cy); await page.mouse.down(); await page.mouse.move(cx + 400, cy, { steps: 8 }); await page.mouse.up(); await page.waitForTimeout(300); await h.shot('v07-walk-turn' + i); }
  // SUGGEST manual path with valid answer
  await h.t('tab-suggest').click(); await page.waitForTimeout(500);
  await h.t('suggest-example').first().click(); L('goal after example', await h.t('suggest-goal').inputValue());
  L('prompt text head', (await h.t('suggest-prompt-text').count()) ? (await h.t('suggest-prompt-text').evaluate((e) => e.value || e.innerText)).slice(0, 1500) : 'no prompt text el');
  await h.browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
