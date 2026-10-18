/**
 * 이미지를 PDF로 E2E. 빌드 결과에서 돌린다 (playwright.config.ts 참고).
 *
 * 받은 PDF를 직접 열어 쪽 수·크기·방향을 확인하고,
 * 만드는 동안 파일이 기기를 떠나지 않는다는 약속을 확인한다.
 * 테스트 이미지는 tests/fixtures/make_image_fixtures.py가 만든다.
 */
import { expect, test, type Page, type Request } from './test';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { expectLocalOnly } from './local-only';

const fixture = (name: string) => fileURLToPath(new URL(`../fixtures/${name}`, import.meta.url));

async function openTool(page: Page, files: string[]) {
  await page.goto('/pdf/from-image/');
  const frame = page.frameLocator('iframe[data-tool-frame]');
  await frame.locator('input[type=file]').setInputFiles(files.map(fixture));
  return frame;
}

async function download(page: Page, frame: ReturnType<Page['frameLocator']>) {
  const event = page.waitForEvent('download');
  await frame.getByRole('button', { name: '다운로드' }).click();
  const file = await event;
  return {
    name: file.suggestedFilename(),
    bytes: new Uint8Array(await readFile(await file.path())),
  };
}

/** PDF 쪽마다 [가로, 세로] (pt, 소수점 버림) */
async function pageSizes(bytes: Uint8Array) {
  const task = getDocument({ data: bytes });
  const doc = await task.promise;
  const sizes: [number, number][] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const { width, height } = (await doc.getPage(i)).getViewport({ scale: 1 });
    sizes.push([Math.floor(width), Math.floor(height)]);
  }
  await task.destroy();
  return sizes;
}

test('이미지마다 A4 한 쪽이 되고, 가로 이미지는 가로 종이에 넣는다', async ({ page }) => {
  const frame = await openTool(page, ['wide.png', 'tall.jpg']);
  await expect(frame.getByText('400×300', { exact: false })).toBeVisible();
  await frame.getByRole('button', { name: 'PDF 만들기' }).click();

  const { name, bytes } = await download(page, frame);
  expect(name).toBe('wide.pdf');
  expect(await pageSizes(bytes)).toEqual([
    [841, 595],
    [595, 841],
  ]);
});

test('순서를 바꾸면 그 순서대로 넣고, 맨 위 이미지 이름으로 받는다', async ({ page }) => {
  const frame = await openTool(page, ['wide.png', 'tall.jpg']);
  await frame.getByRole('button', { name: 'tall.jpg 위로' }).click();
  await frame.getByRole('button', { name: 'PDF 만들기' }).click();

  const { name, bytes } = await download(page, frame);
  expect(name).toBe('tall.pdf');
  expect(await pageSizes(bytes)).toEqual([
    [595, 841],
    [841, 595],
  ]);
});

test('휴대폰 사진의 방향 정보를 읽어 바로 세워 넣는다 (이미지에 맞춤, 여백)', async ({ page }) => {
  const frame = await openTool(page, ['rotated.jpg']);
  // 화소는 400×300이지만 방향 정보대로 세우면 300×400
  await expect(frame.getByText('300×400', { exact: false })).toBeVisible();
  await frame.getByText('이미지에 맞춤', { exact: true }).click();
  await frame.getByRole('button', { name: 'PDF 만들기' }).click();
  const upright = await download(page, frame);
  // 쪽 크기만이 아니라 넣은 이미지 자체도 세워져 있다 (누운 화소를 늘려 넣지 않았다).
  // pdf.js가 버퍼를 가져가 비우므로 먼저 읽는다
  const pdfText = new TextDecoder('latin1').decode(upright.bytes);
  // 300×400 화소 → 225×300pt (96 DPI)
  expect(await pageSizes(upright.bytes)).toEqual([[225, 300]]);
  expect(pdfText).toMatch(/\/Width 300\b/);
  expect(pdfText).toMatch(/\/Height 400\b/);

  // 여백을 바꾸면 다시 만들어야 하고, 양쪽에 36pt씩 붙는다
  await frame.locator('label').filter({ hasText: '여백 있음' }).click();
  await frame.getByRole('button', { name: 'PDF 만들기' }).click();
  expect(await pageSizes((await download(page, frame)).bytes)).toEqual([[297, 372]]);
});

test('열 수 없는 이미지는 표시하고 빼고 만든다', async ({ page }) => {
  const frame = await openTool(page, ['broken.png']);
  await expect(frame.getByText('열 수 없는 이미지입니다.', { exact: false })).toBeVisible();
  await expect(frame.getByRole('button', { name: 'PDF 만들기' })).toBeDisabled();

  await frame.getByText('이미지 추가').locator('input').setInputFiles(fixture('tall.jpg'));
  await frame.getByRole('button', { name: 'PDF 만들기' }).click();
  const { name, bytes } = await download(page, frame);
  expect(name).toBe('tall.pdf');
  expect(await pageSizes(bytes)).toEqual([[595, 841]]);
});

test('만드는 동안의 요청에는 파일이 기기 밖으로 나가는 것이 없다', async ({ page, baseURL }) => {
  const requests: Request[] = [];
  page.on('request', (request) => requests.push(request));

  await page.goto('/pdf/from-image/');
  const frame = page.frameLocator('iframe[data-tool-frame]');
  await frame.locator('input[type=file]').waitFor({ state: 'attached' });
  requests.length = 0; // 페이지를 여는 요청은 빼고, 파일을 고른 뒤부터 센다
  await frame
    .locator('input[type=file]')
    .setInputFiles([fixture('wide.png'), fixture('rotated.jpg')]);
  await frame.getByRole('button', { name: 'PDF 만들기' }).click();
  await expect(frame.getByRole('button', { name: '다운로드' })).toBeVisible();
  await page.waitForLoadState('networkidle');

  expectLocalOnly(page, requests, baseURL!);
});
