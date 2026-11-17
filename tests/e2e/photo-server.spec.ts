// T-037: 사진 자동 읽기의 서버 경로(api/read-layout)를 page.route로 흉내 낸다. 미리보기와 확인 없이 반영되면 실패.
import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { openApp, snapshot, VIEWPORTS } from './helpers';

const SAMPLE_JPG = 'docs/evidence/layout-reader/sample-handdrawn.jpg';

function sampleLayoutJson(): string {
  const md = readFileSync('docs/evidence/layout-reader/sample-result.md', 'utf8');
  const m = md.match(/```json\n([\s\S]*?)\n```/);
  if (!m) throw new Error('sample-result.md에서 json 블록을 찾지 못했다');
  return m[1]!;
}

type Post = { status: number; body: unknown };
async function mockServer(page: Page, get: { status: number; body: unknown }, post: Post): Promise<{ posts: () => number; types: string[] }> {
  let n = 0;
  const types: string[] = [];
  await page.route('**/api/read-layout', async (route) => {
    const req = route.request();
    if (req.method() === 'POST') {
      n++;
      types.push(req.headers()['content-type'] ?? '');
      await new Promise((r) => setTimeout(r, 700));
      await route.fulfill({ status: post.status, contentType: 'application/json', body: JSON.stringify(post.body) });
    } else {
      await route.fulfill({ status: get.status, contentType: 'application/json', body: JSON.stringify(get.body) });
    }
  });
  return { posts: () => n, types };
}

for (const vp of VIEWPORTS) {
  test.describe(`[${vp.name}] 사진 읽기 서버 경로`, () => {
    test.use({ viewport: vp.size });

    test('SV-1 서버가 있으면 읽고, 미리보기 → 확인 → 적용해야 방이 바뀐다', async ({ page }) => {
      const srv = await mockServer(page, { status: 200, body: { available: true } }, { status: 200, body: { text: sampleLayoutJson() } });
      await openApp(page);
      const room0 = (await snapshot(page)).room;
      await page.getByTestId('tab-photo').click();
      await expect(page.getByTestId('layout-json')).toBeHidden();
      await page.getByTestId('photo-file').setInputFiles(SAMPLE_JPG);
      await expect(page.getByTestId('layout-preview')).toBeVisible({ timeout: 10_000 });
      expect(srv.posts()).toBe(1);
      expect(srv.types[0]).toMatch(/^image\//);
      await expect(page.getByText('이 앱의 서버를 거쳐')).toBeVisible();
      // 미리보기만으로는 반영되지 않는다
      expect((await snapshot(page)).room).toEqual(room0);
      expect((await snapshot(page)).items).toHaveLength(0);
      await page.getByTestId('layout-apply').click();
      expect((await snapshot(page)).room, '확인 대화 상태에서도 그대로').toEqual(room0);
      await page.getByTestId('layout-apply-cancel').click();
      expect((await snapshot(page)).room).toEqual(room0);
      await page.getByTestId('layout-apply').click();
      await page.getByTestId('layout-apply-confirm').click();
      await expect.poll(async () => (await snapshot(page)).room).toEqual({ width: 3400, depth: 2800, ceilingHeight: 2400 });
      expect((await snapshot(page)).items).toHaveLength(3);
      expect(srv.posts()).toBe(1);
    });

    test('SV-2 POST가 503 no_key면 수동 붙여넣기로 내려가고 아무것도 반영되지 않는다', async ({ page }) => {
      const srv = await mockServer(page, { status: 200, body: { available: true } }, { status: 503, body: { error: 'no_key' } });
      await openApp(page);
      const room0 = (await snapshot(page)).room;
      await page.getByTestId('tab-photo').click();
      await page.getByTestId('photo-file').setInputFiles(SAMPLE_JPG);
      await expect(page.getByTestId('layout-json')).toBeVisible({ timeout: 10_000 });
      await expect(page.getByTestId('photo-read-status')).toContainText('바로 읽을 수 없어요');
      expect(srv.posts()).toBe(1);
      await expect(page.getByTestId('layout-preview')).toHaveCount(0);
      expect((await snapshot(page)).room).toEqual(room0);
      // 수동 경로는 여전히 미리보기 → 확인을 거친다
      await page.getByTestId('layout-json').fill(sampleLayoutJson());
      await expect(page.getByTestId('layout-preview')).toBeVisible();
      expect((await snapshot(page)).room).toEqual(room0);
    });

    test('SV-3 GET이 available:false면 처음부터 수동 경로이고 사진을 올려도 POST가 없다', async ({ page }) => {
      const srv = await mockServer(page, { status: 200, body: { available: false } }, { status: 200, body: { text: sampleLayoutJson() } });
      await openApp(page);
      await page.getByTestId('tab-photo').click();
      await expect(page.getByTestId('layout-json')).toBeVisible();
      await page.getByTestId('photo-file').setInputFiles(SAMPLE_JPG);
      await expect(page.getByTestId('photo-preview')).toBeVisible();
      await page.waitForTimeout(800);
      expect(srv.posts()).toBe(0);
      await expect(page.getByTestId('layout-preview')).toHaveCount(0);
    });
  });
}
