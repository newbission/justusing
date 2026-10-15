/**
 * PDF를 이미지로 E2E. 빌드 결과에서 돌린다 (playwright.config.ts 참고).
 *
 * 받은 이미지(또는 ZIP)의 형식·크기를 직접 확인하고,
 * 변환하는 동안 파일이 기기를 떠나지 않는다는 약속을 확인한다.
 */
import { expect, test, type Page, type Request } from './test';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { unzipSync } from 'fflate';
import { expectLocalOnly } from './local-only';

const fixture = (name: string) => fileURLToPath(new URL(`../fixtures/${name}`, import.meta.url));

async function openTool(page: Page, file: string) {
  await page.goto('/pdf/to-image/');
  const frame = page.frameLocator('iframe[data-tool-frame]');
  await frame.locator('input[type=file]').setInputFiles(fixture(file));
  return frame;
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

const isJpeg = (bytes: Uint8Array) => bytes[0] === 0xff && bytes[1] === 0xd8;

/** PNG의 가로·세로 (IHDR) */
function pngSize(bytes: Uint8Array) {
  expect([...bytes.slice(1, 4)]).toEqual([0x50, 0x4e, 0x47]); // 'PNG'
  const view = new DataView(bytes.buffer, bytes.byteOffset);
  return { width: view.getUint32(16), height: view.getUint32(20) };
}

test('전체 추출은 모든 쪽을 JPG로 만들어 ZIP 하나로 받는다', async ({ page }) => {
  const frame = await openTool(page, 'three-pages.pdf');
  await expect(frame.getByText('이미지 3장을 만듭니다.', { exact: false })).toBeVisible();
  await frame.getByRole('button', { name: '이미지로 변환' }).click();

  const { name, bytes } = await download(page, frame);
  expect(name).toBe('three-pages_이미지.zip');
  const entries = unzipSync(bytes);
  expect(Object.keys(entries)).toEqual([
    'three-pages_1.jpg',
    'three-pages_2.jpg',
    'three-pages_3.jpg',
  ]);
  expect(Object.values(entries).every(isJpeg)).toBe(true);
});

test('선택 추출로 한 쪽만 고르면 PNG 한 장을 바로 받고, 화질에 따라 크기가 바뀐다', async ({
  page,
}) => {
  const frame = await openTool(page, 'three-pages.pdf');
  await frame.getByText('선택 추출', { exact: true }).click();
  await expect(frame.getByRole('button', { name: '이미지로 변환' })).toBeDisabled();
  await frame.getByRole('button', { name: '2쪽' }).click();
  await frame.getByText('PNG', { exact: true }).click();
  await frame.getByRole('button', { name: '이미지로 변환' }).click();

  // A4(595×842pt)를 150 DPI로
  const standard = await download(page, frame);
  expect(standard.name).toBe('three-pages_2.png');
  expect(pngSize(standard.bytes)).toEqual({ width: 1239, height: 1754 });

  // 화질을 바꾸면 결과가 다시 만들기로 돌아간다
  await frame.getByText('고화질 (300 DPI)').click();
  await expect(frame.getByRole('button', { name: '다운로드' })).toHaveCount(0);
  await frame.getByRole('button', { name: '이미지로 변환' }).click();
  const high = await download(page, frame);
  expect(pngSize(high.bytes)).toEqual({ width: 2479, height: 3508 });
});

test('암호 PDF도 암호를 넣으면 이미지로 만든다', async ({ page }) => {
  const frame = await openTool(page, 'encrypted.pdf');
  await frame.getByLabel('PDF 암호').fill('1234');
  await frame.getByLabel('PDF 암호').press('Enter');
  await frame.getByRole('button', { name: '이미지로 변환' }).click();

  const { name, bytes } = await download(page, frame);
  expect(name).toBe('encrypted_1.jpg');
  expect(isJpeg(bytes)).toBe(true);
});

test('변환하는 동안의 요청에는 파일이 기기 밖으로 나가는 것이 없다', async ({ page, baseURL }) => {
  const requests: Request[] = [];
  page.on('request', (request) => requests.push(request));

  await page.goto('/pdf/to-image/');
  const frame = page.frameLocator('iframe[data-tool-frame]');
  await frame.locator('input[type=file]').waitFor({ state: 'attached' });
  requests.length = 0; // 페이지를 여는 요청은 빼고, 파일을 고른 뒤부터 센다
  await frame.locator('input[type=file]').setInputFiles(fixture('three-pages.pdf'));
  await frame.getByRole('button', { name: '이미지로 변환' }).click();
  await expect(frame.getByRole('button', { name: '다운로드' })).toBeVisible();
  await page.waitForLoadState('networkidle');

  expectLocalOnly(page, requests, baseURL!);
});
