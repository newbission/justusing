/**
 * 이미지 이어 붙이기 E2E. 빌드 결과에서 돌린다 (playwright.config.ts 참고).
 *
 * 내려 가며 찍은 시험 캡처(scroll-1~3)를 이으면 원래 긴 화면(scroll-page.png)과 화소까지 같아야 한다.
 * 겹친 부분과 고정 막대를 찾지 못하거나 한 줄이라도 더 자르면 달라진다.
 */
import type { FrameLocator } from '@playwright/test';
import { expect, test, type Page } from './test';
import { difference, isJpeg, limitCanvas } from './canvas-limit';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { unzipSync } from 'fflate';

const fixture = (name: string) => fileURLToPath(new URL(`../fixtures/${name}`, import.meta.url));

async function openTool(page: Page, files: string[]) {
  await page.goto('/image/stitch/');
  const frame = page.frameLocator('iframe[data-tool-frame]');
  await frame.locator('input[type=file]').first().setInputFiles(files.map(fixture));
  return frame;
}

/** 이미지를 브라우저로 열어 가로·세로와 화소를 읽는다 */
async function pixels(page: Page, bytes: Uint8Array) {
  return page.evaluate(async (data) => {
    const bitmap = await createImageBitmap(new Blob([new Uint8Array(data)]));
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(bitmap, 0, 0);
    return {
      width: bitmap.width,
      height: bitmap.height,
      data: Array.from(ctx.getImageData(0, 0, bitmap.width, bitmap.height).data),
    };
  }, Array.from(bytes));
}

async function download(page: Page, frame: FrameLocator, name: string | RegExp) {
  const event = page.waitForEvent('download');
  await frame.getByRole('button', { name }).click();
  const file = await event;
  return {
    name: file.suggestedFilename(),
    bytes: new Uint8Array(await readFile(await file.path())),
  };
}

test('내려 가며 찍은 캡처를 겹친 부분 없이 원래 화면대로 잇는다', async ({ page }) => {
  const frame = await openTool(page, ['scroll-1.png', 'scroll-2.png', 'scroll-3.png']);
  await expect(frame.getByText('겹친 부분을 찾았습니다')).toHaveCount(2);
  await expect(frame.getByText('결과 360 × 1,360 px')).toBeVisible();
  await frame.getByText('PNG', { exact: true }).click();
  await frame.getByRole('button', { name: '이어 붙이기' }).click();
  const file = await download(page, frame, '다운로드');
  expect(file.name).toBe('scroll-1_이어붙임.png');

  const result = await pixels(page, file.bytes);
  const expected = await pixels(page, new Uint8Array(await readFile(fixture('scroll-page.png'))));
  expect([result.width, result.height]).toEqual([expected.width, expected.height]);
  expect(result.data.join() === expected.data.join()).toBe(true);
});

test('canvas 하나에 그리지 못하는 길이도 JPG로 잇는다', async ({ page }) => {
  const frame = await openTool(page, ['scroll-1.png', 'scroll-2.png', 'scroll-3.png']);
  await expect(frame.getByText('겹친 부분을 찾았습니다')).toHaveCount(2);
  await expect(frame.getByText('결과 360 × 1,360 px')).toBeVisible();
  // 결과(약 49만 화소)보다 작은 canvas만 되게 하면 줄 묶음씩 그려 직접 만든 JPG가 된다
  await limitCanvas(page, 100_000);
  await frame.getByRole('button', { name: '이어 붙이기' }).click();
  const file = await download(page, frame, '다운로드');
  expect(file.name).toBe('scroll-1_이어붙임.jpg');
  expect(isJpeg(file.bytes)).toBe(true);
  const expected = new Uint8Array(await readFile(fixture('scroll-page.png')));
  const diff = await difference(page, expected, file.bytes);
  expect(diff.sizes).toEqual([
    [360, 1360],
    [360, 1360],
  ]);
  expect(diff.mean).toBeLessThan(3);

  // WebP는 줄 묶음으로 만들 수 없어 PNG·JPG를 권한다
  await frame.getByText('WebP', { exact: true }).click();
  await frame.getByRole('button', { name: '이어 붙이기' }).click();
  await expect(
    frame.getByText('이 브라우저가 이렇게 큰 이미지를 만들지 못했습니다. PNG나 JPG로'),
  ).toBeVisible();
});

test('예시 대화 캡처도 겹친 부분을 찾는다', async ({ page }) => {
  await page.goto('/image/stitch/');
  const frame = page.frameLocator('iframe[data-tool-frame]');
  await frame.getByRole('button', { name: '예시 파일로 해 보기' }).click();
  await expect(frame.getByText('겹친 부분을 찾았습니다')).toHaveCount(2);
  // 750×1334 세 장에서 위 막대 144줄+겹침 518줄, 아래 입력 막대 112줄을 이음마다 잘라 낸다
  await expect(frame.getByText('결과 750 × 2,454 px')).toBeVisible();
});

test('JPG 캡처가 섞여도 겹친 부분을 찾는다', async ({ page }) => {
  const frame = await openTool(page, ['scroll-1.png', 'scroll-2.jpg', 'scroll-3.png']);
  await expect(frame.getByText('겹친 부분을 찾았습니다')).toHaveCount(2);
  await expect(frame.getByText('결과 360 × 1,360 px')).toBeVisible();
});

test('이음의 잘라 낼 높이를 고치고 되돌린다', async ({ page }) => {
  const frame = await openTool(page, ['scroll-1.png', 'scroll-2.png']);
  await expect(frame.getByText('결과 360 × 1,000 px')).toBeVisible();
  const top = frame.getByRole('group', { name: '1번째와 2번째 사이' }).getByLabel('아래 사진 위');
  await expect(top).toHaveValue('224');
  await top.fill('124');
  await expect(frame.getByText('직접 고쳤습니다')).toBeVisible();
  await expect(frame.getByText('결과 360 × 1,100 px')).toBeVisible();
  await frame.getByRole('button', { name: '자동 값으로' }).click();
  await expect(frame.getByText('결과 360 × 1,000 px')).toBeVisible();

  // 자동 지우기를 끄면 그대로 잇는다
  await frame.getByLabel('겹친 부분과 되풀이되는 위·아래 막대 자동으로 지우기').uncheck();
  await expect(frame.getByText('결과 360 × 1,280 px')).toBeVisible();
});

test('긴 결과를 빈 줄에서 나누어 ZIP으로 받는다', async ({ page }) => {
  const frame = await openTool(page, ['scroll-1.png', 'scroll-2.png', 'scroll-3.png']);
  await expect(frame.getByText('겹친 부분을 찾았습니다')).toHaveCount(2);
  await frame.getByLabel('긴 결과를 나누어 저장').check();
  await frame.getByLabel('한 장 높이 (px)').fill('500');
  await frame.getByRole('button', { name: '이어 붙이기' }).click();
  const file = await download(page, frame, /모두 받기 \(ZIP, \d장\)/);
  expect(file.name).toBe('scroll-1_이어붙임.zip');
  const files = unzipSync(file.bytes);
  const names = Object.keys(files).sort();
  expect(names[0]).toBe('scroll-1_이어붙임_1.jpg');
  let total = 0;
  for (const name of names) {
    const { width, height, data } = await pixels(page, files[name]!);
    expect(width, name).toBe(360);
    expect(height, name).toBeLessThanOrEqual(500);
    total += height;
    if (name === names[0]) continue;
    // 나눈 곳은 빈 줄이다: 둘째 장부터 첫 줄이 한 색이다
    const row = data.slice(0, width * 4);
    const plain = row.every((value, i) => Math.abs(value - row[i % 4]!) <= 16);
    expect(plain, name).toBe(true);
  }
  expect(total).toBe(1360);
});

test('PDF로 받으면 A4 비율 쪽으로 나눈다', async ({ page }) => {
  const frame = await openTool(page, ['scroll-1.png', 'scroll-2.png', 'scroll-3.png']);
  await expect(frame.getByText('겹친 부분을 찾았습니다')).toHaveCount(2);
  await frame.getByText('PDF', { exact: true }).click();
  await frame.getByRole('button', { name: '이어 붙이기' }).click();
  const file = await download(page, frame, '다운로드');
  expect(file.name).toBe('scroll-1_이어붙임.pdf');
  const text = Buffer.from(file.bytes).toString('latin1');
  // 360px 폭이면 A4 비율 쪽은 509px. 1360px는 세 쪽이 된다
  expect(text.match(/\/Type\s*\/Page[^s]/g)).toHaveLength(3);
});

test('가로로 이으면 가장 낮은 이미지 높이에 맞춘다', async ({ page }) => {
  const frame = await openTool(page, ['wide.png', 'tall.jpg']);
  await frame.getByText('가로로 (옆으로)').click();
  // 400×300 그대로, 300×400은 높이 300으로 줄여 225×300
  await expect(frame.getByText('결과 625 × 300 px')).toBeVisible();
  await expect(frame.getByText('PDF', { exact: true })).toHaveCount(0);
  await frame.getByText('가장 높은 사진').click();
  await expect(frame.getByText('결과 833 × 400 px')).toBeVisible();
  await expect(frame.getByText('사진 1장을 늘려서 붙입니다', { exact: false })).toBeVisible();
  await frame.getByRole('button', { name: '이어 붙이기' }).click();
  const file = await download(page, frame, '다운로드');
  expect(file.name).toBe('wide_이어붙임.jpg');
  const { width, height } = await pixels(page, file.bytes);
  expect([width, height]).toEqual([833, 400]);

  // canvas 한 변 한계를 넘는 폭은 PNG로도 그릴 수 없어 미리 막는다
  await frame.getByText('직접 입력').click();
  await frame.getByLabel('높이 (px)').fill('8000');
  await expect(frame.getByText('결과 폭이 너무 넓습니다', { exact: false })).toBeVisible();
  await expect(frame.getByRole('button', { name: '이어 붙이기' })).toBeDisabled();
});

test('아이폰 사진(HEIC)도 바로 세워 잇는다', async ({ page }) => {
  // 크롬은 HEIC를 스스로 읽지 못해 libheif로 연다. iphone.heic는 바로 세우면 300×400
  const frame = await openTool(page, ['wide.png', 'iphone.heic']);
  await frame.getByText('가로로 (옆으로)').click();
  await expect(frame.getByText('결과 625 × 300 px')).toBeVisible();
  await frame.getByRole('button', { name: '이어 붙이기' }).click();
  const file = await download(page, frame, '다운로드');
  const { width, height, data } = await pixels(page, file.bytes);
  expect([width, height]).toEqual([625, 300]);
  // 두 번째 사진의 왼쪽 위는 돌린 뒤의 파랑
  const at = (5 * width + 405) * 4;
  expect(data[at + 2]).toBeGreaterThan(200);
  expect(data[at]).toBeLessThan(60);
});

test('한 장이거나 열 수 없는 이미지는 빼고 알린다', async ({ page }) => {
  const frame = await openTool(page, ['wide.png', 'broken.png']);
  await expect(frame.getByText('열 수 없는 이미지입니다. 빼고 잇습니다.')).toBeVisible();
  await expect(frame.getByText('이을 이미지를 2장 이상 넣어 주세요.')).toBeVisible();
  await expect(frame.getByRole('button', { name: '이어 붙이기' })).toBeDisabled();
});
