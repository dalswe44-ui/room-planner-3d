// 주요 화면 스크린샷을 docs/evidence/에 남긴다. 파일 이름에 task-id, 체크리스트 ID, 뷰포트가 들어간다.
// 판정은 checklist.spec.ts의 수치 비교가 하고, 여기서는 사람이 볼 증빙만 만든다(V-4, F-5 색은 화면 확인 항목).
import { expect, test, type Page } from '@playwright/test';
import { addA, addItem, addOverlappingB, enter, openApp, snapshot, VIEWPORTS } from './helpers';

// 실행마다 추적 파일을 덮어쓰지 않도록, EVIDENCE_DIR을 줄 때만 그 폴더에 저장한다(예: EVIDENCE_DIR=docs/evidence/2026-11-17-T-017).
const DIR = process.env.EVIDENCE_DIR;
// 파일 이름 앞부분. 회차마다 EVIDENCE_PREFIX로 바꾼다(기본 T-005).
const PREFIX = process.env.EVIDENCE_PREFIX ?? 'T-005';

async function settle(page: Page) {
  // frameloop="demand"라 한 프레임 그려질 시간을 준다
  await page.waitForTimeout(400);
}

async function shot(page: Page, name: string) {
  if (!DIR) throw new Error('EVIDENCE_DIR 없이 shot을 부를 수 없다');
  await settle(page);
  await page.screenshot({ path: `${DIR}/${name}.png` });
}

for (const vp of VIEWPORTS) {
  test.describe(`[${vp.name}] 증빙`, () => {
    test.use({ viewport: vp.size });
    test.skip(!DIR, 'EVIDENCE_DIR이 없으면 스크린샷 증빙을 만들지 않는다');
    test.beforeEach(async ({ page }) => {
      await openApp(page);
    });

    test('R-1 기본 상태 화면', async ({ page }) => {
      await shot(page, `${PREFIX}_R-1_default_${vp.name}`);
    });

    test('R-4 거부 문구 화면', async ({ page }) => {
      await enter(page, 'room-width', '3.5');
      await expect(page.getByTestId('room-width-error')).toBeVisible();
      await shot(page, `${PREFIX}_R-4_reject_${vp.name}`);
    });

    test('F-1 가구 추가 평면 뷰(이름 표시 확인용)', async ({ page }) => {
      await addItem(page, '책상', '1200', '600', '720');
      await shot(page, `${PREFIX}_F-1_plan_${vp.name}`);
    });

    test('W-1 겹침 경고 평면 뷰', async ({ page }) => {
      await addOverlappingB(page);
      await expect(page.getByTestId('item-status')).toContainText('겹침');
      await shot(page, `${PREFIX}_W-1_overlap_plan_${vp.name}`);
    });

    test('V-4 겹침 상태의 3D 뷰', async ({ page }) => {
      await addOverlappingB(page);
      await page.getByTestId('view-3d').click();
      await expect.poll(async () => (await snapshot(page)).view).toBe('3d');
      await shot(page, `${PREFIX}_V-4_overlap_3d_${vp.name}`);
    });

    test('D-1 벽까지 거리 화면', async ({ page }) => {
      await addA(page);
      await page.getByTestId('item-dist-0').scrollIntoViewIfNeeded();
      await shot(page, `${PREFIX}_D-1_distances_${vp.name}`);
    });
  });
}
