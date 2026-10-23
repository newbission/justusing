/**
 * 이미지 형식 변환 E2E. 빌드 결과에서 돌린다 (playwright.config.ts 참고).
 *
 * 받은 이미지를 브라우저로 다시 열어 형식·크기·색이 맞는지 확인하고,
 * 처리하는 동안 파일이 기기를 떠나지 않는다는 약속을 확인한다.
 */
import { expect, test, type Page, type Request } from './test';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { unzipSync } from 'fflate';
import { expectLocalOnly } from './local-only';

const fixture = (name: string) => fileURLToPath(new URL(`../fixtures/${name}`, import.meta.url));

async function openTool(page: Page, files: string[]) {
  await page.goto('/image/convert/');
  const frame = page.frameLocator('iframe[data-tool-frame]');
  await frame.locator('input[type=file]').setInputFiles(files.map(fixture));
  return frame;
}

/** 브라우저로 이미지를 열어 가로·세로와 왼쪽 위 화소의 색(RGBA)을 읽는다 */
async function inspect(page: Page, bytes: Uint8Array) {
  return page.evaluate(async (data) => {
    const bitmap = await createImageBitmap(new Blob([new Uint8Array(data)]));
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const context = canvas.getContext('2d')!;
    context.drawImage(bitmap, 0, 0);
    const pixel = Array.from(context.getImageData(0, 0, 1, 1).data);
    return { width: bitmap.width, height: bitmap.height, pixel };
  }, Array.from(bytes));
}

const isJpeg = (bytes: Uint8Array) => bytes[0] === 0xff && bytes[1] === 0xd8;
const isPng = (bytes: Uint8Array) => bytes[0] === 0x89 && bytes[1] === 0x50;
const isWebp = (bytes: Uint8Array) => String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP';

test('투명한 PNG를 JPG로 바꾸면 투명한 곳이 흰색이 된다', async ({ page, baseURL }) => {
  const requests: Request[] = [];
  page.on('request', (request) => requests.push(request));
  const frame = await openTool(page, ['screen.png']);
  await expect(frame.getByText('PNG → JPG', { exact: false })).toBeVisible();
  requests.length = 0; // 페이지를 여는 요청은 빼고, 파일을 고른 뒤부터 센다

  await frame.getByRole('button', { name: '변환하기' }).click();
  const event = page.waitForEvent('download');
  await frame.getByRole('button', { name: '다운로드' }).click();
  const file = await event;
  expect(file.suggestedFilename()).toBe('screen.jpg');
  const bytes = new Uint8Array(await readFile(await file.path()));
  expect(isJpeg(bytes)).toBe(true);
  const { width, height, pixel } = await inspect(page, bytes);
  expect({ width, height }).toEqual({ width: 800, height: 600 });
  // 투명했던 왼쪽 위가 흰색 (JPG라 값이 조금 흔들릴 수 있다)
  for (const value of pixel) expect(value).toBeGreaterThan(245);
  expectLocalOnly(page, requests, baseURL!);
});

test('GIF·BMP를 WebP로 바꿔 ZIP 하나로 받는다', async ({ page }) => {
  const frame = await openTool(page, ['moving.gif', 'green.bmp']);
  await expect(
    frame.getByText('움직이는 GIF는 첫 장면만 바뀝니다.', { exact: false }),
  ).toBeVisible();
  await frame.getByText('WebP', { exact: true }).click();
  await frame.getByRole('button', { name: '변환하기' }).click();
  const event = page.waitForEvent('download');
  await frame.getByRole('button', { name: '모두 받기 (ZIP, 2장)' }).click();
  const file = await event;
  expect(file.suggestedFilename()).toBe('이미지_변환.zip');
  const entries = unzipSync(new Uint8Array(await readFile(await file.path())));
  expect(Object.keys(entries).sort()).toEqual(['green.webp', 'moving.webp']);
  expect(isWebp(entries['green.webp']!)).toBe(true);
  // GIF는 첫 장면(빨강)만 남는다
  const gif = await inspect(page, entries['moving.webp']!);
  expect({ width: gif.width, height: gif.height }).toEqual({ width: 120, height: 80 });
  expect(gif.pixel[0]).toBeGreaterThan(gif.pixel[2]!);
});

test('사진을 PNG로 바꾸면 크기가 그대로인 PNG가 된다', async ({ page }) => {
  const frame = await openTool(page, ['photo.jpg']);
  await frame.getByText('PNG', { exact: true }).click();
  await frame.getByRole('button', { name: '변환하기' }).click();
  const event = page.waitForEvent('download');
  await frame.getByRole('button', { name: '다운로드' }).click();
  const file = await event;
  expect(file.suggestedFilename()).toBe('photo.png');
  const bytes = new Uint8Array(await readFile(await file.path()));
  expect(isPng(bytes)).toBe(true);
  expect(await inspect(page, bytes)).toMatchObject({ width: 1200, height: 900 });
});

test('브라우저가 읽지 못하는 파일은 알려 주고 빼고 바꾼다', async ({ page }) => {
  const frame = await openTool(page, ['broken.png', 'wide.png']);
  await expect(frame.getByText('읽지 못하는 이미지입니다.', { exact: false })).toBeVisible();
  await expect(frame.getByText('이미지 1장을 JPG로 바꿉니다.')).toBeVisible();
});

test('아이폰 사진(HEIC)도 크롬에서 바로 세운 JPG로 바뀐다', async ({ page, baseURL }) => {
  const requests: Request[] = [];
  page.on('request', (request) => requests.push(request));
  // 크롬은 HEIC를 스스로 읽지 못해 libheif로 연다. 화소는 가로이고 회전 표시(irot)가 붙어 있다
  const frame = await openTool(page, ['iphone.heic']);
  await expect(frame.getByText('HEIC → JPG', { exact: false })).toBeVisible();
  await frame.getByRole('button', { name: '변환하기' }).click();
  const event = page.waitForEvent('download');
  await frame.getByRole('button', { name: '다운로드' }).click();
  const file = await event;
  expect(file.suggestedFilename()).toBe('iphone.jpg');
  const bytes = new Uint8Array(await readFile(await file.path()));
  expect(isJpeg(bytes)).toBe(true);
  const { width, height, pixel } = await inspect(page, bytes);
  expect({ width, height }).toEqual({ width: 300, height: 400 });
  // 시계 방향으로 돌아 원래 왼쪽 아래(파랑)가 왼쪽 위로 온다
  expect(pixel[2]).toBeGreaterThan(200);
  expect(pixel[0]).toBeLessThan(60);
  expectLocalOnly(page, requests, baseURL!);
});
