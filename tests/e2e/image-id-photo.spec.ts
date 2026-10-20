/**
 * 증명사진 E2E. 빌드 결과에서 돌린다 (playwright.config.ts 참고).
 *
 * 흰 배경 얼굴 사진(face.jpg)을 기울여 넣고, 얼굴 찾기 데이터를 받아 저절로 맞춘 결과가
 * 413×531 JPG이고 기울기가 바로잡혔는지 본다. 데이터 없이 직접 맞추기와 키보드 조작도 본다.
 */
import { expect, test, type FrameLocator, type Page, type Request } from './test';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { expectLocalOnly } from './local-only';

const fixture = fileURLToPath(new URL('../fixtures/face.jpg', import.meta.url));

/** 얼굴 사진을 degrees만큼 시계 방향으로 기울인 JPG (브라우저 canvas로 만든다) */
async function tilted(page: Page, degrees: number): Promise<Buffer> {
  const source = (await readFile(fixture)).toString('base64');
  const data = await page.evaluate(
    async ({ source, degrees }) => {
      const input = Uint8Array.from(atob(source), (char) => char.charCodeAt(0));
      const bitmap = await createImageBitmap(new Blob([input]));
      const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
      const context = canvas.getContext('2d')!;
      context.fillStyle = '#fff';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.translate(canvas.width / 2, canvas.height / 2);
      context.rotate((degrees * Math.PI) / 180);
      context.translate(-canvas.width / 2, -canvas.height / 2);
      context.drawImage(bitmap, 0, 0);
      const out = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.9 });
      const bytes = new Uint8Array(await out.arrayBuffer());
      return Array.from(bytes);
    },
    { source, degrees },
  );
  return Buffer.from(data);
}

async function open(page: Page, buffer?: Buffer): Promise<FrameLocator> {
  await page.goto('/image/id-photo/');
  const frame = page.frameLocator('iframe[data-tool-frame]');
  await frame.locator('input[type=file]').setInputFiles({
    name: 'portrait.jpg',
    mimeType: 'image/jpeg',
    buffer: buffer ?? (await readFile(fixture)),
  });
  return frame;
}

/** 받은 JPG의 가로·세로 */
async function jpegSize(page: Page, bytes: Buffer) {
  return page.evaluate(async (data) => {
    const bitmap = await createImageBitmap(new Blob([new Uint8Array(data)]));
    return { width: bitmap.width, height: bitmap.height };
  }, Array.from(bytes));
}

const angle = async (frame: FrameLocator) =>
  Number((await frame.getByText(/^기울기 /).textContent())!.match(/-?\d+\.\d/)![0]);

test('얼굴을 찾아 기울기를 바로잡고 413×531 JPG로 받는다', async ({ page, baseURL }) => {
  test.setTimeout(120_000);
  await page.goto('/image/id-photo/');
  const photo = await tilted(page, 8);
  const requests: Request[] = [];
  page.on('request', (request) => requests.push(request));
  const frame = await open(page, photo);

  // 처음에는 데이터를 받을지 묻고 크기를 알려 준다. 그동안에도 직접 맞출 수 있다
  await expect(frame.getByText('사진 위 칸을 직접 맞춰 주세요.')).toBeVisible();
  await frame.getByRole('button', { name: /^데이터 받기 \(\d+\.\dMB\)$/ }).click();
  await expect(frame.getByText('얼굴에 맞춰 잘랐습니다.', { exact: false })).toBeVisible({
    timeout: 60_000,
  });
  await expect(frame.getByText('머리 길이 약 3.4cm')).toBeVisible();
  // 사진을 시계 방향으로 8° 기울였으니 얼굴 선도 그만큼 기울어 있다 (원래 사진도 조금 기울어 있다)
  expect(await angle(frame)).toBeGreaterThan(3);
  expect(await angle(frame)).toBeLessThan(12);
  // 흰 배경이고 정수리를 사진에서 찾았다
  await expect(frame.getByText('배경이 흰색이 아닌 것 같습니다', { exact: false })).toHaveCount(0);
  await expect(frame.getByText('정수리를 사진에서 찾지 못해', { exact: false })).toHaveCount(0);

  const event = page.waitForEvent('download');
  await frame.getByRole('button', { name: 'JPG 다운로드' }).click();
  const file = await event;
  expect(file.suggestedFilename()).toBe('portrait_증명사진.jpg');
  const bytes = await readFile(await file.path());
  expect(bytes.length).toBeLessThanOrEqual(500 * 1024);
  expect(await jpegSize(page, bytes)).toEqual({ width: 413, height: 531 });
  await expect(frame.getByText(/^413×531 JPG \d+KB를 만들었습니다\.$/)).toBeVisible();

  // 받은 것은 우리 사이트의 데이터뿐이다 (얼굴 찾기 엔진의 사용 통계도 보내지 않는다)
  expectLocalOnly(page, requests, baseURL!);
  expect(requests.filter((request) => request.url().includes('googleapis'))).toEqual([]);
});

test('키보드로 크기·위치·기울기를 바꾸고 자동으로 다시 맞춘다', async ({ page }) => {
  test.setTimeout(120_000);
  const frame = await open(page);
  await frame.getByRole('button', { name: /^데이터 받기/ }).click();
  await expect(frame.getByText('머리 길이 약 3.4cm')).toBeVisible({ timeout: 60_000 });
  const before = await angle(frame);

  const view = frame.getByRole('application', { name: '증명사진 미리보기' });
  await view.focus();
  for (let i = 0; i < 5; i++) await view.press('+');
  await expect(frame.getByText('머리 길이 약 3.8cm')).toBeVisible();
  await expect(frame.getByText('머리 길이가 기준(3.2~3.6cm)을 벗어났습니다.')).toBeVisible();
  for (let i = 0; i < 4; i++) await view.press('[');
  expect(await angle(frame)).toBeCloseTo(before + 2, 1);

  await frame.getByRole('button', { name: '자동으로 다시 맞추기' }).click();
  await expect(frame.getByText('머리 길이 약 3.4cm')).toBeVisible();
  expect(await angle(frame)).toBeCloseTo(before, 1);
  await expect(frame.getByText('머리 길이가 기준', { exact: false })).toHaveCount(0);
});

test('데이터를 받지 않아도 직접 맞춰 받을 수 있다', async ({ page }) => {
  const frame = await open(page);
  await expect(frame.getByRole('button', { name: /^데이터 받기/ })).toBeVisible();
  await frame.getByRole('button', { name: '크게' }).click();
  await frame.getByRole('button', { name: '위로' }).click();
  const event = page.waitForEvent('download');
  await frame.getByRole('button', { name: 'JPG 다운로드' }).click();
  const bytes = await readFile(await (await event).path());
  expect(await jpegSize(page, bytes)).toEqual({ width: 413, height: 531 });
  // 얼굴을 찾지 않았으니 머리 길이는 보이지 않는다
  await expect(frame.getByText('머리 길이 약', { exact: false })).toHaveCount(0);
});
