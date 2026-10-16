/**
 * PDF 가리기(영구 삭제) E2E. 빌드 결과에서 돌린다 (playwright.config.ts 참고).
 *
 * 가린 글자가 결과 파일의 어느 스트림에도 남지 않는지, 가리지 않은 쪽은 글자가 그대로인지,
 * 쪽끼리 같이 쓰던 자원·링크를 타고 가린 쪽의 내용이 딸려 오지 않는지 확인한다.
 */
import { expect, test, type Page, type Request } from './test';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { PDFDocument, PDFName, PDFNumber, PDFRawStream, decodePDFRawStream } from '@cantoo/pdf-lib';
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
  const resources = context.register(
    context.obj({ XObject: { Secret: gray(7), Public: gray(9) } }),
  );
  const first = source.addPage([200, 200]);
  const second = source.addPage([200, 200]);
  for (const [added, image] of [
    [first, 'Secret'],
    [second, 'Public'],
  ] as const) {
    added.node.set(PDFName.of('Resources'), resources);
    added.node.set(
      PDFName.of('Contents'),
      context.register(context.stream(`q 100 0 0 100 50 50 cm /${image} Do Q`)),
    );
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
