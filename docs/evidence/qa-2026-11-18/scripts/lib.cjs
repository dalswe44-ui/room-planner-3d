const { chromium } = require(process.cwd() + '/node_modules/playwright');
const EV = process.cwd() + '/docs/evidence/qa-2026-11-18';
const URL = process.env.APP_URL || 'http://localhost:4541/';
async function open(opts = {}) {
  const browser = await chromium.launch({ channel: 'chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, locale: 'ko-KR', ...opts });
  const page = await ctx.newPage();
  const logs = [];
  page.on('console', (m) => { if (['error', 'warning'].includes(m.type())) logs.push(`[console.${m.type()}] ${m.text()}`); });
  page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
  page.on('requestfailed', (r) => logs.push(`[reqfailed] ${r.url()}`));
  page.on('response', (r) => { if (r.status() >= 400) logs.push(`[http ${r.status()}] ${r.url()}`); });
  await page.goto(URL);
  await page.waitForFunction(() => { try { return !!window.__sceneProbe.snapshot().room; } catch { return false; } });
  const h = {
    browser, ctx, page, logs,
    snap: () => page.evaluate(() => window.__sceneProbe.snapshot()),
    f2c: (x, z) => page.evaluate(([x, z]) => window.__sceneProbe.floorToClient(x, z), [x, z]),
    shot: (name, o = {}) => page.screenshot({ path: `${EV}/${name}.png`, ...o }),
    t: (id) => page.getByTestId(id),
    enter: async (id, v) => { const i = page.getByTestId(id); await i.fill(v); await i.press('Enter'); },
    err: async (id) => { const e = page.getByTestId(id + '-error'); return (await e.count()) && (await e.isVisible()) ? (await e.innerText()) : null; },
    drag: async (a, b, steps = 12) => { const p = await h.f2c(a.x, a.z), q = await h.f2c(b.x, b.z); await page.mouse.move(p.x, p.y); await page.mouse.down(); await page.mouse.move(q.x, q.y, { steps }); await page.mouse.up(); },
    tap: async (x, z) => { const p = await h.f2c(x, z); await page.mouse.click(p.x, p.y); },
    items: async () => (await h.snap()).items.map((i) => ({ n: i.name, c: [i.center.x, i.center.z], s: [i.size.w, i.size.d, i.size.h], r: i.rotationDeg, sel: i.selected, warn: i.warning })),
  };
  return h;
}
module.exports = { open, EV, URL };
