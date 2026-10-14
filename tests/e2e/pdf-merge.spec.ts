/**
 * PDF 합치기 E2E. 빌드 결과에서 돌린다 (playwright.config.ts 참고).
 *
 * 받은 파일을 직접 열어 순서·쪽수·암호 해제를 확인하고,
 * 합치는 동안 파일이 기기를 떠나지 않는다는 약속을 확인한다.
 */
import { expect, test, type Page, type Request } from './test';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { expectLocalOnly } from './local-only';

const fixture = (name: string) => fileURLToPath(new URL(`../fixtures/${name}`, import.meta.url));

async function openMerge(page: Page) {
  await page.goto('/pdf/merge/');
  const frame = page.frameLocator('iframe[data-tool-frame]');
  await frame.locator('input[type=file]').waitFor({ state: 'attached' });
  return frame;
}

/** 받은 PDF의 쪽마다 글자를 읽는다 */
async function pageTexts(path: string) {
  const task = getDocument({ data: new Uint8Array(await readFile(path)) });
  const doc = await task.promise;
  const texts: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const content = await (await doc.getPage(i)).getTextContent();
    texts.push(content.items.map((item) => ('str' in item ? item.str : '')).join(''));
  }
  await task.destroy();
  return texts;
}

test('정한 순서대로 합치고, 암호 PDF도 풀어서 넣는다', async ({ page }) => {
  const frame = await openMerge(page);
  await frame
    .locator('input[type=file]')
    .first()
    .setInputFiles([fixture('three-pages.pdf'), fixture('encrypted.pdf')]);

  // 암호를 넣기 전에는 합칠 수 없다
  await expect(frame.getByRole('button', { name: 'PDF 합치기' })).toBeDisabled();
  await frame.getByLabel('encrypted.pdf 암호').fill('1234');
  await frame.getByLabel('encrypted.pdf 암호').press('Enter');
  await expect(frame.getByText('파일 2개 · 총 4쪽')).toBeVisible();

  // 암호 PDF를 맨 위로 올린다
  await frame.getByRole('button', { name: 'encrypted.pdf 위로' }).click();
  await frame.getByRole('button', { name: 'PDF 합치기' }).click();

  const download = page.waitForEvent('download');
  await frame.getByRole('button', { name: '다운로드' }).click();
  const file = await download;
  expect(file.suggestedFilename()).toBe('encrypted_합침.pdf');

  const path = await file.path();
  expect(await pageTexts(path)).toEqual(['Secret page', 'Page 1', 'Page 2', 'Page 3']);
  // 결과 파일에는 암호가 걸리지 않는다
  expect((await readFile(path)).includes('/Encrypt')).toBe(false);
});

test('합친 뒤 목록을 바꾸면 다시 합쳐야 한다', async ({ page }) => {
  const frame = await openMerge(page);
  await frame
    .locator('input[type=file]')
    .first()
    .setInputFiles([fixture('three-pages.pdf'), fixture('korean.pdf')]);
  await frame.getByRole('button', { name: 'PDF 합치기' }).click();
  await expect(frame.getByRole('button', { name: '다운로드' })).toBeVisible();

  await frame.getByRole('button', { name: 'korean.pdf 위로' }).click();
  await expect(frame.getByRole('button', { name: 'PDF 합치기' })).toBeEnabled();
  await expect(frame.getByRole('button', { name: '다운로드' })).toHaveCount(0);
});

test('파일이 하나뿐이면 합칠 수 없다', async ({ page }) => {
  const frame = await openMerge(page);
  await frame
    .locator('input[type=file]')
    .first()
    .setInputFiles([fixture('three-pages.pdf')]);
  await expect(frame.getByText('합칠 PDF를 2개 이상 넣어 주세요.')).toBeVisible();
  await expect(frame.getByRole('button', { name: 'PDF 합치기' })).toBeDisabled();
});

test('합치는 동안의 요청에는 파일이 기기 밖으로 나가는 것이 없다', async ({ page, baseURL }) => {
  const requests: Request[] = [];
  page.on('request', (request) => requests.push(request));

  const frame = await openMerge(page);
  requests.length = 0; // 페이지를 여는 요청은 빼고, 파일을 고른 뒤부터 센다
  await frame
    .locator('input[type=file]')
    .first()
    .setInputFiles([fixture('three-pages.pdf'), fixture('korean.pdf')]);
  await frame.getByRole('button', { name: 'PDF 합치기' }).click();
  await expect(frame.getByRole('button', { name: '다운로드' })).toBeVisible();
  await page.waitForLoadState('networkidle');

  expectLocalOnly(page, requests, baseURL!);
});

test('줄을 끌어서 순서를 바꾼다', async ({ page }) => {
  const frame = await openMerge(page);
  await frame
    .locator('input[type=file]')
    .first()
    .setInputFiles([fixture('three-pages.pdf'), fixture('korean.pdf')]);
  const rows = frame.locator('.row');
  await expect(rows.nth(1)).toContainText('1쪽');

  // 두 번째 줄을 첫 번째 줄 윗부분에 놓는다
  await rows.nth(1).dragTo(rows.nth(0), { targetPosition: { x: 100, y: 5 } });
  await expect(rows.nth(0)).toContainText('korean.pdf');
  await expect(rows.nth(1)).toContainText('three-pages.pdf');
});

test('펼친 페이지에서 순서를 바꾸고 뺀 대로 합친다', async ({ page }) => {
  const frame = await openMerge(page);
  await frame
    .locator('input[type=file]')
    .first()
    .setInputFiles([fixture('three-pages.pdf'), fixture('encrypted.pdf')]);
  await frame.getByLabel('encrypted.pdf 암호').fill('1234');
  await frame.getByLabel('encrypted.pdf 암호').press('Enter');

  await frame.getByRole('button', { name: 'three-pages.pdf 페이지 펼치기' }).click();
  await frame.getByRole('button', { name: '원래 2쪽 제외' }).click();
  // 3쪽을 맨 앞으로: 1 2 3 → 3 1 2 (2쪽은 제외)
  await frame.getByRole('button', { name: '원래 3쪽 앞으로' }).click();
  await frame.getByRole('button', { name: '원래 3쪽 앞으로' }).click();
  await expect(frame.getByText('3쪽 중 2쪽 넣음')).toBeVisible();
  await expect(frame.getByText('파일 2개 · 총 3쪽')).toBeVisible();

  // 미리보기는 합칠 순서 그대로 보여 준다
  await frame.getByRole('button', { name: '미리보기' }).click();
  await expect(frame.getByRole('dialog').locator('.caption')).toHaveText([
    '1쪽 · three-pages.pdf 3쪽',
    '2쪽 · three-pages.pdf 1쪽',
    '3쪽 · encrypted.pdf 1쪽',
  ]);
  await frame.getByRole('button', { name: '닫기' }).click();

  await frame.getByRole('button', { name: 'PDF 합치기' }).click();
  const download = page.waitForEvent('download');
  await frame.getByRole('button', { name: '다운로드' }).click();
  expect(await pageTexts(await (await download).path())).toEqual([
    'Page 3',
    'Page 1',
    'Secret page',
  ]);
});

test('펼친 페이지를 끌어서 순서를 바꾼다', async ({ page }) => {
  const frame = await openMerge(page);
  await frame
    .locator('input[type=file]')
    .first()
    .setInputFiles([fixture('three-pages.pdf'), fixture('korean.pdf')]);
  await frame.getByRole('button', { name: 'three-pages.pdf 페이지 펼치기' }).click();

  const cards = frame.locator('[data-page-index]');
  // 세 번째 페이지를 첫 번째 페이지 왼쪽에 놓는다
  await cards.nth(2).dragTo(cards.nth(0), { targetPosition: { x: 5, y: 40 } });
  await expect
    .poll(() => cards.evaluateAll((list) => list.map((card) => card.dataset.pageIndex)))
    .toEqual(['2', '0', '1']);
  // 페이지 끌기는 파일 순서를 건드리지 않는다
  await expect(frame.locator('.row').first()).toContainText('three-pages.pdf');
});
