// docs/SPEC.md 4절 완료 기준 체크리스트를 데스크톱(1280×800)과 모바일 폭(360×740)에서 확인한다.
// 테스트 이름 앞의 ID가 체크리스트 항목이다.
import { expect, test, type Page } from '@playwright/test';
import {
  addA,
  addB,
  addItem,
  distances,
  dragFloor,
  dragItemTo,
  enter,
  expectNear,
  fillAddField,
  floorToClient,
  itemById,
  mmPerPixel,
  openApp,
  pressAdd,
  snapshot,
  tapFloor,
  VIEWPORTS,
} from './helpers';

async function roomProbe(page: Page) {
  return (await snapshot(page)).room;
}

async function expectRoom(page: Page, width: number, depth: number, ceilingHeight: number) {
  await expect.poll(() => roomProbe(page)).toEqual({ width, depth, ceilingHeight });
}

/** 거부: probe.room이 그대로이고 그 칸의 오류 문구가 보인다 */
async function expectRoomRejected(page: Page, testId: string, room: { width: number; depth: number; ceilingHeight: number }) {
  await expect(page.getByTestId(`${testId}-error`)).toBeVisible();
  expect(await roomProbe(page)).toEqual(room);
}

const DEFAULT_ROOM = { width: 3600, depth: 3000, ceilingHeight: 2400 };

for (const vp of VIEWPORTS) {
  test.describe(`[${vp.name}]`, () => {
    test.use({ viewport: vp.size });
    test.beforeEach(async ({ page }) => {
      await openApp(page);
    });

    // ---------- 방 ----------
    test('R-1 기본 상태', async ({ page }) => {
      expect(await roomProbe(page)).toEqual(DEFAULT_ROOM);
      await expect(page.getByTestId('room-width')).toHaveValue('3600');
      await expect(page.getByTestId('room-depth')).toHaveValue('3000');
      await expect(page.getByTestId('room-height')).toHaveValue('2400');
      for (const id of ['room-width', 'room-depth', 'room-height']) await expect(page.getByTestId(`${id}-error`)).toHaveCount(0);
      await expect(page.getByTestId('room-unit-warning')).toHaveCount(0);
      expect((await snapshot(page)).view).toBe('2d');
    });

    test('R-2 빈 값·0·음수·글자 거부 후 4000 반영', async ({ page }) => {
      for (const v of ['', '0', '-100', 'abc', '1m20cm']) {
        await enter(page, 'room-width', v);
        await expectRoomRejected(page, 'room-width', DEFAULT_ROOM);
      }
      await enter(page, 'room-width', '4000');
      await expectRoom(page, 4000, 3000, 2400);
      await expect(page.getByTestId('room-width-error')).toHaveCount(0);
    });

    test('R-3 경계값', async ({ page }) => {
      for (const [id, key] of [['room-width', 'width'], ['room-depth', 'depth']] as const) {
        for (const v of ['499', '20001']) {
          const before = await roomProbe(page);
          await enter(page, id, v);
          await expectRoomRejected(page, id, before);
        }
        for (const v of [500, 20000]) {
          await enter(page, id, String(v));
          await expect.poll(async () => (await roomProbe(page))[key]).toBe(v);
          await expect(page.getByTestId(`${id}-error`)).toHaveCount(0);
        }
        await enter(page, id, key === 'width' ? '3600' : '3000');
      }
      await expectRoom(page, 3600, 3000, 2400);
      for (const v of ['1799', '5001']) {
        await enter(page, 'room-height', v);
        await expectRoomRejected(page, 'room-height', DEFAULT_ROOM);
      }
      for (const v of [1800, 5000]) {
        await enter(page, 'room-height', String(v));
        await expect.poll(async () => (await roomProbe(page)).ceilingHeight).toBe(v);
        await expect(page.getByTestId('room-unit-warning')).toHaveCount(0);
      }
    });

    test('R-4 mm 칸에 m로 쓴 3.5 거부, 문구에 500과 20000', async ({ page }) => {
      await enter(page, 'room-width', '3.5');
      await expectRoomRejected(page, 'room-width', DEFAULT_ROOM);
      const msg = (await page.getByTestId('room-width-error').textContent()) ?? '';
      expect(msg).toContain('500');
      expect(msg).toContain('20000');
    });

    test('R-5 단위 확인 경고', async ({ page }) => {
      for (const [id, key, reset] of [['room-width', 'width', '3600'], ['room-depth', 'depth', '3000']] as const) {
        for (const [v, warn] of [[999, true], [1000, false], [15000, false], [15001, true]] as const) {
          await enter(page, id, String(v));
          await expect.poll(async () => (await roomProbe(page))[key]).toBe(v);
          if (warn) await expect(page.getByTestId('room-unit-warning')).toContainText('단위를 확인하세요');
          else await expect(page.getByTestId('room-unit-warning')).toHaveCount(0);
        }
        await enter(page, id, reset);
      }
    });

    // ---------- 단위 ----------
    test('U-1 단위 전환은 표시만 바꾼다', async ({ page }) => {
      const steps = [
        ['unit-cm', ['360.0', '300.0', '240.0']],
        ['unit-m', ['3.600', '3.000', '2.400']],
        ['unit-mm', ['3600', '3000', '2400']],
      ] as const;
      for (const [btn, values] of steps) {
        await page.getByTestId(btn).click();
        for (const b of ['unit-mm', 'unit-cm', 'unit-m']) {
          await expect(page.getByTestId(b)).toHaveAttribute('aria-pressed', b === btn ? 'true' : 'false');
        }
        await expect(page.getByTestId('room-width')).toHaveValue(values[0]);
        await expect(page.getByTestId('room-depth')).toHaveValue(values[1]);
        await expect(page.getByTestId('room-height')).toHaveValue(values[2]);
        expect(await roomProbe(page)).toEqual(DEFAULT_ROOM);
      }
    });

    test('U-2 단위 왕복에서 저장값 불변', async ({ page }) => {
      await enter(page, 'room-width', '1234');
      const id = await addA(page);
      const room0 = await roomProbe(page);
      const a0 = await itemById(page, id);
      for (const [btn, shown] of [['unit-mm', '1234'], ['unit-cm', '123.4'], ['unit-m', '1.234'], ['unit-mm', '1234']] as const) {
        await page.getByTestId(btn).click();
        const input = page.getByTestId('room-width');
        await expect(input).toHaveValue(shown);
        await input.focus();
        await input.press('Enter');
        await expect(input).toHaveValue(shown);
        await expect(page.getByTestId('room-width-error')).toHaveCount(0);
        expect(await roomProbe(page)).toEqual(room0);
        const a = await itemById(page, id);
        expect(a.center).toEqual(a0.center);
        expect(a.size).toEqual(a0.size);
      }
    });

    test('U-3 단위 붙여 입력', async ({ page }) => {
      await page.getByTestId('unit-cm').click();
      await enter(page, 'room-width', '420');
      await expect.poll(async () => (await roomProbe(page)).width).toBe(4200);
      await page.getByTestId('unit-m').click();
      await enter(page, 'room-width', '4.3');
      await expect.poll(async () => (await roomProbe(page)).width).toBe(4300);
      await page.getByTestId('unit-mm').click();
      for (const [v, mm] of [['440cm', 4400], ['4.5m', 4500], [' 4.6 M ', 4600]] as const) {
        await enter(page, 'room-width', v);
        await expect.poll(async () => (await roomProbe(page)).width).toBe(mm);
      }
    });

    test('U-4 m 칸에 mm로 쓴 3600 거부', async ({ page }) => {
      await page.getByTestId('unit-m').click();
      await enter(page, 'room-width', '3600');
      await expectRoomRejected(page, 'room-width', DEFAULT_ROOM);
    });

    // ---------- 가구 ----------
    test('F-1 책상 추가', async ({ page }) => {
      const id = await addItem(page, '책상', '1200', '600', '720');
      await expect(page.getByTestId('item-row')).toHaveCount(1);
      const it = await itemById(page, id);
      expect(it.size).toEqual({ w: 1200, h: 720, d: 600 });
      expect(it.center).toEqual({ x: 1800, y: 360, z: 1500 });
      expect(it.rotationDeg).toBe(0);
      expect(it.selected).toBe(true);
      expect(it.warning).toBe(false);
    });

    test('F-2 가구 치수 거부와 경계값', async ({ page }) => {
      await fillAddField(page, 'furniture-name', 'A');
      for (const [field, good] of [['furniture-w', '1000'], ['furniture-d', '600'], ['furniture-h', '700']] as const) {
        await fillAddField(page, 'furniture-w', '1000');
        await fillAddField(page, 'furniture-d', '600');
        await fillAddField(page, 'furniture-h', '700');
        for (const bad of ['', '0', '-5', 'abc', '9', '10001']) {
          const before = await page.getByTestId('item-row').count();
          await fillAddField(page, field, bad);
          await pressAdd(page);
          await expect(page.getByTestId(`${field}-error`)).toBeVisible();
          await expect(page.getByTestId('item-row')).toHaveCount(before);
        }
        for (const ok of ['10', '10000']) {
          const before = await page.getByTestId('item-row').count();
          await fillAddField(page, field, ok);
          await pressAdd(page);
          await expect(page.getByTestId('item-row')).toHaveCount(before + 1);
        }
        await fillAddField(page, field, good);
      }
      // 마지막 추가 6개가 경계값 크기로 그려졌는지 probe로 본다
      const sizes = (await snapshot(page)).items.map((it) => [it.size.w, it.size.d, it.size.h]);
      expect(sizes).toEqual([
        [10, 600, 700], [10000, 600, 700],
        [1000, 10, 700], [1000, 10000, 700],
        [1000, 600, 10], [1000, 600, 10000],
      ]);
    });

    test('F-3 mm 칸의 0.6 거부, cm로 추가', async ({ page }) => {
      await fillAddField(page, 'furniture-d', '600');
      await fillAddField(page, 'furniture-h', '720');
      await fillAddField(page, 'furniture-w', '0.6');
      await pressAdd(page);
      await expect(page.getByTestId('furniture-w-error')).toBeVisible();
      await expect(page.getByTestId('item-row')).toHaveCount(0);
      await page.getByTestId('unit-cm').click();
      const id = await addItem(page, '책상', '120', '60', '72');
      expect((await itemById(page, id)).size).toEqual({ w: 1200, h: 720, d: 600 });
    });

    test('F-4 선택한 가구 치수 수정과 거부', async ({ page }) => {
      const id = await addA(page);
      await enter(page, 'item-w', '1400');
      await enter(page, 'item-d', '800');
      await enter(page, 'item-h', '900');
      await expect.poll(async () => (await itemById(page, id)).size).toEqual({ w: 1400, h: 900, d: 800 });
      expect((await itemById(page, id)).center).toEqual({ x: 1800, y: 450, z: 1500 });
      for (const bad of ['0', '10001', 'abc']) {
        await enter(page, 'item-w', bad);
        await expect(page.getByTestId('item-w-error')).toBeVisible();
        expect((await itemById(page, id)).size).toEqual({ w: 1400, h: 900, d: 800 });
      }
    });

    test('F-5 이름·색 수정, 빈 이름은 "가구"', async ({ page }) => {
      const id = await addA(page);
      const color0 = (await itemById(page, id)).color;
      await enter(page, 'item-name', '소파');
      await expect(page.getByTestId('item-row').first()).toContainText('소파');
      const newColor = color0.toLowerCase() === '#123456' ? '#654321' : '#123456';
      await page.getByTestId('item-color').fill(newColor);
      await expect.poll(async () => (await itemById(page, id)).color.toLowerCase()).toBe(newColor);
      // 추가 폼에서 이름을 비우고 추가
      await addItem(page, '', '500', '500', '500');
      await expect(page.getByTestId('item-row').nth(1)).toContainText('가구');
      // 선택한 가구의 이름 칸을 비움
      await enter(page, 'item-name', '');
      await expect(page.getByTestId('item-name')).toHaveValue('가구');
    });

    test('F-6 선택, 빈 곳 탭으로 해제, 삭제', async ({ page }) => {
      const a = await addA(page);
      const b = await addB(page);
      await page.locator(`[data-testid="item-row"][data-item-id="${a}"]`).click();
      await expect.poll(async () => (await snapshot(page)).items.map((it) => [it.id, it.selected])).toEqual([[a, true], [b, false]]);
      await tapFloor(page, { x: 300, z: 2700 });
      await expect.poll(async () => (await snapshot(page)).items.map((it) => it.selected)).toEqual([false, false]);
      await page.locator(`[data-testid="item-row"][data-item-id="${a}"]`).click();
      await page.getByTestId('item-delete').click();
      await expect(page.getByTestId('item-row')).toHaveCount(1);
      expect((await snapshot(page)).items.map((it) => it.id)).toEqual([b]);
    });

    // ---------- 배치 ----------
    test('P-1 끌어 놓기, 카메라 고정', async ({ page }) => {
      const id = await addA(page);
      const before = await itemById(page, id);
      const o0 = await floorToClient(page, { x: 0, z: 0 });
      await dragItemTo(page, id, { x: 1000, z: 800 });
      const after = await itemById(page, id);
      await expectNear(page, after.center, { x: 1000, z: 800 });
      expect(after.size).toEqual(before.size);
      expect(after.rotationDeg).toBe(before.rotationDeg);
      expect(await floorToClient(page, { x: 0, z: 0 })).toEqual(o0);
    });

    test('P-2 놓을 때 10 mm 격자(변 기준)', async ({ page }) => {
      const id = await addA(page);
      for (const t of [{ x: 1000, z: 800 }, { x: 2456, z: 1994 }, { x: 707, z: 2213 }]) {
        await dragItemTo(page, id, t);
        const c = (await itemById(page, id)).center;
        await expectNear(page, c, t);
        expect(c.x % 10, `center.x ${c.x}`).toBe(0);
        expect(c.z % 10, `center.z ${c.z}`).toBe(0);
      }
      const small = await addItem(page, '작은 상자', '450', '450', '800');
      await dragItemTo(page, small, { x: 500, z: 500 });
      const c = (await itemById(page, small)).center;
      await expectNear(page, c, { x: 500, z: 500 });
      expect((c.x - 225) % 10, `center.x ${c.x}`).toBe(0);
      expect((c.z - 225) % 10, `center.z ${c.z}`).toBe(0);
    });

    test('P-3 가장자리를 잡아 끌어도 잡은 지점이 따라감', async ({ page }) => {
      const id = await addA(page);
      await dragFloor(page, { x: 2100, z: 1700 }, { x: 2600, z: 2000 });
      await expectNear(page, (await itemById(page, id)).center, { x: 2300, z: 1800 });
    });

    test('P-4 움직이지 않고 떼면 그대로, 회전 순환', async ({ page }) => {
      const id = await addA(page);
      await tapFloor(page, { x: 300, z: 2700 });
      await expect.poll(async () => (await itemById(page, id)).selected).toBe(false);
      await tapFloor(page, { x: 1800, z: 1500 });
      await expect.poll(async () => (await itemById(page, id)).selected).toBe(true);
      const a0 = await itemById(page, id);
      expect(a0.center).toEqual({ x: 1800, y: 350, z: 1500 });
      for (const deg of [90, 180, 270, 0]) {
        await page.getByTestId('item-rotate').click();
        await expect.poll(async () => (await itemById(page, id)).rotationDeg).toBe(deg);
        const a = await itemById(page, id);
        expect(a.center).toEqual(a0.center);
        expect(a.size).toEqual(a0.size);
      }
    });

    // ---------- 경고 ----------
    test('W-1 겹침 경고', async ({ page }) => {
      await addB(page);
      await addB(page);
      await expect.poll(async () => (await snapshot(page)).items.map((it) => it.warning)).toEqual([true, true]);
      await expect(page.getByTestId('item-status')).toContainText('겹침');
    });

    test('W-2 떼어 놓으면 해제, 다시 겹쳐도 막지 않음', async ({ page }) => {
      await addB(page);
      await addB(page);
      // 목표 (650, 650): 1000×1000 상자의 변이 벽과 다른 상자에서 150 mm라 자석 맞춤(100 mm)에 걸리지 않고 겹치지도 않는다(T-008). 같은 자리의 두 상자 중 어느 쪽이 잡힐지는 SPEC이 정하지 않았으므로("하나를") 끌려 간 쪽을 probe로 찾는다
      await dragFloor(page, { x: 1800, z: 1500 }, { x: 650, z: 650 });
      const moved = (await snapshot(page)).items.find((it) => it.center.x !== 1800 || it.center.z !== 1500);
      if (!moved) throw new Error('끌린 가구가 없다');
      await expectNear(page, moved.center, { x: 650, z: 650 });
      await expect.poll(async () => (await snapshot(page)).items.map((it) => it.warning)).toEqual([false, false]);
      await expect(page.getByTestId('item-status')).toHaveCount(0);
      await dragItemTo(page, moved.id, { x: 1800, z: 1500 });
      await expectNear(page, (await itemById(page, moved.id)).center, { x: 1800, z: 1500 });
      await expect.poll(async () => (await snapshot(page)).items.map((it) => it.warning)).toEqual([true, true]);
    });

    test('W-3 맞닿음은 겹침 아님, 1 mm 겹치면 경고', async ({ page }) => {
      const first = await addB(page);
      await enter(page, 'room-width', '5600');
      await expect.poll(async () => (await roomProbe(page)).width).toBe(5600);
      const second = await addB(page);
      expect((await itemById(page, first)).center.x).toBe(1800);
      expect((await itemById(page, second)).center.x).toBe(2800);
      await expect.poll(async () => (await snapshot(page)).items.map((it) => it.warning)).toEqual([false, false]);
      await enter(page, 'item-w', '1002');
      await expect.poll(async () => (await snapshot(page)).items.map((it) => it.warning)).toEqual([true, true]);
    });

    test('W-4 벽에 붙은 것은 이탈 아님, 방보다 큰 가구', async ({ page }) => {
      const id = await addItem(page, '큰 상자', '3600', '3000', '500');
      expect((await itemById(page, id)).warning).toBe(false);
      await enter(page, 'item-w', '3602');
      await expect.poll(async () => (await itemById(page, id)).size.w).toBe(3602);
      await expect.poll(async () => (await itemById(page, id)).warning).toBe(true);
      await expect(page.getByTestId('item-status')).toContainText('방 밖');
      const big = await addItem(page, '더 큰 상자', '4000', '600', '500');
      expect((await itemById(page, big)).warning).toBe(true);
    });

    test('W-5 방 줄이기', async ({ page }) => {
      const id = await addB(page);
      for (const [w, warn] of [[2300, false], [2299, true], [3600, false]] as const) {
        await enter(page, 'room-width', String(w));
        await expect.poll(async () => (await roomProbe(page)).width).toBe(w);
        await expect.poll(async () => (await itemById(page, id)).warning).toBe(warn);
        expect((await itemById(page, id)).center.x).toBe(1800);
      }
    });

    test('W-6 방 밖으로 끌어 놓기', async ({ page }) => {
      const id = await addA(page);
      await dragItemTo(page, id, { x: 100, z: 1500 });
      const a = await itemById(page, id);
      await expectNear(page, a.center, { x: 100, z: 1500 });
      expect(a.warning).toBe(true);
      await expect(page.getByTestId('item-status')).toContainText('방 밖');
    });

    test('W-7 겹침과 방 밖 동시 표시', async ({ page }) => {
      await addB(page);
      await addB(page);
      await enter(page, 'room-width', '2000');
      await expect(page.getByTestId('item-status')).toContainText('겹침');
      await expect(page.getByTestId('item-status')).toContainText('방 밖');
    });

    // ---------- 벽까지 거리 ----------
    test('D-1 벽까지 거리 단위 표시와 회전', async ({ page }) => {
      await addA(page);
      expect(await distances(page)).toEqual(['1200', '1300', '1200', '1300']);
      await page.getByTestId('unit-cm').click();
      expect(await distances(page)).toEqual(['120.0', '130.0', '120.0', '130.0']);
      await page.getByTestId('unit-m').click();
      expect(await distances(page)).toEqual(['1.200', '1.300', '1.200', '1.300']);
      await page.getByTestId('unit-mm').click();
      await page.getByTestId('item-rotate').click();
      await expect.poll(() => distances(page)).toEqual(['1000', '1500', '1000', '1500']);
    });

    test('D-2 끈 뒤 거리가 probe 값과 같다', async ({ page }) => {
      const id = await addA(page);
      await dragItemTo(page, id, { x: 1000, z: 800 });
      const snap = await snapshot(page);
      const a = await itemById(page, id);
      const minX = a.center.x - a.size.w / 2;
      const maxX = a.center.x + a.size.w / 2;
      const minZ = a.center.z - a.size.d / 2;
      const maxZ = a.center.z + a.size.d / 2;
      const expected = [minZ, snap.room.width - maxX, snap.room.depth - maxZ, minX].map((v) => String(v));
      expect(await distances(page)).toEqual(expected);
    });

    test('D-3 벽에 붙음 0, 밖은 음수, 선택 해제 시 없음', async ({ page }) => {
      await addItem(page, '큰 상자', '3600', '3000', '500');
      expect(await distances(page)).toEqual(['0', '0', '0', '0']);
      await enter(page, 'item-w', '3700');
      await expect.poll(() => distances(page)).toEqual(['0', '-50', '0', '-50']);
      // 큰 상자가 바닥을 덮으므로 위쪽 벽(z -100 ~ 0) 위를 짧게 누른다
      await tapFloor(page, { x: 1800, z: -50 });
      await expect(page.locator('[data-testid^="item-dist-"]')).toHaveCount(0);
    });

    // ---------- 뷰 ----------
    test('V-1 뷰 전환', async ({ page }) => {
      for (const v of ['3d', '2d'] as const) {
        await page.getByTestId(`view-${v}`).click();
        await expect.poll(async () => (await snapshot(page)).view).toBe(v);
        await expect(page.getByTestId(`view-${v}`)).toHaveAttribute('aria-pressed', 'true');
        await expect(page.getByTestId(`view-${v === '3d' ? '2d' : '3d'}`)).toHaveAttribute('aria-pressed', 'false');
      }
    });

    test('V-2 두 뷰가 같은 데이터를 그린다', async ({ page }) => {
      await enter(page, 'room-width', '4200');
      await enter(page, 'room-depth', '2800');
      await enter(page, 'room-height', '2300');
      await addA(page);
      const s2d = await snapshot(page);
      await page.getByTestId('view-3d').click();
      await expect.poll(async () => (await snapshot(page)).view).toBe('3d');
      const s3d = await snapshot(page);
      expect(s2d.room).toEqual({ width: 4200, depth: 2800, ceilingHeight: 2300 });
      expect(s3d.room).toEqual(s2d.room);
      expect(s3d.items).toEqual(s2d.items);
      await page.getByTestId('view-2d').click();
      await expect.poll(async () => (await snapshot(page)).view).toBe('2d');
      expect((await snapshot(page)).items).toEqual(s2d.items);
    });

    test('V-3 평면 뷰 방향과 방 전체가 캔버스 안', async ({ page }) => {
      const o = await floorToClient(page, { x: 0, z: 0 });
      const px = await floorToClient(page, { x: 3600, z: 0 });
      const pz = await floorToClient(page, { x: 0, z: 3000 });
      expect(px.x).toBeGreaterThan(o.x);
      expect(Math.abs(px.y - o.y)).toBeLessThan(1);
      expect(pz.y).toBeGreaterThan(o.y);
      expect(Math.abs(pz.x - o.x)).toBeLessThan(1);
      const box = await page.getByTestId('scene-canvas').boundingBox();
      if (!box) throw new Error('scene-canvas 없음');
      for (const view of ['2d', '3d'] as const) {
        await page.getByTestId(`view-${view}`).click();
        await expect.poll(async () => (await snapshot(page)).view).toBe(view);
        for (const c of [{ x: 0, z: 0 }, { x: 3600, z: 0 }, { x: 3600, z: 3000 }, { x: 0, z: 3000 }]) {
          const p = await floorToClient(page, c);
          expect(p.x, `${view} 모서리 (${c.x}, ${c.z})`).toBeGreaterThanOrEqual(box.x);
          expect(p.x).toBeLessThanOrEqual(box.x + box.width);
          expect(p.y, `${view} 모서리 (${c.x}, ${c.z})`).toBeGreaterThanOrEqual(box.y);
          expect(p.y).toBeLessThanOrEqual(box.y + box.height);
        }
      }
    });

    test('V-3 보조(SPEC 2절 "처음에 방 전체가 보인다") 뷰 전환 버튼이 평면 뷰의 방 바닥을 가리지 않는다', async ({ page }) => {
      const tb = await page.getByTestId('view-2d').boundingBox();
      const tb3 = await page.getByTestId('view-3d').boundingBox();
      if (!tb || !tb3) throw new Error('뷰 전환 버튼 없음');
      const toggle = { left: tb.x, top: Math.min(tb.y, tb3.y), right: tb3.x + tb3.width, bottom: Math.max(tb.y + tb.height, tb3.y + tb3.height) };
      const o = await floorToClient(page, { x: 0, z: 0 });
      const far = await floorToClient(page, { x: 3600, z: 3000 });
      const ox = Math.max(0, Math.min(toggle.right, far.x) - Math.max(toggle.left, o.x));
      const oy = Math.max(0, Math.min(toggle.bottom, far.y) - Math.max(toggle.top, o.y));
      const mm = await mmPerPixel(page);
      expect(
        ox * oy,
        `버튼(${toggle.left.toFixed(0)},${toggle.top.toFixed(0)})-(${toggle.right.toFixed(0)},${toggle.bottom.toFixed(0)})이 바닥 (${o.x.toFixed(0)},${o.y.toFixed(0)})-(${far.x.toFixed(0)},${far.y.toFixed(0)})을 ${ox.toFixed(0)}×${oy.toFixed(0)} px(약 ${(ox * mm).toFixed(0)}×${(oy * mm).toFixed(0)} mm) 가린다`,
      ).toBe(0);
    });

    // ---------- 위임 지시(T-003 4번) ----------
    test('T003-4 평면 뷰에서 가구 이름이 상자 위에 글자로 보인다 (SPEC 체크리스트 밖)', async ({ page }) => {
      await addItem(page, '책상라벨', '1200', '600', '720');
      await expect(page.getByTestId('scene-canvas').getByText('책상라벨')).toBeVisible({ timeout: 3000 });
    });
  });
}
