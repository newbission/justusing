/**
 * 이미지 압축 E2E. 빌드 결과에서 돌린다 (playwright.config.ts 참고).
 *
 * 받은 이미지를 브라우저로 다시 열어 크기·형식·투명이 맞는지 확인하고,
 * 처리하는 동안 파일이 기기를 떠나지 않는다는 약속을 확인한다.
 */
import { expect, test, type Page, type Request } from './test';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { unzipSync } from 'fflate';
import { expectLocalOnly } from './local-only';

const fixture = (name: string) => fileURLToPath(new URL(`../fixtures/${name}`, import.meta.url));

async function openTool(page: Page, files: string[]) {
  await page.goto('/image/compress/');
  const frame = page.frameLocator('iframe[data-tool-frame]');
  await frame.locator('input[type=file]').setInputFiles(files.map(fixture));
  return frame;
}

/** 브라우저로 이미지를 열어 가로·세로와 왼쪽 위 화소의 투명도를 읽는다 */
async function inspect(page: Page, bytes: Uint8Array) {
  return page.evaluate(async (data) => {
    const bitmap = await createImageBitmap(new Blob([new Uint8Array(data)]));
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const context = canvas.getContext('2d')!;
    context.drawImage(bitmap, 0, 0);
    const alpha = context.getImageData(0, 0, 1, 1).data[3];
    return { width: bitmap.width, height: bitmap.height, alpha };
  }, Array.from(bytes));
}

const isJpeg = (bytes: Uint8Array) => bytes[0] === 0xff && bytes[1] === 0xd8;
const isPng = (bytes: Uint8Array) => bytes[0] === 0x89 && bytes[1] === 0x50;
const isWebp = (bytes: Uint8Array) => String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP';

test('사진 한 장을 같은 크기의 더 작은 JPG로 줄인다', async ({ page, baseURL }) => {
  const requests: Request[] = [];
  page.on('request', (request) => requests.push(request));
  const frame = await openTool(page, ['photo.jpg']);
  const original = await readFile(fixture('photo.jpg'));
  await expect(frame.getByText('1200×900', { exact: false })).toBeVisible();
  requests.length = 0; // 페이지를 여는 요청은 빼고, 파일을 고른 뒤부터 센다

  await frame.getByRole('button', { name: '압축하기' }).click();
  await expect(frame.getByText('완료:', { exact: false })).toBeVisible();
  const event = page.waitForEvent('download');
  await frame.getByRole('button', { name: '다운로드' }).click();
  const file = await event;
  expect(file.suggestedFilename()).toBe('photo_압축.jpg');
  const bytes = new Uint8Array(await readFile(await file.path()));

  expect(isJpeg(bytes)).toBe(true);
  expect(bytes.length).toBeLessThan(original.length / 2);
  expect(await inspect(page, bytes)).toMatchObject({ width: 1200, height: 900 });
  expectLocalOnly(page, requests, baseURL!);
});

test('여러 장은 ZIP 하나로 받고, PNG는 투명을 지킨 채 줄어든다', async ({ page }) => {
  const frame = await openTool(page, ['photo.jpg', 'screen.png']);
  await frame.getByRole('button', { name: '압축하기' }).click();
  const event = page.waitForEvent('download');
  await frame.getByRole('button', { name: '모두 받기 (ZIP, 2장)' }).click();
  const file = await event;
  expect(file.suggestedFilename()).toBe('이미지_압축.zip');
  const entries = unzipSync(new Uint8Array(await readFile(await file.path())));
  expect(Object.keys(entries).sort()).toEqual(['photo_압축.jpg', 'screen_압축.png']);

  const png = entries['screen_압축.png']!;
  expect(isPng(png)).toBe(true);
  expect(png.length).toBeLessThan((await readFile(fixture('screen.png'))).length);
  expect(await inspect(page, png)).toEqual({ width: 800, height: 600, alpha: 0 });
});

test('WebP로 바꾸기를 고르면 WebP로 저장한다', async ({ page }) => {
  const frame = await openTool(page, ['photo.jpg']);
  await frame.getByText('WebP로 바꾸기 (더 작음)').click();
  await frame.getByRole('button', { name: '압축하기' }).click();
  const event = page.waitForEvent('download');
  await frame.getByRole('button', { name: '다운로드' }).click();
  const file = await event;
  expect(file.suggestedFilename()).toBe('photo_압축.webp');
  const bytes = new Uint8Array(await readFile(await file.path()));
  expect(isWebp(bytes)).toBe(true);
  expect(await inspect(page, bytes)).toMatchObject({ width: 1200, height: 900 });
});

test('휴대폰 사진의 회전 정보를 적용해 바로 세워 저장한다', async ({ page }) => {
  // rotated.jpg는 400×300 화소에 '90° 돌려서 보라'는 EXIF가 붙어 있다
  const frame = await openTool(page, ['rotated.jpg']);
  await expect(frame.getByText('300×400', { exact: false })).toBeVisible();
  await frame.getByText('많이 (용량 우선)').click();
  await frame.getByRole('button', { name: '압축하기' }).click();
  await expect(frame.getByText('완료:', { exact: false })).toBeVisible();
  const event = page.waitForEvent('download');
  await frame.getByRole('button', { name: '다운로드' }).click();
  const bytes = new Uint8Array(await readFile(await (await event).path()));
  expect(await inspect(page, bytes)).toMatchObject({ width: 300, height: 400 });
});

test('더 줄지 않는 이미지는 원본 그대로 두고, 열 수 없는 파일은 알려 준다', async ({ page }) => {
  const frame = await openTool(page, ['small.jpg', 'broken.png']);
  await expect(frame.getByText('열 수 없는 이미지입니다.', { exact: false })).toBeVisible();
  await frame.getByText('조금 (화질 우선)').click();
  await frame.getByRole('button', { name: '압축하기' }).click();
  await expect(frame.getByText('이미 작아서 원본 그대로', { exact: false })).toBeVisible();
  await expect(frame.getByText('더 줄일 수 없었습니다.', { exact: false })).toBeVisible();
  await expect(frame.getByRole('button', { name: '다운로드' })).toHaveCount(0);
});
