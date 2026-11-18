// 2026-11-18 QA 결함 수정의 e2e(2026-11-19 추가): SPEC 4-4 DR-W4, RF-1, RF-2, 4-7 WK-5, 5절 S-4의 깨진 파일.
// 수정 보고서(docs/reports/fix-qa-1118.md)가 "e2e는 아직 없음"으로 남긴 것을 채운다. 데스크톱·모바일 폭에서 모두 돈다.
import { expect, test, type Page } from '@playwright/test';
import { addA, dragFloor, enter, expectNear, itemById, openApp, snapshot, tapFloor, VIEWPORTS } from './helpers';

const structureTab = async (page: Page) => {
  await page.getByTestId('tab-structure').click();
  await expect.poll(async () => (await snapshot(page)).editMode).toBe('structure');
};
const mainTab = async (page: Page) => {
  await page.getByTestId('tab-main').click();
  await expect.poll(async () => (await snapshot(page)).editMode).toBe('furniture');
};
/** 위쪽 바깥 벽을 누른다. 이미 있는 문·창문을 피해 벽의 빈 곳(50 mm 간격으로 찾음)을 누른다. */
async function selectOuterWall0(page: Page): Promise<void> {
  await structureTab(page);
  const spans = (await snapshot(page)).openings.map((o) => [Math.min(o.from.x, o.to.x), Math.max(o.from.x, o.to.x)]);
  let x = 50;
  while (spans.some(([a, b]) => x >= a - 60 && x <= b + 60)) x += 50;
  await tapFloor(page, { x, z: -50 });
  await expect(page.getByTestId('outer-wall-card')).toBeVisible();
}

for (const vp of VIEWPORTS) {
  test.describe(`[${vp.name}] QA 1118 수정`, () => {
    test.use({ viewport: vp.size });
    test.beforeEach(async ({ page }) => {
      await openApp(page);
    });

    test('DR-W4 같은 벽에 문을 두 번 넣으면 둘째는 빈 구간에 놓이고, 자리가 없으면 넣지 않는다', async ({ page }) => {
      await selectOuterWall0(page);
      await page.getByTestId('wall-add-door').click();
      await expect.poll(async () => (await snapshot(page)).openings.length).toBe(1);
      await selectOuterWall0(page);
      await page.getByTestId('wall-add-door').click();
      await expect.poll(async () => (await snapshot(page)).openings.length).toBe(2);
      const [a, b] = (await snapshot(page)).openings;
      const span = (o: typeof a) => [Math.min(o.from.x, o.to.x), Math.max(o.from.x, o.to.x)];
      const [a0, a1] = span(a);
      const [b0, b1] = span(b);
      expect(Math.min(a1, b1) - Math.max(a0, b0), '두 문이 겹치지 않는다').toBeLessThanOrEqual(0);
      // 계속 넣으면 언젠가 빈 구간이 900보다 좁아진다. 그때는 넣지 않고 알린다.
      let count = 2;
      for (let i = 0; i < 4; i++) {
        await selectOuterWall0(page);
        await page.getByTestId('wall-add-door').click();
        if (await page.getByTestId('wall-opening-full').isVisible()) break;
        count += 1;
        await expect.poll(async () => (await snapshot(page)).openings.length).toBe(count);
      }
      await expect(page.getByTestId('wall-opening-full')).toBeVisible();
      const all = (await snapshot(page)).openings;
      expect(all.length).toBe(count);
      for (let i = 0; i < all.length; i++)
        for (let j = i + 1; j < all.length; j++) {
          const [p0, p1] = span(all[i]!);
          const [q0, q1] = span(all[j]!);
          expect(Math.min(p1, q1) - Math.max(p0, q0), `문 ${i}와 ${j}가 겹치지 않는다`).toBeLessThanOrEqual(0);
        }
    });

    test('RF-1 방을 줄이면 밖으로 나간 칸막이는 지워지고 문은 벽 안으로 옮겨지며, 되돌리기 한 번에 돌아온다', async ({ page }) => {
      await structureTab(page);
      await dragFloor(page, { x: 1800, z: 100 }, { x: 1810, z: 2000 }, 20);
      await expect.poll(async () => (await snapshot(page)).walls.length).toBe(1);
      const wall = (await snapshot(page)).walls[0]!;
      await selectOuterWall0(page);
      await page.getByTestId('wall-add-door').click();
      await expect.poll(async () => (await snapshot(page)).openings.length).toBe(1);
      expect((await snapshot(page)).openings[0]!.from).toEqual({ x: 1350, z: 0 });
      await mainTab(page);
      await enter(page, 'room-width', '1000');
      await expect.poll(async () => (await snapshot(page)).room.width).toBe(1000);
      const after = await snapshot(page);
      expect(after.walls).toHaveLength(0);
      expect(after.openings[0]!.from).toEqual({ x: 100, z: 0 });
      expect(after.openings[0]!.to).toEqual({ x: 1000, z: 0 });
      await expect(page.getByTestId('room-fit-note')).toBeVisible();
      await expect(page.getByTestId('room-fit-note')).toContainText('지웠습니다');
      await page.getByTestId('undo').click();
      await expect.poll(async () => (await snapshot(page)).room.width).toBe(3600);
      const back = await snapshot(page);
      expect(back.walls).toHaveLength(1);
      expect(back.walls[0]!.a).toEqual(wall.a);
      expect(back.walls[0]!.b).toEqual(wall.b);
      expect(back.openings[0]!.from).toEqual({ x: 1350, z: 0 });
      expect(back.openings[0]!.to).toEqual({ x: 2250, z: 0 });
    });

    test('RF-2 가로 칸막이는 방 안으로 잘리고, 100 mm보다 짧아지면 지워진다', async ({ page }) => {
      await structureTab(page);
      await dragFloor(page, { x: 500, z: 1500 }, { x: 3000, z: 1500 }, 20);
      await expect.poll(async () => (await snapshot(page)).walls.length).toBe(1);
      const w0 = (await snapshot(page)).walls[0]!;
      await expectNear(page, w0.a, { x: 500, z: 1500 });
      await mainTab(page);
      await enter(page, 'room-width', '2000');
      await expect.poll(async () => (await snapshot(page)).room.width).toBe(2000);
      const cut = (await snapshot(page)).walls[0]!;
      expect(cut.a).toEqual(w0.a);
      expect(cut.b).toEqual({ x: 2000, z: w0.b.z });
      await expect(page.getByTestId('room-fit-note')).toContainText('잘랐습니다');
      await enter(page, 'room-width', String(w0.a.x + 50));
      await expect.poll(async () => (await snapshot(page)).walls.length).toBe(0);
      await expect(page.getByTestId('room-fit-note')).toContainText('지웠습니다');
    });

    test('WK-5 사람 뷰에서는 패널이 잠기고 방향키로 가구가 움직이지 않는다', async ({ page }) => {
      const a = await addA(page);
      const before = await itemById(page, a);
      await page.getByTestId('view-walk').click();
      await expect.poll(async () => (await snapshot(page)).view).toBe('walk');
      await expect(page.getByTestId('walk-edit-locked')).toBeVisible();
      await expect(page.getByTestId('preset-chair')).toBeDisabled();
      await expect(page.getByTestId('furniture-add')).toBeDisabled();
      await expect(page.getByTestId('room-width')).toBeDisabled();
      await expect(page.getByTestId('item-row')).toBeDisabled();
      await page.locator('body').press('ArrowRight');
      await page.locator('body').press('ArrowRight');
      const after = await itemById(page, a);
      expect(after.center).toEqual(before.center);
      expect(after.selected).toBe(false);
      await page.getByTestId('view-2d').click();
      await expect(page.getByTestId('walk-edit-locked')).toHaveCount(0);
      await expect(page.getByTestId('preset-chair')).toBeEnabled();
    });

    test('S-4 깨진 사진 파일은 오류 문구를 보이고 보관하지 않는다(D-1118-01)', async ({ page }) => {
      await page.getByTestId('tab-photo').click();
      await page.getByTestId('photo-file').setInputFiles({ name: 'fake.png', mimeType: 'image/png', buffer: Buffer.from('this is not a png') });
      await expect(page.getByTestId('photo-file-error')).toBeVisible();
      await expect(page.getByTestId('photo-preview')).toHaveCount(0);
      await expect(page.getByTestId('photo-remove')).toHaveCount(0);
      await page.reload();
      await page.getByTestId('tab-photo').click();
      await expect(page.getByTestId('photo-file')).toHaveCount(1);
      await expect(page.getByTestId('photo-preview')).toHaveCount(0);
    });
  });
}
