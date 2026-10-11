/**
 * E2E 테스트 설정. 개발 서버가 아니라 빌드 결과(npm run build → astro preview)로 돌린다.
 * 도구 격리(sandbox iframe)와 CSP는 빌드 결과에서만 켜지기 때문이다.
 *
 *   npm run build && npm run test:e2e
 *
 * 로컬에서 설치된 크롬을 쓰려면 PLAYWRIGHT_CHANNEL=chrome 을 붙인다.
 */
import { defineConfig, devices } from '@playwright/test';

const PORT = 4322;

export default defineConfig({
  testDir: 'tests/e2e',
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    channel: process.env.PLAYWRIGHT_CHANNEL,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `npx astro preview --port ${PORT}`,
    port: PORT,
    reuseExistingServer: !process.env.CI,
  },
});
