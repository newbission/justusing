/**
 * E2E 테스트 설정. 개발 서버가 아니라 빌드 결과로 돌린다.
 * 도구 격리(sandbox iframe)와 CSP는 빌드 결과에서만 켜지기 때문이다.
 * 서버는 배포와 같은 Cloudflare 방식(wrangler dev: wrangler.jsonc, _headers)을 쓴다.
 * astro preview는 CORS 헤더를 저절로 붙여서, 배포에서만 깨지는 문제를 가린다.
 *
 *   npm run build && npm run test:e2e
 *
 * 로컬에서 설치된 크롬을 쓰려면 PLAYWRIGHT_CHANNEL=chrome 을 붙인다.
 */
import { defineConfig, devices } from '@playwright/test';

/** npm run preview(4322)와 겹치지 않게 (겹치면 로컬에서 그 서버를 재사용해 버린다) */
const PORT = 8788;

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
    command: `npx wrangler dev --port ${PORT}`,
    port: PORT,
    reuseExistingServer: !process.env.CI,
  },
});
