/**
 * '예시로 따라 하기' E2E. 견본을 넣고 사용법 단계마다 단계 글에 적힌 버튼을 짚는지 본다.
 * 단계 글은 frame 페이지에 빌드 때 넣은 그 도구의 사용법이다 (src/frame/tour.ts).
 */
import { fileURLToPath } from 'node:url';
import { expect, test } from './test';

test('따라 하기는 견본을 넣고 단계 글에 적힌 버튼을 짚는다', async ({ page }) => {
  await page.goto('/pdf/split/');
  await page.getByRole('button', { name: '예시로 따라 하기' }).click();
  const frame = page.frameLocator('iframe[data-tool-frame]');
  const tour = frame.getByRole('region', { name: '따라 하기' });
  await expect(tour).toContainText('따라 하기 1/4');
  await expect(frame.getByText('예시-보고서.pdf')).toBeVisible();
  await expect(tour.getByRole('button', { name: '이전' })).toBeDisabled();

  await tour.getByRole('button', { name: '다음' }).click();
  await expect(frame.getByRole('radiogroup')).toHaveClass(/tour-target/);

  await frame.getByRole('radiogroup').getByText('한 장씩 나누기').click();
  await tour.getByRole('button', { name: '다음' }).click();
  const run = frame.getByRole('button', { name: 'PDF 나누기' });
  await expect(run).toHaveClass(/tour-target/);
  await expect(frame.getByRole('radiogroup')).not.toHaveClass(/tour-target/);

  // 나중에 나타나는 버튼도 짚는다
  await tour.getByRole('button', { name: '다음' }).click();
  await run.click();
  await expect(frame.getByRole('button', { name: '다운로드' })).toHaveClass(/tour-target/);
  await expect(tour.getByRole('button', { name: '마치기' })).toBeVisible();

  await tour.getByRole('button', { name: '그만하기' }).click();
  await expect(tour).toBeHidden();
  await expect(frame.locator('.tour-target')).toHaveCount(0);
});

test('견본을 받지 못하면 단계 대신 다시 받기만 두고, 여러 번 눌러도 견본은 한 번만 들어간다', async ({
  page,
}) => {
  await page.route('**/samples/**', (route) => route.abort());
  await page.goto('/pdf/merge/');
  const start = page.getByRole('button', { name: '예시로 따라 하기' });
  await start.click();
  const frame = page.frameLocator('iframe[data-tool-frame]');
  const tour = frame.getByRole('region', { name: '따라 하기' });
  await expect(tour).toContainText('예시 파일을 받지 못했습니다');
  await expect(tour.getByRole('button', { name: '다음' })).toBeHidden();

  await page.unroute('**/samples/**');
  await tour.getByRole('button', { name: '다시 받기' }).click();
  await expect(tour).toContainText('따라 하기 1/');
  await start.click();
  await start.click();
  await expect(frame.getByText('예시-보고서.pdf')).toHaveCount(1);
});

test('다시 받는 사이 그만두면 늦게 온 견본을 넣지 않는다', async ({ page }) => {
  await page.route('**/samples/**', (route) => route.abort());
  await page.goto('/pdf/split/');
  await page.getByRole('button', { name: '예시로 따라 하기' }).click();
  const frame = page.frameLocator('iframe[data-tool-frame]');
  const tour = frame.getByRole('region', { name: '따라 하기' });
  await expect(tour).toContainText('예시 파일을 받지 못했습니다');

  await page.unroute('**/samples/**');
  await page.route('**/samples/**', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 800));
    await route.continue();
  });
  await tour.getByRole('button', { name: '다시 받기' }).click();
  await tour.getByRole('button', { name: '그만하기' }).click();
  await page.waitForTimeout(1500);
  await expect(tour).toBeHidden();
  await expect(frame.getByText('예시-보고서.pdf')).toHaveCount(0);
});

test('견본을 받는 사이 내 파일을 고르면 늦게 온 견본을 넣지 않는다', async ({ page }) => {
  await page.route('**/samples/**', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 800));
    await route.continue();
  });
  await page.goto('/pdf/split/');
  await page.getByRole('button', { name: '예시로 따라 하기' }).click();
  const frame = page.frameLocator('iframe[data-tool-frame]');
  await frame
    .locator('input[type=file]')
    .setInputFiles(fileURLToPath(new URL('../fixtures/three-pages.pdf', import.meta.url)));
  await expect(frame.getByText('three-pages.pdf')).toBeVisible();
  await page.waitForTimeout(1500);
  await expect(frame.getByText('three-pages.pdf')).toBeVisible();
  await expect(frame.getByText('예시-보고서.pdf')).toHaveCount(0);
  await expect(frame.getByRole('region', { name: '따라 하기' })).toBeHidden();
});

test('견본이 있는 모든 도구에서 따라 하기가 시작된다', async ({ page, request }) => {
  test.setTimeout(180_000);
  const xml = await (await request.get('/sitemap.xml')).text();
  const paths = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)]
    .map((match) => new URL(match[1]!).pathname)
    .filter((path) => /^\/[^/]+\/[^/]+\/$/.test(path) && !/^\/(en|guide)\//.test(path));
  expect(paths.length).toBeGreaterThanOrEqual(27);

  for (const path of paths) {
    await page.goto(path);
    await page.getByRole('button', { name: '예시로 따라 하기' }).click();
    const tour = page
      .frameLocator('iframe[data-tool-frame]')
      .getByRole('region', { name: '따라 하기' });
    await expect(tour, path).toContainText('따라 하기 1/');
  }
});

test('이름 뒤에 바뀌는 말이 붙은 버튼도 짚는다', async ({ page }) => {
  await page.goto('/image/compress/');
  await page.getByRole('button', { name: '예시로 따라 하기' }).click();
  const frame = page.frameLocator('iframe[data-tool-frame]');
  const tour = frame.getByRole('region', { name: '따라 하기' });
  await tour.getByRole('button', { name: '다음' }).click();
  await tour.getByRole('button', { name: '다음' }).click();
  await frame.getByRole('button', { name: '압축하기' }).click();
  await tour.getByRole('button', { name: '다음' }).click();
  await expect(frame.getByRole('button', { name: '모두 받기 (ZIP, 2장)' })).toHaveClass(
    /tour-target/,
  );
});

test('영어 화면은 영어 사용법으로 따라 한다', async ({ page }) => {
  await page.goto('/en/image/compress/');
  await page.getByRole('button', { name: 'Walk through with a sample' }).click();
  const frame = page.frameLocator('iframe[data-tool-frame]');
  const tour = frame.getByRole('region', { name: 'Walkthrough' });
  await expect(tour).toContainText('Walkthrough 1/');
  await tour.getByRole('button', { name: 'Next' }).click();
  await expect(tour).toContainText('Walkthrough 2/');
});
