/**
 * 글 페이지(소개·개인정보처리방침·이용약관·문의) E2E.
 * 광고 심사가 요구하는 페이지라, 모든 페이지의 바닥글에서 갈 수 있고 사이트맵에 있어야 한다.
 */
import { expect, test } from '@playwright/test';

const pages = [
  { name: '소개', path: '/about/' },
  { name: '개인정보처리방침', path: '/privacy/' },
  { name: '이용약관', path: '/terms/' },
  { name: '문의', path: '/contact/' },
];

for (const { name, path } of pages) {
  test(`도구 페이지 바닥글에서 ${name} 페이지로 간다`, async ({ page }) => {
    await page.goto('/pdf/merge/');
    await page.getByRole('contentinfo').getByRole('link', { name, exact: true }).click();
    await expect(page).toHaveURL(path);
    await expect(page.getByRole('heading', { level: 1, name })).toBeVisible();
  });
}

test('글 페이지가 모두 사이트맵에 있다', async ({ request, baseURL }) => {
  const xml = await (await request.get('/sitemap.xml')).text();
  for (const { path } of pages) {
    // 사이트맵의 주소는 배포 도메인으로 적히므로 경로만 본다
    expect(xml, `${baseURL}${path}`).toContain(`${path}</loc>`);
  }
});

test('문의 페이지와 개인정보처리방침의 메일 주소가 같다', async ({ page }) => {
  await page.goto('/contact/');
  const contact = await page.locator('main a[href^="mailto:"]').first().getAttribute('href');
  await page.goto('/privacy/');
  const privacy = await page.locator('main a[href^="mailto:"]').first().getAttribute('href');
  expect(contact).toMatch(/^mailto:contact@/);
  expect(privacy).toBe(contact);
});
