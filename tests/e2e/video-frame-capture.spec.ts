/**
 * 동영상 장면 캡처 E2E. 빌드 결과에서 돌린다 (playwright.config.ts 참고).
 *
 * 시험 동영상(color-steps.mp4, 320×180, 3초: 빨강·초록·파랑 1초씩)에서 장면을 받아 크기와 아래쪽 가운데 색으로
 * 그 시각의 장면인지 확인한다. 여러 장은 ZIP을 풀어 장 수·이름·색을 본다.
 */
import type { FrameLocator } from '@playwright/test';
import { expect, test, type Page } from './test';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { unzipSync } from 'fflate';

const fixture = (name: string) => fileURLToPath(new URL(`../fixtures/${name}`, import.meta.url));

async function openTool(page: Page, file: string, path = '/video/frame-capture/') {
  await page.goto(path);
  const frame = page.frameLocator('iframe[data-tool-frame]');
  await frame.locator('input[type=file]').first().setInputFiles(fixture(file));
  return frame;
}

async function download(page: Page, frame: FrameLocator, name: string) {
  const event = page.waitForEvent('download');
  await frame.getByRole('button', { name }).click();
  const file = await event;
  return {
    name: file.suggestedFilename(),
    bytes: new Uint8Array(await readFile(await file.path())),
  };
}

/** 이미지의 가로·세로와 아래쪽 가운데 색 이름 */
async function look(page: Page, bytes: Uint8Array) {
  return page.evaluate(async (data) => {
    const bitmap = await createImageBitmap(new Blob([new Uint8Array(data)]));
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(bitmap, 0, 0);
    const [r, g, b] = ctx.getImageData(bitmap.width / 2, (bitmap.height * 2) / 3, 1, 1).data;
    const color =
      r! > 180 && g! < 90 && b! < 90
        ? 'red'
        : g! > 160 && r! < 90 && b! < 110
          ? 'green'
          : b! > 180 && r! < 90 && g! < 110
            ? 'blue'
            : `${r},${g},${b}`;
    return { width: bitmap.width, height: bitmap.height, color };
  }, Array.from(bytes));
}

async function moveTo(frame: FrameLocator, seconds: string) {
  const field = frame.getByLabel('위치 (초)');
  await field.fill(seconds);
  await field.press('Enter');
}

test('찾아간 장면을 원래 크기 JPG로 받는다', async ({ page }) => {
  const frame = await openTool(page, 'color-steps.mp4');
  await expect(frame.getByText('320×180')).toBeVisible();
  await moveTo(frame, '1.5');
  await expect(frame.getByText('지금 장면 0:01.50 · JPG')).toBeVisible();
  const file = await download(page, frame, '이 장면 받기');
  expect(file.name).toBe('color-steps_00m01.50s.jpg');
  expect(file.bytes.subarray(0, 3)).toEqual(new Uint8Array([0xff, 0xd8, 0xff]));
  expect(await look(page, file.bytes)).toEqual({ width: 320, height: 180, color: 'green' });
  await expect(frame.getByText(/받았습니다: 0:01.50 장면 · \d+KB/)).toBeVisible();
});

test('1/30초 버튼으로 한 장면씩 옮기고 PNG로 받는다', async ({ page }) => {
  const frame = await openTool(page, 'color-steps.mp4');
  await moveTo(frame, '2.5');
  await frame.getByRole('button', { name: '1/30초 앞으로' }).click();
  await expect(frame.getByLabel('위치 (초)')).toHaveValue('2.53');
  await frame.getByRole('button', { name: '1/30초 뒤로' }).click();
  await frame.getByRole('button', { name: '1/30초 뒤로' }).click();
  await expect(frame.getByLabel('위치 (초)')).toHaveValue('2.47');
  await frame.getByText('PNG', { exact: true }).click();
  const file = await download(page, frame, '이 장면 받기');
  expect(file.name).toBe('color-steps_00m02.47s.png');
  expect(await look(page, file.bytes)).toEqual({ width: 320, height: 180, color: 'blue' });
});

test('일정 간격으로 여러 장을 뽑아 ZIP으로 받는다', async ({ page }) => {
  const frame = await openTool(page, 'color-steps.mp4');
  await frame.getByText('일정 간격으로 여러 장', { exact: true }).click();
  // 0~3초를 1초마다: 0·1·2·3초 (끝 시각 장면도 넣는다)
  await expect(frame.getByText('4장 · JPG · ZIP')).toBeVisible();
  const file = await download(page, frame, 'ZIP으로 받기');
  expect(file.name).toBe('color-steps_장면.zip');
  const entries = unzipSync(file.bytes);
  expect(Object.keys(entries)).toEqual([
    'color-steps_00m00.00s.jpg',
    'color-steps_00m01.00s.jpg',
    'color-steps_00m02.00s.jpg',
    'color-steps_00m03.00s.jpg',
  ]);
  const colors = [];
  for (const bytes of Object.values(entries)) colors.push((await look(page, bytes)).color);
  // 1초·2초는 경계라 그 시각에 시작하는 장면(초록·파랑)이고, 3초(끝)는 마지막 장면
  expect(colors).toEqual(['red', 'green', 'blue', 'blue']);
  await expect(frame.getByText(/받았습니다: 4장 · ZIP \d+KB/)).toBeVisible();
});

test('구간·간격을 바꾸면 장 수가 바뀐다', async ({ page }) => {
  const frame = await openTool(page, 'color-steps.mp4');
  await frame.getByText('일정 간격으로 여러 장', { exact: true }).click();
  await frame.getByText('0.5초마다', { exact: true }).click();
  await frame.getByLabel('시작 (초)').fill('1');
  await frame.getByLabel('시작 (초)').press('Enter');
  await frame.getByLabel('끝 (초)').fill('2');
  await frame.getByLabel('끝 (초)').press('Enter');
  await expect(frame.getByText('3장 · JPG · ZIP')).toBeVisible();
  // 위치 버튼으로도 구간을 정한다
  await moveTo(frame, '0.5');
  await frame.getByRole('button', { name: '지금 위치를 시작으로' }).click();
  await expect(frame.getByLabel('시작 (초)')).toHaveValue('0.5');
  await expect(frame.getByText('4장 · JPG · ZIP')).toBeVisible();
});

test('열지 못하는 파일은 알리고 다시 고르게 한다', async ({ page }) => {
  const frame = await openTool(page, 'not-a-video.mp4');
  await expect(frame.getByRole('alert')).toContainText('이 동영상을 열 수 없습니다');
  await expect(frame.getByText('동영상 파일 선택')).toBeVisible();
});

test('영어 화면', async ({ page }) => {
  const frame = await openTool(page, 'color-steps.mp4', '/en/video/frame-capture/');
  await frame.getByLabel('Position (s)').fill('0.5');
  await frame.getByLabel('Position (s)').press('Enter');
  const file = await download(page, frame, 'Download this frame');
  expect(file.name).toBe('color-steps_00m00.50s.jpg');
  expect((await look(page, file.bytes)).color).toBe('red');
});
