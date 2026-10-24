/**
 * 동영상을 GIF로 E2E. 빌드 결과에서 돌린다 (playwright.config.ts 참고).
 *
 * 시험 동영상(color-steps.mp4, 320×180, 3초: 빨강·초록·파랑 1초씩, 위 띠에서 흰 네모가 움직임)으로 GIF·WebP를 만들어
 * 파일을 직접 읽어 장면 수·크기·반복·장면 길이를 확인하고, 첫 장면의 색이 동영상과 같은지 본다.
 */
import type { FrameLocator } from '@playwright/test';
import { expect, test, type Page } from './test';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const fixture = (name: string) => fileURLToPath(new URL(`../fixtures/${name}`, import.meta.url));

async function openTool(page: Page, file: string, path = '/video/to-gif/') {
  await page.goto(path);
  const frame = page.frameLocator('iframe[data-tool-frame]');
  await frame.locator('input[type=file]').first().setInputFiles(fixture(file));
  return frame;
}

/** GIF 파일의 화면 크기, 장면 수, 장면 길이(1/100초), 반복 횟수(NETSCAPE 표시가 없으면 undefined) */
function readGif(bytes: Uint8Array) {
  const u16 = (at: number) => bytes[at]! | (bytes[at + 1]! << 8);
  expect(String.fromCharCode(...bytes.subarray(0, 6))).toBe('GIF89a');
  const width = u16(6);
  const height = u16(8);
  let at = 13;
  if (bytes[10]! & 0x80) at += 3 * 2 ** ((bytes[10]! & 7) + 1);
  const skipBlocks = () => {
    while (bytes[at]! !== 0) at += bytes[at]! + 1;
    at++;
  };
  let frames = 0;
  let loop: number | undefined;
  const delays: number[] = [];
  while (at < bytes.length) {
    const block = bytes[at]!;
    if (block === 0x3b) break;
    if (block === 0x21) {
      const label = bytes[at + 1]!;
      at += 2;
      if (label === 0xf9) delays.push(u16(at + 2));
      if (
        label === 0xff &&
        String.fromCharCode(...bytes.subarray(at + 1, at + 12)) === 'NETSCAPE2.0'
      ) {
        loop = u16(at + 14);
      }
      skipBlocks();
    } else if (block === 0x2c) {
      frames++;
      const packed = bytes[at + 9]!;
      at += 10;
      if (packed & 0x80) at += 3 * 2 ** ((packed & 7) + 1);
      at++; // LZW 최소 코드 크기
      skipBlocks();
    } else {
      throw new Error(`알 수 없는 GIF 블록 ${block} @ ${at}`);
    }
  }
  return { width, height, frames, loop, delays };
}

/** 움직이는 WebP의 화면 크기, 장면 수, 반복 횟수 */
function readWebp(bytes: Uint8Array) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const tag = (at: number) => String.fromCharCode(...bytes.subarray(at, at + 4));
  expect([tag(0), tag(8)]).toEqual(['RIFF', 'WEBP']);
  expect(view.getUint32(4, true)).toBe(bytes.length - 8);
  const u24 = (at: number) => bytes[at]! | (bytes[at + 1]! << 8) | (bytes[at + 2]! << 16);
  let width = 0;
  let height = 0;
  let frames = 0;
  let loop: number | undefined;
  for (let at = 12; at + 8 <= bytes.length;) {
    const name = tag(at);
    const size = view.getUint32(at + 4, true);
    if (name === 'VP8X') {
      expect(bytes[at + 8]! & 0x02).toBe(0x02);
      width = u24(at + 12) + 1;
      height = u24(at + 15) + 1;
    }
    if (name === 'ANIM') loop = view.getUint16(at + 12, true);
    if (name === 'ANMF') frames++;
    at += 8 + size + (size & 1);
  }
  return { width, height, frames, loop };
}

/** 이미지(움직이면 첫 장면)를 브라우저로 열어 가로·세로와 (x, y) 화소 색 */
async function pixelAt(page: Page, bytes: Uint8Array, x: number, y: number) {
  return page.evaluate(
    async ([data, px, py]) => {
      const bitmap = await createImageBitmap(new Blob([new Uint8Array(data as number[])]));
      const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(bitmap, 0, 0);
      return {
        width: bitmap.width,
        height: bitmap.height,
        rgb: Array.from(ctx.getImageData(px as number, py as number, 1, 1).data).slice(0, 3),
      };
    },
    [Array.from(bytes), x, y] as const,
  );
}

async function setRange(frame: FrameLocator, start: string, end: string) {
  await frame.getByLabel('시작 (초)').fill(start);
  await frame.getByLabel('시작 (초)').press('Enter');
  await frame.getByLabel('끝 (초)').fill(end);
  await frame.getByLabel('끝 (초)').press('Enter');
}

async function make(page: Page, frame: FrameLocator, make: string, get: string) {
  await frame.getByRole('button', { name: make }).click();
  await expect(frame.getByRole('button', { name: get })).toBeVisible({ timeout: 30_000 });
  const event = page.waitForEvent('download');
  await frame.getByRole('button', { name: get }).click();
  const file = await event;
  return {
    name: file.suggestedFilename(),
    bytes: new Uint8Array(await readFile(await file.path())),
  };
}

test('고른 구간을 고른 폭·초당 장면 수로 계속 반복하는 GIF로 만든다', async ({ page }) => {
  const frame = await openTool(page, 'color-steps.mp4');
  await expect(frame.getByText('320×180')).toBeVisible();
  await setRange(frame, '0', '2');
  await frame.getByText('240px', { exact: true }).click();
  // 만들기 전에 결과 크기·장면 수와 예상 용량을 보인다
  await expect(frame.getByText(/240 × 135 px · 20장 · 예상 약 \d+KB/)).toBeVisible();

  const file = await make(page, frame, 'GIF 만들기', 'GIF 받기');
  expect(file.name).toBe('color-steps.gif');
  const gif = readGif(file.bytes);
  expect(gif).toMatchObject({ width: 240, height: 135, frames: 20, loop: 0 });
  // 초당 10장 = 장면마다 1/10초, 모두 2초
  expect(gif.delays).toEqual(Array(20).fill(10));
  await expect(frame.getByRole('img', { name: '만든 움직이는 그림' })).toBeVisible();
  await expect(frame.getByText(/받았습니다: GIF \d+KB/)).toBeVisible();

  // 첫 장면은 빨강 (아래쪽 가운데)
  const first = await pixelAt(page, file.bytes, 120, 100);
  expect(first.width).toBe(240);
  expect(first.rgb[0]).toBeGreaterThan(180);
  expect(first.rgb[1]).toBeLessThan(80);
});

test('장면 화소는 화면 스레드가 아니라 워커에서 읽는다', async ({ page }) => {
  // 화면(frame 문서)에서 getImageData를 부르면 센다. 워커의 OffscreenCanvas는 세지 않는다
  await page.addInitScript(() => {
    const read = CanvasRenderingContext2D.prototype.getImageData;
    CanvasRenderingContext2D.prototype.getImageData = function (...args) {
      const counter = globalThis as { __pixelReads?: number };
      counter.__pixelReads = (counter.__pixelReads ?? 0) + 1;
      return read.apply(this, args);
    };
  });
  const frame = await openTool(page, 'color-steps.mp4');
  await setRange(frame, '0', '1');
  await expect(frame.getByText(/예상 약/)).toBeVisible();
  const gif = readGif((await make(page, frame, 'GIF 만들기', 'GIF 받기')).bytes);
  expect(gif.frames).toBe(10);
  const tool = page.frames().find((item) => item.url().includes('/video/to-gif/frame/'))!;
  expect(
    await tool.evaluate(() => (globalThis as { __pixelReads?: number }).__pixelReads ?? 0),
  ).toBe(0);
});

test('한 번만 재생, 초당 장면 수 5, 색 수를 바꿔 만든다', async ({ page }) => {
  const frame = await openTool(page, 'color-steps.mp4');
  await setRange(frame, '1', '3');
  await frame.getByText('320px', { exact: true }).click();
  await frame.getByRole('slider', { name: '초당 장면 수' }).fill('5');
  await frame.getByText('32색', { exact: true }).click();
  await frame.getByLabel(/디더링/).uncheck();
  await frame.getByText('한 번만', { exact: true }).click();
  await expect(frame.getByText(/320 × 180 px · 10장/)).toBeVisible();

  const gif = readGif((await make(page, frame, 'GIF 만들기', 'GIF 받기')).bytes);
  // 반복 표시가 없으면 한 번만 재생한다
  expect(gif).toMatchObject({ width: 320, height: 180, frames: 10, loop: undefined });
  expect(gif.delays).toEqual(Array(10).fill(20));
});

test('설정을 바꾸면 만든 결과를 지우고 다시 만들게 한다', async ({ page }) => {
  const frame = await openTool(page, 'color-steps.mp4');
  await setRange(frame, '0', '0.5');
  await frame.getByRole('button', { name: 'GIF 만들기' }).click();
  await expect(frame.getByRole('button', { name: 'GIF 받기' })).toBeVisible();
  await frame.getByText('한 번만', { exact: true }).click();
  await expect(frame.getByRole('button', { name: 'GIF 만들기' })).toBeVisible();
  await expect(frame.getByRole('img', { name: '만든 움직이는 그림' })).toHaveCount(0);
});

test('움직이는 WebP로도 만든다', async ({ page }) => {
  const frame = await openTool(page, 'color-steps.mp4');
  await setRange(frame, '0', '1.5');
  await frame.getByText('움직이는 WebP', { exact: true }).click();
  const file = await make(page, frame, 'WebP 만들기', 'WebP 받기');
  expect(file.name).toBe('color-steps.webp');
  expect(readWebp(file.bytes)).toEqual({ width: 320, height: 180, frames: 15, loop: 0 });
  const first = await pixelAt(page, file.bytes, 160, 120);
  expect(first.rgb[0]).toBeGreaterThan(180);
});

test('열지 못하는 파일은 알리고 다시 고르게 한다', async ({ page }) => {
  const frame = await openTool(page, 'not-a-video.mp4');
  await expect(frame.getByRole('alert')).toContainText('이 동영상을 열 수 없습니다');
  await expect(frame.getByText('동영상 파일 선택')).toBeVisible();
});

test('영어 화면', async ({ page }) => {
  const frame = await openTool(page, 'color-steps.mp4', '/en/video/to-gif/');
  await frame.getByLabel('End (s)').fill('1');
  await frame.getByLabel('End (s)').press('Enter');
  await expect(frame.getByText('480px', { exact: true })).toHaveCount(0);
  await expect(frame.getByText(/320 × 180 px · 10 frames · About \d+KB/)).toBeVisible();
  const gif = readGif((await make(page, frame, 'Make GIF', 'Download GIF')).bytes);
  // 원본이 320px라 480·640은 없고 고를 수 있는 가장 큰 폭(원본 320px)이 기본
  expect(gif).toMatchObject({ width: 320, height: 180, frames: 10, loop: 0 });
});
