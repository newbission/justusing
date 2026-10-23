/**
 * 홈의 움직이는 설명 그림(LocalProcessing) E2E.
 * 움직임 줄이기를 켠 사람은 처음부터 완성 그림을 보고, 아니면 화면에 보일 때 한 번 움직여 완성 그림에서 멈춘다.
 */
import { expect, test } from './test';

const locales = [
  {
    path: '/',
    title: '고른 파일은 브라우저 안에서 처리됩니다',
    saved: '내 기기에 저장',
    replay: '다시 보기',
  },
  {
    path: '/en/',
    title: 'Your files are processed inside your browser',
    saved: 'Saved to your device',
    replay: 'Replay',
  },
];

for (const { path, title, saved, replay } of locales) {
  test(`${path} 움직임 줄이기에서는 멈춘 완성 그림과 설명 글을 보여 준다`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(path);
    const figure = page.locator('[data-local-motion]');
    await figure.scrollIntoViewIfNeeded();

    await expect(figure.locator('figcaption')).toContainText(title);
    await expect(figure).not.toHaveClass(/armed/);
    await expect(figure.getByRole('button', { name: replay })).toBeHidden();
    // 마지막 단계(결과 저장)가 처음부터 보인다
    await expect(figure.locator('.s3')).toHaveCSS('opacity', '1');
    await expect(figure.locator('.s3')).toContainText(saved);
  });

  test(`${path} 그림은 보일 때 움직이고 완성 그림에서 멈춘다`, async ({ page }) => {
    await page.goto(path);
    const figure = page.locator('[data-local-motion]');
    await figure.scrollIntoViewIfNeeded();

    await expect(figure).toHaveClass(/playing/);
    // 약 4초 뒤 모든 움직임이 끝나 결과가 보인다
    await expect(figure.locator('.s3')).toHaveCSS('opacity', '1', { timeout: 8000 });
    await expect
      .poll(
        () =>
          figure.evaluate((el) =>
            el.getAnimations({ subtree: true }).every((a) => a.playState === 'finished'),
          ),
        { timeout: 8000 },
      )
      .toBe(true);

    // 다시 보기로 처음부터 다시 움직인다
    await figure.getByRole('button', { name: replay }).click();
    await expect(figure.locator('.s3')).not.toHaveCSS('opacity', '1');
    await expect(figure.locator('.s3')).toHaveCSS('opacity', '1', { timeout: 8000 });
  });
}
