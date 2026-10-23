/**
 * HEIC JPG 변환 E2E. 빌드 결과에서 돌린다 (playwright.config.ts 참고).
 *
 * 크롬은 HEIC를 스스로 읽지 못해 libheif(WebAssembly) 경로를 그대로 시험한다.
 * 받은 이미지를 브라우저로 다시 열어 크기·방향(irot)·색이 맞는지 보고, 대표 그림(primary)만 바뀌는지,
 * 10비트·Display P3 사진, 깨진 파일, 견본까지 본다. 테스트 파일은 tests/fixtures/make_image_fixtures.py가 만든다.
 */
import { expect, test, type Page, type Request } from './test';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { unzipSync } from 'fflate';
import { expectLocalOnly } from './local-only';

const fixture = (name: string) => fileURLToPath(new URL(`../fixtures/${name}`, import.meta.url));

async function openTool(page: Page, files: string[]) {
  await page.goto('/image/heic-to-jpg/');
  const frame = page.frameLocator('iframe[data-tool-frame]');
  await frame.locator('input[type=file]').setInputFiles(files.map(fixture));
  return frame;
}

/** 받은 이미지의 가로·세로와 네 귀퉁이(5화소 안쪽) 색 */
async function inspect(page: Page, bytes: Uint8Array) {
  return page.evaluate(async (data) => {
    const bitmap = await createImageBitmap(new Blob([new Uint8Array(data)]));
    const { width, height } = bitmap;
    const canvas = new OffscreenCanvas(width, height);
    const context = canvas.getContext('2d', { willReadFrequently: true })!;
    context.drawImage(bitmap, 0, 0);
    const at = (x: number, y: number) => Array.from(context.getImageData(x, y, 1, 1).data);
    return {
      width,
      height,
      corners: [at(5, 5), at(width - 6, 5), at(5, height - 6), at(width - 6, height - 6)],
    };
  }, Array.from(bytes));
}

/** RGB를 빨강·초록·파랑·흰색으로 (JPG라 값이 조금 흔들린다) */
function colorName([r, g, b]: number[]) {
  if (r! > 200 && g! > 200 && b! > 200) return 'white';
  if (r! > 200 && g! < 60 && b! < 60) return 'red';
  if (g! > 200 && r! < 60 && b! < 60) return 'green';
  if (b! > 200 && r! < 60 && g! < 60) return 'blue';
  return `${r},${g},${b}`;
}

const isJpeg = (bytes: Uint8Array) => bytes[0] === 0xff && bytes[1] === 0xd8;

test('아이폰 사진을 바로 세운 JPG로 바꾸고, 사진은 기기를 떠나지 않는다', async ({
  page,
  baseURL,
}) => {
  const requests: Request[] = [];
  page.on('request', (request) => requests.push(request));
  const frame = await openTool(page, ['iphone.heic']);
  await expect(frame.getByText('HEIC → JPG', { exact: false })).toBeVisible();
  await expect(frame.getByText('대표 사진 한 장만 바뀌고', { exact: false })).toBeVisible();
  // 목록 썸네일은 libheif로 만든 JPG다 (브라우저는 HEIC를 <img>로 그리지 못한다)
  await expect(frame.locator('.thumb img')).toHaveJSProperty('naturalWidth', 300);

  await frame.getByRole('button', { name: '변환하기' }).click();
  const event = page.waitForEvent('download');
  await frame.getByRole('button', { name: '다운로드' }).click();
  const file = await event;
  expect(file.suggestedFilename()).toBe('iphone.jpg');
  const bytes = new Uint8Array(await readFile(await file.path()));
  expect(isJpeg(bytes)).toBe(true);
  // 화소는 가로 400×300이고 시계 방향 90° 회전 표시(irot)가 붙어 있다 → 세로 300×400
  const result = await inspect(page, bytes);
  expect([result.width, result.height]).toEqual([300, 400]);
  expect(result.corners.map(colorName)).toEqual(['blue', 'red', 'white', 'green']);
  // 다시 그려 저장해 촬영 정보(EXIF)가 남지 않는다
  expect(new TextDecoder('latin1').decode(bytes.slice(0, 64))).not.toContain('Exif');
  expectLocalOnly(page, requests, baseURL!);
});

test('여러 장은 ZIP으로 받고, 대표 그림·10비트 사진도 바꾼다', async ({ page }) => {
  const frame = await openTool(page, ['iphone.heic', 'burst.heic', 'deep.heic']);
  await expect(frame.getByText('사진 3장을 JPG로 바꿉니다.')).toBeVisible();
  await frame.getByRole('button', { name: '변환하기' }).click();
  const event = page.waitForEvent('download');
  await frame.getByRole('button', { name: '모두 받기 (ZIP, 3장)' }).click();
  const file = await event;
  expect(file.suggestedFilename()).toBe('HEIC_변환.zip');
  const entries = unzipSync(new Uint8Array(await readFile(await file.path())));
  expect(Object.keys(entries).sort()).toEqual(['burst.jpg', 'deep.jpg', 'iphone.jpg']);

  // 두 장이 든 파일은 대표 그림(둘째 장, 빨강 120×160)만
  const burst = await inspect(page, entries['burst.jpg']!);
  expect([burst.width, burst.height]).toEqual([120, 160]);
  expect(colorName(burst.corners[0]!)).toBe('red');
  // 10비트는 8비트로 줄여 같은 색 (200, 40, 40)쯤
  const deep = await inspect(page, entries['deep.jpg']!);
  expect([deep.width, deep.height]).toEqual([400, 300]);
  const [r, g, b] = deep.corners[0]!;
  expect(Math.abs(r! - 200)).toBeLessThan(8);
  expect(Math.abs(g! - 40)).toBeLessThan(8);
  expect(Math.abs(b! - 40)).toBeLessThan(8);
});

test('Display P3 사진은 일반 화면 색으로 바꿔 저장한다', async ({ page }) => {
  const frame = await openTool(page, ['p3.heic']);
  await frame.getByText('PNG', { exact: true }).click();
  await frame.getByRole('button', { name: '변환하기' }).click();
  const event = page.waitForEvent('download');
  await frame.getByRole('button', { name: '다운로드' }).click();
  const file = await event;
  expect(file.suggestedFilename()).toBe('p3.png');
  const { corners } = await inspect(page, new Uint8Array(await readFile(await file.path())));
  // P3의 (200, 60, 60)은 일반 화면(sRGB)에서 더 짙은 빨강이다. 바꾸지 않으면 200 그대로 남는다
  const [r, g] = corners[0]!;
  expect(r).toBeGreaterThan(208);
  expect(g).toBeLessThan(55);
});

test('깨진 HEIC는 알려 주고 빼고 바꾼다', async ({ page }) => {
  const frame = await openTool(page, ['broken.heic', 'iphone.heic']);
  await expect(frame.getByText('읽지 못하는 사진입니다.', { exact: false })).toBeVisible();
  await expect(frame.getByText('사진 1장을 JPG로 바꿉니다.')).toBeVisible();
});

test('예시 사진 두 장을 바꿔 받는다', async ({ page }) => {
  await page.goto('/image/heic-to-jpg/');
  const frame = page.frameLocator('iframe[data-tool-frame]');
  await frame.getByRole('button', { name: '예시 파일로 해 보기' }).click();
  await expect(frame.getByText('사진 2장을 JPG로 바꿉니다.')).toBeVisible();
  await frame.getByRole('button', { name: '변환하기' }).click();
  const event = page.waitForEvent('download');
  await frame.getByRole('button', { name: '모두 받기 (ZIP, 2장)' }).click();
  const entries = unzipSync(new Uint8Array(await readFile(await (await event).path())));
  expect(Object.keys(entries).sort()).toEqual(['예시-아이폰사진1.jpg', '예시-아이폰사진2.jpg']);
  // 둘째 장은 세로로 들고 찍은 사진 (회전 표시를 적용해 1200×1600)
  const portrait = await inspect(page, entries['예시-아이폰사진2.jpg']!);
  expect([portrait.width, portrait.height]).toEqual([1200, 1600]);
});

test('영어 화면에서도 바꾼다', async ({ page }) => {
  await page.goto('/en/image/heic-to-jpg/');
  const frame = page.frameLocator('iframe[data-tool-frame]');
  await frame.locator('input[type=file]').setInputFiles(fixture('iphone.heic'));
  await expect(frame.getByText('Convert 1 photo to JPG.')).toBeVisible();
  await frame.getByRole('button', { name: 'Convert photos' }).click();
  await expect(frame.getByRole('button', { name: 'Download', exact: true })).toBeVisible();
});
