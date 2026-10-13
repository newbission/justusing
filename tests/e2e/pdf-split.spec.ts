/**
 * PDF 나누기 E2E. 빌드 결과에서 돌린다 (playwright.config.ts 참고).
 *
 * 받은 파일(PDF·ZIP)을 직접 열어 쪽 구성을 확인하고,
 * 나누는 동안 파일이 기기를 떠나지 않는다는 약속을 확인한다.
 */
import { expect, test, type Page, type Request } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { unzipSync } from 'fflate';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { expectLocalOnly } from './local-only';

const fixture = (name: string) => fileURLToPath(new URL(`../fixtures/${name}`, import.meta.url));

async function openSplit(page: Page, file: string) {
  await page.goto('/pdf/split/');
  const frame = page.frameLocator('iframe[data-tool-frame]');
  await frame.locator('input[type=file]').setInputFiles(fixture(file));
  return frame;
}

/** PDF 바이트의 쪽마다 글자를 읽는다 */
async function pageTexts(bytes: Uint8Array) {
  const task = getDocument({ data: bytes });
  const doc = await task.promise;
  const texts: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const content = await (await doc.getPage(i)).getTextContent();
    texts.push(content.items.map((item) => ('str' in item ? item.str : '')).join(''));
  }
  await task.destroy();
  return texts;
}

async function download(page: Page, frame: ReturnType<Page['frameLocator']>) {
  const event = page.waitForEvent('download');
  await frame.getByRole('button', { name: '다운로드' }).click();
  const file = await event;
  return {
    name: file.suggestedFilename(),
    bytes: new Uint8Array(await readFile(await file.path())),
  };
}

test('범위로 나누면 범위마다 PDF가 든 ZIP을 받는다', async ({ page }) => {
  const frame = await openSplit(page, 'three-pages.pdf');
  await frame.getByLabel('나눌 범위').fill('3, 1-2');
  await expect(frame.locator('.note')).toHaveText(['파일 2', '파일 2', '파일 1']);
  await frame.getByRole('button', { name: 'PDF 나누기' }).click();

  const { name, bytes } = await download(page, frame);
  expect(name).toBe('three-pages_나눔.zip');
  const entries = unzipSync(bytes);
  expect(Object.keys(entries)).toEqual(['three-pages_3.pdf', 'three-pages_1-2.pdf']);
  expect(await pageTexts(entries['three-pages_3.pdf']!)).toEqual(['Page 3']);
  expect(await pageTexts(entries['three-pages_1-2.pdf']!)).toEqual(['Page 1', 'Page 2']);
});

test('잘못된 범위는 이유를 보여 주고 나눌 수 없다', async ({ page }) => {
  const frame = await openSplit(page, 'three-pages.pdf');
  await frame.getByLabel('나눌 범위').fill('1-9');
  await expect(frame.getByRole('alert')).toContainText('9쪽은 없습니다');
  await expect(frame.getByRole('button', { name: 'PDF 나누기' })).toBeDisabled();
});

test('한 장씩 나누면 쪽마다 파일이 생긴다', async ({ page }) => {
  const frame = await openSplit(page, 'three-pages.pdf');
  await frame.getByText('한 장씩 나누기').click();
  await frame.getByRole('button', { name: 'PDF 나누기' }).click();

  const entries = unzipSync((await download(page, frame)).bytes);
  expect(Object.keys(entries)).toEqual([
    'three-pages_1.pdf',
    'three-pages_2.pdf',
    'three-pages_3.pdf',
  ]);
});

test('고른 페이지만 뽑으면 PDF 하나를 바로 받고, 암호 PDF도 풀린다', async ({ page }) => {
  const frame = await openSplit(page, 'encrypted.pdf');
  await frame.getByLabel('PDF 암호').fill('1234');
  await frame.getByLabel('PDF 암호').press('Enter');
  await frame.getByText('고른 페이지만').click();

  await expect(frame.getByRole('button', { name: 'PDF 나누기' })).toBeDisabled();
  await frame.getByRole('button', { name: '1쪽' }).click();
  await frame.getByRole('button', { name: 'PDF 나누기' }).click();

  const { name, bytes } = await download(page, frame);
  expect(name).toBe('encrypted_발췌.pdf');
  expect(await pageTexts(bytes)).toEqual(['Secret page']);
  expect(new TextDecoder('latin1').decode(bytes).includes('/Encrypt')).toBe(false);
});

test('나누는 동안의 모든 요청은 우리 사이트로만 가고 본문이 없다', async ({ page, baseURL }) => {
  const requests: Request[] = [];
  page.on('request', (request) => requests.push(request));

  await page.goto('/pdf/split/');
  const frame = page.frameLocator('iframe[data-tool-frame]');
  await frame.locator('input[type=file]').waitFor({ state: 'attached' });
  requests.length = 0; // 페이지를 여는 요청은 빼고, 파일을 고른 뒤부터 센다
  await frame.locator('input[type=file]').setInputFiles(fixture('three-pages.pdf'));
  await frame.getByText('한 장씩 나누기').click();
  await frame.getByRole('button', { name: 'PDF 나누기' }).click();
  await expect(frame.getByRole('button', { name: '다운로드' })).toBeVisible();
  await page.waitForLoadState('networkidle');

  expectLocalOnly(requests, baseURL!);
});
