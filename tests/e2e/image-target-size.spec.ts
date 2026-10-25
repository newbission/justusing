/**
 * 이미지 용량 맞추기 E2E. 빌드 결과에서 돌린다 (playwright.config.ts 참고).
 *
 * 받은 파일이 목표 용량(1KB = 1,000바이트) 이하인지, 크기·형식·투명이 맞는지 브라우저로 다시 열어 확인하고,
 * 처리하는 동안 파일이 기기를 떠나지 않는다는 약속을 확인한다.
 */
import { expect, test, type Page, type Request } from './test';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { unzipSync } from 'fflate';
import { expectLocalOnly } from './local-only';

const fixture = (name: string) => fileURLToPath(new URL(`../fixtures/${name}`, import.meta.url));

async function openTool(page: Page, files: string[]) {
  await page.goto('/image/target-size/');
  const frame = page.frameLocator('iframe[data-tool-frame]');
  await frame.locator('input[type=file]').setInputFiles(files.map(fixture));
  return frame;
}

/** 브라우저로 이미지를 열어 가로·세로와 왼쪽 위 화소(RGBA)를 읽는다 */
async function inspect(page: Page, bytes: Uint8Array) {
  return page.evaluate(async (data) => {
    const bitmap = await createImageBitmap(new Blob([new Uint8Array(data)]));
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const context = canvas.getContext('2d')!;
    context.drawImage(bitmap, 0, 0);
    const [r, g, b, a] = context.getImageData(0, 0, 1, 1).data;
    return { width: bitmap.width, height: bitmap.height, corner: [r, g, b, a] };
  }, Array.from(bytes));
}

const isJpeg = (bytes: Uint8Array) => bytes[0] === 0xff && bytes[1] === 0xd8;
const isPng = (bytes: Uint8Array) => bytes[0] === 0x89 && bytes[1] === 0x50;

async function download(page: Page, click: () => Promise<void>) {
  const event = page.waitForEvent('download');
  await click();
  const file = await event;
  return {
    name: file.suggestedFilename(),
    bytes: new Uint8Array(await readFile(await file.path())),
  };
}

test('사진을 100KB 이하로 맞추고, 화질만으로 모자라면 크기를 줄인다', async ({ page, baseURL }) => {
  const requests: Request[] = [];
  page.on('request', (request) => requests.push(request));
  // photo.jpg: 1200×900, 약 537KB. 화질 60%로도 100KB를 넘는 잔무늬 사진이다
  const frame = await openTool(page, ['photo.jpg']);
  await expect(frame.getByText('1200×900', { exact: false })).toBeVisible();
  requests.length = 0; // 페이지를 여는 요청은 빼고, 파일을 고른 뒤부터 센다

  await frame.getByText('100KB', { exact: true }).click();
  await frame.getByRole('button', { name: '용량 맞추기' }).click();
  await expect(frame.getByText('완료: 1장 모두 100KB 이하입니다.')).toBeVisible();
  await expect(frame.getByText('(줄임)', { exact: false })).toBeVisible();
  const file = await download(page, () => frame.getByRole('button', { name: '다운로드' }).click());

  expect(file.name).toBe('photo_100KB.jpg');
  expect(isJpeg(file.bytes)).toBe(true);
  expect(file.bytes.length).toBeLessThanOrEqual(100_000);
  const { width, height } = await inspect(page, file.bytes);
  expect(width).toBeLessThan(1200);
  // 비율은 그대로
  expect(Math.abs(width / height - 4 / 3)).toBeLessThan(0.01);
  expectLocalOnly(page, requests, baseURL!);
});

test('"크기는 그대로, 화질만"은 가로·세로를 두고, 못 맞추면 까닭을 알린다', async ({ page }) => {
  const frame = await openTool(page, ['photo.jpg']);
  await frame.getByText('크기는 그대로, 화질만').click();
  await frame.getByText('200KB', { exact: true }).click();
  await frame.getByRole('button', { name: '용량 맞추기' }).click();
  await expect(frame.getByText('완료:', { exact: false })).toBeVisible();
  const file = await download(page, () => frame.getByRole('button', { name: '다운로드' }).click());
  expect(file.bytes.length).toBeLessThanOrEqual(200_000);
  expect(await inspect(page, file.bytes)).toMatchObject({ width: 1200, height: 900 });

  // 10KB는 가장 낮은 화질로도 넘는다
  await frame.getByText('직접 입력', { exact: true }).click();
  await frame.getByLabel('목표 용량 숫자').fill('10');
  await frame.getByRole('button', { name: '용량 맞추기' }).click();
  await expect(frame.getByText('맞추지 못함: 화질만으로는', { exact: false })).toBeVisible();
  await expect(
    frame.getByText('화질만 낮춰서는 맞추지 못한 이미지가 있습니다.', { exact: false }),
  ).toBeVisible();
  await expect(frame.getByRole('button', { name: '다운로드' })).toHaveCount(0);

  // 크기도 줄이면 맞춘다
  await frame.getByText('필요하면 크기도 줄이기 (추천)').click();
  await frame.getByRole('button', { name: '용량 맞추기' }).click();
  const small = await download(page, () => frame.getByRole('button', { name: '다운로드' }).click());
  expect(small.name).toBe('photo_10KB.jpg');
  expect(small.bytes.length).toBeLessThanOrEqual(10_000);
});

test('여러 장은 ZIP 하나로, 이미 목표 이하인 원본은 그대로 넣는다', async ({ page }) => {
  // screen.png는 투명한 PNG(800×600, 약 11KB), small.jpg는 이미 작은 JPG(약 10KB)
  const frame = await openTool(page, ['photo.jpg', 'screen.png', 'small.jpg']);
  await frame.getByText('100KB', { exact: true }).click();
  await frame.getByRole('button', { name: '용량 맞추기' }).click();
  await expect(frame.getByText('투명한 곳은 흰색', { exact: false })).toBeVisible();
  await expect(frame.getByText('이미 목표 이하라 원본 그대로', { exact: false })).toBeVisible();
  const file = await download(page, () =>
    frame.getByRole('button', { name: '모두 받기 (ZIP, 3장)' }).click(),
  );
  expect(file.name).toBe('이미지_100KB.zip');
  const entries = unzipSync(file.bytes);
  expect(Object.keys(entries).sort()).toEqual(['photo_100KB.jpg', 'screen_100KB.jpg', 'small.jpg']);
  for (const bytes of Object.values(entries)) expect(bytes.length).toBeLessThanOrEqual(100_000);
  // 원본 그대로 넣었다
  expect(entries['small.jpg']).toEqual(new Uint8Array(await readFile(fixture('small.jpg'))));
  // JPG로 바꾼 PNG는 투명했던 왼쪽 위가 흰색이다
  const screen = entries['screen_100KB.jpg']!;
  expect(isJpeg(screen)).toBe(true);
  const { corner } = await inspect(page, screen);
  for (const channel of corner) expect(channel).toBeGreaterThan(245);
});

test('모두 이미 목표 이하면 원본 그대로 두고 받을 것이 없다', async ({ page }) => {
  const frame = await openTool(page, ['small.jpg']);
  await frame.getByText('500KB', { exact: true }).click();
  await frame.getByRole('button', { name: '용량 맞추기' }).click();
  await expect(frame.getByText('모두 이미 500KB 이하라 원본 그대로 둡니다.')).toBeVisible();
  await expect(frame.getByRole('button', { name: '다운로드' })).toHaveCount(0);
});

test('"원래 형식 그대로"는 PNG를 색 수를 줄여 PNG로 맞춘다', async ({ page }) => {
  // noise.png: 80×60 잡음 PNG, 약 14KB
  const frame = await openTool(page, ['noise.png']);
  await frame.getByText('원래 형식 그대로').click();
  await frame.getByText('직접 입력', { exact: true }).click();
  await frame.getByLabel('목표 용량 숫자').fill('10');
  await frame.getByRole('button', { name: '용량 맞추기' }).click();
  await expect(frame.getByText(/· (\d+색|색 그대로)/)).toBeVisible();
  const file = await download(page, () => frame.getByRole('button', { name: '다운로드' }).click());
  expect(file.name).toBe('noise_10KB.png');
  expect(isPng(file.bytes)).toBe(true);
  expect(file.bytes.length).toBeLessThanOrEqual(10_000);
  expect(await inspect(page, file.bytes)).toMatchObject({ width: 80, height: 60 });
});

test('목표가 범위를 벗어나면 막고, 열 수 없는 파일은 알려 준다', async ({ page }) => {
  const frame = await openTool(page, ['photo.jpg', 'broken.png']);
  await expect(frame.getByText('열 수 없는 이미지입니다.', { exact: false })).toBeVisible();
  await expect(frame.getByText('이미지 1장을 200KB 이하로 맞춥니다.')).toBeVisible();

  await frame.getByText('직접 입력', { exact: true }).click();
  await frame.getByLabel('목표 용량 숫자').fill('5');
  await expect(frame.getByText('목표 용량을 10KB에서 50MB 사이로 적어 주세요.')).toBeVisible();
  await expect(frame.getByRole('button', { name: '용량 맞추기' })).toBeDisabled();

  await frame.getByLabel('단위').selectOption('MB');
  await expect(frame.getByText('이미지 1장을 5MB 이하로 맞춥니다.')).toBeVisible();
  await frame.getByRole('button', { name: '용량 맞추기' }).click();
  await expect(frame.getByText('모두 이미 5MB 이하라 원본 그대로 둡니다.')).toBeVisible();
});

test('아이폰 사진(HEIC)은 목표 이하여도 "원래 형식 그대로"에서 JPG로 바꿔 맞춘다', async ({
  page,
  baseURL,
}) => {
  const requests: Request[] = [];
  page.on('request', (request) => requests.push(request));
  // iphone.heic: 약 3.5KB, 바로 세우면 300×400. 크롬은 HEIC를 스스로 읽지 못해 libheif로 연다
  const frame = await openTool(page, ['iphone.heic']);
  await expect(frame.getByText('300×400', { exact: false })).toBeVisible();
  requests.length = 0;

  await frame.getByText('원래 형식 그대로').click();
  await expect(
    frame.getByText('이미 목표 이하여도 JPG로 바꿔 맞춥니다', { exact: false }),
  ).toBeVisible();
  await frame.getByText('100KB', { exact: true }).click();
  await frame.getByRole('button', { name: '용량 맞추기' }).click();
  await expect(frame.getByText('완료: 1장 모두 100KB 이하입니다.')).toBeVisible();
  const file = await download(page, () => frame.getByRole('button', { name: '다운로드' }).click());
  expect(file.name).toBe('iphone_100KB.jpg');
  expect(isJpeg(file.bytes)).toBe(true);
  expect(await inspect(page, file.bytes)).toMatchObject({ width: 300, height: 400 });
  expectLocalOnly(page, requests, baseURL!);
});
