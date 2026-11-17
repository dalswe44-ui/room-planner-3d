// docs/SPEC.md 4-2절(2026-11-17 추가 기능)과 2절 자석·방향키 항목 M-1~M-3, K-1, B-1, B-2, L-1, L-2, H-1, H-2, S-1, T-1, C-1.
// 테스트 이름 앞의 ID가 체크리스트 항목이다. T-1은 터치 전용이라 한 번만, 나머지는 데스크톱·모바일 폭에서 모두 돈다.
import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import {
  addA,
  addB,
  addItem,
  detachedTargetRightOf,
  dragItemTo,
  enter,
  expectNear,
  floorToClient,
  itemById,
  mmPerPixel,
  openApp,
  snapMm,
  snapshot,
  tapFloor,
  VIEWPORTS,
} from './helpers';

const STORAGE_KEY = 'room-planner-3d/project';
const DEFAULT_ROOM = { width: 3600, depth: 3000, ceilingHeight: 2400 };

async function itemCount(page: Page): Promise<number> {
  return (await snapshot(page)).items.length;
}

/** docs/evidence/layout-reader/sample-result.md 의 ```json 블록 */
function sampleLayoutJson(): string {
  const md = readFileSync('docs/evidence/layout-reader/sample-result.md', 'utf8');
  const m = md.match(/```json\n([\s\S]*?)\n```/);
  if (!m) throw new Error('sample-result.md에서 json 블록을 찾지 못했다');
  return m[1]!;
}

for (const vp of VIEWPORTS) {
  test.describe(`[${vp.name}] 추가 기능`, () => {
    test.use({ viewport: vp.size });
    test.beforeEach(async ({ page }) => {
      await openApp(page);
    });

    // ---------- 자석 맞춤 ----------
    // 자석 거리는 화면 12 px에 해당하는 바닥 거리(2026-11-17 사용자 결정). 뷰포트마다 배율이 달라 화면에서 직접 잰다.
    test('M-1 벽에서 자석 거리의 절반 앞에 놓으면 벽에 붙는다(옛 기준 20 mm보다 먼 거리)', async ({ page }) => {
      const a = await addA(page);
      const off = Math.round((await snapMm(page)) / 2);
      expect(off, '화면 기준이라 20 mm보다 넓다').toBeGreaterThan(20);
      // 왼쪽 변 off → 중심 x = off + 500
      await dragItemTo(page, a, { x: 500 + off, z: 1500 });
      const it = await itemById(page, a);
      expect(it.center.x).toBe(500);
      await expectNear(page, it.center, { x: 500, z: 1500 });
      expect(it.warning).toBe(false);
    });

    test('M-2 다른 가구 옆 자석 거리의 절반에서 놓으면 맞닿고 둘 다 경고 없음', async ({ page }) => {
      const a = await addA(page);
      const off = Math.round((await snapMm(page)) / 2);
      await dragItemTo(page, a, { x: 500 + off, z: 1500 });
      expect((await itemById(page, a)).center.x).toBe(500);
      const c = await addItem(page, 'C', '1000', '600', '700');
      // A의 오른쪽 변 1000 + off
      await dragItemTo(page, c, { x: 1500 + off, z: (await itemById(page, a)).center.z });
      const ia = await itemById(page, a);
      const ic = await itemById(page, c);
      expect(ic.center.x - ic.size.w / 2, 'C의 왼쪽 변이 A의 오른쪽 변').toBe(ia.center.x + ia.size.w / 2);
      expect(ia.warning).toBe(false);
      expect(ic.warning).toBe(false);
    });

    test('M-3 자석 거리의 두 배 간격이면 붙지 않는다', async ({ page }) => {
      const a = await addA(page);
      const snap = await snapMm(page);
      await dragItemTo(page, a, { x: 500 + Math.round(snap / 2), z: 1500 });
      const c = await addItem(page, 'C', '1000', '600', '700');
      const want = Math.round((snap * 2) / 10) * 10;
      await dragItemTo(page, c, { x: 1500 + want, z: (await itemById(page, a)).center.z });
      const ia = await itemById(page, a);
      const ic = await itemById(page, c);
      const gap = ic.center.x - ic.size.w / 2 - (ia.center.x + ia.size.w / 2);
      expect(gap, `간격 ${gap}, 자석 ${snap.toFixed(1)} mm`).toBeGreaterThan(snap);
      await expectNear(page, { x: gap, z: 0 }, { x: want, z: 0 });
      expect(ia.warning || ic.warning).toBe(false);
    });

    // ---------- 방향키 ----------
    test('K-1 방향키 10 mm, Shift 1 mm, 입력 칸에서는 무시', async ({ page }) => {
      const id = await addItem(page, '책상', '1200', '600', '720');
      const a0 = await itemById(page, id);
      for (let i = 0; i < 3; i++) await page.keyboard.press('ArrowRight');
      await expect.poll(async () => (await itemById(page, id)).center.x).toBe(a0.center.x + 30);
      expect((await itemById(page, id)).center.z).toBe(a0.center.z);
      for (let i = 0; i < 2; i++) await page.keyboard.press('Shift+ArrowDown');
      await expect.poll(async () => (await itemById(page, id)).center.z).toBe(a0.center.z + 2);
      expect((await itemById(page, id)).center.x).toBe(a0.center.x + 30);
      // 입력 칸에 포커스가 있으면 움직이지 않는다
      const before = (await itemById(page, id)).center;
      await page.getByTestId('item-name').focus();
      await page.keyboard.press('ArrowRight');
      await page.keyboard.press('Shift+ArrowDown');
      await page.waitForTimeout(150);
      expect((await itemById(page, id)).center).toEqual(before);
    });

    // ---------- 기본 가구 ----------
    test('B-1 책상 버튼은 바로 추가하고 선택한다', async ({ page }) => {
      await page.getByTestId('preset-desk').click();
      await expect(page.getByTestId('item-row')).toHaveCount(1);
      const snap = await snapshot(page);
      expect(snap.items).toHaveLength(1);
      const it = snap.items[0]!;
      expect(it.kind).toBe('desk');
      expect(it.size).toEqual({ w: 1200, h: 720, d: 600 });
      expect(it.selected).toBe(true);
    });

    test('B-2 방 6000×3000에서 기본 가구 7개가 겹치지 않는다', async ({ page }) => {
      await enter(page, 'room-width', '6000');
      await expect.poll(async () => (await snapshot(page)).room.width).toBe(6000);
      const kinds = ['bed', 'desk', 'chair', 'wardrobe', 'shelf', 'sofa', 'table'];
      for (const [i, k] of kinds.entries()) {
        await page.getByTestId(`preset-${k}`).click();
        await expect.poll(() => itemCount(page)).toBe(i + 1);
      }
      const snap = await snapshot(page);
      expect(snap.items.map((it) => it.kind)).toEqual(kinds);
      expect(snap.items.map((it) => it.warning)).toEqual(Array(7).fill(false));
      expect(snap.items.map((it) => it.selected)).toEqual([false, false, false, false, false, false, true]);
    });

    // ---------- 배치도 가져오기 ----------
    test('L-1 배치도 JSON 적용', async ({ page }) => {
      await page.getByTestId('tab-photo').click();
      await page.getByTestId('layout-json').fill(sampleLayoutJson());
      await expect(page.getByTestId('layout-preview')).toBeVisible();
      await expect(page.getByTestId('layout-apply')).toBeEnabled();
      await page.getByTestId('layout-apply').click();
      await page.getByTestId('layout-apply-confirm').click();
      await expect(page.getByTestId('layout-applied')).toBeVisible();
      await expect.poll(async () => (await snapshot(page)).room).toEqual({ width: 3400, depth: 2800, ceilingHeight: 2400 });
      const items = (await snapshot(page)).items;
      expect(items).toHaveLength(3);
      const at = (x: number, z: number) => {
        const it = items.find((i) => i.center.x === x && i.center.z === z);
        if (!it) throw new Error(`중심 (${x}, ${z})인 가구가 없다: ${JSON.stringify(items.map((i) => i.center))}`);
        return it;
      };
      expect(at(500, 1000).size).toMatchObject({ w: 1000, d: 2000 }); // 침대
      expect(at(2800, 500).size).toEqual({ w: 1200, d: 600, h: 720 }); // 책상
      const wardrobe = at(1750, 2500);
      expect(wardrobe.size).toEqual({ w: 900, d: 600, h: 2000 }); // 높이가 없어 종류 기본값
    });

    test('L-2 깨진 JSON은 오류를 보이고 적용 버튼이 꺼진다', async ({ page }) => {
      await page.getByTestId('tab-photo').click();
      await page.getByTestId('layout-json').fill('{"format":');
      await expect(page.getByTestId('layout-error')).toBeVisible();
      await expect(page.getByTestId('layout-apply')).toBeDisabled();
      expect((await snapshot(page)).room).toEqual(DEFAULT_ROOM);
      expect(await itemCount(page)).toBe(0);
    });

    // ---------- 되돌리기 ----------
    for (const via of ['버튼', 'Ctrl+Z'] as const) {
      test(`H-1 추가·이동·삭제 후 되돌리기 3번, 다시 실행 2번 (${via})`, async ({ page }) => {
        const id = await addA(page);
        await dragItemTo(page, id, { x: 1000, z: 800 });
        const moved = (await itemById(page, id)).center;
        await expectNear(page, moved, { x: 1000, z: 800 });
        await page.getByTestId('item-delete').click();
        await expect.poll(() => itemCount(page)).toBe(0);
        const undo = async () => {
          if (via === '버튼') await page.getByTestId('undo').click();
          else await page.keyboard.press('Control+z');
        };
        const redo = async () => {
          if (via === '버튼') await page.getByTestId('redo').click();
          else await page.keyboard.press('Control+Shift+z');
        };
        await undo();
        await expect.poll(() => itemCount(page)).toBe(1);
        await undo();
        await undo();
        await expect.poll(() => itemCount(page)).toBe(0);
        await redo();
        await redo();
        await expect.poll(() => itemCount(page)).toBe(1);
        expect((await snapshot(page)).items[0]!.center).toEqual(moved);
      });
    }

    test('H-2 이름 칸에 포커스가 있으면 Ctrl+Z가 가구 상태를 바꾸지 않는다', async ({ page }) => {
      const id = await addA(page);
      await dragItemTo(page, id, { x: 1000, z: 800 });
      const before = await snapshot(page);
      await page.getByTestId('item-name').focus();
      await page.keyboard.press('Control+z');
      await page.waitForTimeout(200);
      expect(await snapshot(page)).toEqual(before);
    });

    // ---------- 저장 ----------
    test('S-1 새로 고침 뒤에도 방·가구·단위가 유지된다', async ({ page }) => {
      await enter(page, 'room-width', '4200');
      await enter(page, 'room-depth', '2800');
      await enter(page, 'room-height', '2300');
      const id = await addA(page);
      await dragItemTo(page, id, { x: 1000, z: 800 });
      await page.getByTestId('unit-cm').click();
      const strip = (items: Awaited<ReturnType<typeof snapshot>>['items']) =>
        items.map(({ center, size, rotationDeg, color, kind }) => ({ center, size, rotationDeg, color, kind }));
      const before = await snapshot(page);
      expect(before.room).toEqual({ width: 4200, depth: 2800, ceilingHeight: 2300 });
      // 저장은 바뀐 뒤 300 ms 뒤에 일어난다
      await expect
        .poll(() => page.evaluate((k) => localStorage.getItem(k) ?? '', STORAGE_KEY))
        .toContain('"displayUnit":"cm"');
      await page.waitForTimeout(500);
      await page.reload();
      await page.waitForFunction(() => window.__sceneProbe?.snapshot().room.width === 4200);
      const after = await snapshot(page);
      expect(after.room).toEqual(before.room);
      expect(strip(after.items)).toEqual(strip(before.items));
      await expect(page.getByTestId('unit-cm')).toHaveAttribute('aria-pressed', 'true');
      await expect(page.getByTestId('room-width')).toHaveValue('420.0');
    });

    test('S-1 깨진 저장값이면 기본 방으로 시작하고 페이지 오류가 없다', async ({ page }) => {
      const errors: string[] = [];
      page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
      page.on('console', (m) => {
        if (m.type() === 'error') errors.push(`console.error: ${m.text()}`);
      });
      const broken = [
        '{"format":',
        'null',
        '[]',
        JSON.stringify({ format: 'room-planner-project', version: 1, project: { room: { width: -5 } } }),
        JSON.stringify({ format: 'room-planner-project', version: 99, project: {} }),
      ];
      for (const text of broken) {
        await page.evaluate(([k, v]) => localStorage.setItem(k!, v!), [STORAGE_KEY, text]);
        await page.reload();
        await page.waitForFunction(() => window.__sceneProbe?.snapshot().room.width === 3600);
        const snap = await snapshot(page);
        expect(snap.room, `저장값 ${text}`).toEqual(DEFAULT_ROOM);
        expect(snap.items, `저장값 ${text}`).toEqual([]);
        await expect(page.getByTestId('room-width')).toHaveValue('3600');
      }
      expect(errors).toEqual([]);
      // 깨진 뒤에도 앱이 동작한다
      await addA(page);
    });

    // ---------- 가구 도구 막대 (SPEC 4-3절) ----------
    const toolbar = (page: Page) => page.getByTestId('item-toolbar');
    const rowTexts = (page: Page) => page.getByTestId('item-row').allTextContents();

    test('TB-1 도구 막대 복제: 복제본 선택, 값 동일, 경고 없음, 되돌리기 한 번에 사라짐', async ({ page }) => {
      const id = await addItem(page, '책장', '1000', '600', '700');
      await page.getByTestId('item-rotate').click(); // 회전 90인 가구로 복제를 확인한다
      await expect.poll(async () => (await itemById(page, id)).rotationDeg).toBe(90);
      await expect(toolbar(page)).toBeVisible();
      const orig = await itemById(page, id);
      await page.getByTestId('tool-duplicate').click();
      await expect.poll(() => itemCount(page)).toBe(2);
      const snap = await snapshot(page);
      const copy = snap.items.find((it) => it.id !== id)!;
      expect(copy.selected).toBe(true);
      expect(snap.items.find((it) => it.id === id)!.selected).toBe(false);
      expect(copy.size).toEqual(orig.size);
      expect(copy.rotationDeg).toBe(orig.rotationDeg);
      expect(copy.kind).toBe(orig.kind);
      expect(snap.items.map((it) => it.warning)).toEqual([false, false]);
      // 이름·치수는 선택된 복제본의 수정 칸과 목록 줄로 확인한다
      await expect(page.getByTestId('item-name')).toHaveValue('책장');
      await expect(page.getByTestId('item-w')).toHaveValue('1000');
      await expect(page.getByTestId('item-d')).toHaveValue('600');
      await expect(page.getByTestId('item-h')).toHaveValue('700');
      const rows = await rowTexts(page);
      expect(rows[1]).toBe(rows[0]);
      await page.getByTestId('undo').click();
      await expect.poll(() => itemCount(page)).toBe(1);
      expect((await snapshot(page)).items[0]!.id).toBe(id);
    });

    test('TB-2 도구 막대 회전: 왼쪽 90, 오른쪽 두 번 270, 크기·중심 그대로', async ({ page }) => {
      const id = await addA(page);
      const before = await itemById(page, id);
      await page.getByTestId('tool-rotate-left').click();
      await expect.poll(async () => (await itemById(page, id)).rotationDeg).toBe(90);
      await page.getByTestId('tool-rotate-right').click();
      await page.getByTestId('tool-rotate-right').click();
      await expect.poll(async () => (await itemById(page, id)).rotationDeg).toBe(270);
      const after = await itemById(page, id);
      expect(after.size).toEqual(before.size);
      expect(after.center).toEqual(before.center);
    });

    test('TB-3 도구 막대 삭제, 빈 바닥을 짧게 누르면 막대가 사라진다', async ({ page }) => {
      const id = await addA(page);
      await expect(toolbar(page)).toBeVisible();
      await tapFloor(page, { x: 300, z: 2700 });
      await expect.poll(async () => (await itemById(page, id)).selected).toBe(false);
      await expect(toolbar(page)).toHaveCount(0);
      await page.locator(`[data-testid="item-row"][data-item-id="${id}"]`).click();
      await expect(toolbar(page)).toBeVisible();
      await page.getByTestId('tool-delete').click();
      await expect.poll(() => itemCount(page)).toBe(0);
      await expect(page.getByTestId('item-row')).toHaveCount(0);
      await expect(toolbar(page)).toHaveCount(0);
    });

    test('TB-4 도구 막대 버튼을 눌러도 선택이 유지되고 중심이 움직이지 않는다', async ({ page }) => {
      const id = await addA(page);
      const before = await itemById(page, id);
      expect(before.selected).toBe(true);
      for (const t of ['tool-rotate-left', 'tool-rotate-right', 'tool-rotate-left']) {
        const c0 = (await itemById(page, id)).center;
        await page.getByTestId(t).click();
        await page.waitForTimeout(150);
        const it = await itemById(page, id);
        expect(it.selected, `${t} 뒤 선택`).toBe(true);
        expect(it.center, `${t} 뒤 중심`).toEqual(c0);
        await expect(toolbar(page)).toBeVisible();
      }
      expect((await itemById(page, id)).center).toEqual(before.center);
    });

    test('TB-5 끄는 동안 도구 막대가 사라졌다가 놓으면 다시 보인다', async ({ page }) => {
      const id = await addA(page);
      await expect(toolbar(page)).toHaveCount(1);
      const it = await itemById(page, id);
      const a = await floorToClient(page, { x: it.center.x, z: it.center.z });
      const b = await floorToClient(page, { x: 1000, z: 800 });
      await page.mouse.move(a.x, a.y);
      await page.mouse.down();
      await page.mouse.move((a.x + b.x) / 2, (a.y + b.y) / 2, { steps: 6 });
      await page.mouse.move(b.x, b.y, { steps: 6 });
      await expect(toolbar(page)).toHaveCount(0);
      await page.mouse.up();
      await expect(toolbar(page)).toHaveCount(1);
      await expectNear(page, (await itemById(page, id)).center, { x: 1000, z: 800 });
    });

    // ---------- 도면 치수 (SPEC 4-3절) ----------
    test('DM-1 평면 뷰의 방 치수 글자: 단위 따라 바뀌고 3D에서는 없다', async ({ page }) => {
      await expect(page.getByTestId('room-dim-width')).toHaveText(/^\s*3600\s*mm\s*$/);
      await expect(page.getByTestId('room-dim-depth')).toHaveText(/^\s*3000\s*mm\s*$/);
      await page.getByTestId('unit-cm').click();
      await expect(page.getByTestId('room-dim-width')).toHaveText(/^\s*360\.0\s*cm\s*$/);
      await expect(page.getByTestId('room-dim-depth')).toHaveText(/^\s*300\.0\s*cm\s*$/);
      await page.getByTestId('unit-mm').click();
      await enter(page, 'room-width', '4200');
      await expect.poll(async () => (await snapshot(page)).room.width).toBe(4200);
      await expect(page.getByTestId('room-dim-width')).toHaveText(/^\s*4200\s*mm\s*$/);
      await expect(page.getByTestId('room-dim-depth')).toHaveText(/^\s*3000\s*mm\s*$/);
      await page.getByTestId('view-3d').click();
      await expect.poll(async () => (await snapshot(page)).view).toBe('3d');
      await expect(page.getByTestId('room-dim-width')).toHaveCount(0);
      await expect(page.getByTestId('room-dim-depth')).toHaveCount(0);
    });

    test('DM-2 선택한 가구의 도면 거리 글자가 패널 거리와 같고 선택을 풀면 없다', async ({ page }) => {
      const id = await addItem(page, '책상', '1200', '600', '720');
      const num = (t: string | null) => (t ?? '').match(/-?\d+(?:\.\d+)?/)?.[0];
      const same = async () => {
        for (let i = 0; i < 4; i++) {
          const scene = num(await page.getByTestId(`scene-dist-${i}`).textContent());
          const panel = num(await page.getByTestId(`item-dist-${i}`).textContent());
          expect(scene, `scene-dist-${i}`).toBeDefined();
          expect(scene, `scene-dist-${i}와 item-dist-${i}`).toBe(panel);
        }
      };
      await same();
      expect(await page.getByTestId('scene-dist-0').textContent()).toContain('1200'); // 중심 (1800, 1500), 폭 1200 → 벽 0까지 1200
      await page.getByTestId('unit-cm').click();
      await expect.poll(async () => num(await page.getByTestId('scene-dist-0').textContent())).toBe('120.0');
      await same();
      await page.getByTestId('unit-mm').click();
      await dragItemTo(page, id, { x: 1000, z: 800 });
      await same();
      await tapFloor(page, { x: 300, z: 2700 });
      await expect.poll(async () => (await itemById(page, id)).selected).toBe(false);
      for (let i = 0; i < 4; i++) {
        await expect(page.getByTestId(`scene-dist-${i}`)).toHaveCount(0);
        await expect(page.getByTestId(`item-dist-${i}`)).toHaveCount(0);
      }
    });

    // ---------- 그려진 색 ----------
    test('C-1 겹치면 평면 뷰의 실제 픽셀이 경고 빨강, 떼면 원래 색', async ({ page }) => {
      const first = await addB(page);
      const second = await addB(page);
      const sampleColor = async (id: string) => {
        const it = await itemById(page, id);
        // 글자(이름)가 있는 중심을 피해 상자 안쪽 네 점의 채널별 중앙값
        const pts = [] as { x: number; y: number }[];
        for (const sx of [-1, 1]) {
          for (const sz of [-1, 1]) {
            pts.push(await floorToClient(page, { x: it.center.x + sx * it.size.w * 0.35, z: it.center.z + sz * it.size.d * 0.35 }));
          }
        }
        await page.waitForTimeout(400);
        const png = (await page.screenshot()).toString('base64');
        return page.evaluate(
          async ([b64, points]) => {
            const img = new Image();
            img.src = `data:image/png;base64,${b64}`;
            await img.decode();
            const cv = document.createElement('canvas');
            cv.width = img.width;
            cv.height = img.height;
            const ctx = cv.getContext('2d')!;
            ctx.drawImage(img, 0, 0);
            const px = (points as { x: number; y: number }[]).map((p) => ctx.getImageData(Math.round(p.x), Math.round(p.y), 1, 1).data);
            const med = (c: number) => [...px.map((d) => d[c]!)].sort((a, b) => a - b)[1]!;
            return [med(0), med(1), med(2)] as [number, number, number];
          },
          [png, pts] as const,
        );
      };
      const isWarningRed = ([r, g, b]: number[]) => r > g + 70 && r > b + 70;
      const dist = (p: number[], q: number[]) => Math.abs(p[0]! - q[0]!) + Math.abs(p[1]! - q[1]!) + Math.abs(p[2]! - q[2]!);

      const base = await sampleColor(second);
      expect(isWarningRed(base), `겹치기 전 색 ${base}`).toBe(false);

      const f = await itemById(page, first);
      await dragItemTo(page, second, { x: f.center.x, z: f.center.z });
      await expect.poll(async () => (await itemById(page, second)).warning).toBe(true);
      const over = await sampleColor(second);
      expect(isWarningRed(over), `겹친 색 ${over}`).toBe(true);
      expect(dist(over, base), `겹치기 전 ${base}, 겹친 뒤 ${over}는 뚜렷이 달라야 한다`).toBeGreaterThan(80);

      // 고정 mm 목표는 작은 화면에서 자석에 붙는다. 자석 거리의 2배 넘게 떨어진 곳으로 계산한다(T-027)
      const target = await detachedTargetRightOf(page, first, 1000, 1000);
      await dragItemTo(page, second, target);
      await expectNear(page, (await itemById(page, second)).center, target);
      await expect.poll(async () => (await itemById(page, second)).warning).toBe(false);
      const after = await sampleColor(second);
      expect(isWarningRed(after), `뗀 뒤 색 ${after}`).toBe(false);
      expect(dist(after, base), `원래 색 ${base}, 뗀 뒤 ${after}`).toBeLessThan(45);
      expect(dist(after, over), `겹친 색 ${over}과 뗀 뒤 ${after}는 달라야 한다`).toBeGreaterThan(80);
      expect(await mmPerPixel(page)).toBeGreaterThan(0);
    });
  });
}

// ---------- 터치 ----------
test.describe('[touch] 터치 끌기', () => {
  test.use({ viewport: { width: 390, height: 780 }, hasTouch: true, isMobile: true });

  test('T-1 손가락으로 평면 뷰 가구를 끌어 놓는다, 화면은 스크롤되지 않는다', async ({ page, context }) => {
    await openApp(page);
    const id = await addA(page);
    await page.evaluate(() => window.scrollTo(0, 0));
    const scrollState = () =>
      page.evaluate(() => ({
        win: [window.scrollX, window.scrollY],
        els: [...document.querySelectorAll('*')].filter((e) => e.scrollTop !== 0 || e.scrollLeft !== 0).map((e) => [e.tagName, e.className, e.scrollLeft, e.scrollTop]),
      }));
    const scroll0 = await scrollState();
    const cdp = await context.newCDPSession(page);
    const touch = (type: 'touchStart' | 'touchMove' | 'touchEnd', p?: { x: number; y: number }) =>
      cdp.send('Input.dispatchTouchEvent', { type, touchPoints: p ? [{ x: p.x, y: p.y }] : [] });

    const o0 = await floorToClient(page, { x: 0, z: 0 });
    const start = await floorToClient(page, { x: 1800, z: 1500 });
    const end = await floorToClient(page, { x: 1000, z: 800 });
    const vh = page.viewportSize()!.height;
    expect(start.y).toBeLessThan(vh);
    expect(end.y).toBeLessThan(vh);
    await touch('touchStart', start);
    for (let i = 1; i <= 12; i++) {
      await touch('touchMove', { x: start.x + ((end.x - start.x) * i) / 12, y: start.y + ((end.y - start.y) * i) / 12 });
    }
    await touch('touchEnd');
    await expect.poll(async () => (await itemById(page, id)).center.x).not.toBe(1800);
    await expectNear(page, (await itemById(page, id)).center, { x: 1000, z: 800 });
    expect(await scrollState()).toEqual(scroll0);
    // 카메라도 그대로(평면 뷰 투영이 같다)
    // 카메라가 움직이지 않았는지: 0.001 px까지 비교(부동소수 반올림 차이만 허용)
    const o1 = await floorToClient(page, { x: 0, z: 0 });
    expect(o1.x).toBeCloseTo(o0.x, 3);
    expect(o1.y).toBeCloseTo(o0.y, 3);
  });
});

// T-018 회귀: 자동 저장에서 불러온 가구에도 평면 뷰 이름표가 보인다(불러오기가 첫 그림 전이라 drei Html의 붙일 요소가 바뀌며 이름표가 지워지던 결함).
test.describe('[desktop] 불러온 가구 이름표', () => {
  test('S-1/T-018 새로 고침으로 불러온 가구에도 이름표가 보인다', async ({ page }) => {
    await openApp(page);
    await page.getByTestId('preset-desk').click();
    await expect(page.locator('.furniture-label')).toHaveCount(1);
    await page.waitForTimeout(1000); // 자동 저장 지연(300 ms)보다 길게
    await page.reload();
    await page.waitForFunction(() => window.__sceneProbe?.snapshot().items.length === 1);
    await expect(page.locator('.furniture-label')).toHaveCount(1);
    await expect(page.locator('.furniture-label')).toHaveText('책상');
  });
});
