// e2e 공용 도구. 위치·크기는 화면 픽셀이 아니라 window.__sceneProbe의 수치(mm)로 확인한다.
import { expect, type Page } from '@playwright/test';
import type { SceneProbeItem, SceneProbeSnapshot } from '../../src/contracts/probe';

export const VIEWPORTS = [
  { name: 'desktop', size: { width: 1280, height: 800 } },
  { name: 'mobile', size: { width: 360, height: 740 } },
] as const;

export interface Pt {
  x: number;
  z: number;
}

/** 앱을 새로 열고 장면 조회 함수가 준비될 때까지 기다린다. */
export async function openApp(page: Page): Promise<void> {
  await page.goto('/');
  await page.waitForFunction(() => {
    try {
      return window.__sceneProbe?.snapshot().room.width === 3600;
    } catch {
      return false;
    }
  });
}

export function snapshot(page: Page): Promise<SceneProbeSnapshot> {
  return page.evaluate(() => window.__sceneProbe!.snapshot());
}

export function floorToClient(page: Page, p: Pt): Promise<{ x: number; y: number }> {
  return page.evaluate(([x, z]) => window.__sceneProbe!.floorToClient(x, z), [p.x, p.z] as const);
}

export async function itemById(page: Page, id: string): Promise<SceneProbeItem> {
  const snap = await snapshot(page);
  const item = snap.items.find((it) => it.id === id);
  if (!item) throw new Error(`probe에 가구 ${id}가 없다`);
  return item;
}

/** 칸에 값을 넣고 Enter로 확정한다(방 칸, 선택한 가구의 수정 칸). */
export async function enter(page: Page, testId: string, value: string): Promise<void> {
  const input = page.getByTestId(testId);
  await input.fill(value);
  await input.press('Enter');
}

/** 추가 폼 칸에 값을 넣고 Tab으로 확정한다(추가 폼에서 Enter는 제출이다). */
export async function fillAddField(page: Page, testId: string, value: string): Promise<void> {
  const input = page.getByTestId(testId);
  await input.fill(value);
  await input.press('Tab');
}

/** furniture-add를 좌표로 누른다. 버튼이 disabled여도 시간 초과 없이 "누름"이 일어난다. */
export async function pressAdd(page: Page): Promise<void> {
  const btn = page.getByTestId('furniture-add');
  await btn.scrollIntoViewIfNeeded();
  const box = await btn.boundingBox();
  if (!box) throw new Error('furniture-add가 보이지 않는다');
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
}

/** 추가 폼으로 가구를 추가하고 새 가구의 id를 돌려준다. */
export async function addItem(page: Page, name: string, w: string, d: string, h: string): Promise<string> {
  const before = await page.getByTestId('item-row').count();
  await fillAddField(page, 'furniture-name', name);
  await fillAddField(page, 'furniture-w', w);
  await fillAddField(page, 'furniture-d', d);
  await fillAddField(page, 'furniture-h', h);
  await pressAdd(page);
  await expect(page.getByTestId('item-row')).toHaveCount(before + 1);
  const id = await page.getByTestId('item-row').nth(before).getAttribute('data-item-id');
  if (!id) throw new Error('item-row에 data-item-id가 없다');
  await expect.poll(async () => (await snapshot(page)).items.some((it) => it.id === id)).toBe(true);
  return id;
}

export const addA = (page: Page) => addItem(page, 'A', '1000', '600', '700');
export const addB = (page: Page) => addItem(page, 'B', '1000', '1000', '500');

/** 화면 1픽셀이 나타내는 방 길이(mm). x·z 중 큰 쪽. */
export async function mmPerPixel(page: Page): Promise<number> {
  const o = await floorToClient(page, { x: 0, z: 0 });
  const ax = await floorToClient(page, { x: 1000, z: 0 });
  const az = await floorToClient(page, { x: 0, z: 1000 });
  const pxX = Math.hypot(ax.x - o.x, ax.y - o.y);
  const pxZ = Math.hypot(az.x - o.x, az.y - o.y);
  return Math.max(1000 / pxX, 1000 / pxZ);
}

/** SPEC의 "근처": 각 축 "화면 1픽셀의 길이 + 5" 이내 */
export async function expectNear(page: Page, actual: Pt, target: Pt): Promise<void> {
  const tol = (await mmPerPixel(page)) + 5;
  expect(Math.abs(actual.x - target.x), `x ${actual.x} vs ${target.x} (허용 ${tol.toFixed(1)})`).toBeLessThanOrEqual(tol);
  expect(Math.abs(actual.z - target.z), `z ${actual.z} vs ${target.z} (허용 ${tol.toFixed(1)})`).toBeLessThanOrEqual(tol);
}

/** 방 좌표 grab 지점을 눌러 to 지점까지 끌어 놓는다(평면 뷰). */
export async function dragFloor(page: Page, grab: Pt, to: Pt, steps = 12): Promise<void> {
  const a = await floorToClient(page, grab);
  const b = await floorToClient(page, to);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move(b.x, b.y, { steps });
  await page.mouse.up();
}

/** 가구의 현재 중심을 잡아 target으로 끌어 놓는다. */
export async function dragItemTo(page: Page, id: string, target: Pt): Promise<void> {
  const it = await itemById(page, id);
  await dragFloor(page, { x: it.center.x, z: it.center.z }, target);
}

/** 방 좌표의 한 점을 짧게 누른다. */
export async function tapFloor(page: Page, p: Pt): Promise<void> {
  const c = await floorToClient(page, p);
  await page.mouse.click(c.x, c.y);
}

export async function distances(page: Page): Promise<string[]> {
  const out: string[] = [];
  for (let i = 0; i < 4; i++) out.push(((await page.getByTestId(`item-dist-${i}`).textContent()) ?? '').trim());
  return out;
}

/**
 * B를 두 번 추가하고 둘째를 첫째 위로 끌어 겹치게 만든다(새 가구는 빈 자리에 놓이므로 추가만으로는 겹치지 않는다).
 * 첫째·둘째 id를 돌려준다. 둘째가 선택된 상태로 끝난다.
 */
export async function addOverlappingB(page: Page): Promise<{ first: string; second: string }> {
  const first = await addB(page);
  const second = await addB(page);
  const f = await itemById(page, first);
  expect((await itemById(page, second)).warning, '둘째는 빈 자리에 놓여 겹침이 없어야 한다').toBe(false);
  await dragItemTo(page, second, { x: f.center.x, z: f.center.z });
  await expectNear(page, (await itemById(page, second)).center, { x: f.center.x, z: f.center.z });
  return { first, second };
}

/** 자석 거리(mm): 화면 12 px에 해당하는 바닥 거리. 뷰포트·방 크기마다 달라 화면에서 직접 잰다. */
export async function snapMm(page: Page): Promise<number> {
  const room = (await snapshot(page)).room;
  const p0 = await floorToClient(page, { x: 0, z: room.depth / 2 });
  const p1 = await floorToClient(page, { x: 1000, z: room.depth / 2 });
  return 12 * (1000 / Math.hypot(p1.x - p0.x, p1.y - p0.y));
}

/**
 * 방 폭을 6000으로 넓힌 뒤, other 가구의 오른쪽에서 자석 거리의 2.2배 떨어지고 오른쪽 벽에서도 2배 넘게 떨어진
 * 곳에 w×d 가구가 놓이는 중심을 돌려준다(자석에 붙지 않고 겹치지도 않는 목표. 화면이 작으면 자석 거리가 mm로 커져서 고정 mm 목표는 붙는다).
 */
export async function detachedTargetRightOf(page: Page, otherId: string, w: number, d: number): Promise<Pt> {
  await enter(page, 'room-width', '6000');
  await expect.poll(async () => (await snapshot(page)).room.width).toBe(6000);
  const snap = await snapMm(page);
  const other = await itemById(page, otherId);
  const left = other.center.x + other.size.w / 2 + Math.ceil((snap * 2.2) / 10) * 10;
  const room = (await snapshot(page)).room;
  expect(room.width - (left + w), `오른쪽 벽과의 간격이 자석 거리 ${snap.toFixed(0)} mm의 2배 이상이어야 한다`).toBeGreaterThanOrEqual(snap * 2);
  expect(Math.min(other.center.z - d / 2, room.depth - (other.center.z + d / 2)), '위·아래 벽과의 간격').toBeGreaterThanOrEqual(snap * 2);
  return { x: left + w / 2, z: other.center.z };
}

/** 기본 가구 칩을 누르고 장면 위 ✓(draft-confirm)로 확정한다. 확정된 가구의 id를 돌려준다(확정하면 선택된다). */
export async function addPreset(page: Page, kind: string): Promise<string> {
  const before = await page.getByTestId('item-row').count();
  await page.getByTestId(`preset-${kind}`).click();
  await expect.poll(async () => (await snapshot(page)).draft?.kind).toBe(kind);
  await page.getByTestId('draft-confirm').click();
  await expect(page.getByTestId('item-row')).toHaveCount(before + 1);
  await expect.poll(async () => (await snapshot(page)).draft).toBeNull();
  const snap = await snapshot(page);
  const sel = snap.items.find((it) => it.selected);
  if (!sel) throw new Error('확정한 가구가 선택돼 있지 않다');
  return sel.id;
}
