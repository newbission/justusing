/**
 * PDF 회전 E2E. 빌드 결과에서 돌린다 (playwright.config.ts 참고).
 *
 * 받은 파일을 직접 열어 쪽마다 각도를 확인하고,
 * 돌리는 동안 파일이 기기를 떠나지 않는다는 약속을 확인한다.
 */
import { expect, test, type Page, type Request } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { PDFDocument } from '@cantoo/pdf-lib';
import { expectLocalOnly } from './local-only';

const fixture = (name: string) => fileURLToPath(new URL(`../fixtures/${name}`, import.meta.url));

async function openRotate(page: Page, file: string) {
  await page.goto('/pdf/rotate/');
  const frame = page.frameLocator('iframe[data-tool-frame]');
  await frame.locator('input[type=file]').setInputFiles(fixture(file));
  return frame;
}

/** 다운로드한 PDF의 쪽마다 각도 */
async function downloadAngles(page: Page, frame: ReturnType<Page['frameLocator']>) {
  const event = page.waitForEvent('download');
  await frame.getByRole('button', { name: '다운로드' }).click();
  const file = await event;
  const doc = await PDFDocument.load(await readFile(await file.path()));
  return {
    name: file.suggestedFilename(),
    angles: doc.getPages().map((p) => p.getRotation().angle),
  };
}

test('쪽마다·전체로 돌린 각도가 결과에 들어간다', async ({ page }) => {
  const frame = await openRotate(page, 'three-pages.pdf');
  // 돌린 쪽이 없으면 실행할 수 없다
  await expect(frame.getByRole('button', { name: 'PDF 회전' })).toBeDisabled();

  await frame.getByRole('button', { name: '1쪽 오른쪽으로 돌리기' }).click();
  await frame.getByRole('button', { name: '전체 ↺' }).click();
  await expect(frame.getByText('2쪽을 돌렸습니다.')).toBeVisible();
  await frame.getByRole('button', { name: 'PDF 회전' }).click();

  const { name, angles } = await downloadAngles(page, frame);
  expect(name).toBe('three-pages_회전.pdf');
  expect(angles).toEqual([0, 270, 270]);
});

test('되돌리기로 처음 상태가 되면 실행할 수 없다', async ({ page }) => {
  const frame = await openRotate(page, 'three-pages.pdf');
  await frame.getByRole('button', { name: '전체 ↻' }).click();
  await expect(frame.getByRole('button', { name: 'PDF 회전' })).toBeEnabled();
  await frame.getByRole('button', { name: '되돌리기' }).click();
  await expect(frame.getByRole('button', { name: 'PDF 회전' })).toBeDisabled();
  await expect(frame.getByText('돌린 쪽이 없습니다.')).toBeVisible();
});

test('암호 PDF도 풀어서 돌린다', async ({ page }) => {
  const frame = await openRotate(page, 'encrypted.pdf');
  await frame.getByLabel('PDF 암호').fill('1234');
  await frame.getByLabel('PDF 암호').press('Enter');
  await frame.getByRole('button', { name: '1쪽 오른쪽으로 돌리기' }).click();
  await frame.getByRole('button', { name: 'PDF 회전' }).click();
  expect((await downloadAngles(page, frame)).angles).toEqual([90]);
});

test('돌리는 동안의 요청에는 파일이 기기 밖으로 나가는 것이 없다', async ({ page, baseURL }) => {
  const requests: Request[] = [];
  page.on('request', (request) => requests.push(request));

  await page.goto('/pdf/rotate/');
  const frame = page.frameLocator('iframe[data-tool-frame]');
  await frame.locator('input[type=file]').waitFor({ state: 'attached' });
  requests.length = 0; // 페이지를 여는 요청은 빼고, 파일을 고른 뒤부터 센다
  await frame.locator('input[type=file]').setInputFiles(fixture('three-pages.pdf'));
  await frame.getByRole('button', { name: '전체 ↻' }).click();
  await frame.getByRole('button', { name: 'PDF 회전' }).click();
  await expect(frame.getByRole('button', { name: '다운로드' })).toBeVisible();
  await page.waitForLoadState('networkidle');

  expectLocalOnly(page, requests, baseURL!);
});
