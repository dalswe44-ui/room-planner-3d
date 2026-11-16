import { defineConfig } from '@playwright/test';

// 빌드한 결과물을 미리보기 서버로 띄워 검증한다. 브라우저는 시스템에 설치된 Chrome을 쓴다.
// 실행마다 자기 빌드 폴더와 포트를 쓰고 이미 떠 있는 서버를 재사용하지 않는다.
// (여러 작업이 같은 dist/와 4173 포트를 함께 써서 결과가 섞이던 문제: docs/reports/review/pstack-1-tests.md)
// 다른 실행과 동시에 돌릴 때는 E2E_PORT를 다르게 준다.
const port = Number(process.env.E2E_PORT ?? 4173);
const outDir = `.e2e-dist-${port}`;

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 30_000,
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${port}`,
    channel: 'chrome',
    viewport: { width: 1280, height: 800 },
    trace: 'retain-on-failure',
    launchOptions: { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] },
  },
  webServer: {
    command: `npx vite build --outDir ${outDir} --emptyOutDir && npx vite preview --outDir ${outDir} --port ${port} --strictPort`,
    url: `http://localhost:${port}`,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
