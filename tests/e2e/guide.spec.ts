/**
 * 가이드 E2E. 목록·글·도구 페이지가 서로 이어지고, 두 언어판과 사이트맵이 맞는지 확인한다.
 */
import { expect, test } from './test';

test('머리글의 가이드에서 목록으로 가고, 글을 열어 도구로 간다', async ({ page }) => {
  await page.goto('/');
  await page
    .getByRole('navigation', { name: '도구 분류' })
    .getByRole('link', { name: '가이드' })
    .click();
  await expect(page).toHaveURL(/\/guide\/$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('가이드');

  await page.getByRole('link', { name: /PDF 용량 줄이는 방법/ }).click();
  await expect(page).toHaveURL(/\/guide\/compress-pdf\/$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'PDF 용량 줄이는 방법 (업로드 없이)',
  );
  await page.getByRole('link', { name: 'PDF 압축 열기' }).click();
  await expect(page).toHaveURL(/\/pdf\/compress\/$/);
});

test('도구 페이지에 그 도구의 가이드가 이어진다', async ({ page }) => {
  await page.goto('/image/resize/');
  const guides = page.locator('section.guides');
  await guides.getByRole('link', { name: '이미지 크기(픽셀) 바꾸는 방법' }).click();
  await expect(page).toHaveURL(/\/guide\/resize-image\/$/);
});

test('영어 가이드는 영어로 쓰여 있고 영어 도구로 이어진다', async ({ page }) => {
  await page.goto('/en/guide/sign-pdf/');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'How to sign a PDF (no printer needed)',
  );
  await expect(page.getByRole('link', { name: 'Open Sign PDF' })).toHaveAttribute(
    'href',
    '/en/pdf/sign/',
  );
  // 글 안의 링크도 영어 페이지로 간다
  const links = await page
    .locator('article a')
    .evaluateAll((anchors) => anchors.map((anchor) => anchor.getAttribute('href')));
  expect(links.length).toBeGreaterThan(0);
  for (const href of links) expect(href).toMatch(/^\/en\//);
});

test('가이드 글에 글 정보가 있고 날짜가 화면과 같다', async ({ page }) => {
  await page.goto('/guide/merge-pdf/');
  const blocks = await page.locator('script[type="application/ld+json"]').allTextContents();
  const article = blocks
    .map((text) => JSON.parse(text) as Record<string, string>)
    .find((data) => data['@type'] === 'Article');
  expect(article?.headline).toBe(await page.getByRole('heading', { level: 1 }).textContent());
  expect(article?.datePublished).toMatch(/^2026-10-15/);
  await expect(page.getByText('2026년 10월 15일 작성')).toBeVisible();
});

test('모든 가이드가 두 언어로 사이트맵에 있다', async ({ request, page }) => {
  await page.goto('/guide/');
  const hrefs = await page
    .locator('.guides a')
    .evaluateAll((anchors) => anchors.map((anchor) => anchor.getAttribute('href')!));
  expect(hrefs.length).toBeGreaterThanOrEqual(6);
  const sitemap = await (await request.get('/sitemap.xml')).text();
  for (const href of ['/guide/', ...hrefs]) {
    expect(sitemap).toContain(`${href}</loc>`);
    expect(sitemap).toContain(`/en${href}</loc>`);
  }
});
