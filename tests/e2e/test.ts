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
import { test as base, expect, type Page, type Request } from '@playwright/test';
import { expectLocalOnly } from './local-only';

export { expect, type Page, type Request } from '@playwright/test';

/** CSP 위반 하나 (바깥 페이지·도구 화면 모두). `blocked`가 'inline'이면 인라인 스크립트·스타일이 막힌 것 */
export interface CspViolation {
  directive: string;
  blocked: string;
  document: string;
  source: string;
}

const CSP_MARK = '[csp-violation] ';
const violations = new WeakMap<Page, CspViolation[]>();

/** 지금까지 이 페이지(와 그 안의 frame)에서 생긴 CSP 위반 */
export function cspViolations(page: Page): CspViolation[] {
  return violations.get(page) ?? [];
}

/** 광고 스크립트가 쓰는 주소 (src/components/AdsScript.astro) */
export const AD_HOSTS = /googlesyndication|doubleclick|adtrafficquality|googletagservices/;

export const test = base.extend({
  page: async ({ page, baseURL }, use) => {
    await page.route(AD_HOSTS, (route) =>
      route.fulfill({ contentType: 'text/javascript', body: '' }),
    );
    const requests: Request[] = [];
    page.on('request', (request) => requests.push(request));
    // CSP 위반을 모은다. 도구 화면(출처 없는 iframe)에서도 init script가 돌고 console은 페이지로 모인다
    const found: CspViolation[] = [];
    violations.set(page, found);
    page.on('console', (message) => {
      const text = message.text();
      if (text.startsWith(CSP_MARK)) found.push(JSON.parse(text.slice(CSP_MARK.length)));
    });
    await page.addInitScript((mark) => {
      addEventListener('securitypolicyviolation', (event) => {
        console.debug(
          mark +
            JSON.stringify({
              directive: event.effectiveDirective,
              blocked: event.blockedURI,
              document: event.documentURI,
              source: `${event.sourceFile}:${event.lineNumber}`,
            }),
        );
      });
    }, CSP_MARK);
    await use(page);
    expectLocalOnly(page, requests, baseURL!);
    // 페이지마다 CSP 해시를 그 페이지 것만 남기므로(src/integrations/csp-per-page.ts), 어떤 테스트에서든
    // 인라인 스크립트·스타일이 막히면 실패한다. 외부 연결을 막는 것을 확인하는 테스트가 있어 다른 위반은 여기서 보지 않는다
    expect(
      found.filter(
        (v) => v.blocked === 'inline' && /^(script|style)-src(-elem)?$/.test(v.directive),
      ),
      '인라인 스크립트·스타일이 CSP에 막혔습니다',
    ).toEqual([]);
  },
});
