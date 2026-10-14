/**
 * 영어판과 언어 고르기 E2E.
 *
 * Playwright 브라우저는 자동화 브라우저(navigator.webdriver)라 처음 방문 언어 이동이 꺼진다.
 * 이동 자체를 볼 때만 그 표시를 지우고, 브라우저 언어를 정해서 연다.
 */
import { fileURLToPath } from 'node:url';
import { expect, test, type Page } from './test';

const fixture = (name: string) => fileURLToPath(new URL(`../fixtures/${name}`, import.meta.url));

/** 사람이 쓰는 브라우저처럼 보이게 한다 (자동 언어 이동을 켜려고) */
async function asPerson(page: Page) {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
  });
}

test('영어 페이지는 lang과 문구가 영어다', async ({ page }) => {
  await page.goto('/en/');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'File tools that run in your browser, no uploads',
  );
  await expect(page.getByRole('link', { name: 'Merge PDF' })).toHaveAttribute(
    'href',
    '/en/pdf/merge/',
  );
});

for (const path of ['/en/about/', '/en/privacy/', '/en/terms/', '/en/contact/']) {
  test(`영어 글 페이지 ${path} 가 열리고 바닥글이 영어 페이지로 이어진다`, async ({ page }) => {
    await page.goto(path);
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    const footer = page.getByRole('contentinfo');
    await expect(footer.getByRole('link', { name: 'Privacy Policy' })).toHaveAttribute(
      'href',
      '/en/privacy/',
    );
  });
}

test('영어 도구 화면도 영어로 나오고, 합친 파일 이름도 영어다', async ({ page }) => {
  await page.goto('/en/pdf/merge/');
  const frame = page.frameLocator('iframe[data-tool-frame]');
  await expect(frame.locator('html')).toHaveAttribute('lang', 'en');
  await frame
    .locator('input[type=file]')
    .first()
    .setInputFiles([fixture('three-pages.pdf'), fixture('korean.pdf')]);
  await frame.getByRole('button', { name: 'Merge PDF' }).click();
  const download = page.waitForEvent('download');
  await frame.getByRole('button', { name: 'Download' }).click();
  expect((await download).suggestedFilename()).toBe('three-pages_merged.pdf');
});

test('영어 나누기 도구의 범위 오류도 영어다', async ({ page }) => {
  await page.goto('/en/pdf/split/');
  const frame = page.frameLocator('iframe[data-tool-frame]');
  await frame.locator('input[type=file]').setInputFiles([fixture('three-pages.pdf')]);
  await frame.getByLabel('Page ranges').fill('9');
  await expect(frame.getByRole('alert')).toContainText('There is no page 9');
});

test('다른 언어판을 검색엔진에 알린다', async ({ page }) => {
  await page.goto('/pdf/merge/');
  const alternates = page.locator('link[rel="alternate"]');
  await expect(alternates.and(page.locator('[hreflang="en"]'))).toHaveAttribute(
    'href',
    /\/en\/pdf\/merge\/$/,
  );
  await expect(alternates.and(page.locator('[hreflang="ko"]'))).toHaveAttribute(
    'href',
    /justus\.ing\/pdf\/merge\/$/,
  );
});

test('사이트맵에 영어 페이지가 있다', async ({ request }) => {
  const xml = await (await request.get('/sitemap.xml')).text();
  expect(xml).toContain('/en/pdf/merge/</loc>');
  expect(xml).toContain('/en/privacy/</loc>');
});

test.describe('처음 방문 언어', () => {
  test.use({ locale: 'en-US' });

  test('영어 브라우저로 한국어 페이지에 오면 영어판으로 간다', async ({ page }) => {
    await asPerson(page);
    await page.goto('/pdf/merge/?from=test');
    await expect(page).toHaveURL('/en/pdf/merge/?from=test');
  });

  test('직접 한국어를 고르면 다음부터 한국어로 연다', async ({ page }) => {
    await asPerson(page);
    await page.goto('/en/');
    await page.getByRole('navigation', { name: 'Language' }).getByRole('link').click();
    await expect(page).toHaveURL('/');
    await page.goto('/pdf/merge/');
    await expect(page).toHaveURL('/pdf/merge/');
  });

  test('검색 로봇은 보내지 않는다', async ({ browser, baseURL }) => {
    const context = await browser.newContext({
      locale: 'en-US',
      userAgent: 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
    });
    const page = await context.newPage();
    await asPerson(page);
    await page.goto(`${baseURL}/pdf/merge/`);
    await expect(page.locator('html')).toHaveAttribute('lang', 'ko');
    expect(new URL(page.url()).pathname).toBe('/pdf/merge/');
    await context.close();
  });
});

test.describe('한국어 브라우저', () => {
  test.use({ locale: 'ko-KR' });

  test('한국어 브라우저로 영어 페이지에 오면 한국어판으로 간다', async ({ page }) => {
    await asPerson(page);
    await page.goto('/en/about/');
    await expect(page).toHaveURL('/about/');
  });
});
