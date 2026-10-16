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
