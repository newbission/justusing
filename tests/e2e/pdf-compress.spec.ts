/**
 * PDF 압축 E2E. 빌드 결과에서 돌린다 (playwright.config.ts 참고).
 *
 * 받은 PDF를 직접 열어 사진이 줄고 글자는 그대로인지 확인하고,
 * 처리하는 동안 파일이 기기를 떠나지 않는다는 약속을 확인한다.
 */
import { expect, test, type Page, type Request } from './test';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { PDFDocument, PDFName, PDFRawStream } from '@cantoo/pdf-lib';
import { getDocument, OPS } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { expectLocalOnly } from './local-only';

const fixture = (name: string) => fileURLToPath(new URL(`../fixtures/${name}`, import.meta.url));

async function openTool(page: Page, file: string) {
  await page.goto('/pdf/compress/');
  const frame = page.frameLocator('iframe[data-tool-frame]');
  await frame.locator('input[type=file]').setInputFiles(fixture(file));
  return frame;
}

/** 쪽마다 글자와 그 쪽에 그려지는 사진 수 */
async function pages(bytes: Uint8Array) {
  const task = getDocument({ data: bytes.slice() });
  const doc = await task.promise;
  const result: { text: string; images: number }[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const ops = await page.getOperatorList();
    result.push({
      text: content.items.map((item) => ('str' in item ? item.str : '')).join(''),
      images: ops.fnArray.filter((fn) => fn === OPS.paintImageXObject).length,
    });
  }
  await task.destroy();
  return result;
}

/** PDF 안의 사진마다 압축 방식 */
async function imageFilters(bytes: Uint8Array) {
  const doc = await PDFDocument.load(bytes);
  return doc.context
    .enumerateIndirectObjects()
    .flatMap(([, object]) =>
      object instanceof PDFRawStream &&
      object.dict.lookup(PDFName.of('Subtype')) === PDFName.of('Image')
        ? [String(object.dict.lookup(PDFName.of('Filter')))]
        : [],
    );
}

test('사진이 든 PDF를 줄이고, 글자와 사진은 그대로 남는다', async ({ page, baseURL }) => {
  const requests: Request[] = [];
  page.on('request', (request) => requests.push(request));
  const frame = await openTool(page, 'photos.pdf');
  const original = await readFile(fixture('photos.pdf'));
  await expect(frame.getByText('지금 크기 1008KB')).toBeVisible();
  requests.length = 0; // 페이지를 여는 요청은 빼고, 파일을 고른 뒤부터 센다

  await frame.getByRole('button', { name: '압축하기' }).click();
  await expect(frame.getByText('% 줄어듦', { exact: false })).toBeVisible();
  const event = page.waitForEvent('download');
  await frame.getByRole('button', { name: '다운로드' }).click();
  const file = await event;
  expect(file.suggestedFilename()).toBe('photos_압축.pdf');
  const bytes = new Uint8Array(await readFile(await file.path()));

  // 사진 두 장(JPG, PNG 예측을 건 Flate)을 모두 JPG로 다시 저장하고 쓰지 않는 객체를 지웠다
  expect(bytes.length).toBeLessThan(original.length / 2);
  expect(await imageFilters(bytes)).toEqual(['/DCTDecode', '/DCTDecode']);
  expect(await pages(bytes)).toEqual([
    { text: 'Photo page 1', images: 1 },
    { text: 'Photo page 2', images: 1 },
  ]);
  expectLocalOnly(page, requests, baseURL!);
});

test('줄이는 정도를 바꾸면 다시 압축하고, 많이 고를수록 더 작다', async ({ page }) => {
  const frame = await openTool(page, 'photos.pdf');
  const sizes: number[] = [];
  for (const level of ['조금 (화질 우선)', '많이 (용량 우선)']) {
    await frame.getByText(level).click();
    await frame.getByRole('button', { name: '압축하기' }).click();
    const event = page.waitForEvent('download');
    await frame.getByRole('button', { name: '다운로드' }).click();
    sizes.push((await readFile(await (await event).path())).length);
  }
  expect(sizes[1]).toBeLessThan(sizes[0]!);
});

test('줄일 사진이 없으면 받을 파일 없이 알려 준다', async ({ page }) => {
  const frame = await openTool(page, 'three-pages.pdf');
  await frame.getByRole('button', { name: '압축하기' }).click();
  await expect(frame.getByText('더 줄일 수 없었습니다.', { exact: false })).toBeVisible();
  await expect(frame.getByRole('button', { name: '압축하기' })).toBeDisabled();
  await expect(frame.getByRole('button', { name: '다운로드' })).toHaveCount(0);
});

test('압축 중에 다른 파일로 바꾸면 이전 압축을 그만두고 새 파일을 압축한다', async ({ page }) => {
  const frame = await openTool(page, 'photos.pdf');
  await frame.getByRole('button', { name: '압축하기' }).click();
  await frame.getByRole('button', { name: '다른 파일' }).click();
  await frame.locator('input[type=file]').setInputFiles(fixture('photos.pdf'));
  await frame.getByRole('button', { name: '압축하기' }).click();
  await expect(frame.getByText('% 줄어듦', { exact: false })).toBeVisible();
  const event = page.waitForEvent('download');
  await frame.getByRole('button', { name: '다운로드' }).click();
  const bytes = new Uint8Array(await readFile(await (await event).path()));
  expect(await pages(bytes)).toHaveLength(2);
});
