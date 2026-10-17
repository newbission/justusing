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

/** 상자 하나 (길이 4바이트 + 이름 + 내용) */
const box = (type: string, ...content: number[][]) => {
  const body = content.flat();
  return [...[0, 0, 0, body.length + 8], ...Buffer.from(type), ...body];
};

/**
 * 시험용 JPEG 2000 (JP2) 바이트: 서명·형식 상자와 머리 상자(jp2h: ihdr 채널 수, colr 색, cdef 채널 정의).
 * 그림 자료(코드 스트림)는 없다. 꺼내는 쪽은 상자만 읽고 바이트를 그대로 옮긴다
 */
function jp2Bytes({
  brand = 'jp2 ',
  channels = 3,
  space = 16,
  cdef,
  longType = false,
}: {
  brand?: string;
  channels?: number;
  space?: number;
  cdef?: [number, number, number][];
  /** 형식 상자를 길이 8바이트(XLBox) 머리로 */
  longType?: boolean;
}) {
  const u16 = (value: number) => [value >> 8, value & 0xff];
  const header = box(
    'jp2h',
    box('ihdr', [0, 0, 0, 64, 0, 0, 0, 64], u16(channels), [7, 7, 0, 0]),
    box('colr', [1, 0, 0, 0, 0, 0, space]),
    cdef ? box('cdef', u16(cdef.length), ...cdef.map((entry) => entry.flatMap(u16))) : [],
  );
  return new Uint8Array([
    ...[0, 0, 0, 12, 0x6a, 0x50, 0x20, 0x20, 0x0d, 0x0a, 0x87, 0x0a],
    ...(longType
      ? [
          0,
          0,
          0,
          1,
          ...Buffer.from('ftyp'),
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          28,
          ...Buffer.from(brand),
          0,
          0,
          0,
          0,
          ...Buffer.from(brand),
        ]
      : box('ftyp', [...Buffer.from(brand)], [0, 0, 0, 0], [...Buffer.from(brand)])),
    ...header,
  ]);
}

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
  await expect(frame.getByText('1개는 흑백 팩스·CMYK 화소', { exact: false })).toBeVisible();
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

test('JPEG 2000은 형식에 맞는 확장자로 꺼내고, 장치 색공간이 아니거나 CMYK 프로필 JPG에 투명도가 있으면 못 꺼낸 것으로 센다', async ({
  page,
}) => {
  const doc = await PDFDocument.create();
  const context = doc.context;
  // 형식 상자 이름 jpx, 색 정보: 방법 1 sRGB(16)
  const jpxBytes = jp2Bytes({ brand: 'jpx ' });
  const jpx = (extra: Record<string, unknown>) =>
    context.register(
      context.stream(jpxBytes, {
        Type: 'XObject',
        Subtype: 'Image',
        Width: 64,
        Height: 64,
        Filter: 'JPXDecode',
        ...extra,
      }),
    );
  const profile = (n: number) =>
    context.register(context.flateStream(new Uint8Array(200).fill(1), { N: n }));
  const plain = jpx({ ColorSpace: 'DeviceRGB' });
  const iccJpx = jpx({ ColorSpace: ['ICCBased', profile(3)] });
  const cmykJpg = context.register(
    context.stream(await readFile(fixture('photo.jpg')), {
      Type: 'XObject',
      Subtype: 'Image',
      Width: 1200,
      Height: 900,
      BitsPerComponent: 8,
      Filter: 'DCTDecode',
      ColorSpace: ['ICCBased', profile(4)],
      SMask: context.register(
        context.flateStream(new Uint8Array(1200 * 900).fill(255), {
          Type: 'XObject',
          Subtype: 'Image',
          Width: 1200,
          Height: 900,
          ColorSpace: 'DeviceGray',
          BitsPerComponent: 8,
        }),
      ),
    }),
  );
  const added = doc.addPage([600, 800]);
  for (const ref of [plain, iccJpx, cmykJpg]) {
    const name = added.node.newXObject('Image', ref);
    added.pushOperators(pushGraphicsState(), drawObject(name), popGraphicsState());
  }

  await page.goto('/pdf/extract-images/');
  const frame = page.frameLocator('iframe[data-tool-frame]');
  await frame.locator('input[type=file]').setInputFiles({
    name: 'jpx.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from(await doc.save()),
  });
  await expect(frame.getByText(/^사진 1개 · /)).toBeVisible();
  await expect(frame.getByText('2개는 흑백 팩스·CMYK', { exact: false })).toBeVisible();
  await expect(frame.getByText('1쪽 · 64×64 · JPX', { exact: false })).toBeVisible();
  const event = page.waitForEvent('download');
  await frame.getByRole('button', { name: '다운로드', exact: true }).first().click();
  expect((await event).suggestedFilename()).toBe('jpx_p1_1.jpx');
});

test('자원 목록의 기본 색공간(/DefaultRGB 등)이 장치 색공간을 대신한다', async ({ page }) => {
  const doc = await PDFDocument.create();
  const context = doc.context;
  const profile = new Uint8Array(300).map((_, i) => (i * 13) % 251);
  const jpg = context.register(
    context.stream(await readFile(fixture('photo.jpg')), {
      Type: 'XObject',
      Subtype: 'Image',
      Width: 1200,
      Height: 900,
      BitsPerComponent: 8,
      ColorSpace: 'DeviceRGB',
      Filter: 'DCTDecode',
    }),
  );
  const gray = context.register(
    context.flateStream(new Uint8Array(64 * 64).fill(100), {
      Type: 'XObject',
      Subtype: 'Image',
      Width: 64,
      Height: 64,
      ColorSpace: 'DeviceGray',
      BitsPerComponent: 8,
    }),
  );
  // 1쪽: DefaultRGB가 ICC 프로필 → 그 프로필을 넣어 꺼낸다. 2쪽: DefaultGray가 보정 색공간 → 못 꺼낸다
  for (const [ref, spaces] of [
    [
      jpg,
      context.obj({
        DefaultRGB: ['ICCBased', context.register(context.flateStream(profile, { N: 3 }))],
      }),
    ],
    [gray, context.obj({ DefaultGray: ['CalGray', { WhitePoint: [0.9505, 1, 1.089] }] })],
  ] as const) {
    const added = doc.addPage([600, 800]);
    const name = added.node.newXObject('Image', ref);
    (added.node.Resources() as unknown as { set: (k: PDFName, v: unknown) => void }).set(
      PDFName.of('ColorSpace'),
      spaces,
    );
    added.pushOperators(pushGraphicsState(), drawObject(name), popGraphicsState());
  }

  await page.goto('/pdf/extract-images/');
  const frame = page.frameLocator('iframe[data-tool-frame]');
  await frame.locator('input[type=file]').setInputFiles({
    name: 'defaults.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from(await doc.save()),
  });
  await expect(frame.getByText(/^사진 1개 · /)).toBeVisible();
  await expect(frame.getByText('1개는 흑백 팩스·CMYK', { exact: false })).toBeVisible();
  const event = page.waitForEvent('download');
  await frame.getByRole('button', { name: '다운로드', exact: true }).first().click();
  const bytes = await readFile(await (await event).path());
  expect(bytes.toString('latin1')).toContain('ICC_PROFILE\0');
});

test('회색 ICC 프로필 사진은 프로필을 넣은 회색 PNG로 꺼낸다', async ({ page }) => {
  const doc = await PDFDocument.create();
  const context = doc.context;
  const profile = new Uint8Array(300).map((_, i) => (i * 17) % 251);
  const gray = context.register(
    context.flateStream(
      new Uint8Array(64 * 64).map((_, i) => i % 256),
      {
        Type: 'XObject',
        Subtype: 'Image',
        Width: 64,
        Height: 64,
        ColorSpace: ['ICCBased', context.register(context.flateStream(profile, { N: 1 }))],
        BitsPerComponent: 8,
      },
    ),
  );
  const added = doc.addPage([300, 300]);
  const name = added.node.newXObject('Image', gray);
  added.pushOperators(pushGraphicsState(), drawObject(name), popGraphicsState());

  await page.goto('/pdf/extract-images/');
  const frame = page.frameLocator('iframe[data-tool-frame]');
  await frame.locator('input[type=file]').setInputFiles({
    name: 'gray-icc.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from(await doc.save()),
  });
  await expect(frame.getByText(/^사진 1개 · /)).toBeVisible();
  const event = page.waitForEvent('download');
  await frame.getByRole('button', { name: '다운로드', exact: true }).first().click();
  const png = await readFile(await (await event).path());
  // IHDR의 색 종류 0(회색), iCCP 조각이 있다
  expect(png[25]).toBe(0);
  expect(png.toString('latin1')).toContain('iCCP');
  const pixel = await page.evaluate(async (base64) => {
    const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
    const bitmap = await createImageBitmap(new Blob([bytes], { type: 'image/png' }), {
      colorSpaceConversion: 'none',
    });
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const context = canvas.getContext('2d')!;
    context.drawImage(bitmap, 0, 0);
    return [bitmap.width, ...context.getImageData(5, 0, 1, 1).data];
  }, png.toString('base64'));
  expect(pixel[0]).toBe(64);
  expect(pixel[1]).toBe(5);
});

test('색 목록보다 큰 값은 마지막 색으로 보고, 쪽마다 다른 이름 색공간으로 부른 같은 사진은 따로 꺼낸다', async ({
  page,
}) => {
  const doc = await PDFDocument.create();
  const context = doc.context;
  // 64×64, 값 0·1·2·200이 번갈아 나온다. 색 목록은 빨강·파랑 둘(hival 1)
  const indexed = context.register(
    context.flateStream(
      new Uint8Array(64 * 64).map((_, i) => [0, 1, 2, 200][i % 4]!),
      {
        Type: 'XObject',
        Subtype: 'Image',
        Width: 64,
        Height: 64,
        ColorSpace: ['Indexed', 'DeviceRGB', 1, PDFHexString.of('FF00000000FF')],
        BitsPerComponent: 8,
      },
    ),
  );
  const shared = context.register(
    context.flateStream(new Uint8Array(64 * 64).fill(100), {
      Type: 'XObject',
      Subtype: 'Image',
      Width: 64,
      Height: 64,
      ColorSpace: 'CS0',
      BitsPerComponent: 8,
    }),
  );
  const first = doc.addPage([300, 300]);
  const second = doc.addPage([300, 300]);
  for (const [added, refs, space] of [
    [first, [indexed, shared], 'DeviceGray'],
    [
      second,
      [shared],
      ['ICCBased', context.register(context.flateStream(new Uint8Array(200), { N: 1 }))],
    ],
  ] as const) {
    for (const ref of refs) {
      const name = added.node.newXObject('Image', ref);
      added.pushOperators(pushGraphicsState(), drawObject(name), popGraphicsState());
    }
    (added.node.Resources() as unknown as { set: (k: PDFName, v: unknown) => void }).set(
      PDFName.of('ColorSpace'),
      context.obj({ CS0: space as never }),
    );
  }

  await page.goto('/pdf/extract-images/');
  const frame = page.frameLocator('iframe[data-tool-frame]');
  await frame.locator('input[type=file]').setInputFiles({
    name: 'indexed.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from(await doc.save()),
  });
  await expect(frame.getByText(/^사진 3개 · /)).toBeVisible();
  await expect(frame.getByText('2쪽 · 64×64 · PNG', { exact: false })).toBeVisible();
  const event = page.waitForEvent('download');
  await frame.getByRole('button', { name: '사진 1 받기' }).click();
  const png = await readFile(await (await event).path());
  const pixels = await page.evaluate(async (base64) => {
    const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
    const bitmap = await createImageBitmap(new Blob([bytes], { type: 'image/png' }));
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const context = canvas.getContext('2d')!;
    context.drawImage(bitmap, 0, 0);
    return [...context.getImageData(0, 0, 4, 1).data];
  }, png.toString('base64'));
  // 0 빨강, 1 파랑, 2와 200은 마지막 색(파랑)
  expect(pixels.slice(0, 3)).toEqual([255, 0, 0]);
  expect(pixels.slice(8, 11)).toEqual([0, 0, 255]);
  expect(pixels.slice(12, 15)).toEqual([0, 0, 255]);
});

test('무늬가 그리는 사진도 꺼내고, 장치 색공간 JPG의 안쪽 프로필은 빼고, 번호는 꺼낸 것만 센다', async ({
  page,
}) => {
  const doc = await PDFDocument.create();
  const context = doc.context;
  const gray = (extra: Record<string, unknown> = {}) =>
    context.register(
      context.flateStream(new Uint8Array(64 * 64).fill(90), {
        Type: 'XObject',
        Subtype: 'Image',
        Width: 64,
        Height: 64,
        ColorSpace: 'DeviceGray',
        BitsPerComponent: 8,
        ...extra,
      }),
    );
  // 값 범위가 0~1이 아닌 ICC 사진 (못 꺼냄) — 먼저 그려서 번호가 비지 않는지 본다
  const ranged = gray({
    ColorSpace: [
      'ICCBased',
      context.register(context.flateStream(new Uint8Array(200), { N: 1, Range: [0.2, 0.8] })),
    ],
  });
  // 안에 ICC 프로필(APP2)이 든 JPG를 장치 RGB로 쓴다
  const photo = await readFile(fixture('photo.jpg'));
  const app2 = Buffer.concat([
    Buffer.from([0xff, 0xe2, 0x00, 0x20]),
    Buffer.from('ICC_PROFILE\0'),
    Buffer.from([1, 1]),
    Buffer.alloc(16, 7),
  ]);
  const tagged = context.register(
    context.stream(Buffer.concat([photo.subarray(0, 2), app2, photo.subarray(2)]), {
      Type: 'XObject',
      Subtype: 'Image',
      Width: 1200,
      Height: 900,
      BitsPerComponent: 8,
      ColorSpace: 'DeviceRGB',
      Filter: 'DCTDecode',
    }),
  );
  // 바둑무늬 무늬 안에서만 그리는 사진
  const pattern = context.register(
    context.stream('q 64 0 0 64 0 0 cm /Im Do Q', {
      Type: 'Pattern',
      PatternType: 1,
      PaintType: 1,
      TilingType: 1,
      BBox: [0, 0, 64, 64],
      XStep: 64,
      YStep: 64,
      Resources: { XObject: { Im: gray() } },
    }),
  );
  const added = doc.addPage([600, 800]);
  added.node.set(
    PDFName.of('Resources'),
    context.obj({ XObject: { R: ranged, T: tagged }, Pattern: { P1: pattern } }),
  );
  added.node.set(
    PDFName.of('Contents'),
    context.register(context.stream('/R Do /T Do /Pattern cs /P1 scn 0 0 200 200 re f')),
  );

  await page.goto('/pdf/extract-images/');
  const frame = page.frameLocator('iframe[data-tool-frame]');
  await frame.locator('input[type=file]').setInputFiles({
    name: 'pattern.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from(await doc.save()),
  });
  await expect(frame.getByText(/^사진 2개 · /)).toBeVisible();
  await expect(frame.getByText('1개는 흑백 팩스·CMYK', { exact: false })).toBeVisible();
  const event = page.waitForEvent('download');
  await frame.getByRole('button', { name: '모두 받기 (ZIP)' }).click();
  const entries = unzipSync(new Uint8Array(await readFile(await (await event).path())));
  expect(Object.keys(entries).sort()).toEqual(['pattern_p1_1.png', 'pattern_p1_2.jpg']);
  const jpg = Buffer.from(entries['pattern_p1_2.jpg']!);
  expect(jpg.toString('latin1')).not.toContain('ICC_PROFILE');
  expect(jpg).toEqual(photo);
});

test('도장 주석과 Type3 글자 모양 안의 사진도 꺼내고, 파일 안 색이 다른 JPEG 2000과 값 범위가 다른 ICC JPG는 못 꺼낸 것으로 센다', async ({
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
  // 도장 주석의 모양 안 사진
  const stamp = context.register(
    context.stream('q 64 0 0 64 0 0 cm /Im Do Q', {
      Type: 'XObject',
      Subtype: 'Form',
      BBox: [0, 0, 64, 64],
      Resources: { XObject: { Im: gray(10) } },
    }),
  );
  // Type3 글자 모양 안 사진
  const type3 = context.register(
    context.obj({
      Type: 'Font',
      Subtype: 'Type3',
      FontBBox: [0, 0, 1000, 1000],
      FontMatrix: [0.001, 0, 0, 0.001, 0, 0],
      CharProcs: {
        a: context.register(context.stream('1000 0 d0 q 1000 0 0 1000 0 0 cm /Im Do Q')),
      },
      Encoding: { Type: 'Encoding', Differences: [97, 'a'] },
      FirstChar: 97,
      LastChar: 97,
      Widths: [1000],
      Resources: { XObject: { Im: gray(20) } },
    }),
  );
  // 파일 안 색 정보가 ICC(방법 2)인 JPEG 2000을 장치 RGB로 쓴다
  const jpxBytes = new Uint8Array(64);
  jpxBytes.set([0, 0, 0, 12, 0x6a, 0x50, 0x20, 0x20, 0x0d, 0x0a, 0x87, 0x0a]);
  jpxBytes.set([0, 0, 0, 20, ...Buffer.from('ftypjp2 ')], 12);
  jpxBytes.set(
    [0, 0, 0, 20, ...Buffer.from('jp2h'), 0, 0, 0, 12, ...Buffer.from('colr'), 2, 0, 0, 0],
    32,
  );
  const jpx = context.register(
    context.stream(jpxBytes, {
      Type: 'XObject',
      Subtype: 'Image',
      Width: 64,
      Height: 64,
      Filter: 'JPXDecode',
      ColorSpace: 'DeviceRGB',
    }),
  );
  // 값 범위가 0~1이 아닌 ICC 프로필의 JPG
  const rangedJpg = context.register(
    context.stream(await readFile(fixture('photo.jpg')), {
      Type: 'XObject',
      Subtype: 'Image',
      Width: 1200,
      Height: 900,
      BitsPerComponent: 8,
      Filter: 'DCTDecode',
      ColorSpace: [
        'ICCBased',
        context.register(
          context.flateStream(new Uint8Array(200), { N: 3, Range: [0, 1, 0.2, 0.8, 0, 1] }),
        ),
      ],
    }),
  );
  const added = doc.addPage([600, 800]);
  added.node.set(
    PDFName.of('Resources'),
    context.obj({ Font: { T3: type3 }, XObject: { J: jpx, R: rangedJpg } }),
  );
  added.node.set(
    PDFName.of('Contents'),
    context.register(context.stream('/J Do /R Do BT /T3 64 Tf 100 100 Td (a) Tj ET')),
  );
  added.node.set(
    PDFName.of('Annots'),
    context.obj([
      context.obj({
        Type: 'Annot',
        Subtype: 'Stamp',
        Rect: [300, 300, 364, 364],
        AP: { N: stamp },
      }),
    ]),
  );

  await page.goto('/pdf/extract-images/');
  const frame = page.frameLocator('iframe[data-tool-frame]');
  await frame.locator('input[type=file]').setInputFiles({
    name: 'hidden-places.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from(await doc.save()),
  });
  await expect(frame.getByText(/^사진 2개 · /)).toBeVisible();
  await expect(frame.getByText('2개는 흑백 팩스·CMYK', { exact: false })).toBeVisible();
});

test('화면에 보이지 않는 사진(꺼진 층·숨긴 주석·찍지 않은 Type3 글자)은 꺼내지 않는다', async ({
  page,
}) => {
  const doc = await PDFDocument.create();
  const context = doc.context;
  const gray = (value: number, extra: Record<string, unknown> = {}) =>
    context.register(
      context.flateStream(new Uint8Array(64 * 64).fill(value), {
        Type: 'XObject',
        Subtype: 'Image',
        Width: 64,
        Height: 64,
        ColorSpace: 'DeviceGray',
        BitsPerComponent: 8,
        ...extra,
      }),
    );
  const hiddenLayer = context.register(
    context.obj({ Type: 'OCG', Name: PDFHexString.fromText('Off') }),
  );
  doc.catalog.set(
    PDFName.of('OCProperties'),
    context.obj({ OCGs: [hiddenLayer], D: { OFF: [hiddenLayer] } }),
  );
  const noView = context.register(
    context.stream('q 64 0 0 64 0 0 cm /Im Do Q', {
      Type: 'XObject',
      Subtype: 'Form',
      BBox: [0, 0, 64, 64],
      Resources: { XObject: { Im: gray(40) } },
    }),
  );
  const type3 = context.register(
    context.obj({
      Type: 'Font',
      Subtype: 'Type3',
      FontBBox: [0, 0, 1000, 1000],
      FontMatrix: [0.001, 0, 0, 0.001, 0, 0],
      CharProcs: {
        a: context.register(context.stream('1000 0 d0 q 1000 0 0 1000 0 0 cm /A Do Q')),
        b: context.register(context.stream('1000 0 d0 q 1000 0 0 1000 0 0 cm /B Do Q')),
      },
      Encoding: { Type: 'Encoding', Differences: [97, 'a', 'b'] },
      FirstChar: 97,
      LastChar: 98,
      Widths: [1000, 1000],
      Resources: { XObject: { A: gray(50), B: gray(60) } },
    }),
  );
  const added = doc.addPage([600, 800]);
  added.node.set(
    PDFName.of('Resources'),
    context.obj({
      Font: { T3: type3 },
      Properties: { L1: hiddenLayer },
      XObject: { V: gray(10), H1: gray(20, { OC: hiddenLayer }), H2: gray(30) },
    }),
  );
  added.node.set(
    PDFName.of('Contents'),
    context.register(
      context.stream('/V Do /H1 Do /OC /L1 BDC /H2 Do EMC BT /T3 64 Tf 100 100 Td (a) Tj ET'),
    ),
  );
  added.node.set(
    PDFName.of('Annots'),
    context.obj([
      context.obj({
        Type: 'Annot',
        Subtype: 'Stamp',
        F: 32,
        Rect: [300, 300, 364, 364],
        AP: { N: noView },
      }),
    ]),
  );

  await page.goto('/pdf/extract-images/');
  const frame = page.frameLocator('iframe[data-tool-frame]');
  await frame.locator('input[type=file]').setInputFiles({
    name: 'invisible.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from(await doc.save()),
  });
  // 보이는 V와 찍은 글자 a 안의 사진만
  await expect(frame.getByText(/^사진 2개 · /)).toBeVisible();
  await expect(frame.getByText('흑백 팩스·CMYK', { exact: false })).toHaveCount(0);
});

test('길이를 8바이트로 적은 JPEG 2000 머리 상자 안의 색 정보도 읽는다', async ({ page }) => {
  const doc = await PDFDocument.create();
  const context = doc.context;
  // jp2h를 큰 상자 형식(길이 1 + 8바이트 길이)으로 적고, 안의 색 정보는 ICC(방법 2)
  const bytes = new Uint8Array(80);
  bytes.set([0, 0, 0, 12, 0x6a, 0x50, 0x20, 0x20, 0x0d, 0x0a, 0x87, 0x0a]);
  bytes.set([0, 0, 0, 20, ...Buffer.from('ftypjp2 ')], 12);
  bytes.set([0, 0, 0, 1, ...Buffer.from('jp2h'), 0, 0, 0, 0, 0, 0, 0, 28], 32);
  bytes.set([0, 0, 0, 12, ...Buffer.from('colr'), 2, 0, 0, 0], 48);
  const jpx = context.register(
    context.stream(bytes, {
      Type: 'XObject',
      Subtype: 'Image',
      Width: 64,
      Height: 64,
      Filter: 'JPXDecode',
      ColorSpace: 'DeviceRGB',
    }),
  );
  const added = doc.addPage([300, 300]);
  const imageName = added.node.newXObject('Image', jpx);
  added.pushOperators(pushGraphicsState(), drawObject(imageName), popGraphicsState());

  await page.goto('/pdf/extract-images/');
  const frame = page.frameLocator('iframe[data-tool-frame]');
  await frame.locator('input[type=file]').setInputFiles({
    name: 'xlbox.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from(await doc.save()),
  });
  await expect(frame.getByText('꺼낼 사진이 없습니다.')).toBeVisible();
  await expect(frame.getByText('1개는 흑백 팩스·CMYK', { exact: false })).toBeVisible();
});

/** PDF를 넣고 frame을 돌려준다 */
async function openPdf(page: Page, name: string, doc: PDFDocument) {
  await page.goto('/pdf/extract-images/');
  const frame = page.frameLocator('iframe[data-tool-frame]');
  await frame.locator('input[type=file]').setInputFiles({
    name,
    mimeType: 'application/pdf',
    buffer: Buffer.from(await doc.save()),
  });
  return frame;
}

/** 쪽 하나에 사진들을 차례로 그린다 */
function drawAll(doc: PDFDocument, refs: ReturnType<PDFDocument['context']['register']>[]) {
  const added = doc.addPage([600, 800]);
  for (const ref of refs) {
    const name = added.node.newXObject('Image', ref);
    added.pushOperators(pushGraphicsState(), drawObject(name), popGraphicsState());
  }
}

test('파일 안 투명 채널과 색(sYCC)이 PDF에서 보는 것과 다른 JPEG 2000은 못 꺼낸 것으로 센다', async ({
  page,
}) => {
  const doc = await PDFDocument.create();
  const context = doc.context;
  const jpx = (bytes: Uint8Array, extra: Record<string, unknown> = {}) =>
    context.register(
      context.stream(bytes, {
        Type: 'XObject',
        Subtype: 'Image',
        Width: 64,
        Height: 64,
        Filter: 'JPXDecode',
        ColorSpace: 'DeviceRGB',
        ...extra,
      }),
    );
  // RGB + 투명(그대로) 채널
  const straight: [number, number, number][] = [
    [0, 0, 1],
    [1, 0, 2],
    [2, 0, 3],
    [3, 1, 0],
  ];
  const premultiplied: [number, number, number][] = [...straight.slice(0, 3), [3, 2, 0]];
  drawAll(doc, [
    // 같게 보인다: PDF도 파일 안 투명을 그대로 쓴다
    jpx(jp2Bytes({ channels: 4, cdef: straight }), { SMaskInData: 1 }),
    // PDF는 투명 채널을 버리는데 파일을 보는 프로그램은 쓴다
    jpx(jp2Bytes({ channels: 4, cdef: straight })),
    // PDF는 미리 합친 것으로 보는데 파일은 그대로라고 적혀 있다
    jpx(jp2Bytes({ channels: 4, cdef: straight }), { SMaskInData: 2 }),
    // 채널 정의 없이 채널이 하나 더 있다
    jpx(jp2Bytes({ channels: 4 })),
    // 미리 합친 투명끼리는 같다
    jpx(jp2Bytes({ channels: 4, cdef: premultiplied }), { SMaskInData: 2 }),
    // sYCC: PDF는 표본을 RGB로 읽지만 파일을 보는 프로그램은 sYCC에서 바꾼다
    jpx(jp2Bytes({ space: 18 })),
  ]);
  const frame = await openPdf(page, 'jpx-alpha.pdf', doc);
  await expect(frame.getByText(/^사진 2개 · /)).toBeVisible();
  await expect(frame.getByText('4개는 흑백 팩스·CMYK', { exact: false })).toBeVisible();
});

test('표시 앞에 채움 바이트가 있는 JPG도 안쪽 프로필을 빼고 꺼낸다', async ({ page }) => {
  const doc = await PDFDocument.create();
  const context = doc.context;
  const photo = await readFile(fixture('photo.jpg'));
  const app2 = Buffer.concat([
    Buffer.from([0xff, 0xe2, 0x00, 0x20]),
    Buffer.from('ICC_PROFILE\0'),
    Buffer.from([1, 1]),
    Buffer.alloc(16, 7),
  ]);
  // 프로필 조각 앞에 채움 바이트 FF 두 개
  const filled = Buffer.concat([
    photo.subarray(0, 2),
    Buffer.from([0xff, 0xff]),
    app2,
    photo.subarray(2),
  ]);
  drawAll(doc, [
    context.register(
      context.stream(filled, {
        Type: 'XObject',
        Subtype: 'Image',
        Width: 1200,
        Height: 900,
        BitsPerComponent: 8,
        ColorSpace: 'DeviceRGB',
        Filter: 'DCTDecode',
      }),
    ),
  ]);
  const frame = await openPdf(page, 'filled.pdf', doc);
  await expect(frame.getByText(/^사진 1개 · /)).toBeVisible();
  const event = page.waitForEvent('download');
  await frame.getByRole('button', { name: '다운로드', exact: true }).first().click();
  const jpg = await readFile(await (await event).path());
  expect(jpg.toString('latin1')).not.toContain('ICC_PROFILE');
  expect(jpg).toEqual(photo);
});

test('볼 때 저절로 끄는 층(/AS)의 사진은 꺼내지 않는다', async ({ page }) => {
  const doc = await PDFDocument.create();
  const context = doc.context;
  const gray = (value: number, extra: Record<string, unknown> = {}) =>
    context.register(
      context.flateStream(new Uint8Array(64 * 64).fill(value), {
        Type: 'XObject',
        Subtype: 'Image',
        Width: 64,
        Height: 64,
        ColorSpace: 'DeviceGray',
        BitsPerComponent: 8,
        ...extra,
      }),
    );
  const viewOff = context.register(
    context.obj({
      Type: 'OCG',
      Name: PDFHexString.fromText('Print only'),
      Usage: { View: { ViewState: 'OFF' } },
    }),
  );
  doc.catalog.set(
    PDFName.of('OCProperties'),
    context.obj({
      OCGs: [viewOff],
      D: { AS: [{ Event: 'View', OCGs: [viewOff], Category: ['View'] }] },
    }),
  );
  drawAll(doc, [gray(10), gray(20, { OC: viewOff })]);
  const frame = await openPdf(page, 'auto-layer.pdf', doc);
  await expect(frame.getByText(/^사진 1개 · /)).toBeVisible();
});

test('Differences에 없는 코드로 찍은 Type3 글자(기본 인코딩) 안의 사진도 꺼낸다', async ({
  page,
}) => {
  const doc = await PDFDocument.create();
  const context = doc.context;
  const gray = context.register(
    context.flateStream(new Uint8Array(64 * 64).fill(70), {
      Type: 'XObject',
      Subtype: 'Image',
      Width: 64,
      Height: 64,
      ColorSpace: 'DeviceGray',
      BitsPerComponent: 8,
    }),
  );
  const type3 = context.register(
    context.obj({
      Type: 'Font',
      Subtype: 'Type3',
      FontBBox: [0, 0, 1000, 1000],
      FontMatrix: [0.001, 0, 0, 0.001, 0, 0],
      CharProcs: {
        a: context.register(context.stream('1000 0 d0 q 1000 0 0 1000 0 0 cm /A Do Q')),
        b: context.register(context.stream('1000 0 d0')),
      },
      // a(97)는 기본 인코딩(WinAnsi)으로, b(98)만 Differences로
      Encoding: { Type: 'Encoding', BaseEncoding: 'WinAnsiEncoding', Differences: [98, 'b'] },
      FirstChar: 97,
      LastChar: 98,
      Widths: [1000, 1000],
      Resources: { XObject: { A: gray } },
    }),
  );
  const added = doc.addPage([600, 800]);
  added.node.set(PDFName.of('Resources'), context.obj({ Font: { T3: type3 } }));
  added.node.set(
    PDFName.of('Contents'),
    context.register(context.stream('BT /T3 64 Tf 100 100 Td (a) Tj ET')),
  );
  const frame = await openPdf(page, 'type3-base.pdf', doc);
  await expect(frame.getByText(/^사진 1개 · /)).toBeVisible();
});

test('보이기 식(/VE)과 주석 모양의 /OC로 꺼진 사진은 꺼내지 않고, 긴 머리 형식 상자의 JPEG 2000 형식도 읽는다', async ({
  page,
}) => {
  const doc = await PDFDocument.create();
  const context = doc.context;
  const gray = (value: number, extra: Record<string, unknown> = {}) =>
    context.register(
      context.flateStream(new Uint8Array(64 * 64).fill(value), {
        Type: 'XObject',
        Subtype: 'Image',
        Width: 64,
        Height: 64,
        ColorSpace: 'DeviceGray',
        BitsPerComponent: 8,
        ...extra,
      }),
    );
  const layer = (title: string) =>
    context.register(context.obj({ Type: 'OCG', Name: PDFHexString.fromText(title) }));
  const off = layer('Off');
  const on = layer('On');
  doc.catalog.set(PDFName.of('OCProperties'), context.obj({ OCGs: [off, on], D: { OFF: [off] } }));
  // /P AnyOn으로는 보이지만 /VE [/And 꺼진 층 켜진 층]으로는 꺼진다
  const both = context.register(
    context.obj({ Type: 'OCMD', OCGs: [off, on], P: 'AnyOn', VE: ['And', off, on] }),
  );
  const jpx = context.register(
    context.stream(jp2Bytes({ brand: 'jpx ', longType: true }), {
      Type: 'XObject',
      Subtype: 'Image',
      Width: 64,
      Height: 64,
      Filter: 'JPXDecode',
      ColorSpace: 'DeviceRGB',
    }),
  );
  drawAll(doc, [jpx, gray(20, { OC: both })]);
  // 주석에는 /OC가 없고 모양 묶음 그림에만 꺼진 층
  const look = context.register(
    context.stream('q 64 0 0 64 0 0 cm /Im Do Q', {
      Type: 'XObject',
      Subtype: 'Form',
      BBox: [0, 0, 64, 64],
      OC: off,
      Resources: { XObject: { Im: gray(30) } },
    }),
  );
  doc.getPage(0).node.set(
    PDFName.of('Annots'),
    context.obj([
      context.obj({
        Type: 'Annot',
        Subtype: 'Stamp',
        Rect: [300, 300, 364, 364],
        AP: { N: look },
      }),
    ]),
  );
  const frame = await openPdf(page, 've.pdf', doc);
  await expect(frame.getByText(/^사진 1개 · /)).toBeVisible();
  const event = page.waitForEvent('download');
  await frame.getByRole('button', { name: '다운로드', exact: true }).first().click();
  expect((await event).suggestedFilename()).toBe('ve_p1_1.jpx');
});

test('바로 써 넣은 마스크(/IM true)는 사진이 아니라 못 꺼낸 것으로도 세지 않는다', async ({
  page,
}) => {
  const doc = await PDFDocument.create();
  const added = doc.addPage([300, 300]);
  // 100×100 1비트 마스크: 한 줄 13바이트 × 100줄
  const content = Buffer.concat([
    Buffer.from('q 100 0 0 100 0 0 cm BI /W 100 /H 100 /IM true ID ', 'latin1'),
    Buffer.alloc(1300, 0x55),
    Buffer.from(' EI Q', 'latin1'),
  ]);
  added.node.set(PDFName.of('Contents'), doc.context.register(doc.context.stream(content)));
  const frame = await openPdf(page, 'mask.pdf', doc);
  await expect(frame.getByText('꺼낼 사진이 없습니다.')).toBeVisible();
  await expect(frame.getByText('흑백 팩스·CMYK', { exact: false })).toHaveCount(0);
});

test('칠할 때만 무늬 안 사진을 세고, 보이지 않는 글자·그래픽 상태로 고른 Type3 글자를 따르며, 투명 CMYK JPG는 못 꺼낸 것으로 센다', async ({
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
  const pattern = (value: number) =>
    context.register(
      context.stream('q 64 0 0 64 0 0 cm /Im Do Q', {
        Type: 'Pattern',
        PatternType: 1,
        PaintType: 1,
        TilingType: 1,
        BBox: [0, 0, 64, 64],
        XStep: 64,
        YStep: 64,
        Resources: { XObject: { Im: gray(value) } },
      }),
    );
  const glyphFont = (value: number) =>
    context.register(
      context.obj({
        Type: 'Font',
        Subtype: 'Type3',
        FontBBox: [0, 0, 1000, 1000],
        FontMatrix: [0.001, 0, 0, 0.001, 0, 0],
        CharProcs: {
          a: context.register(context.stream('1000 0 d0 q 1000 0 0 1000 0 0 cm /G Do Q')),
        },
        Encoding: { Type: 'Encoding', Differences: [97, 'a'] },
        FirstChar: 97,
        LastChar: 97,
        Widths: [1000],
        Resources: { XObject: { G: gray(value) } },
      }),
    );
  const cmyk = context.register(
    context.stream(await readFile(fixture('photo.jpg')), {
      Type: 'XObject',
      Subtype: 'Image',
      Width: 1200,
      Height: 900,
      BitsPerComponent: 8,
      Filter: 'DCTDecode',
      ColorSpace: 'DeviceCMYK',
      SMask: gray(255),
    }),
  );
  const added = doc.addPage([600, 800]);
  added.node.set(
    PDFName.of('Resources'),
    context.obj({
      // P1: 고르기만 하고 칠하지 않음, P2: 칠함
      Pattern: { P1: pattern(11), P2: pattern(12) },
      // T1: 보이지 않는 글자(3 Tr)로만 찍음, T2: 그래픽 상태로 고르고 찍음
      Font: { T1: glyphFont(13) },
      ExtGState: { GS2: { Font: [glyphFont(14), 12] } },
      XObject: { C: cmyk },
    }),
  );
  added.node.set(
    PDFName.of('Contents'),
    context.register(
      context.stream(
        '/Pattern cs /P1 scn 0 g 0 0 10 10 re f /Pattern cs /P2 scn 20 20 10 10 re f ' +
          'BT 3 Tr /T1 12 Tf (a) Tj ET BT 0 Tr /GS2 gs (a) Tj ET /C Do',
      ),
    ),
  );
  const frame = await openPdf(page, 'state.pdf', doc);
  // 칠한 무늬(P2)와 그래픽 상태로 고른 글자(T2) 안의 사진만
  await expect(frame.getByText(/^사진 2개 · /)).toBeVisible();
  await expect(frame.getByText('1개는 흑백 팩스·CMYK', { exact: false })).toBeVisible();
});

test('반투명 화소의 색을 깎지 않고 PNG로 꺼낸다', async ({ page }) => {
  const { inflateSync } = await import('node:zlib');
  const doc = await PDFDocument.create();
  const context = doc.context;
  const rgb = new Uint8Array(64 * 64 * 3);
  for (let i = 0; i < rgb.length; i += 3) rgb.set([200, 100, 50], i);
  const picture = context.register(
    context.flateStream(rgb, {
      Type: 'XObject',
      Subtype: 'Image',
      Width: 64,
      Height: 64,
      ColorSpace: 'DeviceRGB',
      BitsPerComponent: 8,
      SMask: context.register(
        context.flateStream(new Uint8Array(64 * 64).fill(10), {
          Type: 'XObject',
          Subtype: 'Image',
          Width: 64,
          Height: 64,
          ColorSpace: 'DeviceGray',
          BitsPerComponent: 8,
        }),
      ),
    }),
  );
  drawAll(doc, [picture]);
  const frame = await openPdf(page, 'alpha.pdf', doc);
  const event = page.waitForEvent('download');
  await frame.getByRole('button', { name: '다운로드', exact: true }).first().click();
  const png = await readFile(await (await event).path());
  // IDAT 자료를 풀어 첫 화소를 본다 (줄 앞 필터 1바이트 뒤 RGBA)
  const chunks: Buffer[] = [];
  for (let at = 8; at < png.length;) {
    const length = png.readUInt32BE(at);
    if (png.toString('latin1', at + 4, at + 8) === 'IDAT')
      chunks.push(png.subarray(at + 8, at + 8 + length));
    at += 12 + length;
  }
  const raw = inflateSync(Buffer.concat(chunks));
  expect([...raw.subarray(0, 5)]).toEqual([0, 200, 100, 50, 10]);
});
