/**
 * 이미지 배경 제거 E2E. 빌드 결과에서 돌린다 (playwright.config.ts 참고).
 *
 * 흰 배경 앞 사람 사진(face.jpg, 800×1200)에서 데이터를 받아 가운데 사람만 남긴 투명 PNG를 받고,
 * 배경 쪽 화소는 투명하고 사람 쪽은 불투명한지 본다. 색 배경 JPG와 물체에 맞춰 자르기,
 * 키보드로 지우개 칠하기·되돌리기, 열 수 없는 파일도 본다.
 * 여러 장: 견본 머그잔·견본 증명사진·face.jpg를 넣어 ZIP 하나로 받고, 사진마다 투명·불투명한 곳을 본다.
 * 한 장만 고쳐도 다른 사진은 그대로인지, 나누는 중에 다른 사진을 열어도 섞이지 않는지, 그만두기도 본다.
 */
import type { FrameLocator } from '@playwright/test';
import { expect, test, type Page, type Request } from './test';
import { unzipSync } from 'fflate';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const fixture = (name: string) => fileURLToPath(new URL(`../fixtures/${name}`, import.meta.url));
const sample = (name: string) =>
  fileURLToPath(new URL(`../../public/samples/ko/${name}`, import.meta.url));

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

test('아이폰 사진(HEIC)도 크롬에서 바로 세워 연다', async ({ page }) => {
  await page.goto('/image/remove-bg/');
  const frame = page.frameLocator('iframe[data-tool-frame]');
  // 크롬은 HEIC를 스스로 읽지 못해 libheif로 연다. 화소는 가로 400×300이고 회전 표시(irot)가 붙어 있다
  await frame.locator('input[type=file]').setInputFiles(fixture('iphone.heic'));
  await expect(frame.getByText('300×400', { exact: true })).toBeVisible();
  await expect(frame.getByRole('alert')).toHaveCount(0);
});

/** 여러 장에 쓰는 사진: 이름, 파일, 가로·세로, 배경인 곳과 남길 곳 */
interface Shot {
  name: string;
  path: string;
  size: [number, number];
  background: number[][];
  subject: number[][];
}
const MUG: Shot = {
  name: '예시-상품사진.jpg',
  path: sample('예시-상품사진.jpg'),
  size: [1600, 1200],
  // 벽 위쪽 두 귀퉁이와 탁자 아래쪽 두 귀퉁이 / 머그잔 몸통
  background: [
    [60, 60],
    [1540, 60],
    [60, 1140],
    [1540, 1140],
  ],
  subject: [
    [760, 700],
    [700, 450],
  ],
};
const ID_PHOTO: Shot = {
  name: '예시-증명사진.jpg',
  path: sample('예시-증명사진.jpg'),
  size: [1024, 1536],
  background: [
    [30, 30],
    [994, 30],
    [30, 400],
    [994, 400],
  ],
  // 얼굴·옷 (옷 가운데는 face.jpg에서 지우개로 칠한 자리와 같은 비율)
  subject: [
    [512, 700],
    [512, 998],
    [512, 1300],
  ],
};
const PORTRAIT: Shot = {
  name: 'portrait.jpg',
  path: fixture('face.jpg'),
  size: [800, 1200],
  background: BACKGROUND,
  subject: PERSON,
};

async function addPhotos(frame: FrameLocator, shots: Shot[]) {
  await frame.locator('input[type=file]').setInputFiles(
    await Promise.all(
      shots.map(async (shot) => ({
        name: shot.name,
        mimeType: 'image/jpeg',
        buffer: await readFile(shot.path),
      })),
    ),
  );
}

/**
 * 이미지를 브라우저로 열어 가로·세로와 고른 자리의 RGBA만 (큰 결과의 화소를 모두 주고받으면 몇십 초 걸린다)
 */
async function sampleAt(page: Page, bytes: Uint8Array, points: number[][]) {
  return page.evaluate(
    async ({ base64, points }) => {
      const data = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
      const bitmap = await createImageBitmap(new Blob([data]), { premultiplyAlpha: 'none' });
      const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
      const context = canvas.getContext('2d')!;
      context.drawImage(bitmap, 0, 0);
      return {
        width: bitmap.width,
        height: bitmap.height,
        values: points.map(([x, y]) => Array.from(context.getImageData(x!, y!, 1, 1).data)),
      };
    },
    { base64: Buffer.from(bytes).toString('base64'), points },
  );
}

/** 결과 PNG가 그 사진의 크기이고 배경은 투명, 남길 곳은 불투명한지 */
async function expectCutout(page: Page, bytes: Uint8Array, shot: Shot) {
  expect([...bytes.subarray(1, 4)]).toEqual([0x50, 0x4e, 0x47]);
  const image = await sampleAt(page, bytes, [...shot.background, ...shot.subject]);
  expect([image.width, image.height], shot.name).toEqual(shot.size);
  image.values.forEach((rgba, index) => {
    const [x, y] = [...shot.background, ...shot.subject][index]!;
    if (index < shot.background.length) {
      expect(rgba[3], `${shot.name} 배경 (${x}, ${y})`).toBeLessThan(16);
    } else {
      expect(rgba[3], `${shot.name} 남길 곳 (${x}, ${y})`).toBeGreaterThan(240);
    }
  });
}

async function downloadZip(page: Page, frame: FrameLocator, count: number) {
  const event = page.waitForEvent('download');
  await frame.getByRole('button', { name: `모두 받기 (ZIP, ${count}장)` }).click();
  const file = await event;
  expect(file.suggestedFilename()).toBe('이미지_배경제거.zip');
  return unzipSync(new Uint8Array(await readFile(await file.path())));
}

const done = (count: number) => `사진 ${count}장의 배경을 지웠습니다.`;

test('여러 장을 넣으면 사진마다 가운데 물체를 남기고 ZIP 하나로 받는다', async ({ page }) => {
  test.setTimeout(180_000);
  await page.goto('/image/remove-bg/');
  const frame = page.frameLocator('iframe[data-tool-frame]');
  await addPhotos(frame, [MUG, ID_PHOTO, PORTRAIT]);

  // 목록이 보이고, 데이터를 받기 전에는 받을 수 없다
  const list = frame.getByRole('list', { name: '사진 목록' });
  await expect(list.getByRole('listitem')).toHaveCount(3);
  await expect(frame.getByText('배경을 지우려면 먼저 데이터를 받아 주세요.')).toBeVisible();
  await expect(frame.getByRole('button', { name: '모두 받기 (ZIP, 0장)' })).toBeDisabled();
  await frame.getByRole('button', { name: /^데이터 받기 \(\d+\.\dMB\)$/ }).click();
  await expect(frame.getByText(done(3), { exact: false })).toBeVisible({ timeout: 90_000 });
  // 목록 칸마다 결과 그림이 그려진다
  await expect(list.locator('canvas')).toHaveCount(3);

  const entries = await downloadZip(page, frame, 3);
  expect(Object.keys(entries).sort()).toEqual(
    ['portrait_배경제거.png', '예시-상품사진_배경제거.png', '예시-증명사진_배경제거.png'].sort(),
  );
  await expectCutout(page, entries['예시-상품사진_배경제거.png']!, MUG);
  await expectCutout(page, entries['예시-증명사진_배경제거.png']!, ID_PHOTO);
  await expectCutout(page, entries['portrait_배경제거.png']!, PORTRAIT);
  await expect(
    frame.getByText(/^사진 3장을 ZIP\([\d.]+(KB|MB)\)으로 만들었습니다\.$/),
  ).toBeVisible();

  // 모든 사진에 흰 배경을 주면 모두 JPG가 된다
  await frame.getByText('흰색', { exact: true }).click();
  const white = await downloadZip(page, frame, 3);
  expect(Object.keys(white).every((name) => name.endsWith('_배경제거.jpg'))).toBe(true);
});

test('한 장만 고쳐도 다른 사진은 그대로다', async ({ page }) => {
  test.setTimeout(180_000);
  await page.goto('/image/remove-bg/');
  const frame = page.frameLocator('iframe[data-tool-frame]');
  await addPhotos(frame, [PORTRAIT, ID_PHOTO]);
  await frame.getByRole('button', { name: /^데이터 받기/ }).click();
  await expect(frame.getByText(done(2), { exact: false })).toBeVisible({ timeout: 90_000 });

  // face.jpg만 옷 가운데를 지우개로 칠하고, 이 사진만 따로 파란 배경을 준다
  await frame.getByRole('button', { name: 'portrait.jpg 고치기' }).click();
  await expect(frame.getByText('사진 가운데의 물체를 남겼습니다.', { exact: false })).toBeVisible();
  await frame.getByText('지우개', { exact: true }).click();
  const view = frame.getByRole('application', { name: '결과 미리보기' });
  await view.focus();
  for (let i = 0; i < 3; i++) await view.press('Shift+ArrowDown');
  await view.press('Enter');
  await expect(frame.getByText('남길 곳 1곳, 붓질 1번')).toBeVisible();
  await frame.getByText('이 사진만 따로 정하기').click();
  await frame.getByText('다른 색', { exact: true }).click();
  await frame.getByLabel('배경색').fill('#0000ff');

  // 다음 사진에는 붓질이 없고 모든 사진의 설정(투명)을 쓴다. 돌아오면 붓질과 따로 정한 설정이 남아 있다
  await frame.getByRole('button', { name: '다음 사진' }).click();
  await expect(frame.getByText('남길 곳 1곳', { exact: true })).toBeVisible();
  await expect(frame.getByRole('button', { name: 'PNG 다운로드' })).toBeEnabled();
  await frame.getByRole('button', { name: '이전 사진' }).click();
  await expect(frame.getByText('남길 곳 1곳, 붓질 1번')).toBeVisible();
  await expect(frame.getByRole('button', { name: 'JPG 다운로드' })).toBeVisible();

  await frame.getByRole('button', { name: '목록으로' }).click();
  await expect(frame.getByText('800×1200 · 남길 곳 1곳, 붓질 1번 · 따로 설정')).toBeVisible();
  const entries = await downloadZip(page, frame, 2);
  expect(Object.keys(entries).sort()).toEqual(
    ['portrait_배경제거.jpg', '예시-증명사진_배경제거.png'].sort(),
  );
  // 고친 사진: 칠한 곳(400, 780)과 배경이 파랗다
  const blue = [[400, 780], ...BACKGROUND];
  const edited = await sampleAt(page, entries['portrait_배경제거.jpg']!, blue);
  expect([edited.width, edited.height]).toEqual([800, 1200]);
  edited.values.forEach(([r, g, b], index) => {
    expect(b! - (r! + g!) / 2, `(${blue[index]})`).toBeGreaterThan(150);
  });
  // 고치지 않은 사진은 같은 비율 자리(옷 가운데)도 그대로 남고 배경은 투명하다
  await expectCutout(page, entries['예시-증명사진_배경제거.png']!, ID_PHOTO);
});

test('나누는 중에 다른 사진을 열어도 마스크가 섞이지 않는다', async ({ page }) => {
  test.setTimeout(180_000);
  await page.goto('/image/remove-bg/');
  const frame = page.frameLocator('iframe[data-tool-frame]');
  await addPhotos(frame, [PORTRAIT, { ...MUG, name: 'mug-1.jpg' }]);
  await frame.getByRole('button', { name: /^데이터 받기/ }).click();
  await expect(frame.getByText(done(2), { exact: false })).toBeVisible({ timeout: 90_000 });

  // 사진을 더 넣고, 앞 사진을 나누는 사이 바로 뒤 사진을 연다
  await addPhotos(frame, [{ ...MUG, name: 'mug-2.jpg' }, ID_PHOTO]);
  await frame.getByRole('button', { name: '예시-증명사진.jpg 고치기' }).click();
  await expect(frame.getByText('1024×1536', { exact: false })).toBeVisible();
  await expect(frame.getByText('사진 가운데의 물체를 남겼습니다.', { exact: false })).toBeVisible({
    timeout: 60_000,
  });
  const one = await download(page, frame, 'PNG');
  expect(one.name).toBe('예시-증명사진_배경제거.png');
  await expectCutout(page, one.bytes, ID_PHOTO);

  await frame.getByRole('button', { name: '목록으로' }).click();
  await expect(frame.getByText(done(4), { exact: false })).toBeVisible({ timeout: 60_000 });
  const entries = await downloadZip(page, frame, 4);
  await expectCutout(page, entries['mug-1_배경제거.png']!, MUG);
  await expectCutout(page, entries['mug-2_배경제거.png']!, MUG);
  await expectCutout(page, entries['portrait_배경제거.png']!, PORTRAIT);
  await expectCutout(page, entries['예시-증명사진_배경제거.png']!, ID_PHOTO);
});

test('지우개로 다 지운 사진은 빼고 나머지를 받는다', async ({ page }) => {
  test.setTimeout(180_000);
  await page.goto('/image/remove-bg/');
  const frame = page.frameLocator('iframe[data-tool-frame]');
  await addPhotos(frame, [MUG, ID_PHOTO, PORTRAIT]);
  await frame.getByRole('button', { name: /^데이터 받기/ }).click();
  await expect(frame.getByText(done(3), { exact: false })).toBeVisible({ timeout: 90_000 });

  // 머그잔 사진을 가장 큰 지우개로 위에서 아래까지 지그재그로 칠해 모두 지운다
  await frame.getByRole('button', { name: '예시-상품사진.jpg 고치기' }).click();
  await expect(frame.getByText('사진 가운데의 물체를 남겼습니다.', { exact: false })).toBeVisible();
  await frame.getByText('지우개', { exact: true }).click();
  await frame.getByLabel('붓 크기').press('End');
  const box = (await frame.getByRole('application', { name: '결과 미리보기' }).boundingBox())!;
  await page.mouse.move(box.x + 1, box.y + 1);
  await page.mouse.down();
  for (let row = 0; row <= 12; row++) {
    const y = box.y + Math.min(box.height - 1, (box.height * row) / 12);
    await page.mouse.move(box.x + 1, y, { steps: 4 });
    await page.mouse.move(box.x + box.width - 1, y, { steps: 20 });
  }
  await page.mouse.up();
  await expect(frame.getByText('남길 곳 1곳, 붓질 1번')).toBeVisible();
  await frame.getByRole('button', { name: '목록으로' }).click();

  // 다 지운 사진만 빠지고 나머지 두 장은 ZIP으로 받는다
  const entries = await downloadZip(page, frame, 3);
  expect(Object.keys(entries).sort()).toEqual(
    ['portrait_배경제거.png', '예시-증명사진_배경제거.png'].sort(),
  );
  await expect(
    frame.getByText('1장은 남은 곳이 없거나 저장하지 못해 뺐습니다.', { exact: false }),
  ).toBeVisible();
  await expectCutout(page, entries['portrait_배경제거.png']!, PORTRAIT);
});

test('여러 장 저장을 그만두면 받지 않는다', async ({ page }) => {
  test.setTimeout(180_000);
  await page.goto('/image/remove-bg/');
  const frame = page.frameLocator('iframe[data-tool-frame]');
  // 원본 크기로 PNG를 만드는 데 몇 초 걸리는 큰 사진 (밝은 바탕 가운데 짙은 원, 6000×4500)
  const big = await page.evaluate(async () => {
    const canvas = new OffscreenCanvas(6000, 4500);
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#f2f2f2';
    ctx.fillRect(0, 0, 6000, 4500);
    ctx.fillStyle = '#203040';
    ctx.beginPath();
    ctx.arc(3000, 2250, 1400, 0, Math.PI * 2);
    ctx.fill();
    const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.9 });
    return Array.from(new Uint8Array(await blob.arrayBuffer()));
  });
  await frame.locator('input[type=file]').setInputFiles(
    ['big-1.jpg', 'big-2.jpg'].map((name) => ({
      name,
      mimeType: 'image/jpeg',
      buffer: Buffer.from(big),
    })),
  );
  await frame.getByRole('button', { name: /^데이터 받기/ }).click();
  await expect(frame.getByText(done(2), { exact: false })).toBeVisible({ timeout: 90_000 });

  let downloads = 0;
  page.on('download', () => downloads++);
  await frame.getByRole('button', { name: '모두 받기 (ZIP, 2장)' }).click();
  await expect(frame.getByText(/^저장하는 중… \d\/2$/)).toBeVisible();
  await frame.getByRole('button', { name: '그만두기' }).click();
  await expect(frame.getByText('저장을 그만두었습니다.')).toBeVisible();
  await expect(frame.getByRole('button', { name: '모두 받기 (ZIP, 2장)' })).toBeEnabled();
  // 하던 저장이 끝날 만큼 기다려도 받지 않는다
  await page.waitForTimeout(5_000);
  expect(downloads).toBe(0);
});
