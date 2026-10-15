/**
 * PDF 이미지 넣기·서명 넣기·자르기 E2E. 빌드 결과에서 돌린다 (playwright.config.ts 참고).
 *
 * 받은 PDF를 pdf.js로 열어 이미지가 화면에 보이는 쪽 기준으로 고른 자리에 들어갔는지
 * (쪽을 돌린 PDF 포함) 확인하고, 처리하는 동안 파일이 기기를 떠나지 않는다는 약속을 확인한다.
 */
import { expect, test, type Page, type Request } from './test';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { PDFDocument, degrees } from '@cantoo/pdf-lib';
import { OPS, getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { expectLocalOnly } from './local-only';

const fixture = (name: string) => fileURLToPath(new URL(`../fixtures/${name}`, import.meta.url));

type Frame = ReturnType<Page['frameLocator']>;

async function openTool(page: Page, tool: string, pdf: string | Buffer) {
  await page.goto(`/pdf/${tool}/`);
  const frame = page.frameLocator('iframe[data-tool-frame]');
  await frame
    .locator('input[type=file]')
    .setInputFiles(
      typeof pdf === 'string'
        ? fixture(pdf)
        : { name: 'rotated.pdf', mimeType: 'application/pdf', buffer: pdf },
    );
  return frame;
}

async function download(page: Page, frame: Frame) {
  const event = page.waitForEvent('download');
  await frame.getByRole('button', { name: '다운로드' }).click();
  const file = await event;
  return {
    name: file.suggestedFilename(),
    bytes: new Uint8Array(await readFile(await file.path())),
  };
}

type Matrix = [number, number, number, number, number, number];
const multiply = (m: Matrix, n: Matrix): Matrix => [
  m[0] * n[0] + m[2] * n[1],
  m[1] * n[0] + m[3] * n[1],
  m[0] * n[2] + m[2] * n[3],
  m[1] * n[2] + m[3] * n[3],
  m[0] * n[4] + m[2] * n[5] + m[4],
  m[1] * n[4] + m[3] * n[5] + m[5],
];

/** 쪽마다 그려진 이미지의 자리. 화면에 보이는 쪽 기준 비율(왼쪽 위 0,0) */
async function imagePlaces(bytes: Uint8Array) {
  const task = getDocument({ data: bytes });
  const doc = await task.promise;
  const pages: { x: number; y: number; width: number; height: number }[][] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const viewport = page.getViewport({ scale: 1 });
    const { fnArray, argsArray } = await page.getOperatorList();
    let ctm: Matrix = [1, 0, 0, 1, 0, 0];
    const stack: Matrix[] = [];
    const found: (typeof pages)[number] = [];
    fnArray.forEach((fn, k) => {
      if (fn === OPS.save) stack.push(ctm);
      else if (fn === OPS.restore) ctm = stack.pop() ?? ctm;
      else if (fn === OPS.transform) ctm = multiply(ctm, argsArray[k] as Matrix);
      else if (fn === OPS.paintImageXObject) {
        // 이미지는 단위 정사각형에 그려진다. 네 모서리를 화면 좌표로 바꾼다
        const corners = [
          [0, 0],
          [1, 0],
          [0, 1],
          [1, 1],
        ].map(([u, v]) =>
          viewport.convertToViewportPoint(
            ctm[0] * u! + ctm[2] * v! + ctm[4],
            ctm[1] * u! + ctm[3] * v! + ctm[5],
          ),
        );
        const xs = corners.map((c) => c[0]!);
        const ys = corners.map((c) => c[1]!);
        found.push({
          x: Math.min(...xs) / viewport.width,
          y: Math.min(...ys) / viewport.height,
          width: (Math.max(...xs) - Math.min(...xs)) / viewport.width,
          height: (Math.max(...ys) - Math.min(...ys)) / viewport.height,
        });
      }
    });
    pages.push(found);
  }
  await task.destroy();
  return pages;
}

function expectNear(actual: number, expected: number, label: string) {
  expect(Math.abs(actual - expected), `${label}: ${actual} ≈ ${expected}`).toBeLessThan(0.005);
}

test('이미지 넣기: 키보드로 옮기고 키운 자리에, 이 쪽에만 넣는다', async ({ page }) => {
  const frame = await openTool(page, 'add-image', 'three-pages.pdf');
  await expect(frame.getByRole('button', { name: '이미지 넣기' })).toBeDisabled();
  await frame.getByText('이미지 선택').locator('input').setInputFiles(fixture('wide.png'));

  // 처음 자리 (x 0.35, y 0.35, 폭 0.3)에서 Shift+→로 0.05 옮기고 +로 0.01 키운다
  const stamp = frame.getByRole('button', { name: '놓을 이미지', exact: false });
  await stamp.focus();
  await stamp.press('Shift+ArrowRight');
  await stamp.press('+');
  await frame.getByRole('button', { name: '이미지 넣기' }).click();

  const { name, bytes } = await download(page, frame);
  expect(name).toBe('three-pages_이미지.pdf');
  const places = await imagePlaces(bytes);
  expect(places.map((p) => p.length)).toEqual([1, 0, 0]);
  const [placed] = places[0]!;
  expectNear(placed!.x, 0.4, 'x');
  expectNear(placed!.y, 0.35, 'y');
  expectNear(placed!.width, 0.31, '폭');
  // 400×300 이미지 비율 그대로 (A4 595×842)
  expectNear(placed!.height, (0.31 * 595 * 0.75) / 842, '높이');
});

test('이미지 넣기: 모든 쪽을 고르면 돌린 쪽에도 화면 기준 같은 자리에 넣는다', async ({ page }) => {
  const doc = await PDFDocument.load(await readFile(fixture('three-pages.pdf')));
  doc.addPage([595, 842]);
  doc.getPages().forEach((p, i) => p.setRotation(degrees(i * 90)));
  const frame = await openTool(page, 'add-image', Buffer.from(await doc.save()));
  await frame.getByText('이미지 선택').locator('input').setInputFiles(fixture('tall.jpg'));
  await frame.getByText('모든 쪽', { exact: true }).click();
  await frame.getByRole('button', { name: '이미지 넣기' }).click();

  const places = await imagePlaces((await download(page, frame)).bytes);
  places.forEach((list, i) => {
    expect(list, `${i + 1}쪽`).toHaveLength(1);
    // 화면에 보이는 쪽 기준으로 같은 x·y·폭. 세로 이미지(300×400) 비율도 그대로
    const view = i % 2 === 0 ? { w: 595, h: 842 } : { w: 842, h: 595 };
    expectNear(list[0]!.x, 0.35, `${i + 1}쪽 x`);
    expectNear(list[0]!.y, 0.35, `${i + 1}쪽 y`);
    expectNear(list[0]!.width, 0.3, `${i + 1}쪽 폭`);
    expectNear(list[0]!.height, (0.3 * view.w * (4 / 3)) / view.h, `${i + 1}쪽 높이`);
  });
});

test('이미지 넣기: 크게 키워도 이미지가 어느 쪽에서도 쪽 밖으로 나가지 않는다', async ({
  page,
}) => {
  const doc = await PDFDocument.load(await readFile(fixture('three-pages.pdf')));
  doc.getPage(1).setRotation(degrees(90));
  const frame = await openTool(page, 'add-image', Buffer.from(await doc.save()));
  await frame.getByText('이미지 선택').locator('input').setInputFiles(fixture('tall.jpg'));
  // 가로로 놓인 2쪽에서 세로 이미지를 한껏 키운다
  await frame.getByRole('button', { name: '다음 쪽' }).click();
  const stamp = frame.getByRole('button', { name: '놓을 이미지', exact: false });
  for (let i = 0; i < 20; i++) await stamp.press('Shift+=');
  await frame.getByText('모든 쪽', { exact: true }).click();
  await frame.getByRole('button', { name: '이미지 넣기' }).click();

  const places = await imagePlaces((await download(page, frame)).bytes);
  places.forEach(([placed], i) => {
    expect(placed!.x, `${i + 1}쪽 왼쪽`).toBeGreaterThanOrEqual(-0.001);
    expect(placed!.y, `${i + 1}쪽 위`).toBeGreaterThanOrEqual(-0.001);
    expect(placed!.x + placed!.width, `${i + 1}쪽 오른쪽`).toBeLessThanOrEqual(1.001);
    expect(placed!.y + placed!.height, `${i + 1}쪽 아래`).toBeLessThanOrEqual(1.001);
  });
  // 가로 쪽에서는 높이가 쪽에 꽉 찬다
  expect(places[1]![0]!.height).toBeGreaterThan(0.99);
});

test('서명 넣기: 그린 서명을 투명 배경 PNG로 넣는다', async ({ page }) => {
  const frame = await openTool(page, 'sign', 'three-pages.pdf');
  await expect(frame.getByRole('button', { name: '서명 완료' })).toBeDisabled();

  const pad = frame.getByLabel('서명 그리는 칸', { exact: false });
  const box = (await pad.boundingBox())!;
  await page.mouse.move(box.x + 40, box.y + 120);
  await page.mouse.down();
  await page.mouse.move(box.x + 120, box.y + 60, { steps: 8 });
  await page.mouse.move(box.x + 200, box.y + 140, { steps: 8 });
  await page.mouse.up();
  await frame.getByRole('button', { name: '서명 완료' }).click();

  await frame.getByRole('button', { name: '서명 넣기' }).click();
  const { name, bytes } = await download(page, frame);
  expect(name).toBe('three-pages_서명.pdf');
  const places = await imagePlaces(bytes.slice());
  expect(places.map((p) => p.length)).toEqual([1, 0, 0]);
  expectNear(places[0]![0]!.x, 0.6, 'x');
  expectNear(places[0]![0]!.width, 0.25, '폭');
  // 투명 배경: PNG의 알파가 SMask로 들어간다
  expect(new TextDecoder('latin1').decode(bytes)).toContain('/SMask');
});

/** 쪽마다 화면에 보이는 크기 (pt, 소수점 한 자리) */
async function viewSizes(bytes: Uint8Array) {
  const task = getDocument({ data: bytes });
  const doc = await task.promise;
  const sizes: [number, number][] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const { width, height } = (await doc.getPage(i)).getViewport({ scale: 1 });
    sizes.push([Math.round(width * 10) / 10, Math.round(height * 10) / 10]);
  }
  await task.destroy();
  return sizes;
}

test('자르기: 키보드로 모서리를 옮긴 영역만 이 쪽에서 남긴다', async ({ page }) => {
  const frame = await openTool(page, 'crop', 'three-pages.pdf');
  // 처음 영역 (가장자리 5%씩 안쪽)에서 왼쪽 위를 오른쪽 0.1·아래 0.05, 오른쪽 아래를 왼쪽 0.05
  const nw = frame.getByRole('button', { name: '왼쪽 위 모서리', exact: false });
  await nw.press('Shift+ArrowRight');
  await nw.press('Shift+ArrowRight');
  await nw.press('Shift+ArrowDown');
  await frame
    .getByRole('button', { name: '오른쪽 아래 모서리', exact: false })
    .press('Shift+ArrowLeft');
  await frame.getByRole('button', { name: 'PDF 자르기' }).click();

  const { name, bytes } = await download(page, frame);
  expect(name).toBe('three-pages_자름.pdf');
  // A4 595×842에서 가로 0.15~0.9, 세로 0.1~0.95
  expect(await viewSizes(bytes)).toEqual([
    [446.3, 715.7],
    [595, 842],
    [595, 842],
  ]);
});

test('자르기: 모든 쪽을 고르면 돌린 쪽도 화면 기준 같은 영역을 남긴다', async ({ page }) => {
  const doc = await PDFDocument.load(await readFile(fixture('three-pages.pdf')));
  doc.addPage([595, 842]);
  doc.getPages().forEach((p, i) => p.setRotation(degrees(i * 90)));
  const frame = await openTool(page, 'crop', Buffer.from(await doc.save()));
  await frame.getByText('모든 쪽', { exact: true }).click();
  await frame
    .getByRole('button', { name: '오른쪽 아래 모서리', exact: false })
    .press('Shift+ArrowUp');
  await frame.getByRole('button', { name: 'PDF 자르기' }).click();

  // 남는 영역: 가로 0.05~0.95(0.9), 세로 0.05~0.9(0.85). 돌린 쪽은 화면 기준 가로·세로
  const sizes = await viewSizes((await download(page, frame)).bytes);
  sizes.forEach(([width, height], i) => {
    const view = i % 2 === 0 ? [595, 842] : [842, 595];
    expect(Math.abs(width - view[0]! * 0.9), `${i + 1}쪽 가로`).toBeLessThan(0.2);
    expect(Math.abs(height - view[1]! * 0.85), `${i + 1}쪽 세로`).toBeLessThan(0.2);
  });
});

test('처리하는 동안의 요청에는 파일이 기기 밖으로 나가는 것이 없다', async ({ page, baseURL }) => {
  const requests: Request[] = [];
  page.on('request', (request) => requests.push(request));

  await page.goto('/pdf/add-image/');
  const frame = page.frameLocator('iframe[data-tool-frame]');
  await frame.locator('input[type=file]').waitFor({ state: 'attached' });
  requests.length = 0; // 페이지를 여는 요청은 빼고, 파일을 고른 뒤부터 센다
  await frame.locator('input[type=file]').setInputFiles(fixture('three-pages.pdf'));
  await frame.getByText('이미지 선택').locator('input').setInputFiles(fixture('rotated.jpg'));
  await frame.getByRole('button', { name: '이미지 넣기' }).click();
  await expect(frame.getByRole('button', { name: '다운로드' })).toBeVisible();
  await page.waitForLoadState('networkidle');

  expectLocalOnly(page, requests, baseURL!);
});
