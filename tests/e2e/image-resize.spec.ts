/**
 * 이미지 크기 조절 E2E. 빌드 결과에서 돌린다 (playwright.config.ts 참고).
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
  await page.goto('/image/resize/');
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

test('비율로 줄이면 가로·세로가 그만큼 줄고 원래 형식으로 저장된다', async ({ page, baseURL }) => {
  const requests: Request[] = [];
  page.on('request', (request) => requests.push(request));
  const frame = await openTool(page, ['photo.jpg']);
  await expect(frame.getByText('1200×900 → 600×450', { exact: false })).toBeVisible();
  requests.length = 0; // 페이지를 여는 요청은 빼고, 파일을 고른 뒤부터 센다

  await frame.getByLabel('비율 (%)').fill('25');
  await expect(frame.getByText('1200×900 → 300×225', { exact: false })).toBeVisible();
  await frame.getByRole('button', { name: '크기 바꾸기' }).click();
  const event = page.waitForEvent('download');
  await frame.getByRole('button', { name: '다운로드' }).click();
  const file = await event;
  expect(file.suggestedFilename()).toBe('photo_300x225.jpg');
  const bytes = new Uint8Array(await readFile(await file.path()));
  expect(bytes[0]).toBe(0xff);
  expect(await inspect(page, bytes)).toMatchObject({ width: 300, height: 225 });
  expectLocalOnly(page, requests, baseURL!);
});

test('비율을 유지하며 칸에 맞추면 가로·세로 사진이 각자 맞춰진다', async ({ page }) => {
  // photo.jpg는 1200×900(가로), rotated.jpg는 바로 세우면 300×400(세로)
  const frame = await openTool(page, ['photo.jpg', 'rotated.jpg', 'screen.png']);
  await frame.getByText('가로·세로 크기로').click();
  await expect(frame.getByText('가로나 세로 크기를 적어 주세요.')).toBeVisible();
  await frame.getByLabel('가로 (px)').fill('200');
  await frame.getByLabel('세로 (px)').fill('200');
  await frame.getByRole('button', { name: '크기 바꾸기' }).click();
  const event = page.waitForEvent('download');
  await frame.getByRole('button', { name: '모두 받기 (ZIP, 3장)' }).click();
  const file = await event;
  expect(file.suggestedFilename()).toBe('이미지_크기조절.zip');
  const entries = unzipSync(new Uint8Array(await readFile(await file.path())));
  expect(Object.keys(entries).sort()).toEqual([
    'photo_200x150.jpg',
    'rotated_150x200.jpg',
    'screen_200x150.png',
  ]);
  // PNG는 투명한 곳이 그대로 남는다
  expect(await inspect(page, entries['screen_200x150.png']!)).toEqual({
    width: 200,
    height: 150,
    alpha: 0,
  });
});

test('비율 유지를 끄면 적은 크기로 정확히 맞춘다', async ({ page }) => {
  const frame = await openTool(page, ['photo.jpg']);
  await frame.getByText('가로·세로 크기로').click();
  await frame.getByLabel('원래 비율 유지').uncheck();
  await frame.getByLabel('가로 (px)').fill('500');
  await expect(
    frame.getByText('비율을 유지하지 않으면 가로와 세로를 모두 적어야 합니다.'),
  ).toBeVisible();
  await expect(frame.getByRole('button', { name: '크기 바꾸기' })).toBeDisabled();
  await frame.getByLabel('세로 (px)').fill('500');
  await frame.getByRole('button', { name: '크기 바꾸기' }).click();
  const event = page.waitForEvent('download');
  await frame.getByRole('button', { name: '다운로드' }).click();
  const bytes = new Uint8Array(await readFile(await (await event).path()));
  expect(await inspect(page, bytes)).toMatchObject({ width: 500, height: 500 });
});

test('너무 큰 결과는 만들지 않고 알려 준다', async ({ page }) => {
  const frame = await openTool(page, ['photo.jpg']);
  await frame.getByText('가로·세로 크기로').click();
  await frame.getByLabel('가로 (px)').fill('20000');
  await expect(frame.getByText('결과가 너무 큽니다.', { exact: false })).toBeVisible();
  await expect(frame.getByRole('button', { name: '크기 바꾸기' })).toBeDisabled();
});

test('아이폰 사진(HEIC)은 크롬에서도 열어 바로 세운 JPG로 저장한다', async ({ page, baseURL }) => {
  const requests: Request[] = [];
  page.on('request', (request) => requests.push(request));
  // 크롬은 HEIC를 스스로 읽지 못해 libheif로 연다. 화소는 가로 400×300이고 회전 표시(irot)가 붙어 있다
  const frame = await openTool(page, ['iphone.heic']);
  await expect(frame.getByText('300×400 → 150×200', { exact: false })).toBeVisible();
  await expect(frame.getByText('HEIC 사진은 브라우저가 HEIC로 저장하지 못해 JPG로')).toBeVisible();
  requests.length = 0;

  await frame.getByRole('button', { name: '크기 바꾸기' }).click();
  const event = page.waitForEvent('download');
  await frame.getByRole('button', { name: '다운로드' }).click();
  const file = await event;
  expect(file.suggestedFilename()).toBe('iphone_150x200.jpg');
  const bytes = new Uint8Array(await readFile(await file.path()));
  expect(bytes[0]).toBe(0xff);
  expect(await inspect(page, bytes)).toMatchObject({ width: 150, height: 200 });
  expectLocalOnly(page, requests, baseURL!);
});
