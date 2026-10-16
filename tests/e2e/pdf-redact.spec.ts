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
  PDFArray,
  PDFDict,
  PDFHexString,
  PDFDocument,
  PDFName,
  PDFNumber,
  PDFRawStream,
  PDFRef,
  PDFString,
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

test('소문자로 바꾸면 길어지는 글자 뒤의 말도 실제 글자 자리대로 덮는다', async ({ page }) => {
  // I를 İ(소문자로 바꾸면 두 자리가 된다)로 읽게 하는 ToUnicode를 붙인 Helvetica
  const source = await PDFDocument.create();
  const context = source.context;
  const helvetica = await source.embedFont(StandardFonts.Helvetica);
  const cmap = context.register(
    context.stream(
      [
        '/CIDInit /ProcSet findresource begin 12 dict begin begincmap',
        '/CIDSystemInfo << /Registry (Adobe) /Ordering (UCS) /Supplement 0 >> def',
        '/CMapName /Adobe-Identity-UCS def /CMapType 2 def',
        '1 begincodespacerange <00> <FF> endcodespacerange',
        '1 beginbfchar <49> <0130> endbfchar',
        '2 beginbfrange <20> <48> <0020> <4A> <7E> <004A> endbfrange',
        'endcmap CMapName currentdict /CMap defineresource pop end end',
      ].join('\n'),
    ),
  );
  const font = context.obj({
    Type: 'Font',
    Subtype: 'Type1',
    BaseFont: 'Helvetica',
    Encoding: 'WinAnsiEncoding',
    ToUnicode: cmap,
  });
  const line = 'IIIIIIIIIIIISECRETWWWWWWWWWWWW';
  const size = 12;
  const added = source.addPage([400, 200]);
  added.node.set(PDFName.of('Resources'), context.obj({ Font: { F1: font } }));
  added.node.set(
    PDFName.of('Contents'),
    context.register(context.stream(`BT /F1 ${size} Tf 20 100 Td (${line}) Tj ET`)),
  );
  const frame = await openRedact(page, {
    name: 'dotted-i.pdf',
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
  const start = (20 + helvetica.widthOfTextAtSize(line.slice(0, 12), size)) / 400;
  const end = (20 + helvetica.widthOfTextAtSize(line.slice(0, 18), size)) / 400;
  expect(box.left).toBeLessThanOrEqual(start);
  expect(box.left + box.width).toBeGreaterThanOrEqual(end);
});

test('기본 인코딩으로 찍은 Type3 글자 모양도 남긴다', async ({ page }) => {
  // /Differences는 b만 바꾸고, a(97)는 기본 인코딩을 따른다. 2쪽(남김)이 a를 찍는다
  const source = await PDFDocument.create();
  const context = source.context;
  const type3 = context.register(
    context.obj({
      Type: 'Font',
      Subtype: 'Type3',
      FontBBox: [0, 0, 500, 500],
      FontMatrix: [0.001, 0, 0, 0.001, 0, 0],
      CharProcs: {
        a: context.register(context.stream('500 0 d0 0 0 400 400 re f')),
        b: context.register(context.stream('500 0 d0 0 0 200 200 re f')),
      },
      Encoding: { Type: 'Encoding', BaseEncoding: 'WinAnsiEncoding', Differences: [98, 'b'] },
      FirstChar: 97,
      LastChar: 98,
      Widths: [500, 500],
    }),
  );
  source.addPage([200, 200]);
  const second = source.addPage([200, 200]);
  second.node.set(PDFName.of('Resources'), context.obj({ Font: { T3: type3 } }));
  second.node.set(
    PDFName.of('Contents'),
    context.register(context.stream('BT /T3 40 Tf 20 100 Td (a) Tj ET')),
  );
  const frame = await openRedact(page, {
    name: 'base-encoding.pdf',
    buffer: Buffer.from(await source.save()),
  });
  await frame.getByRole('button', { name: '가운데에 상자 넣기' }).click();
  const { bytes } = await download(page, frame);
  const result = await PDFDocument.load(bytes);
  const fonts = result.getPage(1).node.Resources()!.lookup(PDFName.of('Font'), PDFDict);
  const kept = fonts.lookup(PDFName.of('T3'), PDFDict);
  expect(kept.lookup(PDFName.of('CharProcs'), PDFDict).has(PDFName.of('a'))).toBe(true);
});

test('자원 목록 없이 쪽 자원을 물려받는 묶음 그림이 쓰는 그림을 남긴다', async ({ page }) => {
  const source = await PDFDocument.create();
  const context = source.context;
  const form = context.register(
    context.stream('q 50 0 0 50 0 0 cm /Pic Do Q', {
      Type: 'XObject',
      Subtype: 'Form',
      BBox: [0, 0, 200, 200],
    }),
  );
  source.addPage([200, 200]);
  const second = source.addPage([200, 200]);
  second.node.set(
    PDFName.of('Resources'),
    context.obj({ XObject: { Fm: form, Pic: secretImage(context) } }),
  );
  second.node.set(PDFName.of('Contents'), context.register(context.stream('/Fm Do')));
  const frame = await openRedact(page, {
    name: 'inherited.pdf',
    buffer: Buffer.from(await source.save()),
  });
  await frame.getByRole('button', { name: '가운데에 상자 넣기' }).click();
  const { bytes } = await download(page, frame);
  expect(await imageWidths(bytes)).toContain(7);
});

test('오른쪽에서 왼쪽으로 쓰는 글자가 섞인 조각은 조각 전체를 가린다', async ({ page }) => {
  // I를 히브리 글자 א로 읽게 하는 ToUnicode를 붙인 Helvetica
  const source = await PDFDocument.create();
  const context = source.context;
  const helvetica = await source.embedFont(StandardFonts.Helvetica);
  const cmap = context.register(
    context.stream(
      [
        '/CIDInit /ProcSet findresource begin 12 dict begin begincmap',
        '/CIDSystemInfo << /Registry (Adobe) /Ordering (UCS) /Supplement 0 >> def',
        '/CMapName /Adobe-Identity-UCS def /CMapType 2 def',
        '1 begincodespacerange <00> <FF> endcodespacerange',
        '1 beginbfchar <49> <05D0> endbfchar',
        '2 beginbfrange <20> <48> <0020> <4A> <7E> <004A> endbfrange',
        'endcmap CMapName currentdict /CMap defineresource pop end end',
      ].join('\n'),
    ),
  );
  const font = context.obj({
    Type: 'Font',
    Subtype: 'Type1',
    BaseFont: 'Helvetica',
    Encoding: 'WinAnsiEncoding',
    ToUnicode: cmap,
  });
  const line = 'IIIIIIIIIIIISECRETWWWWWWWWWWWW';
  const size = 12;
  const added = source.addPage([400, 200]);
  added.node.set(PDFName.of('Resources'), context.obj({ Font: { F1: font } }));
  added.node.set(
    PDFName.of('Contents'),
    context.register(context.stream(`BT /F1 ${size} Tf 20 100 Td (${line}) Tj ET`)),
  );
  const frame = await openRedact(page, {
    name: 'rtl.pdf',
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
  const end = (20 + helvetica.widthOfTextAtSize(line, size)) / 400;
  expect(box.left).toBeLessThanOrEqual(20 / 400 + 0.001);
  expect(box.left + box.width).toBeGreaterThanOrEqual(end - 0.001);
});

test('남긴 그림에 붙은 첨부 파일과 사전 안의 이름은 옮기지 않는다', async ({ page }) => {
  // 2쪽 그림에 첨부 파일(/AF)이 붙어 있고, 쪽 자원의 Properties /Pagination은 비밀 그림을 가리킨다.
  // 내용은 /Artifact << /Type /Pagination >> BDC 로 사전 안에서만 그 이름을 쓴다
  const source = await PDFDocument.create();
  const context = source.context;
  const attached = context.register(
    context.stream('ATTACHED-SECRET-NOTE', { Type: 'EmbeddedFile' }),
  );
  const picture = context.register(
    context.flateStream(new Uint8Array(81).fill(9), {
      Type: 'XObject',
      Subtype: 'Image',
      Width: 9,
      Height: 9,
      ColorSpace: 'DeviceGray',
      BitsPerComponent: 8,
      AF: [
        context.obj({
          Type: 'Filespec',
          F: PDFHexString.fromText('note.txt'),
          EF: { F: attached },
        }),
      ],
    }),
  );
  source.addPage([200, 200]);
  const second = source.addPage([200, 200]);
  second.node.set(
    PDFName.of('Resources'),
    context.obj({
      XObject: { Pic: picture },
      Properties: { Pagination: context.obj({ Leak: secretImage(context) }) },
    }),
  );
  second.node.set(
    PDFName.of('Contents'),
    context.register(
      context.stream('/Artifact << /Type /Pagination >> BDC EMC q 50 0 0 50 10 10 cm /Pic Do Q'),
    ),
  );
  const frame = await openRedact(page, {
    name: 'attached.pdf',
    buffer: Buffer.from(await source.save()),
  });
  await frame.getByRole('button', { name: '가운데에 상자 넣기' }).click();
  const { bytes } = await download(page, frame);
  const { text } = await allStreams(bytes);
  expect(text).not.toContain('ATTACHED-SECRET-NOTE');
  const widths = await imageWidths(bytes);
  expect(widths).toContain(9);
  expect(widths).not.toContain(7);
});

test('물려받는 묶음 그림은 부른 자리의 글꼴로 찍은 Type3 글자 모양을 남긴다', async ({ page }) => {
  // 쪽이 T3을 고르고 묶음 그림을 부른 뒤 F2로 바꾼다. 묶음 그림은 Tf 없이 a를 찍는다
  const source = await PDFDocument.create();
  const context = source.context;
  const helvetica = await source.embedFont(StandardFonts.Helvetica);
  const type3 = context.register(
    context.obj({
      Type: 'Font',
      Subtype: 'Type3',
      FontBBox: [0, 0, 500, 500],
      FontMatrix: [0.001, 0, 0, 0.001, 0, 0],
      CharProcs: { a: context.register(context.stream('500 0 d0 0 0 400 400 re f')) },
      Encoding: { Type: 'Encoding', Differences: [97, 'a'] },
      FirstChar: 97,
      LastChar: 97,
      Widths: [500],
    }),
  );
  const form = context.register(
    context.stream('BT 20 100 Td (a) Tj ET', {
      Type: 'XObject',
      Subtype: 'Form',
      BBox: [0, 0, 200, 200],
    }),
  );
  source.addPage([200, 200]);
  const second = source.addPage([200, 200]);
  second.node.set(
    PDFName.of('Resources'),
    context.obj({ Font: { T3: type3, F2: helvetica.ref }, XObject: { Fm: form } }),
  );
  second.node.set(
    PDFName.of('Contents'),
    context.register(context.stream('BT /T3 40 Tf ET /Fm Do BT /F2 12 Tf ET')),
  );
  const frame = await openRedact(page, {
    name: 'inherited-font.pdf',
    buffer: Buffer.from(await source.save()),
  });
  await frame.getByRole('button', { name: '가운데에 상자 넣기' }).click();
  const { bytes } = await download(page, frame);
  const result = await PDFDocument.load(bytes);
  const fonts = result.getPage(1).node.Resources()!.lookup(PDFName.of('Font'), PDFDict);
  const kept = fonts.lookup(PDFName.of('T3'), PDFDict);
  expect(kept.lookup(PDFName.of('CharProcs'), PDFDict).has(PDFName.of('a'))).toBe(true);
});

test('남긴 그림에 붙은 XMP 설명은 옮기지 않는다', async ({ page }) => {
  const source = await PDFDocument.create();
  const context = source.context;
  const picture = context.register(
    context.flateStream(new Uint8Array(81).fill(9), {
      Type: 'XObject',
      Subtype: 'Image',
      Width: 9,
      Height: 9,
      ColorSpace: 'DeviceGray',
      BitsPerComponent: 8,
      Metadata: context.register(
        context.stream('<x:xmpmeta>IMAGE-XMP-SECRET</x:xmpmeta>', {
          Type: 'Metadata',
          Subtype: 'XML',
        }),
      ),
    }),
  );
  source.addPage([200, 200]);
  const second = source.addPage([200, 200]);
  second.node.set(PDFName.of('Resources'), context.obj({ XObject: { Pic: picture } }));
  second.node.set(
    PDFName.of('Contents'),
    context.register(context.stream('q 50 0 0 50 10 10 cm /Pic Do Q')),
  );
  const frame = await openRedact(page, {
    name: 'image-xmp.pdf',
    buffer: Buffer.from(await source.save()),
  });
  await frame.getByRole('button', { name: '가운데에 상자 넣기' }).click();
  const { bytes } = await download(page, frame);
  const { text } = await allStreams(bytes);
  expect(text).not.toContain('IMAGE-XMP-SECRET');
  expect(await imageWidths(bytes)).toContain(9);
});

test('자기 자원 목록이 있는 묶음 그림도 물려받은 Type3 글꼴로 찍은 글자 모양을 남긴다', async ({
  page,
}) => {
  const source = await PDFDocument.create();
  const context = source.context;
  const type3 = context.register(
    context.obj({
      Type: 'Font',
      Subtype: 'Type3',
      FontBBox: [0, 0, 500, 500],
      FontMatrix: [0.001, 0, 0, 0.001, 0, 0],
      CharProcs: { a: context.register(context.stream('500 0 d0 0 0 400 400 re f')) },
      Encoding: { Type: 'Encoding', Differences: [97, 'a'] },
      FirstChar: 97,
      LastChar: 97,
      Widths: [500],
    }),
  );
  const form = context.register(
    context.stream('BT 20 100 Td (a) Tj ET', {
      Type: 'XObject',
      Subtype: 'Form',
      BBox: [0, 0, 200, 200],
      Resources: {},
    }),
  );
  source.addPage([200, 200]);
  const second = source.addPage([200, 200]);
  second.node.set(
    PDFName.of('Resources'),
    context.obj({ Font: { T3: type3 }, XObject: { Fm: form } }),
  );
  second.node.set(
    PDFName.of('Contents'),
    context.register(context.stream('BT /T3 40 Tf ET /Fm Do')),
  );
  const frame = await openRedact(page, {
    name: 'own-resources.pdf',
    buffer: Buffer.from(await source.save()),
  });
  await frame.getByRole('button', { name: '가운데에 상자 넣기' }).click();
  const { bytes } = await download(page, frame);
  const result = await PDFDocument.load(bytes);
  const fonts = result.getPage(1).node.Resources()!.lookup(PDFName.of('Font'), PDFDict);
  const kept = fonts.lookup(PDFName.of('T3'), PDFDict);
  expect(kept.lookup(PDFName.of('CharProcs'), PDFDict).has(PDFName.of('a'))).toBe(true);
});

test('남긴 그림의 대체 그림(/Alternates)은 옮기지 않는다', async ({ page }) => {
  const source = await PDFDocument.create();
  const context = source.context;
  const picture = context.register(
    context.flateStream(new Uint8Array(81).fill(9), {
      Type: 'XObject',
      Subtype: 'Image',
      Width: 9,
      Height: 9,
      ColorSpace: 'DeviceGray',
      BitsPerComponent: 8,
      Alternates: [{ Image: secretImage(context) }],
    }),
  );
  source.addPage([200, 200]);
  const second = source.addPage([200, 200]);
  second.node.set(PDFName.of('Resources'), context.obj({ XObject: { Pic: picture } }));
  second.node.set(
    PDFName.of('Contents'),
    context.register(context.stream('q 50 0 0 50 10 10 cm /Pic Do Q')),
  );
  const frame = await openRedact(page, {
    name: 'alternates.pdf',
    buffer: Buffer.from(await source.save()),
  });
  await frame.getByRole('button', { name: '가운데에 상자 넣기' }).click();
  const { bytes } = await download(page, frame);
  const widths = await imageWidths(bytes);
  expect(widths).toContain(9);
  expect(widths).not.toContain(7);
});

test('남긴 그림이 이름으로 부르는 색공간을 남긴다', async ({ page }) => {
  const source = await PDFDocument.create();
  const context = source.context;
  const picture = context.register(
    context.flateStream(new Uint8Array(81 * 3).fill(9), {
      Type: 'XObject',
      Subtype: 'Image',
      Width: 9,
      Height: 9,
      ColorSpace: 'CS1',
      BitsPerComponent: 8,
    }),
  );
  source.addPage([200, 200]);
  const second = source.addPage([200, 200]);
  second.node.set(
    PDFName.of('Resources'),
    context.obj({
      XObject: { Pic: picture },
      ColorSpace: { CS1: ['CalRGB', { WhitePoint: [0.9505, 1, 1.089] }] },
    }),
  );
  second.node.set(
    PDFName.of('Contents'),
    context.register(context.stream('q 50 0 0 50 10 10 cm /Pic Do Q')),
  );
  const frame = await openRedact(page, {
    name: 'named-space.pdf',
    buffer: Buffer.from(await source.save()),
  });
  await frame.getByRole('button', { name: '가운데에 상자 넣기' }).click();
  const { bytes } = await download(page, frame);
  const result = await PDFDocument.load(bytes);
  const spaces = result.getPage(1).node.Resources()!.lookup(PDFName.of('ColorSpace'), PDFDict);
  expect(spaces.has(PDFName.of('CS1'))).toBe(true);
});

test('자원이 있는 묶음 그림 안에서 다시 부른 묶음 그림이 물려받은 Type3 글꼴로 찍은 글자 모양을 남긴다', async ({
  page,
}) => {
  const source = await PDFDocument.create();
  const context = source.context;
  const type3 = context.register(
    context.obj({
      Type: 'Font',
      Subtype: 'Type3',
      FontBBox: [0, 0, 500, 500],
      FontMatrix: [0.001, 0, 0, 0.001, 0, 0],
      CharProcs: { a: context.register(context.stream('500 0 d0 0 0 400 400 re f')) },
      Encoding: { Type: 'Encoding', Differences: [97, 'a'] },
      FirstChar: 97,
      LastChar: 97,
      Widths: [500],
    }),
  );
  const inner = context.register(
    context.stream('BT 20 100 Td (a) Tj ET', {
      Type: 'XObject',
      Subtype: 'Form',
      BBox: [0, 0, 200, 200],
      Resources: {},
    }),
  );
  const outer = context.register(
    context.stream('/B Do', {
      Type: 'XObject',
      Subtype: 'Form',
      BBox: [0, 0, 200, 200],
      Resources: { XObject: { B: inner } },
    }),
  );
  source.addPage([200, 200]);
  const second = source.addPage([200, 200]);
  second.node.set(
    PDFName.of('Resources'),
    context.obj({ Font: { T3: type3 }, XObject: { A: outer } }),
  );
  second.node.set(
    PDFName.of('Contents'),
    context.register(context.stream('BT /T3 40 Tf ET /A Do')),
  );
  const frame = await openRedact(page, {
    name: 'nested-forms.pdf',
    buffer: Buffer.from(await source.save()),
  });
  await frame.getByRole('button', { name: '가운데에 상자 넣기' }).click();
  const { bytes } = await download(page, frame);
  const result = await PDFDocument.load(bytes);
  const fonts = result.getPage(1).node.Resources()!.lookup(PDFName.of('Font'), PDFDict);
  const kept = fonts.lookup(PDFName.of('T3'), PDFDict);
  expect(kept.lookup(PDFName.of('CharProcs'), PDFDict).has(PDFName.of('a'))).toBe(true);
});

test('그래픽 상태(gs)로 고른 Type3 글꼴도 남길 쪽에서 찍은 글자 모양만 남긴다', async ({
  page,
}) => {
  // 1쪽(가림)은 글꼴 자원으로 b(비밀 그림)를, 2쪽은 /GS1 gs의 /Font로 같은 글꼴을 골라 a를 찍는다
  const source = await PDFDocument.create();
  const context = source.context;
  const type3 = context.register(
    context.obj({
      Type: 'Font',
      Subtype: 'Type3',
      FontBBox: [0, 0, 500, 500],
      FontMatrix: [0.001, 0, 0, 0.001, 0, 0],
      CharProcs: {
        a: context.register(context.stream('500 0 d0 0 0 400 400 re f')),
        b: context.register(context.stream('500 0 d0 q 400 0 0 400 0 0 cm /Secret Do Q')),
      },
      Encoding: { Type: 'Encoding', Differences: [97, 'a', 'b'] },
      FirstChar: 97,
      LastChar: 98,
      Widths: [500, 500],
      Resources: { XObject: { Secret: secretImage(context) } },
    }),
  );
  const resources = context.register(
    context.obj({ Font: { T3: type3 }, ExtGState: { GS1: { Font: [type3, 40] } } }),
  );
  const first = source.addPage([200, 200]);
  const second = source.addPage([200, 200]);
  for (const [added, draw] of [
    [first, 'BT /T3 40 Tf 20 100 Td (b) Tj ET'],
    [second, 'BT /GS1 gs 20 100 Td (a) Tj ET'],
  ] as const) {
    added.node.set(PDFName.of('Resources'), resources);
    added.node.set(PDFName.of('Contents'), context.register(context.stream(draw)));
  }
  const frame = await openRedact(page, {
    name: 'gs-font.pdf',
    buffer: Buffer.from(await source.save()),
  });
  await frame.getByRole('button', { name: '가운데에 상자 넣기' }).click();
  const { bytes } = await download(page, frame);
  expect(await imageWidths(bytes)).not.toContain(7);
  const result = await PDFDocument.load(bytes);
  const states = result.getPage(1).node.Resources()!.lookup(PDFName.of('ExtGState'), PDFDict);
  const font = states.lookup(PDFName.of('GS1'), PDFDict).lookup(PDFName.of('Font'), PDFArray);
  const procs = (result.context.lookup(font.get(0)) as PDFDict).lookup(
    PDFName.of('CharProcs'),
    PDFDict,
  );
  expect(procs.has(PDFName.of('a'))).toBe(true);
  expect(procs.has(PDFName.of('b'))).toBe(false);
});

test('색공간 배열 안에서 이름으로 부르는 색공간과, 깊이 겹친 묶음 그림이 쓰는 그림을 남긴다', async ({
  page,
}) => {
  const source = await PDFDocument.create();
  const context = source.context;
  const indexed = context.register(
    context.flateStream(new Uint8Array(81).fill(0), {
      Type: 'XObject',
      Subtype: 'Image',
      Width: 9,
      Height: 9,
      ColorSpace: ['Indexed', 'CS1', 0, PDFHexString.of('FF0000')],
      BitsPerComponent: 8,
    }),
  );
  // 자원 목록 없이 바깥 자원을 물려받는 묶음 그림 14겹, 가장 안쪽에서만 /Pic Do
  let form = context.register(
    context.stream('q 50 0 0 50 10 10 cm /Pic Do Q', {
      Type: 'XObject',
      Subtype: 'Form',
      BBox: [0, 0, 200, 200],
    }),
  );
  const xobjects: Record<string, PDFRef> = { Pic: indexed, F0: form };
  for (let depth = 1; depth < 14; depth++) {
    form = context.register(
      context.stream(`/F${depth - 1} Do`, {
        Type: 'XObject',
        Subtype: 'Form',
        BBox: [0, 0, 200, 200],
      }),
    );
    xobjects[`F${depth}`] = form;
  }
  source.addPage([200, 200]);
  const second = source.addPage([200, 200]);
  second.node.set(
    PDFName.of('Resources'),
    context.obj({
      XObject: xobjects,
      ColorSpace: { CS1: ['CalRGB', { WhitePoint: [0.9505, 1, 1.089] }] },
    }),
  );
  second.node.set(PDFName.of('Contents'), context.register(context.stream('/F13 Do')));
  const frame = await openRedact(page, {
    name: 'deep.pdf',
    buffer: Buffer.from(await source.save()),
  });
  await frame.getByRole('button', { name: '가운데에 상자 넣기' }).click();
  const { bytes } = await download(page, frame);
  expect(await imageWidths(bytes)).toContain(9);
  const result = await PDFDocument.load(bytes);
  const spaces = result.getPage(1).node.Resources()!.lookup(PDFName.of('ColorSpace'), PDFDict);
  expect(spaces.has(PDFName.of('CS1'))).toBe(true);
});

test('바로 써 넣은 그림 바이트 안의 EI 뒤를 연산자로 읽지 않는다', async ({ page }) => {
  // 2쪽 그림 바이트(회색 14×1) 안에 " EI /Secret Do"가 들어 있다. 1쪽(가림)이 비밀 그림을 쓴다
  const source = await PDFDocument.create();
  const context = source.context;
  const resources = context.register(context.obj({ XObject: { Secret: secretImage(context) } }));
  const first = source.addPage([200, 200]);
  const second = source.addPage([200, 200]);
  for (const [added, draw] of [
    [first, 'q 50 0 0 50 10 10 cm /Secret Do Q'],
    [second, 'q 50 0 0 50 10 10 cm BI /W 14 /H 1 /CS /G /BPC 8 ID  EI /Secret Do EI Q'],
  ] as const) {
    added.node.set(PDFName.of('Resources'), resources);
    added.node.set(PDFName.of('Contents'), context.register(context.stream(draw)));
  }
  const frame = await openRedact(page, {
    name: 'inline-ei.pdf',
    buffer: Buffer.from(await source.save()),
  });
  await frame.getByRole('button', { name: '가운데에 상자 넣기' }).click();
  const { bytes } = await download(page, frame);
  expect(await imageWidths(bytes)).not.toContain(7);
});

test('자기 자원 묶음 그림이 gs로 바꾼 글꼴로 찍은 글자는 물려받은 Type3 글꼴로 세지 않는다', async ({
  page,
}) => {
  const source = await PDFDocument.create();
  const context = source.context;
  const helvetica = await source.embedFont(StandardFonts.Helvetica);
  const type3 = context.register(
    context.obj({
      Type: 'Font',
      Subtype: 'Type3',
      FontBBox: [0, 0, 500, 500],
      FontMatrix: [0.001, 0, 0, 0.001, 0, 0],
      CharProcs: {
        a: context.register(context.stream('500 0 d0 0 0 400 400 re f')),
        b: context.register(context.stream('500 0 d0 q 400 0 0 400 0 0 cm /Secret Do Q')),
      },
      Encoding: { Type: 'Encoding', Differences: [97, 'a', 'b'] },
      FirstChar: 97,
      LastChar: 98,
      Widths: [500, 500],
      Resources: { XObject: { Secret: secretImage(context) } },
    }),
  );
  const form = context.register(
    context.stream('/G2 gs BT 20 50 Td (b) Tj ET', {
      Type: 'XObject',
      Subtype: 'Form',
      BBox: [0, 0, 200, 200],
      Resources: { ExtGState: { G2: { Font: [helvetica.ref, 12] } } },
    }),
  );
  const resources = context.register(context.obj({ Font: { T3: type3 }, XObject: { A: form } }));
  const first = source.addPage([200, 200]);
  const second = source.addPage([200, 200]);
  for (const [added, draw] of [
    [first, 'BT /T3 40 Tf 20 100 Td (b) Tj ET'],
    [second, 'BT /T3 40 Tf ET /A Do BT /T3 40 Tf 20 100 Td (a) Tj ET'],
  ] as const) {
    added.node.set(PDFName.of('Resources'), resources);
    added.node.set(PDFName.of('Contents'), context.register(context.stream(draw)));
  }
  const frame = await openRedact(page, {
    name: 'form-gs.pdf',
    buffer: Buffer.from(await source.save()),
  });
  await frame.getByRole('button', { name: '가운데에 상자 넣기' }).click();
  const { bytes } = await download(page, frame);
  expect(await imageWidths(bytes)).not.toContain(7);
});

test('자원 목록 없는 투명 마스크 묶음 그림이 쓰는 그림을 남긴다', async ({ page }) => {
  const source = await PDFDocument.create();
  const context = source.context;
  const picture = context.register(
    context.flateStream(new Uint8Array(81).fill(200), {
      Type: 'XObject',
      Subtype: 'Image',
      Width: 9,
      Height: 9,
      ColorSpace: 'DeviceGray',
      BitsPerComponent: 8,
    }),
  );
  const group = context.register(
    context.stream('q 100 0 0 100 0 0 cm /Pic Do Q', {
      Type: 'XObject',
      Subtype: 'Form',
      BBox: [0, 0, 200, 200],
      Group: { S: 'Transparency', CS: 'DeviceGray' },
    }),
  );
  source.addPage([200, 200]);
  const second = source.addPage([200, 200]);
  second.node.set(
    PDFName.of('Resources'),
    context.obj({
      XObject: { Pic: picture },
      ExtGState: { GS1: { SMask: { S: 'Luminosity', G: group } } },
    }),
  );
  second.node.set(
    PDFName.of('Contents'),
    context.register(context.stream('q /GS1 gs 0 0 1 rg 0 0 100 100 re f Q')),
  );
  const frame = await openRedact(page, {
    name: 'smask-inherit.pdf',
    buffer: Buffer.from(await source.save()),
  });
  await frame.getByRole('button', { name: '가운데에 상자 넣기' }).click();
  const { bytes } = await download(page, frame);
  expect(await imageWidths(bytes)).toContain(9);
});

test('남긴 그림의 마스크 그림에 붙은 XMP도 옮기지 않고, 색공간 정의가 부르는 색공간은 남긴다', async ({
  page,
}) => {
  const source = await PDFDocument.create();
  const context = source.context;
  const mask = context.register(
    context.flateStream(new Uint8Array(81).fill(255), {
      Type: 'XObject',
      Subtype: 'Image',
      Width: 9,
      Height: 9,
      ColorSpace: 'DeviceGray',
      BitsPerComponent: 8,
      Metadata: context.register(
        context.stream('<x:xmpmeta>MASK-XMP-SECRET</x:xmpmeta>', {
          Type: 'Metadata',
          Subtype: 'XML',
        }),
      ),
    }),
  );
  const picture = context.register(
    context.flateStream(new Uint8Array(81).fill(0), {
      Type: 'XObject',
      Subtype: 'Image',
      Width: 9,
      Height: 9,
      ColorSpace: 'CS1',
      BitsPerComponent: 8,
      SMask: mask,
    }),
  );
  source.addPage([200, 200]);
  const second = source.addPage([200, 200]);
  second.node.set(
    PDFName.of('Resources'),
    context.obj({
      XObject: { Pic: picture },
      ColorSpace: {
        CS1: ['Indexed', 'CS2', 0, PDFHexString.of('FF0000')],
        CS2: ['CalRGB', { WhitePoint: [0.9505, 1, 1.089] }],
      },
    }),
  );
  second.node.set(
    PDFName.of('Contents'),
    context.register(context.stream('q 50 0 0 50 10 10 cm /Pic Do Q')),
  );
  const frame = await openRedact(page, {
    name: 'mask-xmp.pdf',
    buffer: Buffer.from(await source.save()),
  });
  await frame.getByRole('button', { name: '가운데에 상자 넣기' }).click();
  const { bytes } = await download(page, frame);
  const { text } = await allStreams(bytes);
  expect(text).not.toContain('MASK-XMP-SECRET');
  const result = await PDFDocument.load(bytes);
  const spaces = result.getPage(1).node.Resources()!.lookup(PDFName.of('ColorSpace'), PDFDict);
  expect(spaces.has(PDFName.of('CS2'))).toBe(true);
});

test('가린 쪽은 인쇄할 때 보이는 주석만 그림에 넣는다', async ({ page }) => {
  // 화면에서만 보이는(인쇄 플래그 없음) 검은 네모 주석이 왼쪽 아래 구석에 있다
  const source = await PDFDocument.create();
  const context = source.context;
  const added = source.addPage([200, 200]);
  const appearance = context.register(
    context.stream('0 0 0 rg 0 0 50 50 re f', {
      Type: 'XObject',
      Subtype: 'Form',
      BBox: [0, 0, 50, 50],
    }),
  );
  added.node.set(
    PDFName.of('Annots'),
    context.obj([
      context.obj({
        Type: 'Annot',
        Subtype: 'Square',
        Rect: [10, 10, 60, 60],
        F: 0,
        AP: { N: appearance },
      }),
    ]),
  );
  const frame = await openRedact(page, {
    name: 'screen-only.pdf',
    buffer: Buffer.from(await source.save()),
  });
  await frame.getByRole('button', { name: '가운데에 상자 넣기' }).click();
  const { bytes } = await download(page, frame);
  const jpg = [...(await PDFDocument.load(bytes)).context.enumerateIndirectObjects()]
    .map(([, object]) => object)
    .find(
      (object): object is PDFRawStream =>
        object instanceof PDFRawStream &&
        object.dict.get(PDFName.of('Filter')) === PDFName.of('DCTDecode'),
    )!;
  const shade = await page.evaluate(async (base64) => {
    const data = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
    const bitmap = await createImageBitmap(new Blob([data], { type: 'image/jpeg' }));
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const context = canvas.getContext('2d')!;
    context.drawImage(bitmap, 0, 0);
    // 주석 가운데 (35, 35) → 위에서부터 165/200
    const x = Math.round((bitmap.width * 35) / 200);
    const y = Math.round((bitmap.height * 165) / 200);
    return context.getImageData(x, y, 1, 1).data[0];
  }, Buffer.from(jpg.contents).toString('base64'));
  // 흰 종이 그대로 (화면 전용 주석은 그리지 않는다)
  expect(shade).toBeGreaterThan(200);
});

test('글꼴이 바뀌어 조각이 나뉜 말도 같은 줄이면 이어서 찾는다', async ({ page }) => {
  // "SEC"는 Helvetica, "RET"은 Times로 이어 찍는다 (pdf.js는 글꼴마다 조각을 나눈다)
  const source = await PDFDocument.create();
  const context = source.context;
  const helvetica = await source.embedFont(StandardFonts.Helvetica);
  const times = await source.embedFont(StandardFonts.TimesRoman);
  const added = source.addPage([400, 200]);
  added.node.set(
    PDFName.of('Resources'),
    context.obj({ Font: { F1: helvetica.ref, F2: times.ref } }),
  );
  added.node.set(
    PDFName.of('Contents'),
    context.register(
      context.stream('BT /F1 12 Tf 20 100 Td (my SEC) Tj /F2 12 Tf (RET code) Tj ET'),
    ),
  );
  const frame = await openRedact(page, {
    name: 'split-fonts.pdf',
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
  const start = (20 + helvetica.widthOfTextAtSize('my ', 12)) / 400;
  const end =
    (20 + helvetica.widthOfTextAtSize('my SEC', 12) + times.widthOfTextAtSize('RET', 12)) / 400;
  expect(box.left).toBeLessThanOrEqual(start);
  expect(box.left + box.width).toBeGreaterThanOrEqual(end);
});

test('ASCII85 그림 바이트 속 EI 뒤를 읽지 않고, 남긴 묶음 그림의 다른 PDF 연결은 뺀다', async ({
  page,
}) => {
  const source = await PDFDocument.create();
  const context = source.context;
  const resources = context.register(context.obj({ XObject: { Secret: secretImage(context) } }));
  const embedded = context.register(
    context.stream('REFERENCED-PDF-SECRET', { Type: 'EmbeddedFile' }),
  );
  const reference = context.register(
    context.stream('0 0 1 rg 0 0 10 10 re f', {
      Type: 'XObject',
      Subtype: 'Form',
      BBox: [0, 0, 10, 10],
      Ref: {
        F: { Type: 'Filespec', F: PDFHexString.fromText('other.pdf'), EF: { F: embedded } },
        Page: 0,
      },
    }),
  );
  const shared = context.register(
    context.obj({ XObject: { Secret: secretImage(context), Fm: reference } }),
  );
  const first = source.addPage([200, 200]);
  const second = source.addPage([200, 200]);
  first.node.set(PDFName.of('Resources'), resources);
  first.node.set(
    PDFName.of('Contents'),
    context.register(context.stream('q 50 0 0 50 10 10 cm /Secret Do Q')),
  );
  second.node.set(PDFName.of('Resources'), shared);
  // ASCII85 그림 바이트(글자) 안에 " EI /Secret Do "가 있다. 진짜 끝은 ~> 뒤
  second.node.set(
    PDFName.of('Contents'),
    context.register(
      context.stream(
        'q 10 0 0 10 10 10 cm BI /W 2 /H 1 /CS /G /BPC 8 /F /A85 ID 8 EI /Secret Do ~> EI Q /Fm Do',
      ),
    ),
  );
  const frame = await openRedact(page, {
    name: 'a85.pdf',
    buffer: Buffer.from(await source.save()),
  });
  await frame.getByRole('button', { name: '가운데에 상자 넣기' }).click();
  const { bytes } = await download(page, frame);
  expect(await imageWidths(bytes)).not.toContain(7);
  const { text } = await allStreams(bytes);
  expect(text).not.toContain('REFERENCED-PDF-SECRET');
});

test('큰 도면 쪽은 좌표 단위(UserUnit)를 그대로 옮긴다', async ({ page }) => {
  const source = await PDFDocument.create();
  const added = source.addPage([10000, 5000]);
  added.node.set(PDFName.of('UserUnit'), PDFNumber.of(3));
  added.drawRectangle({ x: 100, y: 100, width: 1000, height: 1000 });
  const frame = await openRedact(page, {
    name: 'drawing.pdf',
    buffer: Buffer.from(await source.save()),
  });
  await frame.getByRole('button', { name: '가운데에 상자 넣기' }).click();
  const { bytes } = await download(page, frame);
  const result = (await PDFDocument.load(bytes)).getPage(0);
  expect(result.getSize()).toEqual({ width: 10000, height: 5000 });
  expect((result.node.get(PDFName.of('UserUnit')) as PDFNumber).asNumber()).toBe(3);
});

test('공백 없이 띄워 놓은 조각 사이는 띄어 쓴 말로 찾는다', async ({ page }) => {
  // "John"은 쪽에, "Smith"는 묶음 그림 안에서 공백 하나쯤 떨어진 자리에 공백 글자 없이 찍는다
  const source = await PDFDocument.create();
  const context = source.context;
  const helvetica = await source.embedFont(StandardFonts.Helvetica);
  const added = source.addPage([400, 200]);
  const x = 20 + helvetica.widthOfTextAtSize('John', 12) + 3.5;
  const form = context.register(
    context.stream(`BT /F1 12 Tf ${x} 100 Td (Smith) Tj ET`, {
      Type: 'XObject',
      Subtype: 'Form',
      BBox: [0, 0, 400, 200],
    }),
  );
  added.node.set(
    PDFName.of('Resources'),
    context.obj({ Font: { F1: helvetica.ref }, XObject: { Fm: form } }),
  );
  added.node.set(
    PDFName.of('Contents'),
    context.register(context.stream('BT /F1 12 Tf 20 100 Td (John) Tj ET /Fm Do')),
  );
  const frame = await openRedact(page, {
    name: 'gap.pdf',
    buffer: Buffer.from(await source.save()),
  });
  await frame.getByLabel('찾아서 가리기').fill('John Smith');
  await frame.getByRole('button', { name: '모두 찾아 가리기' }).click();
  await expect(frame.getByText('1곳을 찾아 가렸습니다.')).toBeVisible();
});

test('배열 색공간 안 프로필의 XMP는 빼고, 별색 이름과 같은 이름의 색공간 자원은 남기지 않는다', async ({
  page,
}) => {
  const source = await PDFDocument.create();
  const context = source.context;
  const profile = context.register(
    context.flateStream(new Uint8Array(200), {
      N: 3,
      Metadata: context.register(
        context.stream('<x:xmpmeta>ICC-XMP-SECRET</x:xmpmeta>', {
          Type: 'Metadata',
          Subtype: 'XML',
        }),
      ),
    }),
  );
  source.addPage([200, 200]);
  const second = source.addPage([200, 200]);
  second.node.set(
    PDFName.of('Resources'),
    context.obj({
      ColorSpace: {
        CS1: ['ICCBased', profile],
        CS2: [
          'Separation',
          'PatientName',
          'DeviceCMYK',
          { FunctionType: 2, Domain: [0, 1], C0: [0, 0, 0, 0], C1: [0, 0, 0, 1], N: 1 },
        ],
        PatientName: ['CalRGB', { WhitePoint: [0.9505, 1, 1.089] }],
      },
    }),
  );
  second.node.set(
    PDFName.of('Contents'),
    context.register(
      context.stream('/CS1 cs 1 0 0 sc 0 0 50 50 re f /CS2 cs 1 sc 60 60 50 50 re f'),
    ),
  );
  const frame = await openRedact(page, {
    name: 'separation.pdf',
    buffer: Buffer.from(await source.save()),
  });
  await frame.getByRole('button', { name: '가운데에 상자 넣기' }).click();
  const { bytes } = await download(page, frame);
  const { text } = await allStreams(bytes);
  expect(text).not.toContain('ICC-XMP-SECRET');
  const result = await PDFDocument.load(bytes);
  const spaces = result.getPage(1).node.Resources()!.lookup(PDFName.of('ColorSpace'), PDFDict);
  expect(spaces.has(PDFName.of('CS2'))).toBe(true);
  expect(spaces.has(PDFName.of('PatientName'))).toBe(false);
});

test('남긴 그림 스트림의 바깥 파일 연결(/F)은 뺀다', async ({ page }) => {
  const source = await PDFDocument.create();
  const context = source.context;
  const embedded = context.register(context.stream('STREAM-FILE-SECRET', { Type: 'EmbeddedFile' }));
  const picture = context.register(
    context.flateStream(new Uint8Array(81).fill(9), {
      Type: 'XObject',
      Subtype: 'Image',
      Width: 9,
      Height: 9,
      ColorSpace: 'DeviceGray',
      BitsPerComponent: 8,
      F: { Type: 'Filespec', F: PDFHexString.fromText('pixels.bin'), EF: { F: embedded } },
    }),
  );
  source.addPage([200, 200]);
  const second = source.addPage([200, 200]);
  second.node.set(PDFName.of('Resources'), context.obj({ XObject: { Pic: picture } }));
  second.node.set(
    PDFName.of('Contents'),
    context.register(context.stream('q 50 0 0 50 10 10 cm /Pic Do Q')),
  );
  const frame = await openRedact(page, {
    name: 'stream-file.pdf',
    buffer: Buffer.from(await source.save()),
  });
  await frame.getByRole('button', { name: '가운데에 상자 넣기' }).click();
  const { bytes } = await download(page, frame);
  const { text } = await allStreams(bytes);
  expect(text).not.toContain('STREAM-FILE-SECRET');
});

test('합자·자모로 나눈 한글·줄 안 띄움 공백처럼 생김새만 같은 글자도 찾는다', async ({ page }) => {
  // X는 합자 ﬁ, A는 자모로 나눈 '한'(ᄒ ᅡ ᆫ), Z는 줄 안 띄움 공백으로 읽히게 한 Helvetica
  const source = await PDFDocument.create();
  const context = source.context;
  const cmap = context.register(
    context.stream(
      [
        '/CIDInit /ProcSet findresource begin 12 dict begin begincmap',
        '/CIDSystemInfo << /Registry (Adobe) /Ordering (UCS) /Supplement 0 >> def',
        '/CMapName /Adobe-Identity-UCS def /CMapType 2 def',
        '1 begincodespacerange <00> <FF> endcodespacerange',
        '3 beginbfchar <58> <FB01> <41> <1112116111AB> <5A> <00A0> endbfchar',
        '1 beginbfrange <42> <57> <0042> endbfrange',
        'endcmap CMapName currentdict /CMap defineresource pop end end',
      ].join('\n'),
    ),
  );
  const font = context.obj({
    Type: 'Font',
    Subtype: 'Type1',
    BaseFont: 'Helvetica',
    Encoding: 'WinAnsiEncoding',
    ToUnicode: cmap,
  });
  const added = source.addPage([400, 200]);
  added.node.set(PDFName.of('Resources'), context.obj({ Font: { F1: font } }));
  added.node.set(
    PDFName.of('Contents'),
    context.register(context.stream('BT /F1 12 Tf 20 100 Td (BBXBBZAB) Tj ET')),
  );
  const frame = await openRedact(page, {
    name: 'normalize.pdf',
    buffer: Buffer.from(await source.save()),
  });
  for (const term of ['fi', 'b 한']) {
    await frame.getByLabel('찾아서 가리기').fill(term);
    await frame.getByRole('button', { name: '모두 찾아 가리기' }).click();
    await expect(frame.getByText('1곳을 찾아 가렸습니다.')).toBeVisible();
    await frame.getByLabel('찾아서 가리기').fill('');
  }
});

test('바로 써 넣은 색 목록 그림이 기본으로 부르는 색공간을 남긴다', async ({ page }) => {
  const source = await PDFDocument.create();
  const context = source.context;
  source.addPage([200, 200]);
  const second = source.addPage([200, 200]);
  second.node.set(
    PDFName.of('Resources'),
    context.obj({ ColorSpace: { CS1: ['CalRGB', { WhitePoint: [0.9505, 1, 1.089] }] } }),
  );
  second.node.set(
    PDFName.of('Contents'),
    context.register(
      context.stream(
        'q 50 0 0 50 10 10 cm BI /W 1 /H 1 /BPC 8 /CS [/I /CS1 0 <FF0000>] ID \0 EI Q',
      ),
    ),
  );
  const frame = await openRedact(page, {
    name: 'inline-indexed.pdf',
    buffer: Buffer.from(await source.save()),
  });
  await frame.getByRole('button', { name: '가운데에 상자 넣기' }).click();
  const { bytes } = await download(page, frame);
  const result = await PDFDocument.load(bytes);
  const spaces = result.getPage(1).node.Resources()!.lookup(PDFName.of('ColorSpace'), PDFDict);
  expect(spaces.has(PDFName.of('CS1'))).toBe(true);
});

test('장치 색공간 이름은 같은 이름의 색공간 자원을 부르지 않는다', async ({ page }) => {
  const source = await PDFDocument.create();
  const context = source.context;
  const secret = (text: string) => context.register(context.stream(`ICC ${text}`, { N: 3 }));
  source.addPage([200, 200]);
  const second = source.addPage([200, 200]);
  const picture = context.register(
    context.flateStream(new Uint8Array(3).fill(9), {
      Type: 'XObject',
      Subtype: 'Image',
      Width: 1,
      Height: 1,
      BitsPerComponent: 8,
      ColorSpace: 'DeviceRGB',
    }),
  );
  // 가린 쪽에서만 쓰던 항목이 장치 색공간과 같은 이름이면(잘못된 파일), 남긴 쪽이 장치 색공간을 써도 딸려 오면 안 된다
  second.node.set(
    PDFName.of('Resources'),
    context.obj({
      XObject: { Im1: picture },
      ColorSpace: {
        DeviceRGB: ['ICCBased', secret('DEVICE-RGB-SECRET')],
        Pattern: ['ICCBased', secret('PATTERN-SECRET')],
        RGB: ['ICCBased', secret('INLINE-RGB-SECRET')],
      },
    }),
  );
  second.node.set(
    PDFName.of('Contents'),
    context.register(
      context.stream(
        '/DeviceRGB cs 1 0 0 sc 0 0 50 50 re f /Pattern CS ' +
          'q 50 0 0 50 60 60 cm /Im1 Do Q ' +
          'q 50 0 0 50 10 120 cm BI /W 1 /H 1 /BPC 8 /CS /RGB ID \0\0\0 EI Q',
      ),
    ),
  );
  const frame = await openRedact(page, {
    name: 'device-names.pdf',
    buffer: Buffer.from(await source.save()),
  });
  await frame.getByRole('button', { name: '가운데에 상자 넣기' }).click();
  const { bytes } = await download(page, frame);
  const { text } = await allStreams(bytes);
  for (const name of ['DEVICE-RGB-SECRET', 'PATTERN-SECRET', 'INLINE-RGB-SECRET']) {
    expect(text).not.toContain(name);
  }
});

test('원본에서 꺼 둔 보이기 층은 결과에서도 꺼 두고, 투명도 묶음이 부르는 색공간은 남긴다', async ({
  page,
}) => {
  const source = await PDFDocument.create();
  const context = source.context;
  const layer = context.register(
    context.obj({ Type: 'OCG', Name: PDFHexString.fromText('Hidden') }),
  );
  source.catalog.set(
    PDFName.of('OCProperties'),
    context.obj({ OCGs: [layer], D: { BaseState: 'ON', OFF: [layer] } }),
  );
  source.addPage([200, 200]);
  const second = source.addPage([200, 200]);
  second.node.set(
    PDFName.of('Resources'),
    context.obj({
      Properties: { L1: layer },
      ColorSpace: { CS1: ['CalRGB', { WhitePoint: [0.9505, 1, 1.089] }] },
    }),
  );
  second.node.set(PDFName.of('Group'), context.obj({ S: 'Transparency', CS: 'CS1' }));
  second.node.set(
    PDFName.of('Contents'),
    context.register(context.stream('/OC /L1 BDC 0 0 1 rg 20 20 100 100 re f EMC')),
  );
  const frame = await openRedact(page, {
    name: 'layers.pdf',
    buffer: Buffer.from(await source.save()),
  });
  await frame.getByRole('button', { name: '가운데에 상자 넣기' }).click();
  const { bytes } = await download(page, frame);
  const result = await PDFDocument.load(bytes);
  // 쪽이 쓰는 층이 결과의 보이기 설정에서 꺼져 있다
  const properties = result.getPage(1).node.Resources()!.lookup(PDFName.of('Properties'), PDFDict);
  const copied = properties.get(PDFName.of('L1'));
  const settings = result.catalog.lookup(PDFName.of('OCProperties'), PDFDict);
  const off = settings.lookup(PDFName.of('D'), PDFDict).lookup(PDFName.of('OFF'), PDFArray);
  expect(off.asArray()).toContain(copied);
  const pdf = await getDocument({ data: bytes.slice() }).promise;
  const config = await pdf.getOptionalContentConfig();
  expect([...config].every(([, group]) => !group.visible)).toBe(true);
  // 투명도 묶음의 /CS /CS1
  const spaces = result.getPage(1).node.Resources()!.lookup(PDFName.of('ColorSpace'), PDFDict);
  expect(spaces.has(PDFName.of('CS1'))).toBe(true);
});

test('볼 때 저절로 적용되는 규칙(/AS)이 끄는 층도 결과에서 꺼 둔다', async ({ page }) => {
  const source = await PDFDocument.create();
  const context = source.context;
  const layer = (name: string, usage: Record<string, Record<string, string | number>>) =>
    context.register(context.obj({ Type: 'OCG', Name: PDFString.of(name), Usage: usage }));
  const viewOff = layer('View off', { View: { ViewState: 'OFF' } });
  const zoomed = layer('Zoom only', { Zoom: { min: 4 } });
  const byUser = layer('For someone', { User: { Type: 'Ind', Name: 'Someone' } });
  const shown = layer('Shown', { View: { ViewState: 'ON' } });
  const layers = [viewOff, zoomed, byUser, shown];
  source.catalog.set(
    PDFName.of('OCProperties'),
    context.obj({
      OCGs: layers,
      D: {
        BaseState: 'ON',
        AS: [{ Event: 'View', OCGs: layers, Category: ['View', 'Zoom', 'User'] }],
      },
    }),
  );
  source.addPage([200, 200]);
  const second = source.addPage([200, 200]);
  second.node.set(
    PDFName.of('Resources'),
    context.obj({ Properties: { L1: viewOff, L2: zoomed, L3: byUser, L4: shown } }),
  );
  second.node.set(
    PDFName.of('Contents'),
    context.register(
      context.stream(
        ['L1', 'L2', 'L3', 'L4'].map((name) => `/OC /${name} BDC 0 0 10 10 re f EMC`).join(' '),
      ),
    ),
  );
  const frame = await openRedact(page, {
    name: 'auto-layers.pdf',
    buffer: Buffer.from(await source.save()),
  });
  await frame.getByRole('button', { name: '가운데에 상자 넣기' }).click();
  const { bytes } = await download(page, frame);
  const pdf = await getDocument({ data: bytes.slice() }).promise;
  const config = await pdf.getOptionalContentConfig();
  const visible = Object.fromEntries([...config].map(([, group]) => [group.name, group.visible]));
  expect(visible).toEqual({
    'View off': false,
    'Zoom only': false,
    'For someone': false,
    Shown: true,
  });
});
