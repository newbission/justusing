/**
 * PDF 페이지 정리 E2E. 빌드 결과에서 돌린다 (playwright.config.ts 참고).
 *
 * 받은 파일을 직접 열어 쪽 순서를 확인하고,
 * 정리하는 동안 파일이 기기를 떠나지 않는다는 약속을 확인한다.
 */
import { expect, test, type Page, type Request } from './test';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { expectLocalOnly } from './local-only';

const fixture = (name: string) => fileURLToPath(new URL(`../fixtures/${name}`, import.meta.url));

async function openOrganize(page: Page, file: string) {
  await page.goto('/pdf/organize/');
  const frame = page.frameLocator('iframe[data-tool-frame]');
  await frame.locator('input[type=file]').setInputFiles(fixture(file));
  return frame;
}

/** 다운로드한 PDF의 쪽마다 글자 */
async function downloadTexts(page: Page, frame: ReturnType<Page['frameLocator']>) {
  const event = page.waitForEvent('download');
  await frame.getByRole('button', { name: '다운로드' }).click();
  const file = await event;
  const task = getDocument({ data: new Uint8Array(await readFile(await file.path())) });
  const doc = await task.promise;
  const texts: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const content = await (await doc.getPage(i)).getTextContent();
    texts.push(content.items.map((item) => ('str' in item ? item.str : '')).join(''));
  }
  await task.destroy();
  return { name: file.suggestedFilename(), texts };
}

test('순서를 바꾸고 뺀 대로 새 PDF를 만든다', async ({ page }) => {
  const frame = await openOrganize(page, 'three-pages.pdf');
  // 바꾼 내용이 없으면 실행할 수 없다
  await expect(frame.getByRole('button', { name: 'PDF 정리' })).toBeDisabled();

  // 3쪽을 맨 앞으로, 2쪽은 제외 → 3, 1
  await frame.getByRole('button', { name: '원래 3쪽 앞으로' }).click();
  await frame.getByRole('button', { name: '원래 3쪽 앞으로' }).click();
  await frame.getByRole('button', { name: '원래 2쪽 제외' }).click();
  await expect(frame.getByText('3쪽 중 2쪽 남김 · 순서 바뀜')).toBeVisible();
  await frame.getByRole('button', { name: 'PDF 정리' }).click();

  const { name, texts } = await downloadTexts(page, frame);
  expect(name).toBe('three-pages_정리.pdf');
  expect(texts).toEqual(['Page 3', 'Page 1']);
});

test('모든 쪽을 빼면 실행할 수 없고, 되돌리기로 처음 상태가 된다', async ({ page }) => {
  const frame = await openOrganize(page, 'three-pages.pdf');
  for (const n of [1, 2, 3]) await frame.getByRole('button', { name: `원래 ${n}쪽 제외` }).click();
  await expect(frame.getByText('남길 쪽이 하나도 없습니다.')).toBeVisible();
  await expect(frame.getByRole('button', { name: 'PDF 정리' })).toBeDisabled();

  await frame.getByRole('button', { name: '되돌리기' }).click();
  await expect(frame.getByText('바꾼 내용이 없습니다.')).toBeVisible();
});

test('쪽을 끌어서 순서를 바꾼다', async ({ page }) => {
  const frame = await openOrganize(page, 'three-pages.pdf');
  const cards = frame.locator('[data-page-index]');
  await cards.nth(2).dragTo(cards.nth(0), { targetPosition: { x: 5, y: 40 } });
  await frame.getByRole('button', { name: 'PDF 정리' }).click();
  expect((await downloadTexts(page, frame)).texts).toEqual(['Page 3', 'Page 1', 'Page 2']);
});

test('정리하는 동안의 요청에는 파일이 기기 밖으로 나가는 것이 없다', async ({ page, baseURL }) => {
  const requests: Request[] = [];
  page.on('request', (request) => requests.push(request));

  await page.goto('/pdf/organize/');
  const frame = page.frameLocator('iframe[data-tool-frame]');
  await frame.locator('input[type=file]').waitFor({ state: 'attached' });
  requests.length = 0; // 페이지를 여는 요청은 빼고, 파일을 고른 뒤부터 센다
  await frame.locator('input[type=file]').setInputFiles(fixture('three-pages.pdf'));
  await frame.getByRole('button', { name: '원래 2쪽 제외' }).click();
  await frame.getByRole('button', { name: 'PDF 정리' }).click();
  await expect(frame.getByRole('button', { name: '다운로드' })).toBeVisible();
  await page.waitForLoadState('networkidle');

  expectLocalOnly(page, requests, baseURL!);
});
