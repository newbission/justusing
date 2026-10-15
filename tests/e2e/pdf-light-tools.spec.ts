/**
 * PDF 암호 해제·암호 걸기·쪽 번호·글자 추출 E2E. 빌드 결과에서 돌린다 (playwright.config.ts 참고).
 *
 * 받은 파일을 직접 열어 결과를 확인하고, 처리하는 동안 파일이 기기를 떠나지 않는다는 약속을 확인한다.
 */
import { expect, test, type Page, type Request } from './test';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { PDFDocument, degrees } from '@cantoo/pdf-lib';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { expectLocalOnly } from './local-only';

const fixture = (name: string) => fileURLToPath(new URL(`../fixtures/${name}`, import.meta.url));

type Frame = ReturnType<Page['frameLocator']>;

async function openTool(page: Page, tool: string, file: string | { name: string; buffer: Buffer }) {
  await page.goto(`/pdf/${tool}/`);
  const frame = page.frameLocator('iframe[data-tool-frame]');
  await frame
    .locator('input[type=file]')
    .setInputFiles(
      typeof file === 'string'
        ? fixture(file)
        : { name: file.name, mimeType: 'application/pdf', buffer: file.buffer },
    );
  return frame;
}

async function download(page: Page, frame: Frame, button = '다운로드') {
  const event = page.waitForEvent('download');
  await frame.getByRole('button', { name: button }).click();
  const file = await event;
  return {
    name: file.suggestedFilename(),
    bytes: new Uint8Array(await readFile(await file.path())),
  };
}

/** PDF의 쪽마다 글자. 암호가 있으면 그 암호로 연다 */
async function pageTexts(bytes: Uint8Array, password?: string) {
  const task = getDocument({ data: bytes.slice(), password });
  const doc = await task.promise;
  const texts: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const content = await (await doc.getPage(i)).getTextContent();
    texts.push(content.items.map((item) => ('str' in item ? item.str : '')).join(''));
  }
  await task.destroy();
  return texts;
}

/** pdf.js가 암호화된 PDF로 읽는지 (암호 없이 열 수 있는 PDF만) */
async function isEncrypted(bytes: Uint8Array) {
  const task = getDocument({ data: bytes.slice() });
  const { info } = await (await task.promise).getMetadata();
  await task.destroy();
  return Boolean((info as { EncryptFilterName?: string | null }).EncryptFilterName);
}

test('암호 해제: 암호를 넣어 연 PDF를 암호 없는 PDF로 받는다', async ({ page }) => {
  const frame = await openTool(page, 'unlock', 'encrypted.pdf');
  await frame.getByLabel('PDF 암호').fill('1234');
  await frame.getByLabel('PDF 암호').press('Enter');
  await expect(frame.getByText('암호를 풀었습니다.', { exact: false })).toBeVisible();
  await frame.getByRole('button', { name: '암호 해제' }).click();

  const { name, bytes } = await download(page, frame);
  expect(name).toBe('encrypted_암호해제.pdf');
  expect(await isEncrypted(bytes)).toBe(false);
  expect(await pageTexts(bytes)).toEqual(['Secret page']);
});

test('암호 해제: 인쇄·복사 제한만 걸린 PDF는 암호 없이 풀고, 암호 없는 PDF는 풀 것이 없다', async ({
  page,
}) => {
  // 열기 암호는 없고 소유자 암호(제한)만 있는 PDF
  const doc = await PDFDocument.load(await readFile(fixture('three-pages.pdf')));
  doc.encrypt({ userPassword: '', ownerPassword: 'owner', permissions: { printing: false } });
  const restricted = Buffer.from(await doc.save());

  const frame = await openTool(page, 'unlock', { name: 'restricted.pdf', buffer: restricted });
  await expect(frame.getByText('제한이 걸린 PDF입니다', { exact: false })).toBeVisible();
  await frame.getByRole('button', { name: '암호 해제' }).click();
  const { bytes } = await download(page, frame);
  expect(await isEncrypted(bytes)).toBe(false);
  expect(await pageTexts(bytes)).toEqual(['Page 1', 'Page 2', 'Page 3']);

  await frame.getByRole('button', { name: '다른 파일' }).click();
  await frame.locator('input[type=file]').setInputFiles(fixture('three-pages.pdf'));
  await expect(frame.getByText('이 PDF에는 암호나 제한이 없습니다.')).toBeVisible();
  await expect(frame.getByRole('button', { name: '암호 해제' })).toBeDisabled();
});

test('암호 걸기: 두 암호가 같아야 걸고, 받은 PDF는 그 암호로만 열린다', async ({ page }) => {
  const frame = await openTool(page, 'protect', 'three-pages.pdf');
  const run = frame.getByRole('button', { name: '암호 걸기' });
  await expect(run).toBeDisabled();
  await frame.getByLabel('새 암호').fill('secret');
  await frame.getByLabel('암호 확인').fill('secreT');
  await expect(frame.getByText('두 암호가 서로 다릅니다.')).toBeVisible();
  await expect(run).toBeDisabled();
  await frame.getByLabel('암호 확인').fill('secret');
  await run.click();

  const { name, bytes } = await download(page, frame);
  expect(name).toBe('three-pages_암호.pdf');
  await expect(pageTexts(bytes)).rejects.toThrow();
  expect(await pageTexts(bytes, 'secret')).toEqual(['Page 1', 'Page 2', 'Page 3']);
});

test('쪽 번호: 고른 모양과 시작 번호로 모든 쪽에 넣는다', async ({ page }) => {
  const frame = await openTool(page, 'page-numbers', 'three-pages.pdf');
  await frame.getByText('1 / 3', { exact: true }).click();
  await frame.getByLabel('시작 번호').fill('5');
  // 쪽 격자에 들어갈 번호가 미리 보인다
  await expect(frame.locator('.note')).toHaveText(['5 / 7', '6 / 7', '7 / 7']);
  await frame.getByRole('button', { name: '쪽 번호 넣기' }).click();

  const { name, bytes } = await download(page, frame);
  expect(name).toBe('three-pages_쪽번호.pdf');
  expect(await pageTexts(bytes)).toEqual(['Page 15 / 7', 'Page 26 / 7', 'Page 37 / 7']);
});

test('쪽 번호: 돌린 쪽에서도 화면에 보이는 쪽의 아래 가운데에 넣는다', async ({ page }) => {
  // 쪽마다 0·90·180·270도 돌린 PDF
  const doc = await PDFDocument.load(await readFile(fixture('three-pages.pdf')));
  doc.addPage([595, 842]);
  doc.getPages().forEach((p, i) => p.setRotation(degrees(i * 90)));
  const rotated = Buffer.from(await doc.save());

  const frame = await openTool(page, 'page-numbers', { name: 'rotated.pdf', buffer: rotated });
  await frame.getByRole('button', { name: '쪽 번호 넣기' }).click();
  const { bytes } = await download(page, frame);

  const task = getDocument({ data: bytes });
  const result = await task.promise;
  for (let i = 1; i <= result.numPages; i++) {
    const pdfPage = await result.getPage(i);
    const viewport = pdfPage.getViewport({ scale: 1 });
    const items = (await pdfPage.getTextContent()).items.filter(
      (item) => 'str' in item && item.str === String(i),
    );
    expect(items, `${i}쪽 번호`).toHaveLength(1);
    const item = items[0] as { transform: number[] };
    // 글자 기준점을 화면 좌표로: 가로는 가운데 근처, 세로는 아래쪽
    const [x, y] = viewport.convertToViewportPoint(item.transform[4]!, item.transform[5]!);
    expect(Math.abs(x! - viewport.width / 2), `${i}쪽 가로`).toBeLessThan(20);
    expect(viewport.height - y!, `${i}쪽 세로`).toBeLessThan(40);
  }
  await task.destroy();
});

test('글자 추출: 쪽마다 글자를 보여 주고 TXT로 받는다', async ({ page }) => {
  const frame = await openTool(page, 'extract-text', 'three-pages.pdf');
  await expect(frame.getByLabel('추출한 글자')).toHaveValue(/--- 1쪽 ---\nPage 1/);

  const { name, bytes } = await download(page, frame, 'TXT 다운로드');
  expect(name).toBe('three-pages.txt');
  const text = new TextDecoder().decode(bytes);
  expect(text).toBe(
    '--- 1쪽 ---\r\nPage 1\r\n\r\n--- 2쪽 ---\r\nPage 2\r\n\r\n--- 3쪽 ---\r\nPage 3',
  );

  // 한글 (CMap 파일을 받아야 읽힌다)
  await frame.getByRole('button', { name: '다른 파일' }).click();
  await frame.locator('input[type=file]').setInputFiles(fixture('korean.pdf'));
  await expect(frame.getByLabel('추출한 글자')).toHaveValue('안녕하세요 한글 PDF');
});

test('처리하는 동안의 요청에는 파일이 기기 밖으로 나가는 것이 없다', async ({ page, baseURL }) => {
  const requests: Request[] = [];
  page.on('request', (request) => requests.push(request));

  await page.goto('/pdf/protect/');
  const frame = page.frameLocator('iframe[data-tool-frame]');
  await frame.locator('input[type=file]').waitFor({ state: 'attached' });
  requests.length = 0; // 페이지를 여는 요청은 빼고, 파일을 고른 뒤부터 센다
  await frame.locator('input[type=file]').setInputFiles(fixture('three-pages.pdf'));
  await frame.getByLabel('새 암호').fill('secret');
  await frame.getByLabel('암호 확인').fill('secret');
  await frame.getByRole('button', { name: '암호 걸기' }).click();
  await expect(frame.getByRole('button', { name: '다운로드' })).toBeVisible();
  await page.waitForLoadState('networkidle');

  expectLocalOnly(page, requests, baseURL!);
});
