/**
 * 모든 페이지에서 CSP 위반이 없는지 확인한다.
 *
 * 빌드 뒤 페이지마다 CSP의 해시를 그 페이지에 실제로 있는 인라인 스크립트·스타일 것만 남긴다
 * (src/integrations/csp-per-page.ts). 해시를 잘못 빼면 그 페이지의 스크립트·스타일이 막힌다.
 * 사이트맵의 모든 바깥 페이지(한·영)와 그 안의 도구 화면을 열고, 펼침 메뉴·테마 바꾸기처럼 실행 중에 화면을 바꾸는
 * 동작을 해 본 뒤 위반(securitypolicyviolation)이 하나도 없어야 한다.
 * 다른 E2E도 모두 인라인 스크립트·스타일이 막히면 실패한다 (test.ts).
 */
import { expect, test, type Page } from './test';
import { cspViolations } from './test';

async function sitemapPaths(page: Page): Promise<string[]> {
  const xml = await (await page.request.get('/sitemap.xml')).text();
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => new URL(m[1]!).pathname);
}

/** 페이지를 열고 도구 화면이 있으면 그 안이 뜰 때까지 기다린다 */
async function open(page: Page, path: string) {
  await page.goto(path);
  if (await page.locator('iframe[data-tool-frame]').count()) {
    await page.frameLocator('iframe[data-tool-frame]').locator('#app *').first().waitFor();
  }
  await page.waitForLoadState('networkidle');
}

test('사이트맵의 모든 페이지에서 CSP 위반이 없다 (펼침 메뉴·테마 바꾸기 포함)', async ({
  page,
}) => {
  test.setTimeout(600_000);
  const paths = await sitemapPaths(page);
  expect(paths.length).toBeGreaterThan(100);
  for (const path of paths) {
    await open(page, path);
    const trigger = page.locator('[data-mega-trigger]').first();
    await trigger.click();
    await expect(page.locator('[data-mega-panel]:not([hidden])')).toHaveCount(1);
    await page.keyboard.press('Escape');
    await page.locator('[data-theme-toggle]').first().click();
    await page.locator('[data-theme-toggle]').first().click();
    expect(cspViolations(page), path).toEqual([]);
  }
});

test('휴대폰 메뉴·가이드 창·따라 하기·예시 파일·움직이는 그림에서 CSP 위반이 없다', async ({
  page,
}) => {
  test.setTimeout(240_000);
  await page.setViewportSize({ width: 390, height: 844 });
  for (const path of ['/', '/en/']) {
    await open(page, path);
    await page.locator('[data-mobile-menu-open]').click();
    await expect(page.locator('[data-mobile-menu]')).toBeVisible();
    await page.locator('[data-mobile-menu-close]').click();
  }
  await page.setViewportSize({ width: 1280, height: 800 });

  // 홈·안전 페이지의 움직이는 그림 (보일 때 움직인다)
  for (const path of ['/', '/safety/', '/en/safety/']) {
    await open(page, path);
    await page
      .locator('[data-local-motion], [data-safety-motion]')
      .first()
      .scrollIntoViewIfNeeded();
    await page.waitForTimeout(1500);
  }

  for (const [path, sample] of [
    ['/pdf/merge/', '예시 파일로 해 보기'],
    ['/en/image/compress/', 'Try it with a sample file'],
    ['/pdf/watermark/', '예시 파일로 해 보기'],
    ['/text/csv-encoding/', '예시 파일로 해 보기'],
  ] as const) {
    await open(page, path);
    // 예시 파일: 도구가 파일을 그려 보인다 (PDF는 pdf.js가 글꼴을 넣는다).
    // 따라 하기보다 먼저 한다 (따라 하기가 끝나는 신호가 frame에 닿기 전에 누르면 눌리지 않는다)
    const frame = page.frameLocator('iframe[data-tool-frame]');
    await frame.getByRole('button', { name: sample }).click();
    // 다른 테스트와 함께 돌면 견본을 받고 여는 데 오래 걸릴 수 있다
    await expect(frame.getByRole('button', { name: sample })).toHaveCount(0, { timeout: 30_000 });
    // 가이드 창: 가이드 페이지를 받아 본문을 옮겨 넣는다
    const guide = page.locator('[data-guide-open]');
    if (await guide.count()) {
      await guide.click();
      await expect(page.locator('[data-guide-body] p').first()).toBeVisible();
      await page.keyboard.press('Escape');
    }
    // 따라 하기 창
    await page.locator('[data-tour-open]').click();
    await page.locator('[data-tour-close]').click();
    await page.waitForTimeout(2000);
    expect(cspViolations(page), path).toEqual([]);
  }
});
