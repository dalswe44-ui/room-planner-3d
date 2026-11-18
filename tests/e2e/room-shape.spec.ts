// 2026-11-19 QA 5-4: ㄱ자 방(SPEC 4-8 LS-1). 데스크톱·모바일 폭에서 모두 돈다.
import { expect, test } from '@playwright/test';
import { addA, dragItemTo, enter, itemById, openApp, snapshot, tapFloor, VIEWPORTS } from './helpers';

for (const vp of VIEWPORTS) {
  test.describe(`[${vp.name}] ㄱ자 방`, () => {
    test.use({ viewport: vp.size });
    test.beforeEach(async ({ page }) => {
      await openApp(page);
    });

    test('LS-1 ㄱ자로 바꾸면 바닥이 6각형, 빠진 칸의 가구는 방 밖, 크기를 바꿔도 모양 유지, 되돌리기', async ({ page }) => {
      expect((await snapshot(page)).floorCorners).toHaveLength(4);
      await page.getByTestId('room-shape-l').click();
      await expect.poll(async () => (await snapshot(page)).floorCorners?.length).toBe(6);
      expect((await snapshot(page)).floorCorners).toEqual([
        { x: 0, z: 0 },
        { x: 3600, z: 0 },
        { x: 3600, z: 1500 },
        { x: 1800, z: 1500 },
        { x: 1800, z: 3000 },
        { x: 0, z: 3000 },
      ]);
      expect((await snapshot(page)).room).toEqual({ width: 3600, depth: 3000, ceilingHeight: 2400 });
      await enter(page, 'room-notch-w', '1200');
      await expect.poll(async () => (await snapshot(page)).floorCorners?.[3]).toEqual({ x: 2400, z: 1500 });
      await page.getByTestId('room-notch-corner').selectOption('tl');
      await expect.poll(async () => (await snapshot(page)).floorCorners?.[0]).toEqual({ x: 1200, z: 0 });
      await page.getByTestId('room-notch-corner').selectOption('br');
      // 빠진 칸(오른쪽 아래)에 놓은 가구는 방 밖
      const a = await addA(page);
      expect((await itemById(page, a)).warning).toBe(false);
      await dragItemTo(page, a, { x: 3000, z: 2500 });
      await expect.poll(async () => (await itemById(page, a)).warning).toBe(true);
      await expect(page.getByTestId('item-status')).toContainText('방 밖');
      await page.getByTestId('item-bring-inside').waitFor();
      // 방 폭을 바꿔도 ㄱ자는 그대로
      await enter(page, 'room-width', '4000');
      await expect.poll(async () => (await snapshot(page)).floorCorners?.[1]).toEqual({ x: 4000, z: 0 });
      expect((await snapshot(page)).floorCorners).toHaveLength(6);
      // 꺾인 곳 벽의 이름
      await page.getByTestId('tab-structure').click();
      await tapFloor(page, { x: 3400, z: 1550 });
      await expect(page.getByTestId('outer-wall-card')).toContainText('꺾인 곳');
      await page.getByTestId('tab-main').click();
      await page.getByTestId('room-shape-rect').click();
      await expect.poll(async () => (await snapshot(page)).floorCorners?.length).toBe(4);
      await page.getByTestId('undo').click();
      await expect.poll(async () => (await snapshot(page)).floorCorners?.length).toBe(6);
      // 사람 뷰는 방 안(빠진 칸이 아닌 곳)에서 시작한다
      await page.getByTestId('view-walk').click();
      await expect.poll(async () => (await snapshot(page)).view).toBe('walk');
      const eye = (await snapshot(page)).eye!;
      expect(eye.x >= 4000 - 1200 && eye.z >= 1500).toBe(false);
    });
  });
}
