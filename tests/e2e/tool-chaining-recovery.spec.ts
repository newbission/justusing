import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { PDFDocument } from '@cantoo/pdf-lib';
import { expect, test } from './test';

const photo = fileURLToPath(new URL('../fixtures/photo.jpg', import.meta.url));

test('도구 frame을 단독으로 열어도 바깥 페이지의 응답을 기다리지 않는다', async ({ page }) => {
  await page.goto('/image/compress/frame/');
  await page.locator('input[type=file]').setInputFiles(photo);
  await page.getByRole('button', { name: '압축하기' }).click();
  await page.getByRole('button', { name: '다음 도구로' }).click();
  await page.getByRole('button', { name: '이미지를 PDF로' }).click();
  await expect(page.getByRole('button', { name: 'PDF 만들기' })).toBeEnabled();
  await expect(page).toHaveTitle('이미지를 PDF로 도구 화면');
});

for (const failure of ['바깥 도구 페이지', '도구 스타일'] as const) {
  test(`${failure}를 못 받으면 원래 결과를 다운로드하고 다시 넘길 수 있다`, async ({
    page,
    request,
  }) => {
    await page.goto('/image/compress/');
    const frame = page.frameLocator('iframe[data-tool-frame]');
    await frame.locator('input[type=file]').setInputFiles(photo);
    await frame.getByRole('button', { name: '압축하기' }).click();
    const send = frame.getByRole('button', { name: '다음 도구로' });
    await send.click();
    const target = frame.getByRole('button', { name: '이미지를 PDF로' });

    let failPath = '/pdf/from-image/';
    if (failure === '도구 스타일') {
      const manifest = await (await request.get('/_chain/pdf/from-image.json')).json();
      const loaded = await frame
        .locator('link[rel=stylesheet]')
        .evaluateAll((links) => links.map((link) => link.getAttribute('href')));
      const targetStyle = (manifest.styles as string[]).find((href) => !loaded.includes(href));
      expect(targetStyle).toBeDefined();
      failPath = targetStyle!;
    }
    let requests = 0;
    await page.route(
      (url) => url.pathname === failPath,
      (route) => {
        if (++requests === 1) return route.fulfill({ status: 503 });
        return route.continue();
      },
    );
    await target.click();
    await expect(frame.getByRole('alert')).toHaveText('넘기지 못했습니다. 다시 해 보세요.');
    await expect(page).toHaveURL(/\/image\/compress\/$/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('이미지 압축');
    await target.press('Escape');
    const original = page.waitForEvent('download');
    await frame.getByRole('button', { name: '다운로드', exact: true }).click();
    const image = await original;
    expect(image.suggestedFilename()).toBe('photo_압축.jpg');
    expect((await readFile(await image.path())).subarray(0, 2)).toEqual(Buffer.from([0xff, 0xd8]));

    await send.click();
    await target.click();
    await expect(page).toHaveURL(/\/pdf\/from-image\/$/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('이미지를 PDF로');
    await frame.getByRole('button', { name: 'PDF 만들기', exact: true }).click();
    const result = page.waitForEvent('download');
    await frame.getByRole('button', { name: '다운로드', exact: true }).click();
    const pdf = await PDFDocument.load(await readFile(await (await result).path()));
    expect(pdf.getPageCount()).toBe(1);
    expect(requests).toBe(2);
  });
}
