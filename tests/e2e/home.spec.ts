/** 새 홈의 실제 진입 흐름·사진 견본·키보드·모바일 레이아웃. 빌드한 사이트에서 확인한다. */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { expect, test } from './test';

const sample = JSON.parse(readFileSync('src/assets/home/result.json', 'utf8')) as {
  inputBytes: number;
  outputBytes: number;
  targetKB: number;
};
const locales = [
  {
    path: '/',
    primary: '사진 용량 줄이기',
    choose: '무료 도구 보기',
    tools: '도구 모아보기',
    category: '이미지',
    prefix: '',
  },
  {
    path: '/en/',
    primary: 'Shrink a photo',
    choose: 'Explore free tools',
    tools: 'A tool for the task',
    category: 'Image',
    prefix: '/en',
  },
];

for (const locale of locales) {
  test(`${locale.path} 두 번째 기능 소개에서 실제 파일 처리와 다운로드까지 간다`, async ({
    page,
  }) => {
    await page.goto(locale.path);
    const primary = page.locator('.feature-intro').getByRole('link', { name: locale.primary });
    await primary.scrollIntoViewIfNeeded();
    await expect(primary).toBeInViewport();
    await primary.focus();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(`${locale.prefix}/image/target-size/`);
    const frame = page.frameLocator('iframe[data-tool-frame]');
    await frame
      .locator('input[type=file]')
      .setInputFiles(fileURLToPath(new URL('../fixtures/photo.jpg', import.meta.url)));
    await frame
      .getByRole('button', { name: locale.prefix ? 'Fit to size' : '용량 맞추기', exact: true })
      .click();
    const download = page.waitForEvent('download');
    await frame
      .getByRole('button', { name: locale.prefix ? 'Download' : '다운로드', exact: true })
      .click();
    expect((await download).suggestedFilename()).toMatch(/\.jpg$/);
  });

  test(`${locale.path} 전체 도구로 건너뛰고 카테고리와 도구를 찾는다`, async ({ page }) => {
    await page.goto(locale.path);
    const local = page.locator('.local-hero');
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
    await expect(local.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.locator('.feature-intro').getByRole('heading', { level: 2 })).toBeVisible();
    await expect(
      local.getByRole('link', {
        name: locale.prefix ? 'How it works' : '처리 방식 알아보기',
      }),
    ).toHaveAttribute('href', `${locale.prefix}/safety/`);
    await local.getByRole('link', { name: locale.choose }).click();
    await expect(page.locator('#directory-title')).toBeInViewport();
    await page
      .locator('.category-nav')
      .getByRole('link', { name: locale.category, exact: true })
      .click();
    await expect(page.locator('#category-image')).toBeInViewport();
    const directory = page.locator('#tools');
    await expect(directory.locator('.card')).toHaveCount(42);
    const merge = directory.locator(`a[href="${locale.prefix}/pdf/merge/"]`);
    await merge.click();
    await expect(page).toHaveURL(`${locale.prefix}/pdf/merge/`);
    await expect(page.locator('iframe[data-tool-frame]')).toBeVisible();
  });

  test(`${locale.path} 사진 견본은 직접 호스팅하며 실제 결과 크기를 표시한다`, async ({ page }) => {
    await page.goto(locale.path);
    await page.locator('.photo-example').scrollIntoViewIfNeeded();
    const photos = page.locator('.photo-example img');
    await expect(photos).toHaveCount(2);
    for (const photo of await photos.all()) {
      expect(await photo.getAttribute('src')).toMatch(/^\/_astro\//);
      await expect(photo).not.toHaveAttribute('alt', '');
      await expect
        .poll(() => photo.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0))
        .toBe(true);
    }
    expect(sample.outputBytes).toBeLessThanOrEqual(sample.targetKB * 1000);
    expect(sample.outputBytes).toBeLessThan(sample.inputBytes);
    await expect(page.locator('.photo-original')).toContainText(
      `${(sample.inputBytes / 1000).toFixed(1)} KB`,
    );
    await expect(page.locator('.photo-result')).toContainText(
      `${(sample.outputBytes / 1000).toFixed(1)} KB`,
    );
  });

  test(`${locale.path} 모바일 두 테마에서 진입 링크가 보이고 가로로 넘치지 않는다`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    for (const colorScheme of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
      await page.goto(locale.path);
      await expect(
        page.locator('.local-hero').getByRole('link', { name: locale.choose }),
      ).toBeInViewport();
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
        390,
      );
      await page.locator('#tools-video').scrollIntoViewIfNeeded();
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
        390,
      );
    }
  });
}
