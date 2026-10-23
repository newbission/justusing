/**
 * 이미지 모자이크 E2E. 빌드 결과에서 돌린다 (playwright.config.ts 참고).
 *
 * 화소마다 색이 다른 그림(noise.png, 80×60)의 한 곳을 가려 PNG로 받고, 원본과 화소를 견줘
 * 가린 곳 안만 바뀌었는지 본다. 검게 칠하기는 가린 곳에 원래 화소가 하나도 남지 않아야 한다.
 */
import type { FrameLocator } from '@playwright/test';
import { expect, test, type Page } from './test';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const fixture = (name: string) => fileURLToPath(new URL(`../fixtures/${name}`, import.meta.url));

/** 테스트에서 가리는 곳: 왼쪽 10, 위 10, 폭 40, 높이 30 */
const AREA = { x: 10, y: 10, width: 40, height: 30 };
const inArea = (x: number, y: number) =>
  x >= AREA.x && x < AREA.x + AREA.width && y >= AREA.y && y < AREA.y + AREA.height;

async function openTool(page: Page, file: string) {
  await page.goto('/image/mosaic/');
  const frame = page.frameLocator('iframe[data-tool-frame]');
  await frame.locator('input[type=file]').first().setInputFiles(fixture(file));
  if (file !== 'broken.png') {
    await frame.locator('.view canvas').waitFor();
    // 사진을 열면 바깥 페이지가 도구 칸으로 스크롤한다. 누르는 사이에 버튼이 옮겨지지 않게 끝나기를 기다린다
    await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(0);
  }
  return frame;
}

/** 키보드로 쓸 수 있는 '가릴 곳 추가'로 한 곳을 넣고 숫자 칸으로 AREA에 맞춘다 */
async function addArea(frame: FrameLocator) {
  await frame.getByRole('button', { name: '가릴 곳 추가' }).click();
  for (const [label, value] of [
    ['폭 (px)', AREA.width],
    ['높이 (px)', AREA.height],
    ['왼쪽 (px)', AREA.x],
    ['위 (px)', AREA.y],
  ] as const) {
    await frame.getByLabel(label).fill(String(value));
    await frame.getByLabel(label).press('Enter');
  }
  await expect(frame.getByLabel('폭 (px)')).toHaveValue(String(AREA.width));
}

async function download(page: Page, frame: FrameLocator) {
  const event = page.waitForEvent('download');
  await frame.getByRole('button', { name: '가린 이미지 받기' }).click();
  const file = await event;
  return {
    name: file.suggestedFilename(),
    bytes: new Uint8Array(await readFile(await file.path())),
  };
}

/** 이미지를 브라우저로 열어 가로·세로와 RGBA 화소 */
async function pixels(page: Page, bytes: Uint8Array) {
  return page.evaluate(async (data) => {
    const bitmap = await createImageBitmap(new Blob([new Uint8Array(data)]));
    const { width, height } = bitmap;
    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(bitmap, 0, 0);
    return { width, height, data: Array.from(ctx.getImageData(0, 0, width, height).data) };
  }, Array.from(bytes));
}

/** 이미지의 가로·세로만 (큰 사진의 화소를 넘겨받지 않게) */
async function sizeOf(page: Page, bytes: Uint8Array) {
  return page.evaluate(async (data) => {
    const bitmap = await createImageBitmap(new Blob([new Uint8Array(data)]));
    return [bitmap.width, bitmap.height];
  }, Array.from(bytes));
}

/** 원본과 결과를 견줘 가린 곳 안·밖에서 바뀐 화소 수 */
async function compare(page: Page, result: Uint8Array) {
  const before = await pixels(page, new Uint8Array(await readFile(fixture('noise.png'))));
  const after = await pixels(page, result);
  expect([after.width, after.height]).toEqual([80, 60]);
  let inside = 0;
  let outside = 0;
  for (let y = 0; y < 60; y++) {
    for (let x = 0; x < 80; x++) {
      const i = (y * 80 + x) * 4;
      const changed = [0, 1, 2, 3].some((c) => before.data[i + c] !== after.data[i + c]);
      if (changed && inArea(x, y)) inside++;
      else if (changed) outside++;
    }
  }
  return { inside, outside, after: after.data };
}

const at = (data: number[], x: number, y: number) =>
  data.slice((y * 80 + x) * 4, (y * 80 + x) * 4 + 4);

test('모자이크는 가린 곳만 칸마다 같은 색으로 바꾼다', async ({ page }) => {
  const frame = await openTool(page, 'noise.png');
  await expect(frame.getByText('사진 위를 끌어 가릴 곳을 그리세요.')).toBeVisible();
  await expect(frame.getByRole('button', { name: '가린 이미지 받기' })).toBeDisabled();
  await addArea(frame);
  await expect(frame.getByText('가릴 곳 1곳 · 80 × 60 px · PNG')).toBeVisible();
  // 세기 5: 짧은 변 30의 1/8 → 4px 칸
  await expect(frame.getByText('칸 4px')).toBeVisible();
  const file = await download(page, frame);
  expect(file.name).toBe('noise_모자이크.png');
  const { inside, outside, after } = await compare(page, file.bytes);
  expect(outside).toBe(0);
  expect(inside).toBeGreaterThan(AREA.width * AREA.height * 0.9);
  // 4×4 칸 안은 모두 같은 색
  for (let y = AREA.y; y < AREA.y + AREA.height; y++) {
    for (let x = AREA.x; x < AREA.x + AREA.width; x++) {
      const corner = at(
        after,
        AREA.x + Math.floor((x - AREA.x) / 4) * 4,
        AREA.y + Math.floor((y - AREA.y) / 4) * 4,
      );
      expect(at(after, x, y)).toEqual(corner);
    }
  }
  await expect(frame.getByText('받았습니다: 가릴 곳 1곳')).toBeVisible();
});

test('검게 칠하기는 가린 곳에 원래 화소를 남기지 않는다', async ({ page }) => {
  const frame = await openTool(page, 'noise.png');
  await addArea(frame);
  await frame.getByText('검게 칠하기', { exact: true }).click();
  await expect(frame.getByRole('button', { name: '가릴 곳 1: 검게 칠하기' })).toBeVisible();
  // 검게 칠하기에는 세기가 없다
  await expect(frame.getByLabel('세기')).toHaveCount(0);
  const file = await download(page, frame);
  const { outside, after } = await compare(page, file.bytes);
  expect(outside).toBe(0);
  for (let y = AREA.y; y < AREA.y + AREA.height; y++) {
    for (let x = AREA.x; x < AREA.x + AREA.width; x++) {
      expect(at(after, x, y)).toEqual([0, 0, 0, 255]);
    }
  }
});

test('미리보기도 워커가 그린 같은 결과로 바뀐다', async ({ page }) => {
  const frame = await openTool(page, 'noise.png');
  const canvas = frame.locator('.view canvas');
  /** 미리보기 canvas의 (x, y) 화소 (미리보기는 원본과 같은 80×60) */
  const pixel = (x: number, y: number) =>
    canvas.evaluate(
      (node: HTMLCanvasElement, [px, py]) =>
        Array.from(node.getContext('2d')!.getImageData(px!, py!, 1, 1).data),
      [x, y],
    );
  const before = await pixel(AREA.x + 20, AREA.y + 15);
  expect(before).not.toEqual([0, 0, 0, 255]);
  await addArea(frame);
  await frame.getByText('검게 칠하기', { exact: true }).click();
  await expect.poll(() => pixel(AREA.x + 20, AREA.y + 15)).toEqual([0, 0, 0, 255]);
  // 가린 곳 밖은 그대로
  expect(await pixel(AREA.x - 2, AREA.y - 2)).not.toEqual([0, 0, 0, 255]);
  // 지우면 원래 사진으로 돌아온다
  await frame.getByRole('button', { name: '모두 지우기' }).click();
  await expect.poll(() => pixel(AREA.x + 20, AREA.y + 15)).toEqual(before);
});

test('흐림은 가린 곳 안만 바꾼다', async ({ page }) => {
  const frame = await openTool(page, 'noise.png');
  await addArea(frame);
  await frame.getByText('흐리게', { exact: true }).click();
  await expect(frame.getByText('흐림 4px')).toBeVisible();
  const { inside, outside } = await compare(page, (await download(page, frame)).bytes);
  expect(outside).toBe(0);
  expect(inside).toBeGreaterThan(AREA.width * AREA.height * 0.9);
});

test('타원은 네 귀퉁이를 그대로 두고 가운데를 가린다', async ({ page }) => {
  const frame = await openTool(page, 'noise.png');
  await addArea(frame);
  await frame.getByText('타원', { exact: true }).click();
  await frame.getByText('검게 칠하기', { exact: true }).click();
  const file = await download(page, frame);
  const before = await pixels(page, new Uint8Array(await readFile(fixture('noise.png'))));
  const { outside, after } = await compare(page, file.bytes);
  expect(outside).toBe(0);
  for (const [x, y] of [
    [AREA.x, AREA.y],
    [AREA.x + AREA.width - 1, AREA.y],
    [AREA.x, AREA.y + AREA.height - 1],
    [AREA.x + AREA.width - 1, AREA.y + AREA.height - 1],
  ] as const) {
    expect(at(after, x, y)).toEqual(at(before.data, x, y));
  }
  expect(at(after, AREA.x + 20, AREA.y + 15)).toEqual([0, 0, 0, 255]);
});

test('가릴 곳을 키보드로 넣고 옮기고 크기를 바꾸고 지운다', async ({ page }) => {
  const frame = await openTool(page, 'noise.png');
  // 가운데에 짧은 변의 30%(18px) 정사각형으로 넣고 초점을 옮긴다
  await frame.getByRole('button', { name: '가릴 곳 추가' }).click();
  const area = frame.getByRole('button', { name: '가릴 곳 1: 모자이크' });
  await expect(area).toBeFocused();
  await expect(frame.getByLabel('왼쪽 (px)')).toHaveValue('31');
  await area.press('ArrowRight');
  await expect(frame.getByLabel('왼쪽 (px)')).toHaveValue('32');
  await area.press('Shift+ArrowDown');
  await expect(frame.getByLabel('위 (px)')).toHaveValue('31');
  const corner = frame.getByRole('button', { name: '오른쪽 아래 모서리' });
  await corner.press('ArrowLeft');
  await expect(frame.getByLabel('폭 (px)')).toHaveValue('17');
  await area.press('Delete');
  await expect(frame.getByText('아직 없습니다.', { exact: false })).toBeVisible();
  await expect(frame.getByRole('button', { name: '가릴 곳 추가' })).toBeFocused();
  await expect(frame.getByRole('button', { name: '가린 이미지 받기' })).toBeDisabled();
});

test('사진 위를 끌어 가릴 곳을 그리고, 새로 그릴 곳의 설정을 따른다', async ({ page }) => {
  const frame = await openTool(page, 'noise.png');
  await frame.getByText('검게 칠하기', { exact: true }).click();
  const box = (await frame.locator('.view canvas').boundingBox())!;
  await page.mouse.move(box.x + box.width * 0.2, box.y + box.height * 0.2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.6, box.y + box.height * 0.7, { steps: 5 });
  await page.mouse.up();
  await expect(frame.getByText('가릴 곳 1곳', { exact: false }).first()).toBeVisible();
  await expect(frame.getByRole('button', { name: '가릴 곳 1: 검게 칠하기' })).toBeVisible();
  // 빈 곳을 누르면 고른 것을 놓는다
  await page.mouse.click(box.x + box.width * 0.9, box.y + box.height * 0.9);
  await expect(frame.getByRole('heading', { name: '새로 그릴 곳' })).toBeVisible();
  await expect(frame.getByText('가릴 곳 1곳', { exact: false }).first()).toBeVisible();
});

test('휴대폰 사진의 방향 정보대로 세워 연다', async ({ page }) => {
  const frame = await openTool(page, 'rotated.jpg');
  await expect(frame.getByText('300×400')).toBeVisible();
  await frame.getByRole('button', { name: '가릴 곳 추가' }).click();
  const file = await download(page, frame);
  expect(file.name).toBe('rotated_모자이크.jpg');
  expect(await sizeOf(page, file.bytes)).toEqual([300, 400]);
});

test('예시 사진의 번호판을 가려 같은 크기의 JPG로 받는다', async ({ page }) => {
  await page.goto('/image/mosaic/');
  const frame = page.frameLocator('iframe[data-tool-frame]');
  await frame.getByRole('button', { name: '예시 파일로 해 보기' }).click();
  await frame.getByRole('button', { name: '가릴 곳 추가' }).click();
  await expect(frame.getByText('가릴 곳 1곳 · 1,600 × 1,200 px · JPG')).toBeVisible();
  const file = await download(page, frame);
  expect(file.name).toBe('예시-번호판사진_모자이크.jpg');
  expect(await sizeOf(page, file.bytes)).toEqual([1600, 1200]);
});

test('열 수 없는 파일은 알린다', async ({ page }) => {
  const frame = await openTool(page, 'broken.png');
  await expect(frame.getByRole('alert')).toHaveText(
    '이 이미지를 열 수 없습니다. 다른 파일을 골라 주세요.',
  );
});
