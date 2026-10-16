/**
 * PDF 사진 꺼내기 E2E. 빌드 결과에서 돌린다 (playwright.config.ts 참고).
 *
 * JPG는 원본 바이트 그대로, 그 밖의 사진은 PNG로 꺼내는지, 같은 사진은 한 번만 꺼내는지,
 * 아주 작은 그림과 다룰 수 없는 형식을 어떻게 다루는지 확인한다.
 */
import { expect, test, type Page, type Request } from './test';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { unzipSync } from 'fflate';
import {
  PDFDocument,
  PDFHexString,
  drawObject,
  popGraphicsState,
  pushGraphicsState,
} from '@cantoo/pdf-lib';
import { expectLocalOnly } from './local-only';

const fixture = (name: string) => fileURLToPath(new URL(`../fixtures/${name}`, import.meta.url));

/** 1쪽: JPG 사진 + PNG 화면, 2쪽: 같은 JPG + 10×10 작은 그림 + 흑백 팩스(CCITT) 그림 */
async function picturesPdf() {
  const doc = await PDFDocument.create();
  const jpg = await doc.embedJpg(await readFile(fixture('photo.jpg')));
  const png = await doc.embedPng(await readFile(fixture('screen.png')));
  const first = doc.addPage([600, 800]);
  first.drawImage(jpg, { x: 20, y: 400, width: 300, height: 225 });
  first.drawImage(png, { x: 20, y: 20, width: 300, height: 200 });
  const second = doc.addPage([600, 800]);
  second.drawImage(jpg, { x: 20, y: 400, width: 150, height: 112 });
  const context = doc.context;
  const tiny = context.register(
    context.flateStream(new Uint8Array(100).fill(30), {
      Type: 'XObject',
      Subtype: 'Image',
      Width: 10,
      Height: 10,
      ColorSpace: 'DeviceGray',
      BitsPerComponent: 8,
    }),
  );
  const fax = context.register(
    context.stream(new Uint8Array(64), {
      Type: 'XObject',
      Subtype: 'Image',
      Width: 100,
      Height: 100,
      ColorSpace: 'DeviceGray',
      BitsPerComponent: 1,
      Filter: 'CCITTFaxDecode',
    }),
  );
  for (const ref of [tiny, fax]) {
    const name = second.node.newXObject('Image', ref);
    second.pushOperators(pushGraphicsState(), drawObject(name), popGraphicsState());
  }
  return Buffer.from(await doc.save());
}

async function openTool(page: Page) {
  await page.goto('/pdf/extract-images/');
  const frame = page.frameLocator('iframe[data-tool-frame]');
  await frame.locator('input[type=file]').setInputFiles({
    name: 'pictures.pdf',
    mimeType: 'application/pdf',
    buffer: await picturesPdf(),
  });
  return frame;
}

test('JPG는 원본 그대로, 그 밖은 PNG로 꺼내고 같은 사진은 한 번만 꺼낸다', async ({
  page,
  baseURL,
}) => {
  const requests: Request[] = [];
  page.on('request', (request) => requests.push(request));
  const frame = await openTool(page);
  requests.length = 0;

  // 작은 그림은 빼고, 팩스 그림은 꺼내지 못한 것으로 센다
  await expect(frame.getByText(/^사진 2개 · /)).toBeVisible();
  await expect(
    frame.getByText('1개는 흑백 팩스·CMYK 같은 특수한 형식', { exact: false }),
  ).toBeVisible();
  await expect(frame.getByText('1쪽 · 1200×900 · JPG', { exact: false })).toBeVisible();
  await expect(frame.getByText('1쪽 · ', { exact: false })).toHaveCount(2);

  const event = page.waitForEvent('download');
  await frame.getByRole('button', { name: '모두 받기 (ZIP)' }).click();
  const file = await event;
  expect(file.suggestedFilename()).toBe('pictures_images.zip');
  const entries = unzipSync(new Uint8Array(await readFile(await file.path())));
  expect(Object.keys(entries).sort()).toEqual(['pictures_p1_1.jpg', 'pictures_p1_2.png']);
  // JPG는 파일 안의 바이트 그대로
  expect(Buffer.from(entries['pictures_p1_1.jpg']!)).toEqual(await readFile(fixture('photo.jpg')));
  // PNG는 열 수 있는 그림
  expect(Buffer.from(entries['pictures_p1_2.png']!.subarray(1, 4)).toString()).toBe('PNG');

  expectLocalOnly(page, requests, baseURL!);
});

test('작은 그림 빼기를 끄면 아이콘 크기 그림도 꺼낸다', async ({ page }) => {
  const frame = await openTool(page);
  await expect(frame.getByText(/^사진 2개 · /)).toBeVisible();
  await frame.getByLabel('아주 작은 그림 빼기', { exact: false }).uncheck();
  await expect(frame.getByText(/^사진 3개 · /)).toBeVisible();
  await expect(frame.getByText('2쪽 · 10×10 · PNG', { exact: false })).toBeVisible();

  // 하나씩 받기
  const event = page.waitForEvent('download');
  await frame.getByRole('button', { name: '사진 3 받기' }).click();
  expect((await event).suggestedFilename()).toBe('pictures_p2_3.png');
});

test('PNG 예측을 건 Flate 사진도 꺼낸다', async ({ page }) => {
  await page.goto('/pdf/extract-images/');
  const frame = page.frameLocator('iframe[data-tool-frame]');
  await frame.locator('input[type=file]').setInputFiles(fixture('photos.pdf'));
  await expect(frame.getByText(/^사진 2개 · /)).toBeVisible();
  await expect(frame.getByText('특수한 형식', { exact: false })).toHaveCount(0);
  await expect(frame.getByText('2쪽 · 600×450 · PNG', { exact: false })).toBeVisible();
});

test('ICC 사진은 프로필을 넣고, 색 키 투명은 알파로, 바로 써 넣은 그림·보정 색공간은 못 꺼낸 것으로 센다', async ({
  page,
}) => {
  const doc = await PDFDocument.create();
  const context = doc.context;
  const image = (pixels: Uint8Array, dict: Record<string, unknown>) =>
    context.register(
      context.flateStream(pixels, {
        Type: 'XObject',
        Subtype: 'Image',
        Width: 64,
        Height: 64,
        BitsPerComponent: 8,
        ...dict,
      }),
    );
  const profile = context.register(context.flateStream(new Uint8Array(200).fill(7), { N: 3 }));
  const icc = image(new Uint8Array(64 * 64 * 3).fill(120), { ColorSpace: ['ICCBased', profile] });
  // 색 목록 0번(빨강)을 투명으로
  const keyed = image(
    new Uint8Array(64 * 64).map((_, i) => i % 2),
    { ColorSpace: ['Indexed', 'DeviceRGB', 1, PDFHexString.of('FF000000FF00')], Mask: [0, 0] },
  );
  const calibrated = image(new Uint8Array(64 * 64 * 3).fill(90), {
    ColorSpace: ['CalRGB', { WhitePoint: [0.9505, 1, 1.089] }],
  });
  const added = doc.addPage([300, 300]);
  for (const ref of [icc, keyed, calibrated]) {
    const name = added.node.newXObject('Image', ref);
    added.pushOperators(pushGraphicsState(), drawObject(name), popGraphicsState());
  }
  // 쪽 내용에 바로 써 넣은 100×100 그림
  const inline = context.register(
    context.stream(
      `q 100 0 0 100 0 0 cm BI /W 100 /H 100 /CS /G /BPC 8 ID ${'x'.repeat(100 * 100)} EI Q`,
    ),
  );
  added.node.addContentStream(inline);

  await page.goto('/pdf/extract-images/');
  const frame = page.frameLocator('iframe[data-tool-frame]');
  await frame.locator('input[type=file]').setInputFiles({
    name: 'colors.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from(await doc.save()),
  });
  await expect(frame.getByText(/^사진 2개 · /)).toBeVisible();
  await expect(frame.getByText('2개는 흑백 팩스·CMYK', { exact: false })).toBeVisible();

  const event = page.waitForEvent('download');
  await frame.getByRole('button', { name: '모두 받기 (ZIP)' }).click();
  const entries = unzipSync(new Uint8Array(await readFile(await (await event).path())));
  const [first, second] = ['colors_p1_1.png', 'colors_p1_2.png'].map((name) =>
    Buffer.from(entries[name]!),
  );
  // ICC 프로필이 PNG에 들어 있다
  expect(first!.includes(Buffer.from('iCCP'))).toBe(true);
  // 투명이 있으므로 RGBA(색 종류 6)로 저장된다
  expect(second![25]).toBe(6);
});
