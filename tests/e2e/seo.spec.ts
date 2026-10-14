/**
 * 검색엔진용 구조화 데이터 E2E. 화면에 보이는 내용과 어긋나면 검색엔진이 잘못된 정보로 본다.
 */
import { expect, test, type Page } from './test';

interface JsonLd {
  '@type': string;
  [key: string]: unknown;
}

async function jsonLd(page: Page): Promise<JsonLd[]> {
  const blocks = await page.locator('script[type="application/ld+json"]').allTextContents();
  return blocks.map((text) => JSON.parse(text) as JsonLd);
}

test('홈에 사이트 정보가 있다', async ({ page }) => {
  await page.goto('/');
  const site = (await jsonLd(page)).find((data) => data['@type'] === 'WebSite');
  expect(site?.name).toBe('justusing');
});

test('도구 페이지의 FAQ 데이터가 화면의 질문과 같다', async ({ page }) => {
  await page.goto('/pdf/merge/');
  const faq = (await jsonLd(page)).find((data) => data['@type'] === 'FAQPage');
  const questions = (faq?.mainEntity as { name: string }[]).map((item) => item.name);
  const shown = await page.locator('.faq summary').allTextContents();
  expect(questions).toEqual(shown.map((text) => text.trim()));
  expect(questions.length).toBeGreaterThan(2);
});

test('도구 페이지에 무료 웹 도구 정보가 있고 제목과 이름이 같다', async ({ page }) => {
  await page.goto('/pdf/merge/');
  const app = (await jsonLd(page)).find((data) => data['@type'] === 'WebApplication');
  expect(app?.name).toBe(await page.getByRole('heading', { level: 1 }).textContent());
  expect(app?.isAccessibleForFree).toBe(true);
  expect(app?.url).toMatch(/\/pdf\/merge\/$/);
});
