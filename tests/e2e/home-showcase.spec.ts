/** 대표 작업 장면에서 실제 도구로 진입하고, 견본 자산·모바일 이야기 구성이 동작한다. */
import { expect, test } from './test';
import { readFileSync } from 'node:fs';
const results = JSON.parse(readFileSync('src/assets/home/showcase/results.json', 'utf8'));

const examples = ['pdf/from-image', 'image/remove-bg', 'pdf/merge', 'pdf/redact'];
for (const prefix of ['', '/en']) {
  test(`${prefix || '/'} 대표 장면 4개에서 키보드로 실제 도구 화면에 들어간다`, async ({
    page,
  }) => {
    for (const id of examples) {
      await page.goto(`${prefix}/`);
      const scene = page
        .locator('.feature-demo')
        .filter({ has: page.locator(`a[href="${prefix}/${id}/"]`) });
      const link = scene.getByRole('link');
      await link.focus();
      await page.keyboard.press('Enter');
      await expect(page).toHaveURL(`${prefix}/${id}/`);
      await expect(page.locator('iframe[data-tool-frame]')).toBeVisible();
      await expect(
        page.frameLocator('iframe[data-tool-frame]').locator('input[type=file]').first(),
      ).toBeAttached();
    }
  });

  test(`${prefix || '/'} 장면은 실제 결과와 쪽수가 맞고 모든 입력·결과 그림이 직접 호스팅된다`, async ({
    page,
  }) => {
    await page.goto(`${prefix}/`);
    const scenes = page.locator('.feature-demo');
    await expect(scenes).toHaveCount(4);
    expect(results.photos.pages).toBe(3);
    expect(results.merge.pages).toBe(6);
    expect(results.cutout.transparent).toBe(true);
    for (const scene of await scenes.all()) {
      await scene.scrollIntoViewIfNeeded();
      await expect(scene.getByRole('img')).toHaveAttribute('aria-label', /.+/);
      for (const image of await scene.locator('img').all()) {
        await expect(image).toHaveAttribute('loading', 'lazy');
        await expect(image).toHaveAttribute('src', /^\/_astro\//);
        await expect
          .poll(() =>
            image.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0),
          )
          .toBe(true);
      }
      await expect(scene.getByRole('link')).toBeVisible();
    }
    await expect(page.locator('[data-demo="album"] .pdf-viewer')).toHaveCount(1);
    await expect(page.locator('[data-demo="album"] .pdf-page')).toHaveCount(3);
    await expect(page.locator('[data-demo="merge"] .viewer-heading')).toContainText(
      prefix ? '6 pages' : '6쪽',
    );
  });

  test(`${prefix || '/'} 모바일 두 테마에서 큰 장면이 한 구간씩 이어지고 가로로 넘치지 않는다`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    for (const colorScheme of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme });
      await page.goto(`${prefix}/`);
      const scenes = page.locator('.feature-demo');
      const first = (await scenes.nth(0).boundingBox())!;
      const second = (await scenes.nth(1).boundingBox())!;
      expect(second.y).toBeGreaterThanOrEqual(first.y + first.height);
      for (const scene of await scenes.all()) {
        await scene.scrollIntoViewIfNeeded();
        const title = (await scene.locator('.demo-copy').boundingBox())!;
        const stage = (await scene.locator('.demo-stage').boundingBox())!;
        expect(stage.y).toBeGreaterThanOrEqual(title.y + title.height);
        expect(stage.width).toBeGreaterThan(330);
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
          390,
        );
      }
    }
  });
}
