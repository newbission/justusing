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
  PDFName,
  PDFRawStream,
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

test('1비트·뒤집은 투명도와 JPG 색 키 투명을 살리고, 글자열 속 BI는 세지 않는다', async ({
  page,
}) => {
  const doc = await PDFDocument.create();
  const context = doc.context;
  // 1비트 투명도(/Decode [1 0]: 1이 투명)
  const mask = context.register(
    context.flateStream(new Uint8Array((64 / 8) * 64).fill(0b10101010), {
      Type: 'XObject',
      Subtype: 'Image',
      Width: 64,
      Height: 64,
      ColorSpace: 'DeviceGray',
      BitsPerComponent: 1,
      Decode: [1, 0],
    }),
  );
  const masked = context.register(
    context.flateStream(new Uint8Array(64 * 64 * 3).fill(100), {
      Type: 'XObject',
      Subtype: 'Image',
      Width: 64,
      Height: 64,
      ColorSpace: 'DeviceRGB',
      BitsPerComponent: 8,
      SMask: mask,
    }),
  );
  // 검은 화소를 투명으로 하는 JPG
  const jpg = await doc.embedJpg(await readFile(fixture('photo.jpg')));
  const added = doc.addPage([300, 300]);
  added.drawImage(jpg, { x: 0, y: 0, width: 100, height: 75 });
  await jpg.embed();
  (context.lookup(jpg.ref) as PDFRawStream).dict.set(
    PDFName.of('Mask'),
    context.obj([0, 30, 0, 30, 0, 30]),
  );
  const name = added.node.newXObject('Image', masked);
  added.pushOperators(pushGraphicsState(), drawObject(name), popGraphicsState());
  // 글자로 쓴 "BI … ID"는 그림이 아니다
  added.node.addContentStream(
    context.register(context.stream('BT /F1 12 Tf (BI /W 100 /H 100 ID) Tj ET')),
  );

  await page.goto('/pdf/extract-images/');
  const frame = page.frameLocator('iframe[data-tool-frame]');
  await frame.locator('input[type=file]').setInputFiles({
    name: 'alpha.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from(await doc.save()),
  });
  await expect(frame.getByText(/^사진 2개 · /)).toBeVisible();
  await expect(frame.getByText('특수한 형식', { exact: false })).toHaveCount(0);
  // JPG도 투명이 있어 PNG로 나온다
  await expect(frame.getByText('1쪽 · 1200×900 · PNG', { exact: false })).toBeVisible();

  const event = page.waitForEvent('download');
  await frame.getByRole('button', { name: '모두 받기 (ZIP)' }).click();
  const entries = unzipSync(new Uint8Array(await readFile(await (await event).path())));
  for (const bytes of Object.values(entries)) expect(bytes[25]).toBe(6);
});

test('자원 목록에 정의한 색공간 이름을 풀고, 투명도가 붙은 JPEG 2000은 못 꺼낸 것으로 센다', async ({
  page,
}) => {
  const doc = await PDFDocument.create();
  const context = doc.context;
  const named = context.register(
    context.flateStream(
      new Uint8Array(64 * 64).map((_, i) => i % 2),
      {
        Type: 'XObject',
        Subtype: 'Image',
        Width: 64,
        Height: 64,
        BitsPerComponent: 8,
        ColorSpace: 'CS0',
      },
    ),
  );
  const alpha = context.register(
    context.flateStream(new Uint8Array(64 * 64).fill(128), {
      Type: 'XObject',
      Subtype: 'Image',
      Width: 64,
      Height: 64,
      ColorSpace: 'DeviceGray',
      BitsPerComponent: 8,
    }),
  );
  const jpx = context.register(
    context.stream(new Uint8Array(32), {
      Type: 'XObject',
      Subtype: 'Image',
      Width: 64,
      Height: 64,
      Filter: 'JPXDecode',
      SMask: alpha,
    }),
  );
  const added = doc.addPage([300, 300]);
  for (const ref of [named, jpx]) {
    const name = added.node.newXObject('Image', ref);
    added.pushOperators(pushGraphicsState(), drawObject(name), popGraphicsState());
  }
  (added.node.Resources() as unknown as { set: (k: PDFName, v: unknown) => void }).set(
    PDFName.of('ColorSpace'),
    context.obj({ CS0: ['Indexed', 'DeviceRGB', 1, PDFHexString.of('FF00000000FF')] }),
  );

  await page.goto('/pdf/extract-images/');
  const frame = page.frameLocator('iframe[data-tool-frame]');
  await frame.locator('input[type=file]').setInputFiles({
    name: 'named.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from(await doc.save()),
  });
  await expect(frame.getByText(/^사진 1개 · /)).toBeVisible();
  await expect(frame.getByText('1개는 흑백 팩스·CMYK', { exact: false })).toBeVisible();
  await expect(frame.getByText('1쪽 · 64×64 · PNG', { exact: false })).toBeVisible();
});

test('예측 행 크기가 사진과 다르거나 Matte로 미리 섞인 투명도는 못 꺼낸 것으로 센다', async ({
  page,
}) => {
  const doc = await PDFDocument.create();
  const context = doc.context;
  const gray = (extra: Record<string, unknown>) =>
    context.register(
      context.flateStream(new Uint8Array(65 * 64).fill(100), {
        Type: 'XObject',
        Subtype: 'Image',
        Width: 64,
        Height: 64,
        ColorSpace: 'DeviceGray',
        BitsPerComponent: 8,
        ...extra,
      }),
    );
  // 예측 행 크기(Columns)를 적지 않아 PDF 기본값 1이 된다 → 사진 폭 64와 다르다
  const predicted = gray({ DecodeParms: { Predictor: 15 } });
  const matte = context.register(
    context.flateStream(new Uint8Array(64 * 64).fill(128), {
      Type: 'XObject',
      Subtype: 'Image',
      Width: 64,
      Height: 64,
      ColorSpace: 'DeviceGray',
      BitsPerComponent: 8,
      Matte: [0],
    }),
  );
  const premultiplied = context.register(
    context.flateStream(new Uint8Array(64 * 64).fill(50), {
      Type: 'XObject',
      Subtype: 'Image',
      Width: 64,
      Height: 64,
      ColorSpace: 'DeviceGray',
      BitsPerComponent: 8,
      SMask: matte,
    }),
  );
  const added = doc.addPage([300, 300]);
  for (const ref of [predicted, premultiplied]) {
    const name = added.node.newXObject('Image', ref);
    added.pushOperators(pushGraphicsState(), drawObject(name), popGraphicsState());
  }

  await page.goto('/pdf/extract-images/');
  const frame = page.frameLocator('iframe[data-tool-frame]');
  await frame.locator('input[type=file]').setInputFiles({
    name: 'odd.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from(await doc.save()),
  });
  await expect(frame.getByText('꺼낼 사진이 없습니다.')).toBeVisible();
  await expect(frame.getByText('2개는 흑백 팩스·CMYK', { exact: false })).toBeVisible();
});

test('그리지 않고 자원 목록에만 있는 사진은 꺼내지 않고, Decode로 바꿔 보이는 JPG는 못 꺼낸 것으로 센다', async ({
  page,
}) => {
  const doc = await PDFDocument.create();
  const context = doc.context;
  const jpg = await doc.embedJpg(await readFile(fixture('photo.jpg')));
  const added = doc.addPage([600, 800]);
  added.drawImage(jpg, { x: 20, y: 400, width: 300, height: 225 });
  await jpg.embed();
  // 뒤집어 보이는 JPG (색 성분마다 [1 0])
  const jpgDict = (context.lookup(jpg.ref) as PDFRawStream).dict;
  jpgDict.set(PDFName.of('Decode'), context.obj([1, 0, 1, 0, 1, 0]));
  // 자원 목록에만 넣고 그리지 않는 사진
  added.node.newXObject(
    'Unused',
    context.register(
      context.flateStream(new Uint8Array(64 * 64).fill(200), {
        Type: 'XObject',
        Subtype: 'Image',
        Width: 64,
        Height: 64,
        ColorSpace: 'DeviceGray',
        BitsPerComponent: 8,
      }),
    ),
  );

  await page.goto('/pdf/extract-images/');
  const frame = page.frameLocator('iframe[data-tool-frame]');
  await frame.locator('input[type=file]').setInputFiles({
    name: 'unused.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from(await doc.save()),
  });
  await expect(frame.getByText('꺼낼 사진이 없습니다.')).toBeVisible();
  await expect(frame.getByText('1개는 흑백 팩스·CMYK', { exact: false })).toBeVisible();
});

test('ICC 색공간을 정한 JPG는 프로필을 넣어 꺼내고, 보정 색공간 JPG는 못 꺼낸 것으로 센다', async ({
  page,
}) => {
  const doc = await PDFDocument.create();
  const context = doc.context;
  const photo = await readFile(fixture('photo.jpg'));
  const profile = new Uint8Array(70000).map((_, i) => (i * 7) % 251);
  const iccJpg = context.register(
    context.stream(photo, {
      Type: 'XObject',
      Subtype: 'Image',
      Width: 1200,
      Height: 900,
      BitsPerComponent: 8,
      Filter: 'DCTDecode',
      ColorSpace: ['ICCBased', context.register(context.flateStream(profile, { N: 3 }))],
    }),
  );
  const calJpg = context.register(
    context.stream(photo, {
      Type: 'XObject',
      Subtype: 'Image',
      Width: 1200,
      Height: 900,
      BitsPerComponent: 8,
      Filter: 'DCTDecode',
      ColorSpace: ['CalRGB', { WhitePoint: [0.9505, 1, 1.089] }],
    }),
  );
  const added = doc.addPage([600, 800]);
  for (const ref of [iccJpg, calJpg]) {
    const name = added.node.newXObject('Image', ref);
    added.pushOperators(pushGraphicsState(), drawObject(name), popGraphicsState());
  }

  await page.goto('/pdf/extract-images/');
  const frame = page.frameLocator('iframe[data-tool-frame]');
  await frame.locator('input[type=file]').setInputFiles({
    name: 'icc.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from(await doc.save()),
  });
  await expect(frame.getByText(/^사진 1개 · /)).toBeVisible();
  await expect(frame.getByText('1개는 흑백 팩스·CMYK', { exact: false })).toBeVisible();
  const event = page.waitForEvent('download');
  await frame.getByRole('button', { name: '다운로드', exact: true }).first().click();
  const bytes = new Uint8Array(await readFile(await (await event).path()));
  expect(bytes.subarray(0, 2)).toEqual(new Uint8Array([0xff, 0xd8]));
  // 프로필이 APP2 조각 둘(65519바이트씩)로 나뉘어 그대로 들어 있다
  const text = Buffer.from(bytes).toString('latin1');
  expect(text.split('ICC_PROFILE\0').length - 1).toBe(2);
  const first = text.indexOf('ICC_PROFILE\0') + 14;
  expect(Buffer.from(bytes.subarray(first, first + 100))).toEqual(
    Buffer.from(profile.subarray(0, 100)),
  );
  // 그림 자료는 원본 그대로 뒤에 붙어 있다
  expect(Buffer.from(bytes.subarray(bytes.length - 1000))).toEqual(
    photo.subarray(photo.length - 1000),
  );
});

test('SMask가 있으면 /Mask 색 키는 쓰지 않는다', async ({ page }) => {
  const doc = await PDFDocument.create();
  const context = doc.context;
  const opaque = context.register(
    context.flateStream(new Uint8Array(64 * 64).fill(255), {
      Type: 'XObject',
      Subtype: 'Image',
      Width: 64,
      Height: 64,
      ColorSpace: 'DeviceGray',
      BitsPerComponent: 8,
    }),
  );
  // 색 키 [0 255]는 모든 화소를 투명하게 하지만, SMask(모두 불투명)가 우선한다
  const image = context.register(
    context.flateStream(new Uint8Array(64 * 64).fill(100), {
      Type: 'XObject',
      Subtype: 'Image',
      Width: 64,
      Height: 64,
      ColorSpace: 'DeviceGray',
      BitsPerComponent: 8,
      SMask: opaque,
      Mask: [0, 255],
    }),
  );
  const added = doc.addPage([300, 300]);
  const name = added.node.newXObject('Image', image);
  added.pushOperators(pushGraphicsState(), drawObject(name), popGraphicsState());

  await page.goto('/pdf/extract-images/');
  const frame = page.frameLocator('iframe[data-tool-frame]');
  await frame.locator('input[type=file]').setInputFiles({
    name: 'smask.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from(await doc.save()),
  });
  await expect(frame.getByText(/^사진 1개 · /)).toBeVisible();
  const event = page.waitForEvent('download');
  await frame.getByRole('button', { name: '다운로드', exact: true }).first().click();
  const png = await readFile(await (await event).path());
  const alpha = await page.evaluate(async (base64) => {
    const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
    const bitmap = await createImageBitmap(new Blob([bytes], { type: 'image/png' }));
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const context = canvas.getContext('2d')!;
    context.drawImage(bitmap, 0, 0);
    return context.getImageData(10, 10, 1, 1).data[3];
  }, png.toString('base64'));
  expect(alpha).toBe(255);
});

test('여러 쪽이 같이 쓰는 자원 없는 묶음 그림은 쪽마다 그 쪽 사진을 따라가고, ColorTransform JPG는 못 꺼낸 것으로 센다', async ({
  page,
}) => {
  const doc = await PDFDocument.create();
  const context = doc.context;
  const gray = (value: number) =>
    context.register(
      context.flateStream(new Uint8Array(64 * 64).fill(value), {
        Type: 'XObject',
        Subtype: 'Image',
        Width: 64,
        Height: 64,
        ColorSpace: 'DeviceGray',
        BitsPerComponent: 8,
      }),
    );
  const form = context.register(
    context.stream('q 50 0 0 50 0 0 cm /Im0 Do Q', {
      Type: 'XObject',
      Subtype: 'Form',
      BBox: [0, 0, 100, 100],
    }),
  );
  const transformed = context.register(
    context.stream(await readFile(fixture('photo.jpg')), {
      Type: 'XObject',
      Subtype: 'Image',
      Width: 1200,
      Height: 900,
      BitsPerComponent: 8,
      ColorSpace: 'DeviceRGB',
      Filter: 'DCTDecode',
      DecodeParms: { ColorTransform: 0 },
    }),
  );
  for (const [index, value] of [10, 200].entries()) {
    const added = doc.addPage([300, 300]);
    added.node.set(
      PDFName.of('Resources'),
      context.obj({
        XObject:
          index === 0
            ? { Fm: form, Im0: gray(value), Jp: transformed }
            : { Fm: form, Im0: gray(value) },
      }),
    );
    added.node.set(
      PDFName.of('Contents'),
      context.register(context.stream(index === 0 ? '/Fm Do /Jp Do' : '/Fm Do')),
    );
  }

  await page.goto('/pdf/extract-images/');
  const frame = page.frameLocator('iframe[data-tool-frame]');
  await frame.locator('input[type=file]').setInputFiles({
    name: 'shared-form.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from(await doc.save()),
  });
  await expect(frame.getByText(/^사진 2개 · /)).toBeVisible();
  await expect(frame.getByText('1쪽 · 64×64 · PNG', { exact: false })).toBeVisible();
  await expect(frame.getByText('2쪽 · 64×64 · PNG', { exact: false })).toBeVisible();
  await expect(frame.getByText('1개는 흑백 팩스·CMYK', { exact: false })).toBeVisible();
});
