/**
 * 이미지 모자이크 E2E. 빌드 결과에서 돌린다 (playwright.config.ts 참고).
 *
 * 화소마다 색이 다른 그림(noise.png, 80×60)의 한 곳을 가려 PNG로 받고, 원본과 화소를 견줘
 * 가린 곳 안만 바뀌었는지 본다. 검게 칠하기는 가린 곳에 원래 화소가 하나도 남지 않아야 한다.
 */
import type { FrameLocator } from '@playwright/test';
import { expect, test, type Page, type Request } from './test';
import { difference, isJpeg, limitCanvas } from './canvas-limit';
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

test('아이폰 사진(HEIC)도 바로 세워 열고 JPG로 받는다', async ({ page }) => {
  // 크롬은 HEIC를 스스로 읽지 못해 libheif로 연다 (회전 표시 irot을 적용한다)
  const frame = await openTool(page, 'iphone.heic');
  await expect(frame.getByText('300×400')).toBeVisible();
  await frame.getByRole('button', { name: '가릴 곳 추가' }).click();
  const file = await download(page, frame);
  expect(file.name).toBe('iphone_모자이크.jpg');
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

test('canvas 하나에 그리지 못하는 크기도 같은 결과의 JPG로 받는다', async ({ page }) => {
  await page.goto('/image/mosaic/');
  const frame = page.frameLocator('iframe[data-tool-frame]');
  await frame.getByRole('button', { name: '예시 파일로 해 보기' }).click();
  await frame.getByRole('button', { name: '가릴 곳 추가' }).click();
  await expect(frame.getByText('가릴 곳 1곳 · 1,600 × 1,200 px · JPG')).toBeVisible();
  const whole = await download(page, frame);

  // 결과(192만 화소)보다 작은 canvas만 되게 하면 가릴 곳을 먼저 고치고 줄 묶음씩 JPG로 쓴다
  await limitCanvas(page, 1_000_000);
  const strips = await download(page, frame);
  expect(strips.name).toBe('예시-번호판사진_모자이크.jpg');
  expect(isJpeg(strips.bytes)).toBe(true);
  expect(Buffer.from(strips.bytes).equals(Buffer.from(whole.bytes))).toBe(false);
  const diff = await difference(page, whole.bytes, strips.bytes);
  expect(diff.sizes).toEqual([
    [1600, 1200],
    [1600, 1200],
  ]);
  expect(diff.mean).toBeLessThan(2);

  // WebP는 줄 묶음으로 만들 수 없어 PNG·JPG를 권한다
  await frame.getByText('WebP', { exact: true }).click();
  await frame.getByRole('button', { name: '가린 이미지 받기' }).click();
  await expect(
    frame.getByText('이 브라우저가 이렇게 큰 이미지를 만들지 못했습니다. PNG나 JPG로'),
  ).toBeVisible();
});

test('열 수 없는 파일은 알린다', async ({ page }) => {
  const frame = await openTool(page, 'broken.png');
  await expect(frame.getByRole('alert')).toHaveText(
    '이 이미지를 열 수 없습니다. 다른 파일을 골라 주세요.',
  );
});

/**
 * 얼굴 찾기 견본(faces.jpg, 1600×1000): 가상 인물을 크기를 달리해 다섯 번 붙였다 (make_image_fixtures.py의 FACES).
 * 얼굴 가운데 자리 (화소). 얼굴 폭은 약 180·100·54·29·119px
 */
const FACE_CENTERS = [
  { x: 240, y: 620 },
  { x: 632, y: 694 },
  { x: 920, y: 772 },
  { x: 1112, y: 858 },
  { x: 1432, y: 458 },
];
type Point = { x: number; y: number };
type Rect = Point & { width: number; height: number };

/** 화면의 가릴 곳들을 사진 화소 자리로 (가릴 곳 단추의 위치를 사진 칸 크기로 나눈다) */
async function regionRects(frame: FrameLocator, width: number) {
  const view = (await frame.locator('.view').boundingBox())!;
  const k = width / view.width;
  const rects: (Rect & { label: string })[] = [];
  for (const region of await frame.locator('[data-region]').all()) {
    const box = (await region.boundingBox())!;
    rects.push({
      x: (box.x - view.x) * k,
      y: (box.y - view.y) * k,
      width: box.width * k,
      height: box.height * k,
      label: (await region.getAttribute('aria-label'))!,
    });
  }
  return rects;
}

const contains = (rect: Rect, p: Point) =>
  p.x >= rect.x && p.x <= rect.x + rect.width && p.y >= rect.y && p.y <= rect.y + rect.height;

/** 받은 데이터 경로들 (얼굴 찾기 엔진·모델) */
const faceData = (requests: Request[]) =>
  requests
    .map((request) => new URL(request.url()).pathname)
    .filter((path) => path.startsWith('/data/face/'))
    .sort();

test('얼굴 찾기: 받기 전에 묻고, 찾은 얼굴을 가릴 곳으로 넣고, 뺀 얼굴만 그대로 저장한다', async ({
  page,
}) => {
  test.setTimeout(120_000);
  const requests: Request[] = [];
  page.on('request', (request) => requests.push(request));
  const frame = await openTool(page, 'faces.jpg');

  // 누르기 전에는 얼굴 찾기 코드도 데이터도 받지 않는다
  expect(faceData(requests)).toEqual([]);
  expect(requests.filter((request) => request.url().includes('find-faces'))).toEqual([]);

  // 처음에는 크기를 밝히고 묻는다. 취소하면 아무것도 받지 않고 초점이 얼굴 찾기로 돌아간다
  const find = frame.getByRole('button', { name: '얼굴 찾기', exact: true });
  await find.click();
  const getData = frame.getByRole('button', { name: /^데이터 받기 \(\d+\.\dMB\)$/ });
  await expect(getData).toBeFocused();
  await expect(frame.getByText(/얼굴 찾기 데이터 \d+\.\dMB를 한 번 받아야 합니다/)).toBeVisible();
  await frame.getByRole('button', { name: '취소' }).click();
  await expect(find).toBeFocused();
  expect(faceData(requests)).toEqual([]);

  await find.click();
  await getData.click();
  await expect(frame.getByText('얼굴 5개를 찾아 가릴 곳으로 넣었습니다.')).toBeVisible({
    timeout: 60_000,
  });
  await expect(frame.getByText('놓친 얼굴은 직접 그려 더하세요', { exact: false })).toBeVisible();
  await expect(frame.getByText('5곳', { exact: true })).toBeVisible();

  // 얼굴마다 한 곳씩, 얼굴이 아닌 곳은 없다. 굵은 모자이크(세기 8)로 넣는다
  const rects = await regionRects(frame, 1600);
  expect(rects).toHaveLength(5);
  for (const center of FACE_CENTERS) {
    expect(rects.filter((rect) => contains(rect, center))).toHaveLength(1);
  }
  for (const rect of rects) {
    expect(rect.label).toMatch(/^가릴 곳 \d: 모자이크 \(찾은 얼굴\)$/);
    expect(FACE_CENTERS.filter((center) => contains(rect, center))).toHaveLength(1);
  }
  // 얼굴보다 넉넉하다: 가장 큰 얼굴(폭 약 180px)을 덮는 곳은 폭이 그보다 크다
  const biggest = rects.find((rect) => contains(rect, FACE_CENTERS[0]!))!;
  expect(biggest.width).toBeGreaterThan(220);
  await frame.locator('[data-region]').first().focus();
  await expect(frame.getByLabel('세기')).toHaveValue('8');

  // 다섯째 얼굴은 빼고 PNG로 받는다
  const fifth = frame
    .locator('[data-region]')
    .nth(rects.findIndex((rect) => contains(rect, FACE_CENTERS[4]!)));
  await fifth.focus();
  await fifth.press('Delete');
  await expect(frame.getByText('4곳', { exact: true })).toBeVisible();
  await frame.getByText('PNG', { exact: true }).click();
  const file = await download(page, frame);
  expect(file.name).toBe('faces_모자이크.png');

  // 가린 얼굴 가운데 둘레(20×20)는 화소가 바뀌었고, 뺀 얼굴은 원본 그대로다
  const before = await pixels(page, new Uint8Array(await readFile(fixture('faces.jpg'))));
  const after = await pixels(page, file.bytes);
  expect([after.width, after.height]).toEqual([1600, 1000]);
  const changed = (center: Point) => {
    let count = 0;
    for (let y = center.y - 10; y < center.y + 10; y++) {
      for (let x = center.x - 10; x < center.x + 10; x++) {
        const i = (y * 1600 + x) * 4;
        if ([0, 1, 2].some((c) => before.data[i + c] !== after.data[i + c])) count++;
      }
    }
    return count / 400;
  };
  for (const center of FACE_CENTERS.slice(0, 4)) expect(changed(center)).toBeGreaterThan(0.8);
  expect(changed(FACE_CENTERS[4]!)).toBe(0);

  // 받은 것은 엔진과 얼굴 찾기 모델 한 번씩뿐이다 (증명사진의 얼굴 점 모델은 받지 않는다)
  expect(faceData(requests)).toEqual([
    '/data/face/blaze_face_full_range.tflite',
    '/data/face/vision_wasm_module_internal.wasm',
  ]);
  expect(requests.filter((request) => request.url().includes('googleapis'))).toEqual([]);
});

test('얼굴 찾기: 보관본으로 바로 찾고, 엔진이 있으면 모델만, 지워졌으면 다시 묻는다', async ({
  page,
}) => {
  test.setTimeout(120_000);
  let frame = await openTool(page, 'faces.jpg');
  await frame.getByRole('button', { name: '얼굴 찾기', exact: true }).click();
  await frame.getByRole('button', { name: /^데이터 받기/ }).click();
  await expect(frame.getByText('얼굴 5개를 찾아', { exact: false })).toBeVisible({
    timeout: 60_000,
  });

  // 다시 들어오면 묻지 않고 보관본으로 찾는다 (데이터를 다시 받지 않는다). 얼굴이 없는 사진은 못 찾았다고 알린다
  const requests: Request[] = [];
  page.on('request', (request) => requests.push(request));
  frame = await openTool(page, 'noise.png');
  await frame.getByRole('button', { name: '얼굴 찾기', exact: true }).click();
  await expect(frame.getByText('얼굴을 찾지 못했습니다.', { exact: false })).toBeVisible({
    timeout: 60_000,
  });
  await expect(frame.getByRole('button', { name: /^데이터 받기/ })).toHaveCount(0);
  await expect(frame.getByText('아직 없습니다.', { exact: false })).toBeVisible();
  expect(faceData(requests)).toEqual([]);

  // 이미 가린 곳과 겹치는 얼굴은 다시 넣지 않는다
  frame = await openTool(page, 'faces.jpg');
  const find = frame.getByRole('button', { name: '얼굴 찾기', exact: true });
  await find.click();
  await expect(frame.getByText('얼굴 5개를 찾아', { exact: false })).toBeVisible({
    timeout: 60_000,
  });
  await find.click();
  await expect(
    frame.getByText('얼굴 5개를 찾았습니다. 이미 가린 곳과 겹치지 않는 0곳을 넣었습니다.'),
  ).toBeVisible({ timeout: 60_000 });
  await expect(frame.getByText('5곳', { exact: true })).toBeVisible();

  // 증명사진·배경 지우기에서 엔진을 받아 둔 사람: 모델만 받는다 (지워졌다고 하지 않는다)
  await page.evaluate(async () => {
    const cache = await caches.open('justusing-data-v1');
    for (const request of await cache.keys()) {
      if (request.url.includes('blaze_face')) await cache.delete(request);
    }
  });
  frame = await openTool(page, 'faces.jpg');
  await frame.getByRole('button', { name: '얼굴 찾기', exact: true }).click();
  await expect(frame.getByRole('button', { name: '데이터 받기 (1.0MB)' })).toBeVisible();
  await expect(frame.getByText('지워졌습니다', { exact: false })).toHaveCount(0);

  // 보관본이 모두 지워졌으면 조용히 받지 않고 다시 묻는다
  await page.evaluate(async () => {
    const cache = await caches.open('justusing-data-v1');
    for (const request of await cache.keys()) await cache.delete(request);
  });
  frame = await openTool(page, 'faces.jpg');
  await frame.getByRole('button', { name: '얼굴 찾기', exact: true }).click();
  await expect(
    frame.getByText('전에 받은 얼굴 찾기 데이터가 이 브라우저에서 지워졌습니다.'),
  ).toBeVisible();
  await expect(frame.getByRole('button', { name: /^데이터 받기 \(\d+\.\dMB\)$/ })).toBeVisible();
});
