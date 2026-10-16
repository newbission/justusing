/**
 * PDF 가리기(영구 삭제) E2E. 빌드 결과에서 돌린다 (playwright.config.ts 참고).
 *
 * 가린 글자가 결과 파일의 어느 스트림에도 남지 않는지, 가리지 않은 쪽은 글자가 그대로인지,
 * 쪽끼리 같이 쓰던 자원·링크를 타고 가린 쪽의 내용이 딸려 오지 않는지 확인한다.
 */
import { expect, test, type Page, type Request } from './test';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import {
  PDFDict,
  PDFDocument,
  PDFName,
  PDFNumber,
  PDFRawStream,
  StandardFonts,
  decodePDFRawStream,
} from '@cantoo/pdf-lib';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { expectLocalOnly } from './local-only';

const fixture = (name: string) => fileURLToPath(new URL(`../fixtures/${name}`, import.meta.url));

type Frame = ReturnType<Page['frameLocator']>;

async function openRedact(page: Page, file: string | { name: string; buffer: Buffer }) {
  await page.goto('/pdf/redact/');
  const frame = page.frameLocator('iframe[data-tool-frame]');
  await frame
    .locator('input[type=file]')
    .setInputFiles(
      typeof file === 'string' ? fixture(file) : { ...file, mimeType: 'application/pdf' },
    );
  await expect(frame.locator('.overlay')).toBeVisible();
  return frame;
}

/** 쪽 위의 비율 자리(0~1)를 화면 좌표로 */
async function at(frame: Frame, x: number, y: number) {
  const overlay = frame.locator('.overlay');
  await overlay.scrollIntoViewIfNeeded();
  const box = (await overlay.boundingBox())!;
  return { x: box.x + box.width * x, y: box.y + box.height * y };
}

async function download(page: Page, frame: Frame) {
  await frame.getByRole('button', { name: '가리고 저장' }).click();
  const event = page.waitForEvent('download');
  await frame.getByRole('button', { name: '다운로드' }).click();
  const file = await event;
  return {
    name: file.suggestedFilename(),
    bytes: new Uint8Array(await readFile(await file.path())),
  };
}

/** 결과 파일의 모든 스트림을 풀어 이어 붙인 글 (가린 글자가 어디에도 없는지 보려고) */
async function allStreams(bytes: Uint8Array) {
  const doc = await PDFDocument.load(bytes);
  let text = '';
  for (const [, object] of doc.context.enumerateIndirectObjects()) {
    if (!(object instanceof PDFRawStream)) continue;
    try {
      text += Buffer.from(decodePDFRawStream(object).decode()).toString('latin1');
    } catch {
      text += Buffer.from(object.contents).toString('latin1');
    }
  }
  return { doc, text };
}

async function pageTexts(bytes: Uint8Array) {
  const doc = await getDocument({ data: bytes.slice() }).promise;
  const texts = [];
  for (let n = 1; n <= doc.numPages; n++) {
    const content = await (await doc.getPage(n)).getTextContent();
    texts.push(content.items.map((item) => ('str' in item ? item.str : '')).join(''));
  }
  return texts;
}

test('찾거나 그려 가린 쪽의 글자는 파일에서 지워지고, 다른 쪽은 그대로다', async ({
  page,
  baseURL,
}) => {
  const requests: Request[] = [];
  page.on('request', (request) => requests.push(request));
  const frame = await openRedact(page, 'three-pages.pdf');
  requests.length = 0;
  await expect(frame.getByRole('button', { name: '가리고 저장' })).toBeDisabled();

  // 2쪽의 글자를 찾아 가리고, 1쪽은 직접 그려 가린다
  await frame.getByLabel('찾아서 가리기').fill('page 2');
  await frame.getByRole('button', { name: '모두 찾아 가리기' }).click();
  await expect(frame.getByText('1곳을 찾아 가렸습니다.')).toBeVisible();
  await frame.getByRole('button', { name: '이전 쪽' }).click();
  const a = await at(frame, 0.05, 0.05);
  const b = await at(frame, 0.95, 0.3);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move(b.x, b.y, { steps: 5 });
  await page.mouse.up();
  await expect(frame.getByText('가릴 곳 2개 (2쪽)')).toBeVisible();

  const { name, bytes } = await download(page, frame);
  expect(name).toBe('three-pages_가림.pdf');
  expect(await pageTexts(bytes)).toEqual(['', '', 'Page 3']);
  const { text } = await allStreams(bytes);
  expect(text).not.toContain('Page 1');
  expect(text).not.toContain('Page 2');
  expect(text).toContain('Page 3');
  expectLocalOnly(page, requests, baseURL!);
});

test('같이 쓰던 자원과 링크를 타고 가린 쪽의 내용이 딸려 오지 않는다', async ({ page }) => {
  // 두 쪽이 자원 목록 하나를 같이 쓴다: 1쪽만 쓰는 7×7 그림과 2쪽만 쓰는 9×9 그림.
  // 2쪽에는 1쪽으로 가는 링크가 있다
  const source = await PDFDocument.create();
  const context = source.context;
  const gray = (size: number) =>
    context.register(
      context.flateStream(new Uint8Array(size * size).fill(128), {
        Type: 'XObject',
        Subtype: 'Image',
        Width: size,
        Height: size,
        ColorSpace: 'DeviceGray',
        BitsPerComponent: 8,
      }),
    );
  const shared = { Secret: gray(7), Public: gray(9) };
  // 2쪽은 묶음 그림(Form)으로 Public만 그리지만, 묶음 그림의 자원 목록에도 Secret이 들어 있다
  const wrap = context.register(
    context.stream('q 100 0 0 100 50 50 cm /Public Do Q', {
      Type: 'XObject',
      Subtype: 'Form',
      BBox: [0, 0, 200, 200],
      Resources: { XObject: shared },
    }),
  );
  const resources = context.register(context.obj({ XObject: { ...shared, Wrap: wrap } }));
  const first = source.addPage([200, 200]);
  const second = source.addPage([200, 200]);
  for (const [added, draw] of [
    [first, 'q 100 0 0 100 50 50 cm /Secret Do Q'],
    [second, '/Wrap Do'],
  ] as const) {
    added.node.set(PDFName.of('Resources'), resources);
    added.node.set(PDFName.of('Contents'), context.register(context.stream(draw)));
  }
  const link = context.register(
    context.obj({
      Type: 'Annot',
      Subtype: 'Link',
      F: 4,
      Rect: [10, 10, 60, 30],
      Border: [0, 0, 0],
      Dest: [first.ref, 'Fit'],
    }),
  );
  second.node.set(PDFName.of('Annots'), context.obj([link]));
  // 2쪽에 딸린 첨부 파일 (PDF 2.0 /AF)
  const attached = context.register(
    context.obj({
      Type: 'Filespec',
      F: 'secret.txt',
      EF: { F: context.register(context.stream('SECRET-ATTACHMENT', { Type: 'EmbeddedFile' })) },
    }),
  );
  second.node.set(PDFName.of('AF'), context.obj([attached]));

  const frame = await openRedact(page, {
    name: 'shared.pdf',
    buffer: Buffer.from(await source.save()),
  });
  await frame.getByRole('button', { name: '가운데에 상자 넣기' }).click();
  await expect(frame.getByText('가릴 곳 1개 (1쪽)')).toBeVisible();

  const { doc, text } = await allStreams((await download(page, frame)).bytes);
  expect(text).not.toContain('SECRET-ATTACHMENT');
  const sizes = [...doc.context.enumerateIndirectObjects()]
    .map(([, object]) => object)
    .filter((object): object is PDFRawStream => object instanceof PDFRawStream)
    .filter((object) => object.dict.get(PDFName.of('Subtype')) === PDFName.of('Image'))
    .map((object) => (object.dict.get(PDFName.of('Width')) as PDFNumber).asNumber());
  // 1쪽은 가린 그림 한 장으로 바뀌고, 1쪽만 쓰던 7×7 그림은 딸려 오지 않는다
  expect(sizes).toContain(9);
  expect(sizes).not.toContain(7);
  expect(doc.getPageCount()).toBe(2);
  expect(doc.getPage(1).node.get(PDFName.of('Annots'))).toBeUndefined();
});

test('키보드로 상자를 넣고 옮기고 지운다', async ({ page }) => {
  const frame = await openRedact(page, 'three-pages.pdf');
  await frame.getByRole('button', { name: '가운데에 상자 넣기' }).focus();
  await page.keyboard.press('Enter');
  const box = frame.getByRole('button', { name: '가릴 곳 1' });
  await expect(box).toBeFocused();
  const before = (await box.boundingBox())!;
  await page.keyboard.press('Alt+ArrowRight');
  await page.keyboard.press('Shift+ArrowUp');
  const after = (await box.boundingBox())!;
  expect(after.width).toBeGreaterThan(before.width);
  expect(after.y).toBeLessThan(before.y);
  await page.keyboard.press('Delete');
  await expect(frame.getByText('가릴 곳 0개 (0쪽)')).toBeVisible();
});

test('폭이 다른 글자가 섞인 줄에서도 찾은 말을 실제 글자 자리대로 덮는다', async ({ page }) => {
  // 좁은 i와 넓은 W 사이의 SECRET (한 글자 조각으로 들어간다)
  const source = await PDFDocument.create();
  const font = await source.embedFont(StandardFonts.Helvetica);
  const line = 'iiiiiiiiiiiiSECRETWWWWWWWWWWWW';
  const size = 12;
  source.addPage([400, 200]).drawText(line, { x: 20, y: 100, size, font });
  const frame = await openRedact(page, {
    name: 'mixed.pdf',
    buffer: Buffer.from(await source.save()),
  });
  await frame.getByLabel('찾아서 가리기').fill('secret');
  await frame.getByRole('button', { name: '모두 찾아 가리기' }).click();
  await expect(frame.getByText('1곳을 찾아 가렸습니다.')).toBeVisible();

  const box = await frame
    .locator('.box')
    .first()
    .evaluate((element: HTMLElement) => ({
      left: parseFloat(element.style.left) / 100,
      width: parseFloat(element.style.width) / 100,
    }));
  const start = (20 + font.widthOfTextAtSize(line.slice(0, 12), size)) / 400;
  const end = (20 + font.widthOfTextAtSize(line.slice(0, 18), size)) / 400;
  expect(box.left).toBeLessThanOrEqual(start);
  expect(box.left + box.width).toBeGreaterThanOrEqual(end);
  // 줄 전체를 덮지는 않는다
  expect(box.width).toBeLessThan((end - start) * 3);
});

test('가리는 쪽에만 있는 모양 없는 한글 입력 칸은 막지 않는다', async ({ page }) => {
  const source = await PDFDocument.create();
  const first = source.addPage([300, 200]);
  source.addPage([300, 200]);
  const field = source.getForm().createTextField('name');
  field.addToPage(first, { x: 20, y: 80, width: 200, height: 30 });
  field.setText('홍길동');
  for (const widget of field.acroField.getWidgets()) widget.dict.delete(PDFName.of('AP'));
  const frame = await openRedact(page, {
    name: 'form.pdf',
    buffer: Buffer.from(await source.save({ updateFieldAppearances: false })),
  });
  // 1쪽(입력 칸이 있는 쪽)을 가린다
  await frame.getByRole('button', { name: '가운데에 상자 넣기' }).click();
  await frame.getByRole('button', { name: '가리고 저장' }).click();
  await expect(frame.getByRole('button', { name: '다운로드' })).toBeVisible();
});

test('가리지 않은 쪽들이 같이 쓰는 그림은 결과에 한 번만 들어간다', async ({ page }) => {
  const source = await PDFDocument.create();
  const context = source.context;
  const logo = context.register(
    context.flateStream(new Uint8Array(150 * 150).fill(200), {
      Type: 'XObject',
      Subtype: 'Image',
      Width: 150,
      Height: 150,
      ColorSpace: 'DeviceGray',
      BitsPerComponent: 8,
    }),
  );
  const resources = context.register(context.obj({ XObject: { Logo: logo } }));
  for (let i = 0; i < 4; i++) {
    const added = source.addPage([200, 200]);
    added.node.set(PDFName.of('Resources'), resources);
    added.node.set(
      PDFName.of('Contents'),
      context.register(context.stream('q 50 0 0 50 10 10 cm /Logo Do Q')),
    );
  }
  const frame = await openRedact(page, {
    name: 'logo.pdf',
    buffer: Buffer.from(await source.save()),
  });
  await frame.getByRole('button', { name: '가운데에 상자 넣기' }).click();
  const { doc } = await allStreams((await download(page, frame)).bytes);
  const logos = [...doc.context.enumerateIndirectObjects()]
    .map(([, object]) => object)
    .filter((object): object is PDFRawStream => object instanceof PDFRawStream)
    .filter(
      (object) =>
        (object.dict.get(PDFName.of('Width')) as PDFNumber | undefined)?.asNumber() === 150,
    );
  expect(logos).toHaveLength(1);
});

/** 7×7 회색 그림 (가린 쪽에서만 쓰는 비밀 그림 흉내) */
function secretImage(context: PDFDocument['context']) {
  return context.register(
    context.flateStream(new Uint8Array(49).fill(9), {
      Type: 'XObject',
      Subtype: 'Image',
      Width: 7,
      Height: 7,
      ColorSpace: 'DeviceGray',
      BitsPerComponent: 8,
    }),
  );
}

/** 결과에 남은 그림들의 가로 크기 */
async function imageWidths(bytes: Uint8Array) {
  const { doc } = await allStreams(bytes);
  return [...doc.context.enumerateIndirectObjects()]
    .map(([, object]) => object)
    .filter((object): object is PDFRawStream => object instanceof PDFRawStream)
    .filter((object) => object.dict.get(PDFName.of('Subtype')) === PDFName.of('Image'))
    .map((object) => (object.dict.get(PDFName.of('Width')) as PDFNumber).asNumber());
}

test('글꼴과 그림이 같은 이름이어도 쓰는 종류만 남긴다', async ({ page }) => {
  // 같은 자원 목록에 글꼴 /F1과 그림 /F1. 1쪽은 그림 F1을, 2쪽은 글꼴 F1만 쓴다
  const source = await PDFDocument.create();
  const context = source.context;
  const font = await source.embedFont(StandardFonts.Helvetica);
  const resources = context.register(
    context.obj({ Font: { F1: font.ref }, XObject: { F1: secretImage(context) } }),
  );
  const first = source.addPage([200, 200]);
  const second = source.addPage([200, 200]);
  for (const [added, draw] of [
    [first, 'q 50 0 0 50 10 10 cm /F1 Do Q'],
    [second, 'BT /F1 12 Tf 20 100 Td (Hello) Tj ET'],
  ] as const) {
    added.node.set(PDFName.of('Resources'), resources);
    added.node.set(PDFName.of('Contents'), context.register(context.stream(draw)));
  }
  const frame = await openRedact(page, {
    name: 'names.pdf',
    buffer: Buffer.from(await source.save()),
  });
  await frame.getByRole('button', { name: '가운데에 상자 넣기' }).click();
  const { bytes } = await download(page, frame);
  expect(await imageWidths(bytes)).not.toContain(7);
  expect(await pageTexts(bytes)).toEqual(['', 'Hello']);
});

test('같이 쓰는 Type3 글꼴은 남길 쪽에서 찍은 글자 모양만 남긴다', async ({ page }) => {
  // Type3 글꼴: 글자 a는 사각형, 글자 b는 비밀 그림을 그린다. 1쪽(가림)은 b, 2쪽은 a를 찍는다
  const source = await PDFDocument.create();
  const context = source.context;
  const glyphA = context.register(context.stream('500 0 d0 0 0 400 400 re f'));
  const glyphB = context.register(context.stream('500 0 d0 q 400 0 0 400 0 0 cm /Secret Do Q'));
  const type3 = context.register(
    context.obj({
      Type: 'Font',
      Subtype: 'Type3',
      FontBBox: [0, 0, 500, 500],
      FontMatrix: [0.001, 0, 0, 0.001, 0, 0],
      CharProcs: { a: glyphA, b: glyphB },
      Encoding: { Type: 'Encoding', Differences: [97, 'a', 'b'] },
      FirstChar: 97,
      LastChar: 98,
      Widths: [500, 500],
      Resources: { XObject: { Secret: secretImage(context) } },
    }),
  );
  const resources = context.register(context.obj({ Font: { T3: type3 } }));
  const first = source.addPage([200, 200]);
  const second = source.addPage([200, 200]);
  for (const [added, letter] of [
    [first, 'b'],
    [second, 'a'],
  ] as const) {
    added.node.set(PDFName.of('Resources'), resources);
    added.node.set(
      PDFName.of('Contents'),
      context.register(context.stream(`BT /T3 40 Tf 20 100 Td (${letter}) Tj ET`)),
    );
  }
  const frame = await openRedact(page, {
    name: 'type3.pdf',
    buffer: Buffer.from(await source.save()),
  });
  await frame.getByRole('button', { name: '가운데에 상자 넣기' }).click();
  const { bytes } = await download(page, frame);
  expect(await imageWidths(bytes)).not.toContain(7);
});

test('내용 스트림이 나뉘어도 앞 스트림에서 고른 Type3 글꼴의 글자 모양을 남긴다', async ({
  page,
}) => {
  // 2쪽은 글꼴을 고르는 스트림과 글자를 찍는 스트림이 나뉘어 있다
  const source = await PDFDocument.create();
  const context = source.context;
  const glyph = context.register(context.stream('500 0 d0 0 0 400 400 re f'));
  const type3 = context.register(
    context.obj({
      Type: 'Font',
      Subtype: 'Type3',
      FontBBox: [0, 0, 500, 500],
      FontMatrix: [0.001, 0, 0, 0.001, 0, 0],
      CharProcs: { a: glyph },
      Encoding: { Type: 'Encoding', Differences: [97, 'a'] },
      FirstChar: 97,
      LastChar: 97,
      Widths: [500],
    }),
  );
  source.addPage([200, 200]);
  const second = source.addPage([200, 200]);
  second.node.set(PDFName.of('Resources'), context.obj({ Font: { T3: type3 } }));
  second.node.set(
    PDFName.of('Contents'),
    context.obj([
      context.register(context.stream('BT /T3 40 Tf 20 100 Td')),
      context.register(context.stream('(a) Tj ET')),
    ]),
  );
  const frame = await openRedact(page, {
    name: 'split.pdf',
    buffer: Buffer.from(await source.save()),
  });
  await frame.getByRole('button', { name: '가운데에 상자 넣기' }).click();
  const { bytes } = await download(page, frame);
  const result = await PDFDocument.load(bytes);
  const fonts = result.getPage(1).node.Resources()!.lookup(PDFName.of('Font'), PDFDict);
  const kept = fonts.lookup(PDFName.of('T3'), PDFDict);
  expect(kept.lookup(PDFName.of('CharProcs'), PDFDict).has(PDFName.of('a'))).toBe(true);
});

test('이름으로 부르지 않아도 저절로 쓰이는 기본 색공간은 남긴다', async ({ page }) => {
  const source = await PDFDocument.create();
  const context = source.context;
  source.addPage([200, 200]);
  const second = source.addPage([200, 200]);
  second.node.set(
    PDFName.of('Resources'),
    context.obj({ ColorSpace: { DefaultRGB: ['CalRGB', { WhitePoint: [0.9505, 1, 1.089] }] } }),
  );
  second.node.set(
    PDFName.of('Contents'),
    context.register(context.stream('1 0 0 rg 20 20 100 100 re f')),
  );
  const frame = await openRedact(page, {
    name: 'default-rgb.pdf',
    buffer: Buffer.from(await source.save()),
  });
  await frame.getByRole('button', { name: '가운데에 상자 넣기' }).click();
  const { bytes } = await download(page, frame);
  const result = await PDFDocument.load(bytes);
  const spaces = result.getPage(1).node.Resources()!.lookup(PDFName.of('ColorSpace'), PDFDict);
  expect(spaces.has(PDFName.of('DefaultRGB'))).toBe(true);
});
