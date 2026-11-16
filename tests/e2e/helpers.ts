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
