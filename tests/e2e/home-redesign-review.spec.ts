/** 구현과 독립된 새 홈 바로가기의 키보드 진입·실제 로컬 처리·다운로드 검증. */
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { test, expect } from './test';

for (const prefix of ['', '/en']) {
  test(`${prefix || '/'} 첫 소개의 작업 바로가기에서 키보드로 들어가 실제 사진을 처리한다`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${prefix}/`);
    const shortcut = page.locator(`.story-start a[href="${prefix}/image/target-size/"]`);
    await shortcut.focus();
    await expect(shortcut).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(`${prefix}/image/target-size/`);
    await expect(page.locator('iframe[data-tool-frame]')).toHaveAttribute(
      'sandbox',
      'allow-scripts allow-downloads',
    );
    const selectedName = 'private-home-review-photo.jpg';
    const sent: string[] = [];
    page.on('request', (request) =>
      sent.push(`${decodeURIComponent(request.url())}\n${request.postData() ?? ''}`),
    );
    const fixture = fileURLToPath(new URL('../fixtures/photo.jpg', import.meta.url));
    const frame = page.frameLocator('iframe[data-tool-frame]');
    await frame.locator('input[type=file]').setInputFiles({
      name: selectedName,
      mimeType: 'image/jpeg',
      buffer: await readFile(fixture),
    });
    const documentTitle = await page.title();
    expect(documentTitle).not.toContain(selectedName);
    await frame.getByText('100KB', { exact: true }).click();
    await frame
      .getByRole('button', { name: prefix ? 'Fit to size' : '용량 맞추기', exact: true })
      .click();
    const downloadEvent = page.waitForEvent('download');
    await frame
      .getByRole('button', { name: prefix ? 'Download' : '다운로드', exact: true })
      .click();
    const download = await downloadEvent;
    expect(download.suggestedFilename()).toBe('private-home-review-photo_100KB.jpg');
    const result = await readFile((await download.path())!);
    expect([...result.subarray(0, 2)]).toEqual([0xff, 0xd8]);
    expect(result.byteLength).toBeLessThanOrEqual(100_000);
    expect(result.byteLength).toBeGreaterThan(1000);
    const decoded = await page.evaluate(
      async (bytes) => {
        const bitmap = await createImageBitmap(new Blob([new Uint8Array(bytes)]));
        const size = { width: bitmap.width, height: bitmap.height };
        bitmap.close();
        return size;
      },
      [...result],
    );
    expect(decoded.width).toBeGreaterThan(0);
    expect(decoded.width).toBeLessThanOrEqual(1200);
    expect(Math.abs(decoded.width / decoded.height - 4 / 3)).toBeLessThan(0.01);
    expect(sent.some((request) => request.includes(selectedName))).toBe(false);
    expect(await page.title()).toBe(documentTitle);
    const tool = page
      .frames()
      .find((candidate) => candidate.url().includes('/image/target-size/frame/'))!;
    expect(await tool.evaluate(() => self.origin)).toBe('null');
    expect(
      await tool.evaluate(() => {
        try {
          return Boolean(parent.document);
        } catch {
          return 'blocked';
        }
      }),
    ).toBe('blocked');
  });
}

test('두 테마에서 격리 경계와 자료 다운로드 안내의 본문 대비가 AA를 충족한다', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const colorScheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme });
    await page.goto('/');
    const contrasts = await page
      .locator('.proof-outside, .home-data-note p')
      .evaluateAll((elements) => {
        type Rgba = [number, number, number, number];
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = 1;
        const context = canvas.getContext('2d')!;
        // 브라우저가 해석한 CSS 색을 읽는다. 특정 토큰 값 대신 실제 투명 배경의 합성 결과를 검사한다.
        const rgba = (color: string): Rgba => {
          context.clearRect(0, 0, 1, 1);
          context.fillStyle = color;
          context.fillRect(0, 0, 1, 1);
          const [r, g, b, a] = context.getImageData(0, 0, 1, 1).data;
          return [r!, g!, b!, a! / 255];
        };
        const composite = (front: Rgba, back: Rgba): Rgba => {
          const alpha = front[3] + back[3] * (1 - front[3]);
          const channel = (index: 0 | 1 | 2) =>
            (front[index] * front[3] + back[index] * back[3] * (1 - front[3])) / alpha;
          return [channel(0), channel(1), channel(2), alpha];
        };
        const luminance = (color: Rgba) => {
          const linear = (channel: number) => {
            const value = channel / 255;
            return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
          };
          return 0.2126 * linear(color[0]) + 0.7152 * linear(color[1]) + 0.0722 * linear(color[2]);
        };
        return elements.map((element) => {
          const ancestors: Element[] = [];
          for (let ancestor: Element | null = element; ancestor; ancestor = ancestor.parentElement)
            ancestors.unshift(ancestor);
          let background: Rgba = [255, 255, 255, 1];
          for (const ancestor of ancestors)
            background = composite(rgba(getComputedStyle(ancestor).backgroundColor), background);
          const foreground = composite(rgba(getComputedStyle(element).color), background);
          const foregroundLuminance = luminance(foreground);
          const backgroundLuminance = luminance(background);
          return {
            text: element.textContent,
            ratio:
              (Math.max(foregroundLuminance, backgroundLuminance) + 0.05) /
              (Math.min(foregroundLuminance, backgroundLuminance) + 0.05),
          };
        });
      });
    expect(contrasts).toHaveLength(3);
    for (const contrast of contrasts)
      expect(contrast.ratio, `${colorScheme}: ${contrast.text}`).toBeGreaterThanOrEqual(4.5);
  }
});
