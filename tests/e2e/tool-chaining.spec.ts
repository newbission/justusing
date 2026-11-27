/** 빌드된 도구에서 실제 파일을 연속 처리한다. ./test가 전체 요청의 로컬 처리와 CSP도 검사한다. */
import { PDFDocument } from '@cantoo/pdf-lib';
import { unzipSync } from 'fflate';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import type { Locator } from '@playwright/test';
import { expect, test, type Page } from './test';

const fixture = (name: string) => fileURLToPath(new URL(`../fixtures/${name}`, import.meta.url));
const toolFrame = 'iframe[data-tool-frame]';

async function download(page: Page, button: Locator) {
  const pending = page.waitForEvent('download');
  await button.click();
  const file = await pending;
  return { name: file.suggestedFilename(), bytes: await readFile(await file.path()) };
}

test('PDF 두 쪽을 이미지 압축과 PDF 만들기로 이어 보내고 실제 결과를 받는다', async ({ page }) => {
  await page.goto('/pdf/to-image/');
  const frame = page.frameLocator(toolFrame);
  const outer = page.locator(toolFrame);
  await expect(outer).toHaveAttribute('sandbox', 'allow-scripts allow-downloads');
  const messages = await outer.evaluateHandle((element: HTMLIFrameElement) => {
    const seen = { paths: [] as string[], commits: 0, unexpected: 0 };
    // 파일·버퍼는 JSON으로 바꾸면 내용이 안 보일 수 있다. 허용한 신호의 키와 값만 받았는지 본다.
    addEventListener('message', (event) => {
      if (event.source !== element.contentWindow) return;
      const data = event.data;
      const keys = Object.keys(data ?? {})
        .sort()
        .join(',');
      if (
        keys === 'type' &&
        (data.type === 'show-tool' || data.type === 'activity') &&
        event.ports.length === 0
      )
        return;
      if (
        keys === 'path,type' &&
        data.type === 'tool-change' &&
        typeof data.path === 'string' &&
        event.ports.length === 1
      ) {
        seen.paths.push(data.path);
        const port = event.ports[0]!;
        port.addEventListener('message', (reply) => {
          if (reply.data === true && reply.ports.length === 0) seen.commits++;
          else seen.unexpected++;
        });
        port.start();
      } else {
        seen.unexpected++;
      }
    });
    return seen;
  });

  const privateName = 'private-chain-fixture';
  const urls: string[] = [];
  page.on('request', (request) => urls.push(request.url()));
  await frame.locator('input[type=file]').setInputFiles({
    name: `${privateName}.pdf`,
    mimeType: 'application/pdf',
    buffer: await readFile(fixture('photos.pdf')),
  });
  await frame.getByRole('button', { name: '이미지로 변환' }).click();
  const original = unzipSync(
    (await download(page, frame.getByRole('button', { name: '다운로드', exact: true }))).bytes,
  );
  const send = frame.getByRole('button', { name: '다음 도구로', exact: true });
  await send.click();
  await expect(frame.getByRole('button', { name: /이미지 자르기·회전/ })).toBeDisabled();
  await frame.getByRole('button', { name: '이미지 압축', exact: true }).click();

  await expect(page).toHaveURL(/\/image\/compress\/$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('이미지 압축');
  for (const name of Object.keys(original))
    await expect(frame.getByText(name, { exact: true })).toBeVisible();
  await frame.getByRole('button', { name: '압축하기' }).click();
  const zip = await download(
    page,
    frame.getByRole('button', { name: '모두 받기 (ZIP, 2장)', exact: true }),
  );
  expect(zip.name).toBe('이미지_압축.zip');
  const compressed = unzipSync(zip.bytes);
  expect(Object.keys(compressed)).toEqual([
    `${privateName}_1_압축.jpg`,
    `${privateName}_2_압축.jpg`,
  ]);
  for (const [name, image] of Object.entries(compressed)) {
    expect([...image.subarray(0, 2)]).toEqual([0xff, 0xd8]);
    expect(image.length).toBeLessThan(original[name.replace('_압축.jpg', '.jpg')]!.length);
  }

  await send.click();
  await frame.getByRole('button', { name: '이미지를 PDF로', exact: true }).click();
  await expect(page).toHaveURL(/\/pdf\/from-image\/$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('이미지를 PDF로');
  await frame.getByRole('button', { name: 'PDF 만들기', exact: true }).click();
  const pdf = await download(page, frame.getByRole('button', { name: '다운로드', exact: true }));
  expect(pdf.name).toBe(`${privateName}_1_압축.pdf`);
  expect((await PDFDocument.load(pdf.bytes)).getPageCount()).toBe(2);

  expect(await messages.jsonValue()).toEqual({
    paths: ['/image/compress/', '/pdf/from-image/'],
    commits: 2,
    unexpected: 0,
  });
  expect(await outer.evaluate((element: HTMLIFrameElement) => element.contentDocument)).toBeNull();
  expect(await page.content()).not.toContain(privateName);
  expect(urls.some((url) => decodeURIComponent(url).includes(privateName))).toBe(false);

  await page.goBack();
  await expect(page).toHaveURL(/\/image\/compress\/$/);
  await expect(frame.getByText('이미지 파일 선택', { exact: true })).toBeVisible();
  await page.goForward();
  await expect(page).toHaveURL(/\/pdf\/from-image\/$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('이미지를 PDF로');
  await expect(frame.getByText('이미지 파일 선택', { exact: true })).toBeVisible();
});

test('영어 메뉴에서 키보드로 대상을 고르고, 첫 요청에 실패해도 같은 파일로 다시 넘긴다', async ({
  page,
}) => {
  await page.route(
    '**/_chain/image/crop.json',
    (route) => route.fulfill({ status: 503, body: '' }),
    { times: 1 },
  );
  await page.goto('/en/pdf/to-image/');
  const frame = page.frameLocator(toolFrame);
  await frame.locator('input[type=file]').setInputFiles(fixture('user-unit.pdf'));
  await frame.getByRole('button', { name: 'Convert to images' }).click();
  const send = frame.getByRole('button', { name: 'Send to…', exact: true });
  await expect(send).toBeEnabled();
  await send.press('Enter');
  const compress = frame.getByRole('button', { name: 'Compress Image', exact: true });
  const crop = frame.getByRole('button', { name: 'Crop & Rotate Image', exact: true });
  await expect(compress).toBeFocused();
  await compress.press('Escape');
  await expect(send).toBeFocused();
  await send.press('Enter');
  await compress.press('ArrowDown');
  await expect(crop).toBeFocused();
  await crop.press('Enter');
  await expect(frame.getByRole('alert')).toHaveText("Couldn't send. Please try again.");
  await expect(page).toHaveURL(/\/en\/pdf\/to-image\/$/);
  await expect(frame.getByRole('button', { name: 'Download', exact: true })).toBeEnabled();

  await crop.click();
  await expect(page).toHaveURL(/\/en\/image\/crop\/$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Crop & Rotate Image');
  await expect(page.locator('link[rel=canonical]')).toHaveAttribute('href', /\/en\/image\/crop\/$/);
  await expect(page.locator('.locale-switch a[hreflang=ko]')).toHaveAttribute(
    'href',
    '/image/crop/',
  );
  const image = await download(page, frame.getByRole('button', { name: 'Download edited image' }));
  expect(image.name).toBe('user-unit_1_edited.jpg');
  expect([...image.bytes.subarray(0, 2)]).toEqual([0xff, 0xd8]);
});
