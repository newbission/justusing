/**
 * 모든 E2E가 쓰는 test. '@playwright/test' 대신 여기서 가져온다.
 *
 * 광고 주소로 가는 요청을 빈 응답으로 바꾼다. 테스트가 실제 광고 서버에 연결하지 않게 하고,
 * 광고 스크립트를 "받은" 상태(광고 차단 없음)로 맞춘다.
 * 광고 차단 상태는 adblock.spec.ts가 따로 요청을 끊어서 만든다.
 */
import { test as base } from '@playwright/test';

export { expect, type Page, type Request } from '@playwright/test';

/** 광고 스크립트가 쓰는 주소 (src/components/AdsScript.astro) */
export const AD_HOSTS = /googlesyndication|doubleclick|adtrafficquality|googletagservices/;

export const test = base.extend({
  page: async ({ page }, use) => {
    await page.route(AD_HOSTS, (route) =>
      route.fulfill({ contentType: 'text/javascript', body: '' }),
    );
    await use(page);
  },
});
