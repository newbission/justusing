/**
 * 도구 목록(카테고리 페이지·홈) E2E. 도구를 묶음별 소제목으로 나누고 카드마다 아이콘이 있다.
 */
import { expect, test } from './test';

test('PDF 목록은 묶음별 소제목 아래 도구를 보여준다', async ({ page }) => {
  await page.goto('/pdf/');
  await expect(page.getByRole('heading', { level: 2 })).toHaveText([
    '보기·편집',
    '페이지 정리',
    '변환',
  ]);
  const convert = page.locator('section', {
    has: page.getByRole('heading', { level: 2, name: '변환' }),
  });
  await expect(convert.getByRole('heading', { level: 3 })).toHaveText([
    'PDF를 이미지로',
    '이미지를 PDF로',
  ]);
  // 모든 카드에 아이콘이 있다
  const cards = page.locator('.card');
  await expect(cards.locator('svg.tool-icon')).toHaveCount(await cards.count());
});

test('홈에서도 묶음별로 나누고, 영어판은 영어 소제목을 쓴다', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 3, name: '페이지 정리' })).toBeVisible();
  await page.goto('/en/pdf/');
  await expect(page.getByRole('heading', { level: 2 })).toHaveText([
    'View & edit',
    'Organize pages',
    'Convert',
  ]);
});
