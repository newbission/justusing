/** 작업 효용·즉시 진입·기기 안 처리 경계가 이어지는 홈 소개 흐름. */
import { test, expect } from './test';

const locales = [
  {
    path: '/',
    choose: '무료 도구 보기',
    safety: '처리 방식 알아보기',
    prefix: '',
    scope: [/무료/, /앱 설치/, /가입/],
    how: [/파일/, /브라우저/, /광고/, /통계/],
    data: [/OCR|글자 인식/, /배경/, /모바일 데이터/, /용량/, /다시/],
  },
  {
    path: '/en/',
    choose: 'Explore free tools',
    safety: 'How it works',
    prefix: '/en',
    scope: [/free/i, /app/i, /account|sign.?up/i],
    how: [/file/i, /browser/i, /ads/i, /analytics/i],
    data: [/OCR|text recognition/i, /background/i, /mobile data/i, /size/i, /again/i],
  },
];

for (const locale of locales) {
  test(`${locale.path} 작업과 진입을 먼저 보여 주고 처리 경계·자료 수신·실제 결과로 이어진다`, async ({
    page,
  }) => {
    await page.goto(locale.path);
    const story = page.locator('.home-value-story');
    await expect(story).toBeVisible();
    const local = story.locator('.local-hero');
    for (const text of locale.scope) await expect(local).toContainText(text);
    await expect(story.locator('.home-pains')).toHaveCount(0);
    const proof = local.locator('.local-proof');
    await expect(proof).toBeVisible();
    await expect(proof.locator('.proof-steps li')).toHaveCount(3);
    const shortcuts = local.locator('.story-start');
    const links = shortcuts.getByRole('link');
    await expect(links).toHaveCount(4);
    for (const link of await links.all()) {
      await expect(link).toHaveAttribute(
        'href',
        new RegExp(`^${locale.prefix}/(pdf|image|text|video)/[^/]+/$`),
      );
    }
    const how = story.locator('.home-how');
    for (const text of locale.how) await expect(how).toContainText(text);
    const offer = local.locator('.story-scope');
    await expect(offer).toContainText(locale.prefix ? /free/i : /무료/);
    for (const category of [/PDF/, locale.prefix ? /compress/i : /이미지/, /CSV/]) {
      await expect(shortcuts).toContainText(category);
    }
    const dataNote = story.locator('.home-data-note');
    for (const text of locale.data) await expect(dataNote).toContainText(text);
    // DOM의 의미 순서를 확인한다. 위치·높이의 일시적인 로딩 변화와는 독립이다.
    const sequence = [
      '.local-hero h1',
      '.story-start',
      '.local-proof',
      '.home-how',
      '.home-data-note',
      '.feature-intro',
    ];
    const order = await page.evaluate(
      (selectors) =>
        selectors.map((selector) => {
          const element = document.querySelector(selector)!;
          return selectors.map((next) =>
            Boolean(
              element.compareDocumentPosition(document.querySelector(next)!) &
              Node.DOCUMENT_POSITION_FOLLOWING,
            ),
          );
        }),
      sequence,
    );
    for (let index = 0; index < sequence.length - 1; index++)
      expect(order[index][index + 1]).toBe(true);
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
    await expect(local.getByRole('link', { name: locale.safety })).toHaveAttribute(
      'href',
      `${locale.prefix}/safety/`,
    );
    const start = local.getByRole('link', { name: locale.choose });
    await start.focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('#directory-title')).toBeInViewport();
    const toolCount = await page.locator('#tools .card').count();
    await expect(offer).toContainText(String(toolCount));
  });

  test(`${locale.path} 좁은 화면의 두 테마에서도 원리와 데이터 안내를 읽을 수 있다`, async ({
    page,
  }) => {
    for (const width of [320, 390]) {
      await page.setViewportSize({ width, height: 844 });
      for (const colorScheme of ['light', 'dark'] as const) {
        await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
        await page.goto(locale.path);
        for (const selector of [
          '.story-start',
          '.local-hero',
          '.home-how',
          '.local-proof',
          '.home-data-note',
        ]) {
          const section = page.locator(selector);
          await section.scrollIntoViewIfNeeded();
          await expect(section).toBeVisible();
          expect(
            await page.evaluate(() => document.documentElement.scrollWidth),
          ).toBeLessThanOrEqual(width);
        }
        await expect(page.locator('.home-data-note')).toContainText(
          locale.prefix ? /mobile data/i : /모바일 데이터/,
        );
      }
    }
  });

  test(`${locale.path} 자바스크립트 없이도 차별점과 다운로드 안내가 남는다`, async ({
    browser,
    baseURL,
  }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    try {
      // 실제 도구 실행 대신 정적 소개 자체의 대체 화면을 검증한다.
      await page.goto(new URL(locale.path, baseURL).href);
      await expect(page.locator('.local-hero h1')).toBeVisible();
      await expect(page.locator('.local-hero .local-proof')).toBeVisible();
      await expect(page.locator('.story-scope')).toContainText(locale.prefix ? /free/i : /무료/);
      await expect(page.locator('.home-data-note')).toContainText(
        locale.prefix ? /mobile data/i : /모바일 데이터/,
      );
      await expect(
        page.locator('.local-hero').getByRole('link', { name: locale.choose }),
      ).toHaveAttribute('href', '#tools');
    } finally {
      await context.close();
    }
  });
}
