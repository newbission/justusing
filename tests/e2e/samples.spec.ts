/**
 * '예시 파일로 해 보기' E2E. 견본이 있는 모든 도구에서 견본을 받아 도구에 넣는지 본다.
 * 견본 목록은 src/frame/samples.ts, 파일은 public/samples/ (scripts/samples/make_samples.py).
 */
import { fileURLToPath } from 'node:url';
import { expect, test } from './test';

/** 사이트맵에 실린 한국어 도구 페이지 주소 (예: /pdf/merge/) */
async function toolPaths(request: import('@playwright/test').APIRequestContext) {
  const xml = await (await request.get('/sitemap.xml')).text();
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)]
    .map((match) => new URL(match[1]!).pathname)
    .filter((path) => /^\/[^/]+\/[^/]+\/$/.test(path) && !/^\/(en|guide)\//.test(path));
}

test('모든 도구에서 예시 파일을 넣으면 첫 화면을 지나 파일 이름이 보인다', async ({
  page,
  request,
}) => {
  test.setTimeout(180_000);
  const paths = await toolPaths(request);
  expect(paths.length).toBeGreaterThanOrEqual(27);

  for (const path of paths) {
    await page.goto(path);
    const frame = page.frameLocator('iframe[data-tool-frame]');
    const button = frame.getByRole('button', { name: '예시 파일로 해 보기' });
    await button.click({ timeout: 10_000 }).catch((error) => {
      throw new Error(`${path}: ${error}`);
    });
    await expect(button, path).toHaveCount(0);
    await expect(frame.getByText(/예시-/).first(), path).toBeVisible();
  }
});

test('영어 화면은 영어 견본을 넣는다', async ({ page }) => {
  await page.goto('/en/pdf/merge/');
  const frame = page.frameLocator('iframe[data-tool-frame]');
  await frame.getByRole('button', { name: 'Try it with a sample file' }).click();
  await expect(frame.getByText('sample-report.pdf')).toBeVisible();
  await expect(frame.getByText('sample-appendix.pdf')).toBeVisible();
});

test('견본을 받는 사이 직접 고른 파일은 늦게 온 견본으로 바뀌지 않는다', async ({ page }) => {
  await page.route('**/samples/**', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 800));
    await route.continue();
  });
  await page.goto('/pdf/split/');
  const frame = page.frameLocator('iframe[data-tool-frame]');
  await frame.getByRole('button', { name: '예시 파일로 해 보기' }).click();
  await frame
    .locator('input[type=file]')
    .setInputFiles(fileURLToPath(new URL('../fixtures/three-pages.pdf', import.meta.url)));
  await expect(frame.getByText('three-pages.pdf')).toBeVisible();
  await page.waitForTimeout(1500);
  await expect(frame.getByText('three-pages.pdf')).toBeVisible();
  await expect(frame.getByText('예시-보고서.pdf')).toHaveCount(0);
});
