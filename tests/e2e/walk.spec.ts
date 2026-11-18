// T-043: 사람 뷰 WK-1~WK-4. probe.eye와 probe.view의 수치(mm, 도)로 확인한다.
import { expect, test, type Page } from '@playwright/test';
import { addA, dragItemTo, enter, floorToClient, itemById, openApp, snapshot, VIEWPORTS } from './helpers';

const eyeOf = async (page: Page) => (await snapshot(page)).eye;

async function bigRoom(page: Page): Promise<void> {
  await openApp(page);
  await enter(page, 'room-width', '6000');
  await enter(page, 'room-depth', '4000');
  await expect.poll(async () => (await snapshot(page)).room).toMatchObject({ width: 6000, depth: 4000 });
}

async function enterWalk(page: Page) {
  await page.getByTestId('view-walk').click();
  await expect.poll(async () => (await snapshot(page)).view).toBe('walk');
  const eye = await eyeOf(page);
  expect(eye).not.toBeNull();
  return eye!;
}

async function canvasBox(page: Page) {
  const box = await page.getByTestId('scene-canvas').boundingBox();
  if (!box) throw new Error('scene-canvas 없음');
  return box;
}

/** 캔버스 가운데 높이에서 dx px 가로로 끈다(가구 위가 아닌 곳을 잡는다). */
async function dragCanvas(page: Page, from: { x: number; y: number }, dx: number, dy = 0) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x + dx, from.y + dy, { steps: 10 });
  await page.mouse.up();
}

for (const vp of VIEWPORTS) {
  test.describe(`[${vp.name}] 사람 뷰`, () => {
    test.use({ viewport: vp.size });

    test('WK-1 사람 뷰: view walk, eye는 방 안 높이 1500, 평면·3D로 돌아오면 eye는 null', async ({ page }) => {
      await bigRoom(page);
      expect((await snapshot(page)).eye, '평면 뷰에서 eye null').toBeNull();
      const eye = await enterWalk(page);
      expect(eye.height).toBe(1500);
      expect(eye.x).toBeGreaterThan(0);
      expect(eye.x).toBeLessThan(6000);
      expect(eye.z).toBeGreaterThan(0);
      expect(eye.z).toBeLessThan(4000);
      expect(Number.isInteger(eye.headingDeg) && eye.headingDeg >= 0 && eye.headingDeg < 360).toBe(true);
      await page.getByTestId('view-3d').click();
      await expect.poll(async () => (await snapshot(page)).view).toBe('3d');
      expect((await snapshot(page)).eye).toBeNull();
      await enterWalk(page);
      await page.getByTestId('view-2d').click();
      await expect.poll(async () => (await snapshot(page)).view).toBe('2d');
      expect((await snapshot(page)).eye).toBeNull();
    });

    test('WK-2 가로로 끌면 headingDeg만 바뀌고 eye의 x·z, 방, 가구는 그대로', async ({ page }) => {
      await bigRoom(page);
      const a = await addA(page);
      await dragItemTo(page, a, { x: 1000, z: 3300 }); // 시야 밖 구석으로
      const room0 = (await snapshot(page)).room;
      const items0 = (await snapshot(page)).items.map((i) => ({ ...i, selected: false }));
      const eye0 = await enterWalk(page);
      const box = await canvasBox(page);
      const from = { x: box.x + box.width / 2, y: box.y + box.height / 3 };
      await dragCanvas(page, from, 120);
      await expect.poll(async () => (await eyeOf(page))!.headingDeg).not.toBe(eye0.headingDeg);
      const eye1 = (await eyeOf(page))!;
      expect(eye1.x).toBe(eye0.x);
      expect(eye1.z).toBe(eye0.z);
      expect(eye1.height).toBe(1500);
      // 반대로 끌면 되돌아온다(좌우 방향이 일관됨)
      await dragCanvas(page, from, -120);
      await expect.poll(async () => (await eyeOf(page))!.headingDeg).toBe(eye0.headingDeg);
      const snap = await snapshot(page);
      expect(snap.room).toEqual(room0);
      expect(snap.items.map((i) => ({ ...i, selected: false }))).toEqual(items0);
      expect((await eyeOf(page))!.x).toBe(eye0.x);
    });

    test('WK-3 바닥 탭은 eye를 그 자리(벽에서 띄움)로 옮기고, 가구 위를 끌어도 가구는 움직이지 않는다', async ({ page }) => {
      await bigRoom(page);
      const eye0 = await enterWalk(page);
      const box = await canvasBox(page);
      const inCanvas = (p: { x: number; y: number }) => p.x > box.x + 5 && p.x < box.x + box.width - 5 && p.y > box.y + 5 && p.y < box.y + box.height - 5;

      // 바라보는 방향(헤딩 270이면 +x)의 앞 바닥을 누른다
      const dir = eye0.headingDeg === 270 ? { x: 1, z: 0 } : eye0.headingDeg === 0 ? { x: 0, z: -1 } : null;
      expect(dir, `처음 방향 ${eye0.headingDeg}`).not.toBeNull();
      const target = { x: Math.round(eye0.x + dir!.x * 2500), z: Math.round(eye0.z + dir!.z * 2500) };
      const c = await floorToClient(page, target);
      expect(inCanvas(c), `목표 ${JSON.stringify(c)}가 화면 안`).toBe(true);
      await page.mouse.click(c.x, c.y);
      await expect.poll(async () => (await eyeOf(page))!.x, { timeout: 5000 }).not.toBe(eye0.x === target.x ? -1 : eye0.x);
      await expect.poll(async () => {
        const e = (await eyeOf(page))!;
        return Math.abs(e.x - target.x) <= 150 && Math.abs(e.z - target.z) <= 150;
      }).toBe(true);
      const eye1 = (await eyeOf(page))!;
      expect(eye1.height).toBe(1500);
      expect(eye1.headingDeg, '탭은 방향을 바꾸지 않는다').toBe(eye0.headingDeg);

      // 들어갈 때마다 처음 자리로 선다. 앞쪽 벽 가까이(x 5900)를 누르면 벽에서 400 mm 안쪽(x 5600)으로 당겨진다.
      await page.getByTestId('view-2d').click();
      await expect.poll(async () => (await snapshot(page)).view).toBe('2d');
      const eye2 = await enterWalk(page);
      expect(eye2.headingDeg).toBe(270);
      const near = { x: 5900, z: eye2.z };
      const cn = await floorToClient(page, near);
      expect(inCanvas(cn), `벽 가까운 점 ${JSON.stringify(cn)}가 화면 안`).toBe(true);
      await page.mouse.click(cn.x, cn.y);
      // 이동 애니메이션(약 0.45초)이 끝나 멈춘 자리를 본다. 도중 값을 한 번 읽으면 5300~5450 사이가 나와 실패한다(T-1118-01).
      await expect
        .poll(async () => (await eyeOf(page))!.x, { timeout: 5000 })
        .toBeGreaterThanOrEqual(5600 - 150);
      const e = (await eyeOf(page))!;
      expect(e.x).toBeLessThanOrEqual(5600 + 5);
    });

    test('WK-3b 가구 위를 끌거나 눌러도 가구의 center는 그대로이고 eye도 움직이지 않는다(끌면 방향만 바뀜)', async ({ page }) => {
      await bigRoom(page);
      const a = await addA(page);
      await dragItemTo(page, a, { x: 5300, z: 2000 });
      await expect.poll(async () => (await itemById(page, a)).center.x).toBeGreaterThan(5000);
      const A0 = await itemById(page, a);
      const eye0 = await enterWalk(page);
      expect(eye0.headingDeg).toBe(270);
      const box = await canvasBox(page);
      const c = await floorToClient(page, { x: A0.center.x, z: A0.center.z });
      expect(c.x > box.x + 5 && c.x < box.x + box.width - 60 && c.y > box.y + 5 && c.y < box.y + box.height - 5, `가구가 화면 안 ${JSON.stringify(c)}`).toBe(true);

      // 짧게 누름: 가구도 eye도 그대로
      await page.mouse.click(c.x, c.y);
      await page.waitForTimeout(800);
      expect((await itemById(page, a)).center).toEqual(A0.center);
      expect(await eyeOf(page)).toEqual(eye0);

      // 가구 위에서 끌기
      await dragCanvas(page, c, -50, 0);
      await page.waitForTimeout(300);
      const A1 = await itemById(page, a);
      expect(A1.center).toEqual(A0.center);
      expect(A1.rotationDeg).toBe(A0.rotationDeg);
      const eye1 = (await eyeOf(page))!;
      expect(eye1.x).toBe(eye0.x);
      expect(eye1.z).toBe(eye0.z);
      expect(eye1.headingDeg).not.toBe(eye0.headingDeg);
      // 평면 뷰로 돌아와도 같은 자리
      await page.getByTestId('view-2d').click();
      await expect.poll(async () => (await snapshot(page)).view).toBe('2d');
      expect((await itemById(page, a)).center).toEqual(A0.center);
    });

    test('WK-4 사람 뷰에 들어가면 선택·미리보기가 풀리고 가구 도구 막대와 도면 치수가 보이지 않는다', async ({ page }) => {
      await bigRoom(page);
      const a = await addA(page); // 추가하면 선택된다
      await expect.poll(async () => (await itemById(page, a)).selected).toBe(true);
      await expect(page.getByTestId('item-toolbar')).toBeVisible();
      await expect(page.getByTestId('room-dim-width')).toBeVisible();
      await enterWalk(page);
      expect((await itemById(page, a)).selected).toBe(false);
      await expect(page.getByTestId('item-toolbar')).toBeHidden();
      await expect(page.getByTestId('room-dim-width')).toBeHidden();
      await expect(page.getByTestId('room-dim-depth')).toBeHidden();
      await expect(page.getByTestId('scene-hint')).toContainText('끌면 둘러봐요');

      // 미리보기(draft)도 풀린다
      await page.getByTestId('view-2d').click();
      await expect.poll(async () => (await snapshot(page)).view).toBe('2d');
      await page.getByTestId('preset-desk').click();
      await expect.poll(async () => (await snapshot(page)).draft?.kind).toBe('desk');
      await expect(page.getByTestId('draft-toolbar')).toBeVisible();
      await enterWalk(page);
      expect((await snapshot(page)).draft).toBeNull();
      await expect(page.getByTestId('draft-toolbar')).toBeHidden();
      expect((await snapshot(page)).items).toHaveLength(1);
    });
  });
}
