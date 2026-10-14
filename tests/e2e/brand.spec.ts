/**
 * 로고·아이콘·링크 미리보기 이미지 E2E. 주소가 깨져도 화면에는 티가 나지 않아 따로 확인한다.
 */
import { expect, test } from './test';

const FILES = [
  ['/favicon.svg', 'image/svg+xml'],
  ['/favicon.ico', 'image/'],
  ['/apple-touch-icon.png', 'image/png'],
  ['/og.png', 'image/png'],
  ['/brand/mark.svg', 'image/svg+xml'],
  ['/brand/lockup-light.svg', 'image/svg+xml'],
  ['/brand/lockup-dark.svg', 'image/svg+xml'],
  ['/brand/mark-512.png', 'image/png'],
  ['/brand/lockup-light.png', 'image/png'],
  ['/brand/lockup-dark.png', 'image/png'],
] as const;

for (const [path, type] of FILES) {
  test(`${path}를 이미지로 내려준다`, async ({ request }) => {
    const response = await request.get(path);
    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toContain(type);
  });
}

test('페이지 머리말이 아이콘과 링크 미리보기 이미지를 가리킨다', async ({ page }) => {
  await page.goto('/en/pdf/merge/');
  const head = page.locator('head');
  await expect(head.locator('link[rel="icon"][type="image/svg+xml"]')).toHaveAttribute(
    'href',
    '/favicon.svg',
  );
  await expect(head.locator('link[rel="apple-touch-icon"]')).toHaveAttribute(
    'href',
    '/apple-touch-icon.png',
  );
  const og = await head.locator('meta[property="og:image"]').getAttribute('content');
  expect(og).toMatch(/^https:\/\/.+\/og\.png$/);
  await expect(head.locator('meta[name="twitter:card"]')).toHaveAttribute(
    'content',
    'summary_large_image',
  );
});

test('머리글 로고가 홈으로 가는 이름 있는 링크다', async ({ page }) => {
  await page.goto('/pdf/');
  const logo = page.getByRole('link', { name: 'justusing' }).first();
  await expect(logo).toHaveAttribute('href', '/');
  await expect(logo.locator('svg')).toBeVisible();
});
