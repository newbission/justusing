/**
 * 도구 페이지의 '가이드 보기' 창 E2E. 누를 때 가이드 글을 받아 넣고, 페이지에는 글을 미리 넣지 않는다.
 */
import { expect, test } from './test';

test('가이드 보기를 누르면 가이드 글이 창으로 열리고 닫힌다', async ({ page }) => {
  await page.goto('/pdf/split/');
  const dialog = page.getByRole('dialog', { name: 'PDF에서 필요한 쪽만 따로 빼는 방법' });
  // 페이지 HTML에는 글이 없다 (중복 글이 되지 않게)
  await expect(page.locator('[data-guide-body]')).not.toContainText('범위 적는 법');

  await page.getByRole('button', { name: '가이드 보기' }).click();
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('heading', { name: '범위 적는 법' })).toBeVisible();
  // 이미 그 도구 페이지에 있으므로 글 머리의 도구 링크 줄은 뺀다
  await expect(dialog).not.toContainText('이 글의 도구');
  await expect(dialog.getByRole('link', { name: '가이드 페이지에서 보기' })).toHaveAttribute(
    'href',
    '/guide/split-pdf/',
  );

  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await page.getByRole('button', { name: '가이드 보기' }).click();
  await dialog.getByRole('button', { name: '닫기' }).click();
  await expect(dialog).toBeHidden();
});

test('영어 도구 페이지는 영어 가이드를 연다', async ({ page }) => {
  await page.goto('/en/pdf/split/');
  await page.getByRole('button', { name: 'Read the guide' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('link', { name: 'Open the guide page' })).toHaveAttribute(
    'href',
    '/en/guide/split-pdf/',
  );
  await expect(dialog.locator('[data-guide-body] h2').first()).toBeVisible();
});

test('가이드 창 안의 움직이는 그림도 깨지지 않고 움직임 줄이기를 따른다', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/image/stitch/');
  await page.getByRole('button', { name: '가이드 보기' }).click();
  const image = page.getByRole('dialog').locator('[data-guide-body] picture img');
  const currentSrc = () => image.evaluate((node: HTMLImageElement) => node.currentSrc);
  await image.scrollIntoViewIfNeeded();
  await expect.poll(currentSrc).toContain('/guide-motion/ko/stitch-screenshots/stitched.webp');
  await expect
    .poll(() => image.evaluate((node: HTMLImageElement) => node.naturalWidth))
    .toBeGreaterThan(0);

  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect
    .poll(currentSrc)
    .toContain('/guide-motion/ko/stitch-screenshots/stitched-still.webp');
});
