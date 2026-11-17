// T-032: 미리보기 가구(draft) 흐름 DR-1~DR-5, 배치도 사진 자동 읽기 AR-1~AR-4.
// ID는 SPEC에 아직 없는 임시 ID이다(헤드가 SPEC에 추가). 모두 데스크톱·모바일 폭에서 돈다.
import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { addA, dragFloor, enter, expectNear, itemById, openApp, snapshot, tapFloor, VIEWPORTS } from './helpers';

const SAMPLE_JPG = 'docs/evidence/layout-reader/sample-handdrawn.jpg';

function sampleLayoutObject(): unknown {
  const md = readFileSync('docs/evidence/layout-reader/sample-result.md', 'utf8');
  const m = md.match(/```json\n([\s\S]*?)\n```/);
  if (!m) throw new Error('sample-result.md에서 json 블록을 찾지 못했다');
  return JSON.parse(m[1]!);
}

const itemCount = async (page: Page) => (await snapshot(page)).items.length;
const draftOf = async (page: Page) => (await snapshot(page)).draft;

/** 포커스를 칸·버튼에서 치운다(장면 위를 누르는 것과 같은 효과를 키보드 테스트에서 분리해서 쓴다). */
async function blurFocus(page: Page): Promise<void> {
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
}

/** 칩을 눌러 미리보기를 만든다(확정하지 않는다). */
async function chip(page: Page, kind: string): Promise<void> {
  await page.getByTestId(`preset-${kind}`).click();
  await expect.poll(async () => (await draftOf(page))?.kind).toBe(kind);
}

for (const vp of VIEWPORTS) {
  test.describe(`[${vp.name}] 미리보기 가구`, () => {
    test.use({ viewport: vp.size });
    test.beforeEach(async ({ page }) => {
      await openApp(page);
    });

    test('DR-1 칩은 미리보기만 만들고, 다른 칩은 종류를 바꾼다', async ({ page }) => {
      await chip(page, 'desk');
      let snap = await snapshot(page);
      expect(snap.items).toHaveLength(0);
      expect(snap.draft!.kind).toBe('desk');
      expect(snap.draft!.size).toEqual({ w: 1200, h: 720, d: 600 });
      await expect(page.getByTestId('draft-toolbar')).toBeVisible();
      await expect(page.getByTestId('item-toolbar')).toHaveCount(0);
      await expect(page.getByTestId('item-row')).toHaveCount(0);

      await chip(page, 'bed');
      snap = await snapshot(page);
      expect(snap.items).toHaveLength(0);
      expect(snap.draft!.kind).toBe('bed');
      await expect(page.getByTestId('draft-toolbar')).toBeVisible();
      await expect(page.getByTestId('item-toolbar')).toHaveCount(0);
    });

    test('DR-2 미리보기를 끌어 확정하면 끈 위치에 추가·선택되고, 되돌리기 한 번에 사라진다', async ({ page }) => {
      await chip(page, 'desk');
      const d = (await draftOf(page))!;
      const target = { x: 1200, z: 2000 }; // 처음 놓이는 자리(방 가운데)와 다르고, 벽·다른 가구에서 멀다
      await dragFloor(page, { x: d.center.x, z: d.center.z }, target);
      await expect.poll(async () => (await draftOf(page))!.center.x).not.toBe(d.center.x);
      await expectNear(page, (await draftOf(page))!.center, target);
      expect(await itemCount(page)).toBe(0);
      const dragged = (await draftOf(page))!.center;

      await page.getByTestId('draft-confirm').click();
      await expect.poll(() => itemCount(page)).toBe(1);
      const snap = await snapshot(page);
      expect(snap.draft).toBeNull();
      const it = snap.items[0]!;
      expect(it.selected).toBe(true);
      expect(it.kind).toBe('desk');
      expect(it.center).toEqual(dragged);
      await expectNear(page, it.center, target);
      await expect(page.getByTestId('item-toolbar')).toBeVisible();
      await expect(page.getByTestId('draft-toolbar')).toHaveCount(0);

      await page.getByTestId('undo').click();
      await expect.poll(() => itemCount(page)).toBe(0);
    });

    test('DR-3 취소, Escape, Enter(칸·버튼에 포커스가 없을 때)', async ({ page }) => {
      await chip(page, 'sofa');
      await page.getByTestId('draft-cancel').click();
      await expect.poll(() => draftOf(page)).toBeNull();
      expect(await itemCount(page)).toBe(0);
      await expect(page.getByTestId('draft-toolbar')).toHaveCount(0);

      await chip(page, 'table');
      await blurFocus(page);
      await page.keyboard.press('Escape');
      await expect.poll(() => draftOf(page)).toBeNull();
      expect(await itemCount(page)).toBe(0);

      await chip(page, 'shelf');
      await blurFocus(page);
      await page.keyboard.press('Enter');
      await expect.poll(() => itemCount(page)).toBe(1);
      const snap = await snapshot(page);
      expect(snap.draft).toBeNull();
      expect(snap.items[0]!.kind).toBe('shelf');
      expect(snap.items[0]!.selected).toBe(true);
    });

    // 칩을 마우스로 누르면 칩 버튼에 포커스가 남는다. 사용자는 칩을 누른 직후 Escape·Enter로 취소·확정할 수 있어야 한다(위임 메시지 DR-3).
    test('DR-3b 칩을 누른 직후(포커스가 칩에 있는 그대로) Escape로 취소, Enter로 확정', async ({ page }) => {
      await chip(page, 'table');
      await page.keyboard.press('Escape');
      await expect.poll(() => draftOf(page), { message: 'Escape 뒤 미리보기 null' }).toBeNull();
      expect(await itemCount(page)).toBe(0);

      await chip(page, 'shelf');
      await page.keyboard.press('Enter');
      await expect.poll(() => itemCount(page), { message: 'Enter 뒤 가구 1개' }).toBe(1);
      expect(await draftOf(page)).toBeNull();
    });

    test('DR-4 확정 가구를 누르면 미리보기가 버려지고 그 가구가 선택된다, 빈 곳 탭은 유지', async ({ page }) => {
      const a = await addA(page); // 추가 폼으로 확정 가구 하나(평면 뷰)
      await tapFloor(page, { x: 300, z: 2700 }); // 선택 해제
      await expect.poll(async () => (await itemById(page, a)).selected).toBe(false);
      await chip(page, 'chair');
      expect(await itemCount(page)).toBe(1);
      const d0 = (await draftOf(page))!;

      // 빈 곳 탭: draft 유지(방 모서리 근처, draft와 가구 모두 없는 곳)
      const A = await itemById(page, a);
      const far = { x: 3300, z: 2700 };
      expect(Math.abs(far.x - d0.center.x) > 400 || Math.abs(far.z - d0.center.z) > 400).toBe(true);
      expect(Math.abs(far.x - A.center.x) > 600 || Math.abs(far.z - A.center.z) > 400).toBe(true);
      await tapFloor(page, far);
      await page.waitForTimeout(200);
      expect((await draftOf(page))?.kind, '빈 곳 탭 뒤에도 미리보기 유지').toBe('chair');
      await expect(page.getByTestId('draft-toolbar')).toBeVisible();

      // 확정 가구 누르기: 중심을 짧게 눌러도 draft가 위에 겹치면 draft가 눌리므로, 먼저 draft를 가구에서 멀리 끈다.
      await dragFloor(page, { x: d0.center.x, z: d0.center.z }, far);
      await expect.poll(async () => (await draftOf(page))!.center.x).toBeGreaterThan(2800);
      const a1 = await itemById(page, a);
      await tapFloor(page, { x: a1.center.x, z: a1.center.z });
      await expect.poll(() => draftOf(page)).toBeNull();
      const snap = await snapshot(page);
      expect(snap.items).toHaveLength(1);
      expect(snap.items[0]!.selected).toBe(true);
      await expect(page.getByTestId('item-toolbar')).toBeVisible();
      await expect(page.getByTestId('draft-toolbar')).toHaveCount(0);
    });

    test('DR-5 미리보기 카드에서 폭을 바꾸고 카드의 추가 버튼을 누르면 확정 가구에 반영된다', async ({ page }) => {
      await chip(page, 'desk');
      await expect(page.getByTestId('draft-card')).toBeVisible();
      await enter(page, 'draft-w', '1500');
      await expect.poll(async () => (await draftOf(page))!.size.w).toBe(1500);
      const btn = page.getByTestId('draft-card-confirm');
      await btn.scrollIntoViewIfNeeded();
      await btn.click();
      await expect.poll(() => itemCount(page)).toBe(1);
      const snap = await snapshot(page);
      expect(snap.draft).toBeNull();
      expect(snap.items[0]!.size).toEqual({ w: 1500, h: 720, d: 600 });
      expect(snap.items[0]!.selected).toBe(true);
    });
  });
}

// ---------- 사진 자동 읽기 ----------
interface MockOpts {
  /** 호출마다 순서대로 쓰는 동작. 마지막 것을 반복한다. */
  steps: Array<{ reject: { code: string } } | { resolve: true }>;
  sample: unknown;
}

async function installClaudeMock(page: Page, opts: MockOpts): Promise<void> {
  await page.addInitScript((o: MockOpts) => {
    const w = window as unknown as Record<string, unknown>;
    const log = { json: 0, limits: 0, imageCounts: [] as number[], imageAreBlobs: [] as boolean[] };
    w.__claudeCalls = log;
    w.claude = {
      use: async () => ({
        limits: async () => {
          log.limits++;
          return { images: { maxCount: 1, maxInputBytes: 20e6, mediaTypes: ['image/jpeg', 'image/png'] } };
        },
        json: (_prompt: string, options: { images: Blob[]; signal?: AbortSignal }) => {
          const step = o.steps[Math.min(log.json, o.steps.length - 1)]!;
          log.json++;
          log.imageCounts.push(options.images.length);
          log.imageAreBlobs.push(options.images.every((b) => b instanceof Blob));
          return new Promise((resolve, reject) => {
            const t = setTimeout(() => ('reject' in step ? reject(step.reject) : resolve(o.sample)), 1000);
            options.signal?.addEventListener('abort', () => {
              clearTimeout(t);
              reject({ code: 'cancelled' });
            });
          });
        },
      }),
    };
  }, opts);
}

const calls = (page: Page) =>
  page.evaluate(() => (window as unknown as { __claudeCalls: { json: number; limits: number; imageCounts: number[]; imageAreBlobs: boolean[] } }).__claudeCalls);

for (const vp of VIEWPORTS) {
  test.describe(`[${vp.name}] 사진 자동 읽기`, () => {
    test.use({ viewport: vp.size });

    test('AR-1 사진을 고르면 바로 읽고, 미리보기 → 적용하면 방 3400×2800·가구 3개', async ({ page }) => {
      await installClaudeMock(page, { steps: [{ resolve: true }], sample: sampleLayoutObject() });
      await openApp(page);
      const room0 = (await snapshot(page)).room;
      await page.getByTestId('tab-photo').click();
      await page.getByTestId('photo-file').setInputFiles(SAMPLE_JPG);

      await expect(page.getByTestId('photo-read-status')).toContainText('읽는 중');
      await expect(page.getByTestId('photo-read-stop')).toBeVisible();
      await expect(page.getByTestId('layout-manual')).toBeVisible(); // 접힌 details
      await expect(page.getByTestId('layout-json')).toBeHidden();

      await expect(page.getByTestId('layout-preview')).toBeVisible({ timeout: 10_000 });
      await expect(page.getByTestId('photo-read-stop')).toHaveCount(0);
      expect((await snapshot(page)).room, '적용 전에는 방이 그대로').toEqual(room0);
      expect((await snapshot(page)).items).toHaveLength(0);

      await page.getByTestId('layout-apply').click();
      await page.getByTestId('layout-apply-confirm').click();
      await expect(page.getByTestId('layout-applied')).toBeVisible();
      await expect.poll(async () => (await snapshot(page)).room).toEqual({ width: 3400, depth: 2800, ceilingHeight: 2400 });
      expect((await snapshot(page)).items).toHaveLength(3);

      const c = await calls(page);
      expect(c.json, 'json 호출 정확히 1번').toBe(1);
      expect(c.imageCounts).toEqual([1]);
      expect(c.imageAreBlobs).toEqual([true]);
    });

    test('AR-2 rate_limited는 안내와 다시 읽기를 보이고, 자동 재시도 없이 누르면 다시 읽는다', async ({ page }) => {
      await installClaudeMock(page, { steps: [{ reject: { code: 'rate_limited' } }, { resolve: true }], sample: sampleLayoutObject() });
      await openApp(page);
      await page.getByTestId('tab-photo').click();
      await page.getByTestId('photo-file').setInputFiles(SAMPLE_JPG);

      await expect(page.getByTestId('photo-read-retry')).toBeVisible({ timeout: 10_000 });
      await expect(page.getByTestId('photo-read-status')).toContainText('너무 많아');
      await expect(page.getByTestId('layout-preview')).toHaveCount(0);
      await page.waitForTimeout(3000); // 자동 재시도가 있다면 이 사이에 일어난다
      expect((await calls(page)).json, '자동 재시도 없음').toBe(1);
      await expect(page.getByTestId('photo-read-retry')).toBeVisible();

      await page.getByTestId('photo-read-retry').click();
      await expect(page.getByTestId('photo-read-stop')).toBeVisible();
      await expect(page.getByTestId('layout-preview')).toBeVisible({ timeout: 10_000 });
      const c = await calls(page);
      expect(c.json).toBe(2);
      expect(c.imageCounts).toEqual([1, 1]);
      expect((await snapshot(page)).items, '적용 전').toHaveLength(0);
    });

    test('AR-3 window.claude가 없으면 이유 한 줄과 복사·붙여넣기 화면(layout-json)이 바로 보인다', async ({ page }) => {
      await openApp(page);
      await page.getByTestId('tab-photo').click();
      expect(await page.evaluate(() => 'claude' in window)).toBe(false);
      await expect(page.getByTestId('photo-read-status')).toContainText('바로 읽을 수 없어요');
      await expect(page.getByTestId('layout-json')).toBeVisible();
      await expect(page.getByTestId('layout-manual')).toHaveCount(0);
      // 사진을 올려도 읽기 시작 없음
      await page.getByTestId('photo-file').setInputFiles(SAMPLE_JPG);
      await expect(page.getByTestId('photo-preview')).toBeVisible();
      await expect(page.getByTestId('photo-read-stop')).toHaveCount(0);
      await expect(page.getByTestId('layout-json')).toBeVisible();
    });

    test('AR-4 not_granted면 대체 경로(복사·붙여넣기)로 바뀐다', async ({ page }) => {
      await installClaudeMock(page, { steps: [{ reject: { code: 'not_granted' } }], sample: sampleLayoutObject() });
      await openApp(page);
      await page.getByTestId('tab-photo').click();
      await expect(page.getByTestId('layout-json')).toBeHidden(); // 처음엔 자동 읽기 가능으로 보임
      await page.getByTestId('photo-file').setInputFiles(SAMPLE_JPG);
      await expect(page.getByTestId('layout-json')).toBeVisible({ timeout: 10_000 });
      await expect(page.getByTestId('layout-manual')).toHaveCount(0);
      await expect(page.getByTestId('photo-read-status')).toContainText('바로 읽을 수 없어요');
      await expect(page.getByTestId('photo-read-retry')).toHaveCount(0);
      expect((await calls(page)).json).toBe(1);
      // 대체 경로가 실제로 동작한다
      await page.getByTestId('layout-json').fill(JSON.stringify(sampleLayoutObject()));
      await expect(page.getByTestId('layout-preview')).toBeVisible();
    });
  });
}
