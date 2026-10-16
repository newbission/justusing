/**
 * PDF 모아찍기 E2E. 빌드 결과에서 돌린다 (playwright.config.ts 참고).
 *
 * 받은 파일을 직접 열어 장 수·종이 크기를 확인하고, 회전된 쪽이 보이는 방향 그대로 들어갔는지
 * 쪽을 그리는 변환 행렬로 확인한다.
 */
import { expect, test, type Page, type Request } from './test';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { PDFDocument, PDFName, degrees } from '@cantoo/pdf-lib';
import { getDocument, OPS } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { expectLocalOnly } from './local-only';

const fixture = (name: string) => fileURLToPath(new URL(`../fixtures/${name}`, import.meta.url));

type Matrix = [number, number, number, number, number, number];
/** a를 먼저, 그다음 b를 적용하는 행렬 */
const then = (a: Matrix, b: Matrix): Matrix => [
  a[0] * b[0] + a[1] * b[2],
  a[0] * b[1] + a[1] * b[3],
  a[2] * b[0] + a[3] * b[2],
  a[2] * b[1] + a[3] * b[3],
  a[4] * b[0] + a[5] * b[2] + b[4],
  a[4] * b[1] + a[5] * b[3] + b[5],
];
const apply = (m: Matrix, x: number, y: number) => ({
  x: m[0] * x + m[2] * y + m[4],
  y: m[1] * x + m[3] * y + m[5],
});

/** 장마다 그려 넣은 쪽들: 내용의 왼쪽 아래 모서리가 놓인 곳과 그려진 영역 */
async function placedPages(bytes: Uint8Array, sheet: number) {
  const doc = await getDocument({ data: bytes.slice() }).promise;
  const page = await doc.getPage(sheet);
  const { fnArray, argsArray } = await page.getOperatorList();
  const placed: {
    origin: { x: number; y: number };
    box: { x0: number; y0: number; x1: number; y1: number };
  }[] = [];
  const stack: Matrix[] = [];
  let ctm: Matrix = [1, 0, 0, 1, 0, 0];
  let depth = 0;
  let borders = 0;
  let inner = 0;
  fnArray.forEach((fn, i) => {
    const args = argsArray[i];
    if (fn === OPS.constructPath) {
      if (depth === 0) borders++;
      else inner++;
    } else if (fn === OPS.save) stack.push(ctm);
    else if (fn === OPS.restore) ctm = stack.pop() ?? ctm;
    else if (fn === OPS.transform) ctm = then(args as Matrix, ctm);
    else if (fn === OPS.paintFormXObjectBegin) {
      const [form, bbox] = args as [Matrix | null, number[]];
      const m = form ? then(form, ctm) : ctm;
      const [bx0, by0, bx1, by1] = bbox as [number, number, number, number];
      const corners = [
        apply(m, bx0, by0),
        apply(m, bx1, by0),
        apply(m, bx0, by1),
        apply(m, bx1, by1),
      ];
      if (depth === 0)
        placed.push({
          origin: corners[0]!,
          box: {
            x0: Math.min(...corners.map((c) => c.x)),
            y0: Math.min(...corners.map((c) => c.y)),
            x1: Math.max(...corners.map((c) => c.x)),
            y1: Math.max(...corners.map((c) => c.y)),
          },
        });
      depth++;
      stack.push(ctm);
    } else if (fn === OPS.paintFormXObjectEnd) {
      depth--;
      ctm = stack.pop() ?? ctm;
    }
  });
  return { placed, borders, inner };
}

async function openNUp(page: Page) {
  await page.goto('/pdf/n-up/');
  return page.frameLocator('iframe[data-tool-frame]');
}

async function download(page: Page, frame: ReturnType<Page['frameLocator']>) {
  const event = page.waitForEvent('download');
  await frame.getByRole('button', { name: '다운로드' }).click();
  const file = await event;
  const bytes = new Uint8Array(await readFile(await file.path()));
  return { name: file.suggestedFilename(), bytes, doc: await PDFDocument.load(bytes) };
}

test('2쪽 모아찍기는 A4를 눕혀 두 쪽씩 놓는다', async ({ page }) => {
  const frame = await openNUp(page);
  await frame.locator('input[type=file]').setInputFiles(fixture('three-pages.pdf'));
  await frame.getByText('2쪽', { exact: true }).click();
  await expect(frame.getByText('3쪽을 2장에 모읍니다.')).toBeVisible();
  await frame.getByRole('button', { name: '모아찍기' }).click();

  const { name, doc, bytes } = await download(page, frame);
  expect(name).toBe('three-pages_모아찍기.pdf');
  expect(doc.getPageCount()).toBe(2);
  for (const sheet of doc.getPages()) {
    const { width, height } = sheet.getSize();
    expect(Math.round(width)).toBe(842);
    expect(Math.round(height)).toBe(595);
  }
  const first = await placedPages(bytes, 1);
  expect(first.placed).toHaveLength(2);
  // 왼쪽 칸이 1쪽, 오른쪽 칸이 2쪽
  expect(first.placed[0]!.box.x1).toBeLessThan(first.placed[1]!.box.x0);
  expect((await placedPages(bytes, 2)).placed).toHaveLength(1);
});

test('회전된 쪽은 보이는 방향 그대로 넣고, 테두리를 그린다', async ({ page }) => {
  // 2쪽은 가로로 긴 쪽에 /Rotate 90을 붙여 세로로 보이게 한 쪽, 5쪽은 내용이 없는 빈 쪽
  const source = await PDFDocument.create();
  for (let i = 0; i < 5; i++) {
    const added = source.addPage(i === 1 ? [400, 200] : [200, 300]);
    if (i === 1) added.setRotation(degrees(90));
    if (i < 4) added.drawRectangle({ x: 10, y: 10, width: 50, height: 50 });
  }
  const frame = await openNUp(page);
  await frame.locator('input[type=file]').setInputFiles({
    name: 'mixed.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from(await source.save()),
  });
  await frame.getByText('Letter', { exact: true }).click();
  // 미리보기 종이도 Letter 비율
  const sheet = (await frame.locator('.sheet').boundingBox())!;
  expect(sheet.width / sheet.height).toBeCloseTo(612 / 792, 2);
  await frame.getByLabel('쪽마다 테두리 선').check();
  await expect(frame.getByText('5쪽을 2장에 모읍니다.')).toBeVisible();
  await frame.getByRole('button', { name: '모아찍기' }).click();

  const { doc, bytes } = await download(page, frame);
  expect(doc.getPageCount()).toBe(2);
  expect(doc.getPage(0).getSize()).toEqual({ width: 612, height: 792 });

  const { placed, borders } = await placedPages(bytes, 1);
  expect(placed).toHaveLength(4);
  expect(borders).toBeGreaterThanOrEqual(4);
  // 회전된 쪽은 세로로 길게 놓인다 (보이는 모양 200×400)
  const rotated = placed[1]!;
  const w = rotated.box.x1 - rotated.box.x0;
  const h = rotated.box.y1 - rotated.box.y0;
  expect(h / w).toBeCloseTo(2, 1);
  // 시계 방향 90° 회전: 내용의 왼쪽 아래 모서리가 보이는 쪽의 왼쪽 위로 간다
  expect(rotated.origin.x).toBeCloseTo(rotated.box.x0, 0);
  expect(rotated.origin.y).toBeCloseTo(rotated.box.y1, 0);
  // 오른쪽 위 칸에 놓인다
  expect(rotated.box.x0).toBeGreaterThan(placed[0]!.box.x1);
  // 빈 쪽은 칸만 차지하고 테두리만 그린다
  const last = await placedPages(bytes, 2);
  expect(last.placed).toHaveLength(0);
  expect(last.borders).toBeGreaterThanOrEqual(1);
});

test('양식 입력값·주석처럼 주석으로 보이는 내용도 함께 옮긴다', async ({ page }) => {
  // 쪽 내용은 비어 있고, 사각형을 그리는 주석 모양만 있는 쪽
  const source = await PDFDocument.create();
  const added = source.addPage([200, 300]);
  const context = source.context;
  const look = context.register(
    context.stream('0 0 1 rg 0 0 50 50 re f', {
      Type: 'XObject',
      Subtype: 'Form',
      BBox: [0, 0, 50, 50],
    }),
  );
  // 인쇄 플래그(4)가 있는 것만 종이에 나온다. 화면 전용 주석은 빠진다
  const printed = context.register(
    context.obj({
      Type: 'Annot',
      Subtype: 'Square',
      F: 4,
      Rect: [20, 20, 70, 70],
      AP: { N: look },
    }),
  );
  const screenOnly = context.register(
    context.obj({ Type: 'Annot', Subtype: 'Square', Rect: [100, 100, 150, 150], AP: { N: look } }),
  );
  added.node.set(PDFName.of('Annots'), context.obj([printed, screenOnly]));

  const frame = await openNUp(page);
  await frame.locator('input[type=file]').setInputFiles({
    name: 'annotated.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from(await source.save()),
  });
  await frame.getByRole('button', { name: '모아찍기' }).click();

  const { bytes } = await download(page, frame);
  const { placed, inner } = await placedPages(bytes, 1);
  expect(placed).toHaveLength(1);
  expect(inner).toBe(1);
});

/** 모양(/AP) 없이 값만 저장된 입력 칸 하나가 있는 PDF */
async function formWithoutAppearance(value: string) {
  const source = await PDFDocument.create();
  const added = source.addPage([300, 200]);
  const field = source.getForm().createTextField('name');
  field.addToPage(added, { x: 20, y: 80, width: 200, height: 30 });
  field.setText(value);
  for (const widget of field.acroField.getWidgets()) widget.dict.delete(PDFName.of('AP'));
  return Buffer.from(await source.save({ updateFieldAppearances: false }));
}

test('모양 없이 저장된 양식 입력값은 모양을 만들어 옮긴다', async ({ page }) => {
  const frame = await openNUp(page);
  await frame.locator('input[type=file]').setInputFiles({
    name: 'form.pdf',
    mimeType: 'application/pdf',
    buffer: await formWithoutAppearance('Hello form'),
  });
  await frame.getByRole('button', { name: '모아찍기' }).click();

  const { bytes } = await download(page, frame);
  const doc = await getDocument({ data: bytes.slice() }).promise;
  const content = await (await doc.getPage(1)).getTextContent();
  const text = content.items.map((item) => ('str' in item ? item.str : '')).join('');
  expect(text).toContain('Hello form');
});

test('모양을 만들 수 없는 양식 입력값이 있으면 조용히 빼지 않고 알린다', async ({ page }) => {
  const frame = await openNUp(page);
  await frame.locator('input[type=file]').setInputFiles({
    name: 'form-ko.pdf',
    mimeType: 'application/pdf',
    buffer: await formWithoutAppearance('홍길동'),
  });
  await frame.getByRole('button', { name: '모아찍기' }).click();
  await expect(
    frame.getByText('양식 입력값 일부는 모양이 저장되어 있지 않아', { exact: false }),
  ).toBeVisible();
});

test('모으는 동안의 요청에는 파일이 기기 밖으로 나가는 것이 없다', async ({ page, baseURL }) => {
  const requests: Request[] = [];
  page.on('request', (request) => requests.push(request));

  const frame = await openNUp(page);
  await frame.locator('input[type=file]').waitFor({ state: 'attached' });
  requests.length = 0;
  await frame.locator('input[type=file]').setInputFiles(fixture('three-pages.pdf'));
  await frame.getByRole('button', { name: '모아찍기' }).click();
  await expect(frame.getByRole('button', { name: '다운로드' })).toBeVisible();
  await page.waitForLoadState('networkidle');

  expectLocalOnly(page, requests, baseURL!);
});
