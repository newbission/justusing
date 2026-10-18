/**
 * 모든 E2E가 쓰는 test. '@playwright/test' 대신 여기서 가져온다.
 *
 * 광고 주소로 가는 요청을 빈 응답으로 바꾼다. 테스트가 실제 광고 서버에 연결하지 않게 하고,
 * 광고 스크립트를 "받은" 상태(광고 차단 없음)로 맞춘다.
 * 광고 차단 상태는 adblock.spec.ts가 따로 요청을 끊어서 만든다.
 *
 * 테스트가 끝나면 그동안의 모든 요청을 로컬 처리 기준(local-only.ts)으로 확인한다.
 * 도구 테스트가 직접 부르지 않아도 파일을 다루는 모든 테스트가 같은 약속을 지키는지 본다.
 */
import { test as base, type Request } from '@playwright/test';
import { expectLocalOnly } from './local-only';

export { expect, type Page, type Request } from '@playwright/test';

/** 광고 스크립트가 쓰는 주소 (src/components/AdsScript.astro) */
export const AD_HOSTS = /googlesyndication|doubleclick|adtrafficquality|googletagservices/;

export const test = base.extend({
  page: async ({ page, baseURL }, use) => {
    await page.route(AD_HOSTS, (route) =>
      route.fulfill({ contentType: 'text/javascript', body: '' }),
    );
    const requests: Request[] = [];
    page.on('request', (request) => requests.push(request));
    await use(page);
    expectLocalOnly(page, requests, baseURL!);
  },
});
