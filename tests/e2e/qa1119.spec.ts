// 2026-11-19 처음 사용자 보완(QA 보고서 4절)과 부족한 기능(5절): docs/SPEC.md 4-8절의 체크리스트.
// 테스트 이름 앞의 ID가 체크리스트 항목이다. 데스크톱 1280×800과 모바일 360×740에서 모두 돈다.
import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { addA, addB, addItem, dragItemTo, enter, floorToClient, itemById, mmPerPixel, openApp, snapshot, tapFloor, VIEWPORTS } from './helpers';

const DEFAULT_ROOM = { width: 3600, depth: 3000, ceilingHeight: 2400 };

/** 1×1 빨간 PNG */
const PNG_1PX = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==', 'base64');

async function openMenu(page: Page) {
  if (!(await page.getByTestId('project-menu-panel').isVisible())) await page.getByTestId('project-menu').click();
  await expect(page.getByTestId('project-menu-panel')).toBeVisible();
}

const rect = async (page: Page, testId: string, nth = 0) => {
  const box = await page.getByTestId(testId).nth(nth).boundingBox();
  if (!box) throw new Error(`${testId} 없음`);
  return box;
};
const intersects = (a: { x: number; y: number; width: number; height: number }, b: { x: number; y: number; width: number; height: number }) =>
  Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x) > 1 && Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y) > 1;

/** 화면 캡처에서 몇 점의 색(r, g, b)을 읽는다 */
async function pixels(page: Page, points: { x: number; y: number }[]): Promise<number[][]> {
  await page.waitForTimeout(300);
  const png = (await page.screenshot()).toString('base64');
  return page.evaluate(
    async ([b64, pts]) => {
      const img = new Image();
      img.src = `data:image/png;base64,${b64}`;
      await img.decode();
      const cv = document.createElement('canvas');
      cv.width = img.width;
      cv.height = img.height;
      const ctx = cv.getContext('2d')!;
      ctx.drawImage(img, 0, 0);
      return (pts as { x: number; y: number }[]).map((p) => Array.from(ctx.getImageData(Math.round(p.x), Math.round(p.y), 1, 1).data.slice(0, 3)));
    },
    [png, points] as const,
  );
}
const lum = ([r, g, b]: number[]) => 0.299 * r! + 0.587 * g! + 0.114 * b!;

for (const vp of VIEWPORTS) {
  const mobile = vp.name === 'mobile';
  test.describe(`[${vp.name}] QA 1119 보완·기능`, () => {
    test.use({ viewport: vp.size });
    test.beforeEach(async ({ page }) => {
      await openApp(page);
    });

    test('GS-1 첫 화면 세 단계 안내, 닫으면 새로 고침 뒤에도 없음, 배치도 사진 탭 안내', async ({ page }) => {
      await expect(page.getByTestId('first-steps')).toBeVisible();
      await expect(page.getByTestId('first-steps')).toContainText('방 치수');
      await expect(page.getByTestId('first-steps')).toContainText('가구 추가');
      await expect(page.getByTestId('tab-photo')).toHaveText('배치도 사진');
      await page.getByTestId('first-steps-photo').click();
      await expect(page.getByTestId('tab-photo')).toHaveAttribute('aria-selected', 'true');
      await expect(page.getByTestId('photo-kind-hint')).toContainText('실내 사진');
      await page.getByTestId('tab-main').click();
      await page.getByTestId('first-steps-close').click();
      await expect(page.getByTestId('first-steps')).toHaveCount(0);
      await page.reload();
      await openApp(page);
      await expect(page.getByTestId('first-steps')).toHaveCount(0);
      // 가로 스크롤이 생기지 않는다(헤더에 파일 메뉴가 늘었다)
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    });

    test('SV-4 자동 저장 표시: 처음은 켜짐, 바꾸면 저장됨', async ({ page }) => {
      const badge = page.getByTestId('save-status');
      await expect(badge).toHaveAttribute('data-status', 'idle');
      await enter(page, 'room-width', '4000');
      await expect(badge).toHaveAttribute('data-status', 'saved');
      await expect(badge).toHaveText('자동 저장됨');
      if (!mobile) await expect(badge).toBeVisible();
    });

    test('NW-1 새로 시작은 확인 줄을 거치고, 되돌리기 한 번에 돌아온다', async ({ page }) => {
      await addA(page);
      await enter(page, 'room-width', '4000');
      await openMenu(page);
      await page.getByTestId('project-new').click();
      await expect(page.getByTestId('project-confirm')).toBeVisible();
      await page.getByTestId('project-confirm-cancel').click();
      await expect(page.getByTestId('project-confirm')).toHaveCount(0);
      expect((await snapshot(page)).items).toHaveLength(1);
      await page.getByTestId('project-new').click();
      await page.getByTestId('project-confirm-ok').click();
      await expect.poll(async () => (await snapshot(page)).items.length).toBe(0);
      expect((await snapshot(page)).room).toEqual(DEFAULT_ROOM);
      await page.getByTestId('project-menu').click(); // 닫기
      await page.getByTestId('undo').click();
      await expect.poll(async () => (await snapshot(page)).items.length).toBe(1);
      expect((await snapshot(page)).room.width).toBe(4000);
    });

    test('EX-1 (S-3) 예시 방: 4200 × 3300 × 2400, 가구 5개, 경고 없음', async ({ page }) => {
      await openMenu(page);
      await page.getByTestId('project-example').click();
      await page.getByTestId('project-confirm-ok').click();
      await expect.poll(async () => (await snapshot(page)).room).toEqual({ width: 4200, depth: 3300, ceilingHeight: 2400 });
      const snap = await snapshot(page);
      expect(snap.items).toHaveLength(5);
      expect(snap.items.every((i) => !i.warning)).toBe(true);
      expect(snap.openings).toHaveLength(2);
    });

    test('IO-1 (S-5) 파일로 저장한 JSON은 Project 형식·정수이고 probe와 같으며, 불러오기로 되살린다', async ({ page }) => {
      const a = await addA(page);
      await dragItemTo(page, a, { x: 1000, z: 800 });
      const before = await snapshot(page);
      await openMenu(page);
      const [download] = await Promise.all([page.waitForEvent('download'), page.getByTestId('project-export').click()]);
      expect(download.suggestedFilename()).toBe('room-plan.json');
      const text = readFileSync((await download.path())!, 'utf8');
      const saved = JSON.parse(text);
      expect(saved.format).toBe('room-planner-project');
      expect(saved.project.version).toBe(1);
      const item = saved.project.items[0];
      for (const k of ['w', 'd', 'h', 'x', 'z', 'rotationDeg', 'elevation']) expect(Number.isInteger(item[k]), k).toBe(true);
      const probeItem = before.items[0]!;
      expect({ x: item.x, z: item.z, w: item.w, d: item.d, h: item.h }).toEqual({ x: probeItem.center.x, z: probeItem.center.z, ...probeItem.size });
      // 방과 가구를 바꾼 뒤 그 파일을 불러온다
      await page.getByTestId('project-menu').click();
      await enter(page, 'room-width', '5000');
      await page.getByTestId('item-delete').click();
      await expect.poll(async () => (await snapshot(page)).items.length).toBe(0);
      await openMenu(page);
      await page.getByTestId('project-import-file').setInputFiles({ name: 'room-plan.json', mimeType: 'application/json', buffer: Buffer.from(text) });
      await expect(page.getByTestId('project-note')).toContainText('불러왔습니다');
      await expect.poll(async () => (await snapshot(page)).room.width).toBe(3600);
      expect((await snapshot(page)).items[0]!.center).toEqual(probeItem.center);
      // 깨진 파일은 알리고 바꾸지 않는다
      await page.getByTestId('project-import-file').setInputFiles({ name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from('{"version":1}') });
      await expect(page.getByTestId('project-note')).toContainText('프로젝트 파일이 아닙니다');
      expect((await snapshot(page)).items).toHaveLength(1);
    });

    test('WK-6 사람 뷰는 모서리에서 방 가운데를 보고 시작하고, 방향키로 걷고 돈다', async ({ page }) => {
      await enter(page, 'room-width', '6000');
      await enter(page, 'room-depth', '4000');
      await expect.poll(async () => (await snapshot(page)).room.width).toBe(6000);
      await page.getByTestId('view-walk').click();
      await expect.poll(async () => (await snapshot(page)).view).toBe('walk');
      const e0 = (await snapshot(page)).eye!;
      expect({ x: e0.x, z: e0.z }).toEqual({ x: 600, z: 3400 });
      expect([0, 90, 180, 270]).not.toContain(e0.headingDeg);
      await page.locator('body').press('ArrowUp');
      await expect.poll(async () => Math.round(Math.hypot((await snapshot(page)).eye!.x - e0.x, (await snapshot(page)).eye!.z - e0.z))).toBeGreaterThan(250);
      const e1 = (await snapshot(page)).eye!;
      expect(e1.headingDeg).toBe(e0.headingDeg);
      await page.locator('body').press('ArrowLeft');
      await expect.poll(async () => (await snapshot(page)).eye!.headingDeg).toBe((e0.headingDeg + 15) % 360);
      await page.locator('body').press('d');
      await expect.poll(async () => (await snapshot(page)).eye!.x).not.toBe(e1.x);
      // 문이 있으면 문 안쪽에 선다
      await page.getByTestId('view-2d').click();
      await page.getByTestId('tab-structure').click();
      await tapFloor(page, { x: 600, z: 4050 });
      await expect(page.getByTestId('outer-wall-card')).toBeVisible();
      await page.getByTestId('wall-add-door').click();
      await expect.poll(async () => (await snapshot(page)).openings.length).toBe(1);
      const door = (await snapshot(page)).openings[0]!;
      await page.getByTestId('view-walk').click();
      await expect.poll(async () => (await snapshot(page)).view).toBe('walk');
      const e2 = (await snapshot(page)).eye!;
      expect(e2.x).toBe(Math.round((door.from.x + door.to.x) / 2));
      expect(e2.z).toBe(3400);
      expect(e2.headingDeg).toBe(0);
    });

    test('BI-1 방 밖 가구를 "방 안으로 가져오기", 위치 칸으로 옮기기', async ({ page }) => {
      const a = await addA(page);
      await dragItemTo(page, a, { x: -900, z: 1500 });
      await expect.poll(async () => (await itemById(page, a)).warning).toBe(true);
      await page.getByTestId('item-bring-inside').click();
      await expect.poll(async () => (await itemById(page, a)).center.x).toBe(500);
      expect((await itemById(page, a)).warning).toBe(false);
      await expect(page.getByTestId('item-bring-inside')).toHaveCount(0);
      await enter(page, 'item-x', '1200');
      await enter(page, 'item-z', '700');
      await expect.poll(async () => (await itemById(page, a)).center).toMatchObject({ x: 1200, z: 700 });
      await page.getByTestId('undo').click();
      await expect.poll(async () => (await itemById(page, a)).center.z).toBe(1500);
    });

    test('IN-1 입력 힌트: 쉼표·전각 숫자를 읽고, 단위 힌트와 빈 칸 문구를 보인다', async ({ page }) => {
      await enter(page, 'room-width', '4,200');
      await expect.poll(async () => (await snapshot(page)).room.width).toBe(4200);
      await expect(page.getByTestId('room-width')).toHaveValue('4200');
      await enter(page, 'room-width', '４３００');
      await expect.poll(async () => (await snapshot(page)).room.width).toBe(4300);
      await enter(page, 'room-width', '3.5');
      await expect(page.getByTestId('room-width-error')).toContainText('3.5m처럼 단위를 붙여 보세요');
      await expect(page.getByTestId('room-width-error')).toContainText('500');
      await enter(page, 'room-width', '');
      await expect(page.getByTestId('room-width-error')).toContainText('값을 넣어 주세요');
      expect((await snapshot(page)).room.width).toBe(4300);
    });

    test('KB-1 Delete로 지우고(되돌리기 가능), Escape로 선택을 푼다', async ({ page }) => {
      const a = await addA(page);
      await page.locator('body').press('Escape');
      await expect.poll(async () => (await itemById(page, a)).selected).toBe(false);
      await page.getByTestId('item-row').click();
      await page.getByTestId('item-row').press('Delete');
      await expect.poll(async () => (await snapshot(page)).items.length).toBe(0);
      await page.getByTestId('undo').click();
      await expect.poll(async () => (await snapshot(page)).items.length).toBe(1);
      await page.getByTestId('item-row').click();
      await page.locator('body').press('Backspace');
      await expect.poll(async () => (await snapshot(page)).items.length).toBe(0);
    });

    test('VW-1 평면 뷰 안내, +/− 확대, 방 전체 보기', async ({ page }) => {
      await expect(page.getByTestId('scene-hint')).toContainText('끌어');
      const o0 = await floorToClient(page, { x: 0, z: 0 });
      const m0 = await mmPerPixel(page);
      await page.getByTestId('zoom-in').click();
      await expect.poll(() => mmPerPixel(page)).toBeLessThan(m0 * 0.9);
      await page.getByTestId('zoom-out').click();
      await page.getByTestId('zoom-out').click();
      await expect.poll(() => mmPerPixel(page)).toBeGreaterThan(m0 * 1.1);
      await page.getByTestId('view-fit').click();
      await expect.poll(async () => Math.abs((await mmPerPixel(page)) - m0)).toBeLessThan(m0 * 0.01);
      const o1 = await floorToClient(page, { x: 0, z: 0 });
      expect(Math.abs(o1.x - o0.x) + Math.abs(o1.y - o0.y)).toBeLessThan(2);
      // 확대 단추는 평면 뷰의 방을 가리지 않는다
      const zoom = await rect(page, 'view-fit');
      const corner = await floorToClient(page, { x: 3600, z: 1500 });
      expect(zoom.x).toBeGreaterThan(corner.x);
    });

    test('TL-1 천장보다 높은 가구는 경고 문구와 경고 표시', async ({ page }) => {
      const a = await addA(page);
      await enter(page, 'item-h', '3000');
      await expect(page.getByTestId('item-status-ceiling')).toContainText('천장');
      await expect.poll(async () => (await itemById(page, a)).warning).toBe(true);
      await expect(page.getByTestId('warning-live')).toContainText('천장보다 높음');
      await enter(page, 'item-h', '2400');
      await expect(page.getByTestId('item-status')).toHaveCount(0);
    });

    test('TB-6 도구 막대가 도면 거리 글자, 방 치수 글자, 이웃 가구를 가리지 않는다', async ({ page }) => {
      const a = await addA(page);
      const b = await addB(page); // 빈 자리(A 위쪽)에 놓인다
      await page.locator(`[data-testid="item-row"][data-item-id="${a}"]`).click();
      await expect.poll(async () => (await itemById(page, a)).selected).toBe(true);
      await expect(page.getByTestId('item-toolbar')).toBeVisible();
      await page.waitForTimeout(300);
      const bar = await rect(page, 'item-toolbar');
      for (const id of ['scene-dist-0', 'scene-dist-1', 'scene-dist-2', 'scene-dist-3', 'room-dim-width', 'room-dim-depth']) {
        expect(intersects(bar, await rect(page, id)), `${id}와 겹침`).toBe(false);
      }
      const B = await itemById(page, b);
      const p0 = await floorToClient(page, { x: B.center.x - B.size.w / 2, z: B.center.z - B.size.d / 2 });
      const p1 = await floorToClient(page, { x: B.center.x + B.size.w / 2, z: B.center.z + B.size.d / 2 });
      expect(intersects(bar, { x: p0.x, y: p0.y, width: p1.x - p0.x, height: p1.y - p0.y }), '이웃 가구 B와 겹침').toBe(false);
    });

    test('A11Y-1 장면 설명, 탭 화살표 이동과 tabpanel, 경고 읽기 영역', async ({ page }) => {
      await addA(page);
      await expect(page.getByTestId('scene-label')).toHaveAttribute('aria-label', /평면 뷰.*가구 1개/);
      await page.getByTestId('tab-main').focus();
      await page.keyboard.press('ArrowRight');
      await expect(page.getByTestId('tab-structure')).toHaveAttribute('aria-selected', 'true');
      await expect(page.getByTestId('tab-structure')).toBeFocused();
      await expect(page.getByRole('tabpanel')).toHaveAttribute('aria-labelledby', 'tab-structure');
      await page.keyboard.press('End');
      await expect(page.getByTestId('tab-suggest')).toHaveAttribute('aria-selected', 'true');
      await page.keyboard.press('Home');
      await expect(page.getByTestId('tab-main')).toHaveAttribute('aria-selected', 'true');
      const live = page.getByTestId('warning-live');
      await expect(live).toHaveAttribute('aria-live', 'polite');
      await expect(live).toHaveText('');
      const b = await addB(page);
      const first = (await snapshot(page)).items.find((i) => i.id !== b)!;
      await dragItemTo(page, b, { x: first.center.x, z: first.center.z });
      await expect(live).toContainText('겹침');
    });

    test('PF-1 사진 파일 칸은 올린 사진이 있는지 글로 보인다', async ({ page }) => {
      await page.getByTestId('tab-photo').click();
      await expect(page.getByTestId('photo-file-state')).toHaveText('아직 올린 사진이 없어요');
      await page.getByTestId('photo-file').setInputFiles({ name: 'plan.png', mimeType: 'image/png', buffer: PNG_1PX });
      await expect(page.getByTestId('photo-preview')).toBeVisible();
      await expect(page.getByTestId('photo-file-state')).toHaveText('올린 사진이 이 브라우저에 있어요');
      await page.reload();
      await page.getByTestId('tab-photo').click();
      await expect(page.getByTestId('photo-file-state')).toHaveText('올린 사진이 이 브라우저에 있어요');
    });

    test('HC-1 경고는 색만이 아니라 빗금으로도 보인다(빨간 가구와 구별)', async ({ page }) => {
      const a = await addItem1000(page);
      await page.getByTestId('item-color').evaluate((el: HTMLInputElement) => {
        const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
        set.call(el, '#d9482b');
        el.dispatchEvent(new Event('input', { bubbles: true }));
      });
      await expect.poll(async () => (await itemById(page, a)).color).toBe('#d9482b');
      await page.locator('body').press('Escape');
      const it = await itemById(page, a);
      // 빗금 선(x - z = 60 mm) 위의 점과 두 선 사이 가운데(x - z = 0)의 점
      const on = await floorToClient(page, { x: it.center.x + 230, z: it.center.z + 170 });
      const off = await floorToClient(page, { x: it.center.x + 200, z: it.center.z + 200 });
      const [onA, offA] = await pixels(page, [on, off]);
      expect(Math.abs(lum(onA!) - lum(offA!)), `경고 없음: 선 자리 ${onA}, 사이 ${offA}`).toBeLessThan(25);
      // 천장보다 높게 해 경고로 만든다
      await page.getByTestId('item-row').click();
      await enter(page, 'item-h', '3000');
      await expect.poll(async () => (await itemById(page, a)).warning).toBe(true);
      await page.locator('body').press('Escape');
      const [onB, offB] = await pixels(page, [on, off]);
      expect(lum(offB!) - lum(onB!), `경고: 선 자리 ${onB}가 사이 ${offB}보다 어둡다`).toBeGreaterThan(25);
    });

    test('PNG-1 (5-2) 화면을 PNG로 저장', async ({ page }) => {
      await addA(page);
      await openMenu(page);
      const [download] = await Promise.all([page.waitForEvent('download'), page.getByTestId('project-png').click()]);
      expect(download.suggestedFilename()).toBe('room-plan.png');
      const bytes = readFileSync((await download.path())!);
      expect(bytes.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
      expect(bytes.length).toBeGreaterThan(2000);
    });

    test('SH-1 (5-2) 공유 링크를 새 창에서 열면 같은 배치가 보이고, 되돌리기로 쓰던 배치로 돌아간다', async ({ page, browser }) => {
      const a = await addA(page);
      await dragItemTo(page, a, { x: 1000, z: 800 });
      await enter(page, 'room-width', '4100');
      const src = await snapshot(page);
      await openMenu(page);
      await page.getByTestId('project-share').click();
      const url = await page.getByTestId('share-link-url').inputValue();
      expect(url).toContain('#p=');
      const ctx = await browser.newContext({ viewport: vp.size });
      const other = await ctx.newPage();
      await other.goto(url);
      await other.waitForFunction(() => {
        try {
          return window.__sceneProbe?.snapshot().room.width === 4100;
        } catch {
          return false;
        }
      });
      const got = await snapshot(other);
      expect(got.items.map((i) => ({ c: i.center, s: i.size }))).toEqual(src.items.map((i) => ({ c: i.center, s: i.size })));
      await expect(other.getByTestId('share-note')).toContainText('공유 링크의 배치');
      expect(new URL(other.url()).hash).toBe('');
      await other.getByTestId('undo').click();
      await expect.poll(async () => (await snapshot(other)).room.width).toBe(3600);
      await ctx.close();
    });

    test('UL-1 (5-3) 배치도 사진을 평면 뷰 밑그림으로, 진하기 조절, 3D에서는 없음', async ({ page }) => {
      await page.getByTestId('tab-photo').click();
      await page.getByTestId('photo-file').setInputFiles({ name: 'plan.png', mimeType: 'image/png', buffer: PNG_1PX });
      await expect(page.getByTestId('underlay-controls')).toBeVisible();
      expect((await snapshot(page)).underlay ?? null).toBeNull();
      await page.getByTestId('underlay-toggle').check();
      await expect.poll(async () => (await snapshot(page)).underlay).toEqual({ width: 3600, depth: 3000, opacity: 0.5 });
      await page.getByTestId('underlay-opacity').fill('80');
      await expect.poll(async () => (await snapshot(page)).underlay?.opacity).toBe(0.8);
      await page.getByTestId('view-3d').click();
      await expect.poll(async () => (await snapshot(page)).view).toBe('3d');
      expect((await snapshot(page)).underlay ?? null).toBeNull();
    });

    test('WW-1 (5-5) 가구 둘레 틈이 600 mm보다 좁으면 통로 안내', async ({ page }) => {
      const a = await addA(page);
      await enter(page, 'item-x', '500');
      await enter(page, 'item-z', '1500');
      await expect(page.getByTestId('item-walkway')).toHaveCount(0);
      const b = await addA(page);
      await enter(page, 'item-x', '1900');
      await enter(page, 'item-z', '1500');
      await expect.poll(async () => (await itemById(page, b)).center.x).toBe(1900);
      await page.getByTestId('item-row').first().click();
      expect((await itemById(page, a)).selected).toBe(true);
      await expect(page.getByTestId('item-walkway')).toContainText('오른쪽 400');
    });

    test('RT-1 (5-6) 회전 각도를 숫자로', async ({ page }) => {
      const a = await addA(page);
      await enter(page, 'item-angle', '45');
      await expect.poll(async () => (await itemById(page, a)).rotationDeg).toBe(45);
      await enter(page, 'item-angle', '400');
      await expect(page.getByTestId('item-angle-error')).toBeVisible();
      expect((await itemById(page, a)).rotationDeg).toBe(45);
      await page.getByTestId('item-rotate').click();
      await expect.poll(async () => (await itemById(page, a)).rotationDeg).toBe(135);
    });

    test('MS-1 (5-6) 여러 가구를 함께 골라 끌면 같이 움직이고 되돌리기 한 번에 돌아온다', async ({ page }) => {
      const a = await addA(page);
      const b = await addA(page);
      const a0 = await itemById(page, a);
      const b0 = await itemById(page, b);
      // b가 선택된 상태에서 "여러 개 고르기"로 a를 더한다(터치 화면 방법). 데스크톱은 Shift 누르기도 확인한다.
      if (mobile) {
        await page.getByTestId('multi-select-toggle').click();
        await tapFloor(page, { x: a0.center.x, z: a0.center.z });
        await page.getByTestId('multi-select-toggle').click();
      } else {
        const p = await floorToClient(page, { x: a0.center.x, z: a0.center.z });
        await page.keyboard.down('Shift');
        await page.mouse.click(p.x, p.y);
        await page.keyboard.up('Shift');
      }
      await expect(page.getByTestId('group-count')).toHaveText('2');
      expect((await itemById(page, a)).selected && (await itemById(page, b)).selected).toBe(true);
      await dragItemTo(page, b, { x: b0.center.x + 300, z: b0.center.z + 200 });
      const a1 = await itemById(page, a);
      const b1 = await itemById(page, b);
      expect(b1.center.x - b0.center.x).not.toBe(0);
      expect(a1.center.x - a0.center.x).toBe(b1.center.x - b0.center.x);
      expect(a1.center.z - a0.center.z).toBe(b1.center.z - b0.center.z);
      await page.getByTestId('undo').click();
      await expect.poll(async () => (await itemById(page, a)).center).toEqual(a0.center);
      expect((await itemById(page, b)).center).toEqual(b0.center);
    });
  });
}

/** 1000 × 1000 × 700 상자를 추가한다(빗금 간격 120 mm가 여러 줄 들어가는 크기) */
function addItem1000(page: Page): Promise<string> {
  return addItem(page, 'C', '1000', '1000', '700');
}
