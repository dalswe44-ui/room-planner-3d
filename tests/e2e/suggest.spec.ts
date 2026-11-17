// T-043: AI 추천 배치 SG-1~SG-7. AI는 모의한다(sample은 page.addInitScript, 서버는 page.route).
// 적용 결과는 probe(center, rotationDeg)의 mm 값으로 확인한다. 기대 중심은 contracts의 규칙(BACK_TO_ROTATION, footprintOfBack)으로 계산한다.
import { expect, test, type Page } from '@playwright/test';
import { BACK_TO_ROTATION, footprintOfBack, type BackSide } from '../../src/contracts/layoutSuggest';
import { addA, addB, enter, openApp, snapshot, VIEWPORTS } from './helpers';

interface Ans {
  id: number;
  back: BackSide | string;
  left: number | string;
  top: number | string;
}

const answer = (items: Ans[], extra: Record<string, unknown> = {}) =>
  JSON.stringify({ format: 'layout-suggestion', version: 1, items, reasons: ['창가에 두어 밝게 했어요.', '문 앞을 비웠어요.'], tips: ['스탠드를 두면 좋아요.'], ...extra });

type Step = { text: string } | { reject: { code: string } };
interface MockState {
  prompts: string[];
  steps: Step[];
  delay: number;
}
declare global {
  interface Window {
    __mock?: MockState;
  }
}

/** window.claude.use('sample') 모의. 실제 sample처럼 호출할 수 있는 함수에 json·limits가 붙은 꼴. 지시문과 호출 횟수를 window.__mock.prompts에 기록한다. */
async function installClaudeMock(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const mock: MockState = { prompts: [], steps: [], delay: 0 };
    window.__mock = mock;
    (window as unknown as Record<string, unknown>).claude = {
      use: async () =>
        Object.assign(async () => ({ text: '', truncated: false }), {
          limits: async () => ({ images: { maxCount: 1, maxInputBytes: 20e6, mediaTypes: ['image/jpeg', 'image/png'] } }),
          json: (prompt: string, options?: { signal?: AbortSignal }) => {
            const step = mock.steps[Math.min(mock.prompts.length, mock.steps.length - 1)];
            mock.prompts.push(prompt);
            return new Promise((resolve, reject) => {
              const t = setTimeout(() => {
                if (!step) reject({ code: 'upstream_error' });
                else if ('reject' in step) reject(step.reject);
                else resolve(step.text);
              }, mock.delay);
              options?.signal?.addEventListener('abort', () => {
                clearTimeout(t);
                reject({ code: 'cancelled' });
              });
            });
          },
        }),
    };
  });
}

const setSteps = (page: Page, steps: Step[], delay = 0) =>
  page.evaluate(([s, d]) => {
    window.__mock!.steps = s as Step[];
    window.__mock!.delay = d as number;
  }, [steps, delay] as const);
const prompts = (page: Page) => page.evaluate(() => window.__mock!.prompts);

/** 방 4000×3000에 A(1000×600)·B(1000×1000)를 놓고 AI 추천 탭을 연다. */
async function setup(page: Page): Promise<{ a: string; b: string }> {
  await openApp(page);
  await enter(page, 'room-width', '4000');
  await enter(page, 'room-depth', '3000');
  await expect.poll(async () => (await snapshot(page)).room).toMatchObject({ width: 4000, depth: 3000 });
  const a = await addA(page);
  const b = await addB(page);
  await page.getByTestId('tab-suggest').click();
  await expect(page.getByTestId('suggest-panel')).toBeVisible();
  return { a, b };
}

const goal = async (page: Page, text = '공부에 집중하기 좋게') => page.getByTestId('suggest-goal').fill(text);
async function run(page: Page): Promise<void> {
  const btn = page.getByTestId('suggest-run');
  await expect(btn).toBeEnabled();
  await btn.click();
}

/** 답(back, left, top)에서 기대 중심·회전을 계약 규칙으로 계산한다(방 원점은 (0,0)). */
function expected(it: { w: number; d: number }, a: { back: BackSide; left: number; top: number }) {
  const { fw, fd } = footprintOfBack(it, a.back);
  return { x: a.left + fw / 2, z: a.top + fd / 2, rotationDeg: BACK_TO_ROTATION[a.back] };
}

const A = { w: 1000, d: 600 };
const B = { w: 1000, d: 1000 };
const placed = async (page: Page, id: string) => {
  const it = (await snapshot(page)).items.find((x) => x.id === id)!;
  return { x: it.center.x, z: it.center.z, rotationDeg: it.rotationDeg };
};

const GOOD = (): Ans[] => [
  { id: 1, back: 'left', left: 0, top: 200 }, // A: back이 왼쪽 벽 → 회전 90, 발자국 600×1000
  { id: 2, back: 'right', left: 3000, top: 1000 }, // B: 회전 270
];

for (const vp of VIEWPORTS) {
  test.describe(`[${vp.name}] AI 추천 배치`, () => {
    test.use({ viewport: vp.size });

    test('SG-1 추천받기 → 중심·회전이 답대로 바뀌고 이유가 보이며 수·이름·크기는 그대로', async ({ page }) => {
      await installClaudeMock(page);
      const { a, b } = await setup(page);
      await setSteps(page, [{ text: answer(GOOD()) }]);
      const before = (await snapshot(page)).items;
      expect(before).toHaveLength(2);
      await goal(page);
      await run(page);
      await expect(page.getByTestId('suggest-result')).toBeVisible({ timeout: 10_000 });

      const ea = expected(A, { back: 'left', left: 0, top: 200 });
      const eb = expected(B, { back: 'right', left: 3000, top: 1000 });
      expect(await placed(page, a)).toEqual(ea);
      expect(await placed(page, b)).toEqual(eb);
      expect(ea.rotationDeg).toBe(90);
      expect(eb.rotationDeg).toBe(270);

      const after = (await snapshot(page)).items;
      expect(after).toHaveLength(2);
      expect(after.map((i) => i.size)).toEqual(before.map((i) => i.size));
      expect(after.map((i) => i.id)).toEqual(before.map((i) => i.id));
      await expect(page.getByTestId('suggest-reasons')).toContainText('창가에 두어 밝게 했어요.');
      await expect(page.getByTestId('suggest-reasons').locator('li')).toHaveCount(2);
      await expect(page.getByTestId('suggest-tips')).toContainText('스탠드');
      await expect(page.getByTestId('suggest-warnings')).toHaveCount(0);

      const p = await prompts(page);
      expect(p).toHaveLength(1);
      expect(p[0]).toContain('공부에 집중하기 좋게');
      expect(p[0]).toContain('1. A');
      expect(p[0]).toContain('2. B');
    });

    test('SG-2 원래대로와 되돌리기(undo) 모두 추천 전 자리·방향으로 돌아온다', async ({ page }) => {
      await installClaudeMock(page);
      const { a, b } = await setup(page);
      const a0 = await placed(page, a);
      const b0 = await placed(page, b);

      // 원래대로
      await setSteps(page, [{ text: answer(GOOD()) }]);
      await goal(page);
      await run(page);
      await expect(page.getByTestId('suggest-result')).toBeVisible({ timeout: 10_000 });
      expect(await placed(page, a)).not.toEqual(a0);
      await page.getByTestId('suggest-revert').click();
      await expect(page.getByTestId('suggest-reverted')).toBeVisible();
      expect(await placed(page, a)).toEqual(a0);
      expect(await placed(page, b)).toEqual(b0);

      // 되돌리기 한 번(undo). 위 revert는 별도 기록 한 단계이므로 새로 추천받고 undo 한 번만 누른다.
      await run(page);
      await expect(page.getByTestId('suggest-result')).toBeVisible({ timeout: 10_000 });
      expect(await placed(page, a)).toEqual(expected(A, { back: 'left', left: 0, top: 200 }));
      await page.getByTestId('undo').click();
      expect(await placed(page, a)).toEqual(a0);
      expect(await placed(page, b)).toEqual(b0);
      expect((await snapshot(page)).items).toHaveLength(2);
    });

    test('SG-3 겹치는 첫 답은 문제를 적어 한 번만 다시 묻고(호출 2회) 고친 답을 적용한다', async ({ page }) => {
      await installClaudeMock(page);
      const { a, b } = await setup(page);
      const overlapping: Ans[] = [
        { id: 1, back: 'top', left: 1000, top: 1000 },
        { id: 2, back: 'top', left: 1200, top: 1000 }, // A(1000..2000)와 B(1200..2200)가 겹침
      ];
      const fixed: Ans[] = [
        { id: 1, back: 'top', left: 0, top: 0 },
        { id: 2, back: 'bottom', left: 2000, top: 2000 },
      ];
      await setSteps(page, [{ text: answer(overlapping) }, { text: answer(fixed) }]);
      await goal(page);
      await run(page);
      await expect(page.getByTestId('suggest-result')).toBeVisible({ timeout: 10_000 });
      const p = await prompts(page);
      expect(p, 'AI 호출 정확히 2회').toHaveLength(2);
      expect(p[0]).not.toContain('문제:');
      expect(p[1]).toContain('1번 가구(A)가 2번 가구(B)와 겹칩니다.');
      expect(await placed(page, a)).toEqual(expected(A, { back: 'top', left: 0, top: 0 }));
      expect(await placed(page, b)).toEqual(expected(B, { back: 'bottom', left: 2000, top: 2000 }));
      await expect(page.getByTestId('suggest-warnings')).toHaveCount(0);
      await page.waitForTimeout(500);
      expect(await prompts(page), '더 묻지 않는다').toHaveLength(2);
    });

    test('SG-3b 두 번째 답에도 겹침이 남으면 적용하고 경고 문구를 보인다(호출 2회)', async ({ page }) => {
      await installClaudeMock(page);
      const { a, b } = await setup(page);
      const overlapping: Ans[] = [
        { id: 1, back: 'top', left: 1000, top: 1000 },
        { id: 2, back: 'top', left: 1200, top: 1000 },
      ];
      await setSteps(page, [{ text: answer(overlapping) }]); // 마지막 것을 반복: 두 번째도 같은 답
      await goal(page);
      await run(page);
      await expect(page.getByTestId('suggest-result')).toBeVisible({ timeout: 10_000 });
      expect(await prompts(page)).toHaveLength(2);
      await expect(page.getByTestId('suggest-warnings')).toBeVisible();
      await expect(page.getByTestId('suggest-warnings')).toContainText('1번 가구(A)가 2번 가구(B)와 겹칩니다.');
      expect(await placed(page, a)).toEqual(expected(A, { back: 'top', left: 1000, top: 1000 }));
      expect(await placed(page, b)).toEqual(expected(B, { back: 'top', left: 1200, top: 1000 }));
    });

    test('SG-3c 방 밖으로 나간 값은 방 안으로 당겨 넣고, 문제가 없으니 다시 묻지 않는다', async ({ page }) => {
      await installClaudeMock(page);
      const { a, b } = await setup(page);
      await setSteps(page, [
        {
          text: answer([
            { id: 1, back: 'top', left: 99990, top: -500 }, // 오른쪽 위로 크게 벗어남
            { id: 2, back: 'left', left: 0, top: 99990 }, // 아래로 벗어남(발자국 1000×1000)
          ]),
        },
      ]);
      await goal(page);
      await run(page);
      await expect(page.getByTestId('suggest-result')).toBeVisible({ timeout: 10_000 });
      // A: left를 4000-1000, top을 0으로 당김. B: top을 3000-1000으로 당김.
      expect(await placed(page, a)).toEqual(expected(A, { back: 'top', left: 3000, top: 0 }));
      expect(await placed(page, b)).toEqual(expected(B, { back: 'left', left: 0, top: 2000 }));
      expect(await prompts(page)).toHaveLength(1);
      await expect(page.getByTestId('suggest-warnings')).toHaveCount(0);
      const snap = await snapshot(page);
      for (const it of snap.items) {
        expect(it.center.x - it.size.w / 2 >= 0 || it.rotationDeg % 180 === 90).toBe(true);
        expect(it.warning).toBe(false);
      }
    });

    test('SG-4 가구가 없거나 목적이 비면 추천받기가 눌리지 않고, 형식이 틀린 답은 적용하지 않고 오류를 보인다', async ({ page }) => {
      await installClaudeMock(page);
      await openApp(page);
      await page.getByTestId('tab-suggest').click();
      await goal(page);
      await expect(page.getByTestId('suggest-blocker')).toContainText('가구를 먼저 추가');
      await expect(page.getByTestId('suggest-run')).toBeDisabled();
      await page.getByTestId('tab-main').click();
      await addA(page);
      await addB(page);
      await page.getByTestId('tab-suggest').click();
      await goal(page, '');
      await expect(page.getByTestId('suggest-run')).toBeDisabled();
      await goal(page, '   ');
      await expect(page.getByTestId('suggest-run')).toBeDisabled();
      await goal(page, '넓어 보이게');
      await expect(page.getByTestId('suggest-run')).toBeEnabled();
      expect(await prompts(page)).toHaveLength(0);

      const before = (await snapshot(page)).items;
      const bad: Array<[string, string]> = [
        ['없는 번호', answer([{ id: 5, back: 'top', left: 0, top: 0 }, { id: 2, back: 'top', left: 0, top: 1000 }])],
        ['빠진 가구', answer([{ id: 1, back: 'top', left: 0, top: 0 }])],
        ['숫자가 아닌 값', answer([{ id: 1, back: 'top', left: 'abc', top: 0 }, { id: 2, back: 'top', left: 0, top: 1000 }])],
        ['없는 back', answer([{ id: 1, back: 'north', left: 0, top: 0 }, { id: 2, back: 'top', left: 0, top: 1000 }])],
        ['JSON이 아님', '추천드립니다: 책상을 창가에 두세요.'],
      ];
      for (const [label, text] of bad) {
        await setSteps(page, [{ text }]);
        const n = (await prompts(page)).length;
        await run(page);
        await expect(page.getByTestId('suggest-error'), label).toBeVisible({ timeout: 10_000 });
        await expect(page.getByTestId('suggest-result'), label).toHaveCount(0);
        expect((await snapshot(page)).items, `${label}: 가구는 그대로`).toEqual(before);
        expect((await prompts(page)).length, `${label}: 형식 오류는 다시 묻지 않는다`).toBe(n + 1);
        await expect(page.getByTestId('suggest-retry')).toBeVisible();
      }
    });

    test('SG-5 AI를 쓸 수 없으면 안내와 복사·붙여넣기 경로가 보이고 붙여 넣은 답도 같은 검사를 거쳐 적용된다', async ({ page, context }) => {
      await context.grantPermissions(['clipboard-read', 'clipboard-write']);
      let posts = 0;
      await page.route('**/api/suggest-layout', async (route) => {
        if (route.request().method() === 'POST') posts++;
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ available: false }) });
      });
      const { a, b } = await setup(page);
      expect(await page.evaluate(() => 'claude' in window)).toBe(false);
      await expect(page.getByTestId('suggest-manual')).toBeVisible();
      await expect(page.getByTestId('suggest-status')).toContainText('AI를 바로 부를 수 없어요');
      await expect(page.getByTestId('suggest-run')).toHaveCount(0);
      await expect(page.getByTestId('suggest-copy')).toBeDisabled(); // 목적이 비어 있음
      await goal(page, '손님이 와도 좋게');
      await expect(page.getByTestId('suggest-copy')).toBeEnabled();
      await page.getByTestId('suggest-copy').click();
      const clip = await page.evaluate(() => navigator.clipboard.readText().catch(() => null));
      if (clip !== null) {
        expect(clip).toContain('손님이 와도 좋게');
        expect(clip).toContain('1. A');
      } else {
        await expect(page.getByTestId('suggest-prompt-text')).toHaveValue(/손님이 와도 좋게/);
      }

      const before = (await snapshot(page)).items;
      // 틀린 답은 적용하지 않는다
      await page.getByTestId('suggest-paste').fill(answer([{ id: 1, back: 'top', left: 0, top: 0 }]));
      await page.getByTestId('suggest-paste-apply').click();
      await expect(page.getByTestId('suggest-error')).toBeVisible();
      expect((await snapshot(page)).items).toEqual(before);

      // 겹치는 답은 같은 검사로 경고와 함께 적용(다시 묻지 않는다)
      await page.getByTestId('suggest-paste').fill(`다음과 같습니다.\n${answer(GOOD())}\n끝`);
      await page.getByTestId('suggest-paste-apply').click();
      await expect(page.getByTestId('suggest-result')).toBeVisible();
      expect(await placed(page, a)).toEqual(expected(A, { back: 'left', left: 0, top: 200 }));
      expect(await placed(page, b)).toEqual(expected(B, { back: 'right', left: 3000, top: 1000 }));
      await expect(page.getByTestId('suggest-warnings')).toHaveCount(0);

      await page.getByTestId('suggest-paste').fill(answer([{ id: 1, back: 'top', left: 1000, top: 1000 }, { id: 2, back: 'top', left: 1200, top: 1000 }]));
      await page.getByTestId('suggest-paste-apply').click();
      await expect(page.getByTestId('suggest-warnings')).toContainText('겹칩니다');
      expect(posts, 'POST 없음').toBe(0);
    });

    test('SG-6 서버 경로: GET {available:true} → POST {goal, room, items}로 묻고 {text}를 적용한다', async ({ page }) => {
      const bodies: Array<{ headers: Record<string, string>; json: Record<string, unknown> }> = [];
      let gets = 0;
      await page.route('**/api/suggest-layout', async (route) => {
        const req = route.request();
        if (req.method() === 'POST') {
          bodies.push({ headers: req.headers(), json: JSON.parse(req.postData() ?? 'null') as Record<string, unknown> });
          await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ text: answer(GOOD()) }) });
        } else {
          gets++;
          await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ available: true }) });
        }
      });
      const { a, b } = await setup(page);
      expect(await page.evaluate(() => 'claude' in window)).toBe(false);
      await expect(page.getByTestId('suggest-manual')).toHaveCount(0);
      await goal(page);
      await run(page);
      await expect(page.getByTestId('suggest-result')).toBeVisible({ timeout: 10_000 });
      expect(gets).toBeGreaterThanOrEqual(1);
      expect(bodies).toHaveLength(1);
      expect(bodies[0]!.headers['content-type']).toContain('application/json');
      const json = bodies[0]!.json;
      expect(json.goal).toBe('공부에 집중하기 좋게');
      const room = json.room as { corners: unknown[]; walls: unknown[]; openings: unknown[] };
      expect(room.corners).toHaveLength(4);
      expect(Array.isArray(room.walls)).toBe(true);
      expect(Array.isArray(room.openings)).toBe(true);
      const items = json.items as Array<Record<string, unknown>>;
      expect(items.map((i) => i.name)).toEqual(['A', 'B']);
      expect(items[0]).toMatchObject({ w: 1000, d: 600, h: 700, rotationDeg: 0 });
      expect(items[1]).toMatchObject({ w: 1000, d: 1000, h: 500 });
      expect(Object.keys(json).sort()).toEqual(['goal', 'items', 'room']);
      expect(await placed(page, a)).toEqual(expected(A, { back: 'left', left: 0, top: 200 }));
      expect(await placed(page, b)).toEqual(expected(B, { back: 'right', left: 3000, top: 1000 }));
    });

    test('SG-7 만드는 중에 그만을 누르면 아무것도 바뀌지 않는다', async ({ page }) => {
      await installClaudeMock(page);
      const { a, b } = await setup(page);
      await setSteps(page, [{ text: answer(GOOD()) }], 2500);
      const before = (await snapshot(page)).items;
      const a0 = await placed(page, a);
      await goal(page);
      await run(page);
      await expect(page.getByTestId('suggest-stop')).toBeVisible();
      await expect(page.getByTestId('suggest-status')).toContainText('만드는 중');
      await page.getByTestId('suggest-stop').click();
      await expect(page.getByTestId('suggest-stop')).toHaveCount(0);
      await page.waitForTimeout(3200); // 모의 답이 도착했을 시간이 지나도
      expect((await snapshot(page)).items).toEqual(before);
      expect(await placed(page, a)).toEqual(a0);
      expect(await placed(page, b)).toBeTruthy();
      await expect(page.getByTestId('suggest-result')).toHaveCount(0);
      await expect(page.getByTestId('suggest-error')).toHaveCount(0);
      expect(await prompts(page)).toHaveLength(1);
      await expect(page.getByTestId('suggest-run')).toBeEnabled();
      // 그만 뒤 undo 기록도 늘지 않았다: 가구 추가 이전으로만 되돌려진다
      await page.getByTestId('undo').click();
      expect((await snapshot(page)).items).toHaveLength(1);
    });
  });
}
