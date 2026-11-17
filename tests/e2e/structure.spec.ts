// T-037: docs/SPEC.md 4-4 벽·문·구역 WL-1~4, DR-W1~3, WN-1, LB-1, ST-1. 데스크톱·모바일 폭에서 모두 돈다.
// 위치는 probe(mm)로 확인한다. 평면 뷰의 문짝 선·열림 호, 3D의 창 구멍은 캔버스 그림이라 probe에 없어 스크린샷을 첨부만 한다.
import { expect, test, type Page } from '@playwright/test';
import { addA, dragFloor, dragItemTo, expectNear, itemById, openApp, snapMm, snapshot, tapFloor, VIEWPORTS } from './helpers';

const STORAGE_KEY = 'room-planner-3d/project';

const structureTab = async (page: Page) => {
  await page.getByTestId('tab-structure').click();
  await expect.poll(async () => (await snapshot(page)).editMode).toBe('structure');
};
const mainTab = async (page: Page) => {
  await page.getByTestId('tab-main').click();
  await expect.poll(async () => (await snapshot(page)).editMode).toBe('furniture');
};

/**
 * 구조 탭에서 (1800,z0)→(1810,2000)을 끌어 세로 칸막이 벽을 만든다.
 * SPEC은 z0=0이지만 그 자리에서 시작하면 바깥 벽 0이 눌려 벽이 안 생긴다(defects.md D-T037-1). 다른 항목은 z0=100으로 우회한다.
 */
async function drawPartition(page: Page, z0 = 100): Promise<void> {
  await structureTab(page);
  await dragFloor(page, { x: 1800, z: z0 }, { x: 1810, z: 2000 }, 20);
  await expect.poll(async () => (await snapshot(page)).walls.length).toBe(1);
}

/** 바깥 벽 0(위쪽 벽)을 눌러 고른다. 벽은 바깥쪽으로 그려지므로 z=-50을 누른다. */
async function selectOuterWall0(page: Page): Promise<void> {
  await structureTab(page);
  await tapFloor(page, { x: 600, z: -50 });
  await expect(page.getByTestId('outer-wall-card')).toBeVisible();
}

async function selectOpeningAt(page: Page, p: { x: number; z: number }): Promise<void> {
  await structureTab(page);
  if (await page.getByTestId('opening-card').isVisible()) return;
  await tapFloor(page, p);
  await expect(page.getByTestId('opening-card')).toBeVisible();
}

const mid = (o: { from: { x: number; z: number }; to: { x: number; z: number } }) => ({ x: (o.from.x + o.to.x) / 2, z: (o.from.z + o.to.z) / 2 });

for (const vp of VIEWPORTS) {
  test.describe(`[${vp.name}] 벽·문·구역`, () => {
    test.use({ viewport: vp.size });
    test.beforeEach(async ({ page }) => {
      await openApp(page);
    });

    test('WL-1b (우회) z=100에서 시작하면 칸막이가 생기고 되돌리기 한 번에 사라진다', async ({ page }) => {
      await drawPartition(page);
      const w = (await snapshot(page)).walls[0]!;
      await expectNear(page, w.a, { x: 1800, z: 100 });
      await expectNear(page, w.b, { x: 1800, z: 2000 });
      expect(w.thickness).toBe(100);
      await page.getByTestId('undo').click();
      await expect.poll(async () => (await snapshot(page)).walls.length).toBe(0);
    });

    test('WL-1 끌어서 세로 칸막이 벽, 두께 100, 되돌리기 한 번에 사라짐', async ({ page }) => {
      await drawPartition(page, 0);
      const w = (await snapshot(page)).walls[0]!;
      await expectNear(page, w.a, { x: 1800, z: 0 });
      await expectNear(page, w.b, { x: 1800, z: 2000 });
      expect(w.thickness).toBe(100);
      await page.getByTestId('undo').click();
      await expect.poll(async () => (await snapshot(page)).walls.length).toBe(0);
    });

    test('WL-2 칸막이와 겹치면 경고(문구에 벽), 면에 맞닿으면 경고 없음', async ({ page }) => {
      await drawPartition(page);
      await mainTab(page);
      const a = await addA(page);
      await dragItemTo(page, a, { x: 1800, z: 1000 });
      await expect.poll(async () => (await itemById(page, a)).warning).toBe(true);
      await expect(page.getByTestId('item-status')).toContainText('벽');
      // 왼쪽 면(x 1750)에 오른쪽 변이 닿는 자리
      // 가구 중심은 칸막이 위라 눌러도 벽이 잡힌다(관찰: 아래 보고서). 벽에서 떨어진 왼쪽 부분을 잡아 끈다.
      await dragFloor(page, { x: 1400, z: 1000 }, { x: 850, z: 1000 }, 20);
      const it = await itemById(page, a);
      expect(it.center.x + it.size.w / 2).toBe(1750);
      expect(it.warning).toBe(false);
      await expect(page.getByTestId('item-status')).toHaveCount(0);
    });

    test('WL-3 칸막이 면 가까이 끌면 붙는다', async ({ page }) => {
      await drawPartition(page);
      await mainTab(page);
      const a = await addA(page);
      const off = Math.round((await snapMm(page)) / 2);
      await dragItemTo(page, a, { x: 1250 - off, z: 1000 });
      const it = await itemById(page, a);
      expect(it.center.x + it.size.w / 2, '오른쪽 변이 벽 면 1750에 붙음').toBe(1750);
      expect(it.warning).toBe(false);
    });

    test('WL-4 벽까지 거리는 그 방향의 가장 가까운 벽 면(칸막이 포함)', async ({ page }) => {
      await drawPartition(page);
      await mainTab(page);
      const a = await addA(page);
      await dragItemTo(page, a, { x: 1250, z: 1000 });
      let it = await itemById(page, a);
      const maxX = it.center.x + it.size.w / 2;
      expect(maxX).toBe(1750);
      // 오른쪽(item-dist-1): 칸막이 면까지 0. 바깥 벽까지(1850)가 아니다.
      await expect(page.getByTestId('item-dist-1')).toHaveText('0');
      // 칸막이 끝(z 2000)보다 아래로 내리면 오른쪽 벽은 바깥 벽
      await dragItemTo(page, a, { x: 1000, z: 2650 });
      it = await itemById(page, a);
      expect(it.center.z - it.size.d / 2, '칸막이 끝보다 아래').toBeGreaterThan(2000);
      const snap = await snapshot(page);
      const expectRight = snap.room.width - (it.center.x + it.size.w / 2);
      await expect(page.getByTestId('item-dist-1')).toHaveText(String(expectRight));
    });

    test('DR-W1 바깥 벽 0에 문 추가(폭 900), 끌면 offset이 바뀌고 벽 밖으로 나가지 않는다', async ({ page }) => {
      await selectOuterWall0(page);
      await page.getByTestId('wall-add-door').click();
      await expect.poll(async () => (await snapshot(page)).openings.length).toBe(1);
      let o = (await snapshot(page)).openings[0]!;
      expect(o.type).toBe('door');
      expect(Math.hypot(o.to.x - o.from.x, o.to.z - o.from.z)).toBe(900);
      expect(o.from.z).toBe(0);
      await page.screenshot({ path: test.info().outputPath(`DR-W1-plan-${vp.name}.png`) });
      const before = o.from.x;
      await dragFloor(page, mid(o), { x: mid(o).x - 700, z: 0 }, 20);
      await expect.poll(async () => (await snapshot(page)).openings[0]!.from.x).toBeLessThan(before - 400);
      // 벽 왼쪽 끝을 넘게 끌어도 0 ~ 3600 안에 머문다
      await dragFloor(page, mid((await snapshot(page)).openings[0]!), { x: -400, z: 0 }, 20);
      o = (await snapshot(page)).openings[0]!;
      expect(o.from.x).toBeGreaterThanOrEqual(0);
      expect(o.to.x).toBeLessThanOrEqual(3600);
      expect(o.from.x).toBeLessThanOrEqual(10);
    });

    test('DR-W2 문 열리는 자리의 가구는 경고(문구에 문), 열리는 방향을 바꾸면 따라 바뀐다', async ({ page }) => {
      await selectOuterWall0(page);
      await page.getByTestId('wall-add-door').click();
      await expect.poll(async () => (await snapshot(page)).openings.length).toBe(1);
      await mainTab(page);
      const a = await addA(page);
      await dragItemTo(page, a, { x: 1800, z: 450 });
      await expect.poll(async () => (await itemById(page, a)).warning).toBe(true);
      await expect(page.getByTestId('item-status')).toContainText('문');
      // 여는 방향을 바깥으로 → 방 안 가구는 경고 없음(방 밖도 아님)
      await selectOpeningAt(page, { x: 1800, z: 0 });
      await page.getByTestId('opening-flip-swing').click();
      await mainTab(page);
      await expect.poll(async () => (await itemById(page, a)).warning).toBe(false);
      // 다시 안쪽으로 → 경고
      await selectOpeningAt(page, { x: 1800, z: 0 });
      await page.getByTestId('opening-flip-swing').click();
      await mainTab(page);
      await expect.poll(async () => (await itemById(page, a)).warning).toBe(true);
      // 경첩 쪽 바꾸기: 문이 쓰는 자리(사분원의 바운딩 사각형)는 같으므로 경고는 그대로
      await selectOpeningAt(page, { x: 1800, z: 0 });
      await page.getByTestId('opening-flip-hinge').click();
      await mainTab(page);
      expect((await itemById(page, a)).warning).toBe(true);
    });

    test('DR-W3 칸막이 벽에도 문, 벽을 지우면 문도 지워진다', async ({ page }) => {
      await drawPartition(page);
      const wallId = (await snapshot(page)).walls[0]!.id;
      await page.locator(`[data-testid="wall-row"][data-wall-id="${wallId}"]`).click();
      await page.getByTestId('wall-add-door').click();
      await expect.poll(async () => (await snapshot(page)).openings.length).toBe(1);
      const o = (await snapshot(page)).openings[0]!;
      expect(o.from.x).toBe(1800);
      expect(o.to.x).toBe(1800);
      await page.locator(`[data-testid="wall-row"][data-wall-id="${wallId}"]`).click();
      await page.getByTestId('wall-delete').click();
      await expect.poll(async () => (await snapshot(page)).walls.length).toBe(0);
      expect((await snapshot(page)).openings).toHaveLength(0);
    });

    test('WN-1 창문(문턱 900, 높이 1200), 가구 경고를 만들지 않는다', async ({ page }) => {
      await selectOuterWall0(page);
      await page.getByTestId('wall-add-window').click();
      await expect.poll(async () => (await snapshot(page)).openings.length).toBe(1);
      expect((await snapshot(page)).openings[0]!.type).toBe('window');
      await expect.poll(async () => {
        const p = JSON.parse((await page.evaluate((k) => localStorage.getItem(k), STORAGE_KEY)) ?? 'null');
        const o = p?.project?.room?.openings?.[0];
        return o ? [o.sill, o.height] : null;
      }).toEqual([900, 1200]);
      await page.getByTestId('view-3d').click();
      await expect.poll(async () => (await snapshot(page)).view).toBe('3d');
      await page.waitForTimeout(500);
      await page.screenshot({ path: test.info().outputPath(`WN-1-3d-${vp.name}.png`) });
      await page.getByTestId('view-2d').click();
      await expect.poll(async () => (await snapshot(page)).view).toBe('2d');
      await mainTab(page);
      const a = await addA(page);
      await dragItemTo(page, a, { x: 1800, z: 400 });
      expect((await itemById(page, a)).center.z).toBeLessThan(700);
      expect((await itemById(page, a)).warning).toBe(false);
    });

    test('LB-1 거실 이름표가 평면에 보이고 끌어 옮길 수 있다', async ({ page }) => {
      await structureTab(page);
      await page.getByTestId('label-add').click();
      await expect(page.getByTestId('label-name')).toBeVisible();
      await page.getByTestId('label-name').fill('거실');
      await page.getByTestId('label-name').press('Enter');
      await expect(page.getByTestId('area-label')).toHaveText('거실');
      await expect(page.getByTestId('area-label')).toBeVisible();
      await expect.poll(async () => (await snapshot(page)).labels.map((l) => l.name)).toEqual(['거실']);
      const from = (await snapshot(page)).labels[0]!.at;
      await dragFloor(page, from, { x: 700, z: 600 }, 20);
      await expect.poll(async () => (await snapshot(page)).labels[0]!.at.x).not.toBe(from.x);
      await expectNear(page, (await snapshot(page)).labels[0]!.at, { x: 700, z: 600 });
    });

    test('ST-1 새로 고침 뒤에도 칸막이·문·창문·이름표가 그대로', async ({ page }) => {
      await drawPartition(page);
      await selectOuterWall0(page);
      await page.getByTestId('wall-add-door').click();
      await expect.poll(async () => (await snapshot(page)).openings.length).toBe(1);
      await selectOuterWall0(page);
      await page.getByTestId('wall-add-window').click();
      await expect.poll(async () => (await snapshot(page)).openings.length).toBe(2);
      await page.getByTestId('label-add').click();
      await page.getByTestId('label-name').fill('거실');
      await page.getByTestId('label-name').press('Enter');
      await expect.poll(async () => (await snapshot(page)).labels.length).toBe(1);
      const before = await snapshot(page);
      await page.waitForTimeout(1000); // 자동 저장 대기
      await page.reload();
      await openApp(page);
      const after = await snapshot(page);
      const strip = <T extends { selected?: boolean }>(xs: T[]) => xs.map(({ selected: _s, ...r }) => r);
      expect(strip(after.walls)).toEqual(strip(before.walls));
      expect(strip(after.openings)).toEqual(strip(before.openings));
      expect(after.labels).toEqual(before.labels);
      expect(after.walls).toHaveLength(1);
      expect(after.openings.map((o) => o.type).sort()).toEqual(['door', 'window']);
      expect(after.labels[0]!.name).toBe('거실');
    });
  });
}
