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

test('ads.txt와 소유 확인 태그가 같은 AdSense 게시자를 가리킨다', async ({ page, request }) => {
  await page.goto('/');
  const client = await page.locator('meta[name="google-adsense-account"]').getAttribute('content');
  expect(client).toMatch(/^ca-pub-\d+$/);

  const adsTxt = await (await request.get('/ads.txt')).text();
  expect(adsTxt.trim()).toBe(`google.com, ${client!.replace('ca-', '')}, DIRECT, f08c47fec0942fa0`);
});

test('광고 스크립트는 아직 어느 페이지에도 없다', async ({ page }) => {
  // 광고는 쿠키 동의 배너와 함께 넣는다. 그 전에 스크립트가 들어가면 동의 없이 쿠키를 쓰게 된다.
  for (const path of ['/', '/pdf/merge/', '/privacy/']) {
    await page.goto(path);
    await expect(page.locator('script[src*="googlesyndication"]')).toHaveCount(0);
  }
});
