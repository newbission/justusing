/**
 * '예시로 따라 하기' E2E. 창 안에 도구 화면을 하나 더 열고 견본을 넣어, 사용법 단계마다 누를 곳을 비추는지 본다.
 * 단계 글은 frame 페이지에 빌드 때 넣은 그 도구의 사용법이다 (src/frame/tour.ts, src/components/TourButton.astro).
 */
import { fileURLToPath } from 'node:url';
import { NO_SAMPLE } from './no-sample';
import { expect, test, type Page } from './test';

async function openTour(page: Page, path: string, name = '예시로 따라 하기') {
  await page.goto(path);
  await page.getByRole('button', { name }).click();
  const dialog = page.getByRole('dialog');
  const frame = page.frameLocator('dialog iframe');
  return { dialog, frame, card: frame.locator('.frame-tour') };
}

test('창 안에서 견본으로 따라 하고, 마치면 창이 닫히고 원래 도구는 그대로다', async ({ page }) => {
  const { dialog, frame, card } = await openTour(page, '/pdf/split/');
  await expect(dialog.getByRole('heading', { name: 'PDF 나누기 예시로 따라 하기' })).toBeVisible();
  await expect(card).toContainText('4단계 중 1단계');
  await expect(frame.getByText('예시-보고서.pdf')).toBeVisible();
  await expect(card.getByRole('button', { name: '이전' })).toBeDisabled();
  await expect(frame.locator('.tour-spot')).toBeHidden();

  await card.getByRole('button', { name: '다음' }).click();
  await expect(frame.getByRole('radiogroup')).toHaveClass(/tour-target/);
  await expect(frame.locator('.tour-spot')).toBeVisible();
  await expect(frame.locator('.tour-spot')).toContainText('2');

  await frame.getByRole('radiogroup').getByText('한 장씩 나누기').click();
  await card.getByRole('button', { name: '다음' }).click();
  const run = frame.getByRole('button', { name: 'PDF 나누기' });
  await expect(run).toHaveClass(/tour-target/);
  await expect(frame.getByRole('radiogroup')).not.toHaveClass(/tour-target/);

  // 나중에 나타나는 버튼도 비춘다
  await card.getByRole('button', { name: '다음' }).click();
  await run.click();
  await expect(frame.getByRole('button', { name: '다운로드' })).toHaveClass(/tour-target/);

  await card.getByRole('button', { name: '마치기' }).click();
  await expect(dialog).toBeHidden();
  // 원래 도구 화면에는 견본이 들어가지 않았다
  await expect(
    page
      .frameLocator('iframe[data-tool-frame]')
      .getByRole('button', { name: '예시 파일로 해 보기' }),
  ).toBeVisible();
});

test('오른쪽 위 ×·Esc로 닫고, 다시 열면 처음부터 견본 하나로 시작한다', async ({ page }) => {
  const { dialog, frame, card } = await openTour(page, '/pdf/merge/');
  const historyLength = await page.evaluate(() => history.length);
  await expect(card).toContainText('단계 중 1단계');
  await card.getByRole('button', { name: '다음' }).click();
  await dialog.getByRole('button', { name: '닫기' }).click();
  await expect(dialog).toBeHidden();

  await page.getByRole('button', { name: '예시로 따라 하기' }).click();
  await expect(card).toContainText('단계 중 1단계');
  await expect(frame.getByText('예시-보고서.pdf')).toHaveCount(1);
  // 도구 화면 안을 누른 뒤의 Esc도 창을 닫는다
  await card.getByRole('button', { name: '다음' }).click();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  // 여닫아도 탭의 뒤로 가기 기록이 쌓이지 않는다
  expect(await page.evaluate(() => history.length)).toBe(historyLength);
});

test('견본을 받지 못하면 단계 대신 다시 받기만 둔다', async ({ page }) => {
  await page.route('**/samples/**', (route) => route.abort());
  const { card } = await openTour(page, '/pdf/merge/');
  await expect(card).toContainText('예시 파일을 받지 못했습니다');
  await expect(card.getByRole('button', { name: '다음' })).toBeHidden();

  await page.unroute('**/samples/**');
  await card.getByRole('button', { name: '다시 받기' }).click();
  await expect(card).toContainText('단계 중 1단계');
});

test('견본을 받는 사이 직접 고른 파일은 늦게 온 견본으로 바뀌지 않는다', async ({ page }) => {
  await page.route('**/samples/**', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 800));
    await route.continue();
  });
  const { frame, card } = await openTour(page, '/pdf/split/');
  await frame
    .locator('input[type=file]')
    .setInputFiles(fileURLToPath(new URL('../fixtures/three-pages.pdf', import.meta.url)));
  await expect(frame.getByText('three-pages.pdf')).toBeVisible();
  await page.waitForTimeout(1500);
  await expect(frame.getByText('three-pages.pdf')).toBeVisible();
  await expect(frame.getByText('예시-보고서.pdf')).toHaveCount(0);
  await expect(card).toBeHidden();
});

test('이름 뒤에 바뀌는 말이 붙은 버튼도 비춘다', async ({ page }) => {
  const { frame, card } = await openTour(page, '/image/compress/');
  await card.getByRole('button', { name: '다음' }).click();
  await card.getByRole('button', { name: '다음' }).click();
  await frame.getByRole('button', { name: '압축하기' }).click();
  await card.getByRole('button', { name: '다음' }).click();
  await expect(frame.getByRole('button', { name: '모두 받기 (ZIP, 2장)' })).toHaveClass(
    /tour-target/,
  );
});

test('버튼 이름이 없는 단계는 작업 영역을 비춘다', async ({ page }) => {
  const { frame, card } = await openTour(page, '/pdf/organize/');
  await card.getByRole('button', { name: '다음' }).click();
  await expect(frame.locator('.tour-target')).toHaveCount(1);
  await expect(frame.locator('.tour-spot')).toBeVisible();
});

test('견본이 있는 모든 도구에서 따라 하기가 시작된다', async ({ page, request }) => {
  test.setTimeout(180_000);
  const xml = await (await request.get('/sitemap.xml')).text();
  const paths = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)]
    .map((match) => new URL(match[1]!).pathname)
    .filter((path) => /^\/[^/]+\/[^/]+\/$/.test(path) && !/^\/(en|guide)\//.test(path))
    .filter((path) => !NO_SAMPLE.includes(path));
  expect(paths.length).toBeGreaterThanOrEqual(27);

  for (const path of paths) {
    const { card } = await openTour(page, path);
    await expect(card, path).toContainText('단계 중 1단계');
  }
});

test('영어 화면은 영어 사용법으로 따라 한다', async ({ page }) => {
  const { card } = await openTour(page, '/en/image/compress/', 'Walk through with a sample');
  await expect(card).toContainText('Step 1 of');
  await card.getByRole('button', { name: 'Next' }).click();
  await expect(card).toContainText('Step 2 of');
});
