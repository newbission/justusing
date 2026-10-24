/**
 * 이미지 배경 제거 E2E. 빌드 결과에서 돌린다 (playwright.config.ts 참고).
 *
 * 흰 배경 앞 사람 사진(face.jpg, 800×1200)에서 데이터를 받아 가운데 사람만 남긴 투명 PNG를 받고,
 * 배경 쪽 화소는 투명하고 사람 쪽은 불투명한지 본다. 색 배경 JPG와 물체에 맞춰 자르기,
 * 키보드로 지우개 칠하기·되돌리기, 열 수 없는 파일도 본다.
 */
import type { FrameLocator } from '@playwright/test';
import { expect, test, type Page, type Request } from './test';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const fixture = (name: string) => fileURLToPath(new URL(`../fixtures/${name}`, import.meta.url));

async function open(page: Page, file = 'face.jpg', name = 'portrait.jpg'): Promise<FrameLocator> {
  await page.goto('/image/remove-bg/');
  const frame = page.frameLocator('iframe[data-tool-frame]');
  await frame.locator('input[type=file]').setInputFiles({
    name,
    mimeType: file.endsWith('.png') ? 'image/png' : 'image/jpeg',
    buffer: await readFile(fixture(file)),
  });
  return frame;
}

/** 데이터를 받고 가운데 물체를 남길 때까지 기다린다 */
async function separate(frame: FrameLocator) {
  await frame.getByRole('button', { name: /^데이터 받기 \(\d+\.\dMB\)$/ }).click();
  await expect(frame.getByText('사진 가운데의 물체를 남겼습니다.', { exact: false })).toBeVisible({
    timeout: 60_000,
  });
}

async function download(page: Page, frame: FrameLocator, format: 'PNG' | 'JPG') {
  const event = page.waitForEvent('download');
  await frame.getByRole('button', { name: `${format} 다운로드` }).click();
  const file = await event;
  return { name: file.suggestedFilename(), bytes: await readFile(await file.path()) };
}

/** 이미지를 브라우저로 열어 가로·세로와 RGBA 화소 */
async function pixels(page: Page, bytes: Buffer) {
  return page.evaluate(async (data) => {
    const bitmap = await createImageBitmap(new Blob([new Uint8Array(data)]), {
      premultiplyAlpha: 'none',
    });
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const context = canvas.getContext('2d')!;
    context.drawImage(bitmap, 0, 0);
    return {
      width: bitmap.width,
      height: bitmap.height,
      data: Array.from(context.getImageData(0, 0, bitmap.width, bitmap.height).data),
    };
  }, Array.from(bytes));
}

type Pixels = Awaited<ReturnType<typeof pixels>>;
const at = (image: Pixels, x: number, y: number) =>
  image.data.slice((y * image.width + x) * 4, (y * image.width + x) * 4 + 4);

/** 사진에서 배경(흰 벽)인 곳과 사람(얼굴·옷)인 곳 (face.jpg 800×1200) */
const BACKGROUND = [
  [20, 20],
  [780, 20],
  [20, 300],
  [780, 300],
];
const PERSON = [
  [400, 300],
  [400, 700],
  [300, 900],
];

test('데이터를 받아 사람만 남긴 투명 PNG로 받는다', async ({ page }) => {
  test.setTimeout(120_000);
  const requests: Request[] = [];
  page.on('request', (request) => requests.push(request));
  const frame = await open(page);

  // 처음에는 받을 크기를 밝히고 묻는다. 받기 전에는 받을 수 없다
  await expect(frame.getByText('배경을 지우려면 먼저 데이터를 받아 주세요.')).toBeVisible();
  await expect(frame.getByRole('button', { name: 'PNG 다운로드' })).toBeDisabled();
  await separate(frame);

  const { name, bytes } = await download(page, frame, 'PNG');
  expect(name).toBe('portrait_배경제거.png');
  expect([...bytes.subarray(1, 4)]).toEqual([0x50, 0x4e, 0x47]);
  const image = await pixels(page, bytes);
  expect([image.width, image.height]).toEqual([800, 1200]);
  for (const [x, y] of BACKGROUND) expect(at(image, x!, y!)[3]).toBeLessThan(16);
  for (const [x, y] of PERSON) expect(at(image, x!, y!)[3]).toBeGreaterThan(240);
  await expect(frame.getByText(/^800×1200 PNG [\d.]+(KB|MB)를 만들었습니다\.$/)).toBeVisible();

  // 받은 것은 우리 사이트의 엔진·모델뿐이다 (엔진의 사용 통계도 보내지 않는다)
  expect(requests.filter((request) => request.url().includes('googleapis'))).toEqual([]);
  const data = requests
    .map((request) => new URL(request.url()).pathname)
    .filter((path) => path.startsWith('/data/'));
  expect(data.sort()).toEqual([
    '/data/face/magic_touch.tflite',
    '/data/face/vision_wasm_module_internal.wasm',
  ]);

  // 다시 들어오면 묻지 않고 보관본으로 바로 나눈다
  await open(page);
  await expect(frame.getByText('사진 가운데의 물체를 남겼습니다.', { exact: false })).toBeVisible({
    timeout: 60_000,
  });
  await expect(frame.getByRole('button', { name: /^데이터 받기/ })).toHaveCount(0);
});

test('고른 색 배경 JPG로 받고 물체에 맞춰 자른다', async ({ page }) => {
  test.setTimeout(120_000);
  const frame = await open(page);
  await separate(frame);

  await frame.getByText('다른 색', { exact: true }).click();
  await frame.getByLabel('배경색').fill('#ff0000');
  const red = await download(page, frame, 'JPG');
  expect(red.name).toBe('portrait_배경제거.jpg');
  expect([...red.bytes.subarray(0, 3)]).toEqual([0xff, 0xd8, 0xff]);
  const painted = await pixels(page, red.bytes);
  expect([painted.width, painted.height]).toEqual([800, 1200]);
  for (const [x, y] of BACKGROUND) {
    const [r, g, b] = at(painted, x!, y!);
    expect(r).toBeGreaterThan(230);
    expect(g! + b!).toBeLessThan(40);
  }
  // 사람 쪽은 원래 색 (빨간 배경이 비치지 않는다)
  const [r, g, b] = at(painted, 400, 700);
  expect(r! - (g! + b!) / 2).toBeLessThan(60);

  // 흰 배경 + 물체에 맞춰 자르기: 머리 위 빈 곳이 잘려 세로가 줄어든다
  await frame.getByText('흰색', { exact: true }).click();
  await frame.getByText('물체에 맞춰 자르기').click();
  const trimmed = await pixels(page, (await download(page, frame, 'JPG')).bytes);
  expect(trimmed.height).toBeLessThan(1200);
  expect(trimmed.width).toBeLessThanOrEqual(800);
  const corner = at(trimmed, 2, 2);
  expect(Math.min(corner[0]!, corner[1]!, corner[2]!)).toBeGreaterThan(240);
});

test('키보드로 지우개를 칠하고 되돌린다', async ({ page }) => {
  test.setTimeout(120_000);
  const frame = await open(page);
  await separate(frame);

  // 지우개를 고르고 가운데(옷)에 한 번 칠한다
  await frame.getByText('지우개', { exact: true }).click();
  const view = frame.getByRole('application', { name: '결과 미리보기' });
  await view.focus();
  for (let i = 0; i < 3; i++) await view.press('Shift+ArrowDown');
  await view.press('Enter');
  await expect(frame.getByText('남길 곳 1곳, 붓질 1번')).toBeVisible();
  const erased = await pixels(page, (await download(page, frame, 'PNG')).bytes);
  // 커서는 가운데(400, 600)에서 사진 높이의 15% 아래 (400, 780)
  expect(at(erased, 400, 780)[3]).toBeLessThan(16);
  expect(at(erased, 400, 300)[3]).toBeGreaterThan(240);

  // Ctrl+Z로 되돌리면 다시 남는다
  await view.press('Control+z');
  await expect(frame.getByText('남길 곳 1곳', { exact: true })).toBeVisible();
  const restored = await pixels(page, (await download(page, frame, 'PNG')).bytes);
  expect(at(restored, 400, 780)[3]).toBeGreaterThan(240);
});

test('열 수 없는 파일은 알린다', async ({ page }) => {
  const frame = await open(page, 'broken.png', 'broken.png');
  await expect(frame.getByRole('alert')).toHaveText(
    '이 사진을 열 수 없습니다. JPG·PNG 사진으로 다시 해 보세요.',
  );
});
