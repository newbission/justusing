/**
 * 전자 서명된 PDF 안내 E2E. 고친 PDF를 저장하는 도구는 파일을 새로 쓰므로 서명이 깨진다고 알려야 한다.
 */
import { expect, test, type Page } from './test';
import { PDFDocument } from '@cantoo/pdf-lib';
import { signedPdf } from './signed-pdf';

const NOTE = '전자 서명된 PDF입니다';

async function open(page: Page, path: string, buffer: Buffer) {
  await page.goto(path);
  const frame = page.frameLocator('iframe[data-tool-frame]');
  await frame.locator('input[type=file]').setInputFiles({
    name: 'contract.pdf',
    mimeType: 'application/pdf',
    buffer,
  });
  return frame;
}

for (const path of [
  '/pdf/rotate/',
  '/pdf/watermark/',
  '/pdf/fill-form/',
  '/pdf/merge/',
  '/pdf/redact/',
]) {
  test(`${path}: 서명된 PDF를 넣으면 서명이 깨진다고 알린다`, async ({ page }) => {
    const frame = await open(page, path, await signedPdf());
    await expect(frame.getByText(NOTE, { exact: false })).toBeVisible();
  });
}

test('서명이 없는 PDF에는 알리지 않는다', async ({ page }) => {
  const doc = await PDFDocument.create();
  doc.addPage([200, 200]);
  const frame = await open(page, '/pdf/rotate/', Buffer.from(await doc.save()));
  await expect(frame.getByText('1쪽', { exact: true })).toBeVisible();
  await expect(frame.getByText(NOTE, { exact: false })).toHaveCount(0);
});

test('파일을 고치지 않는 도구(PDF를 이미지로)는 알리지 않는다', async ({ page }) => {
  const frame = await open(page, '/pdf/to-image/', await signedPdf());
  await expect(frame.getByText('1쪽', { exact: true })).toBeVisible();
  await expect(frame.getByText(NOTE, { exact: false })).toHaveCount(0);
});
