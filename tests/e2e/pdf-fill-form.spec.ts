/**
 * PDF 양식 채우기 E2E. 빌드 결과에서 돌린다 (playwright.config.ts 참고).
 *
 * 쪽 위에 겹친 입력 칸으로 값을 넣고, 받은 PDF의 칸 값(pdf-lib로 읽음)과 굳힌 글자를 확인한다.
 */
import { expect, test, type Page, type Request } from './test';
import { readFile } from 'node:fs/promises';
import { PDFDocument } from '@cantoo/pdf-lib';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { expectLocalOnly } from './local-only';

/** 글자 칸·체크 상자·라디오(S/L)·선택 상자(Seoul/Busan)가 있는 신청서 */
async function formPdf() {
  const doc = await PDFDocument.create();
  const page = doc.addPage([400, 400]);
  const form = doc.getForm();
  form.createTextField('name').addToPage(page, { x: 20, y: 320, width: 200, height: 24 });
  form.createCheckBox('agree').addToPage(page, { x: 20, y: 270, width: 16, height: 16 });
  const size = form.createRadioGroup('size');
  size.addOptionToPage('S', page, { x: 20, y: 220, width: 14, height: 14 });
  size.addOptionToPage('L', page, { x: 60, y: 220, width: 14, height: 14 });
  const city = form.createDropdown('city');
  city.addOptions(['Seoul', 'Busan']);
  city.addToPage(page, { x: 20, y: 170, width: 120, height: 20 });
  return Buffer.from(await doc.save());
}

async function openTool(page: Page) {
  await page.goto('/pdf/fill-form/');
  const frame = page.frameLocator('iframe[data-tool-frame]');
  await frame.locator('input[type=file]').setInputFiles({
    name: 'application.pdf',
    mimeType: 'application/pdf',
    buffer: await formPdf(),
  });
  await expect(frame.getByText('입력 칸 5개', { exact: false })).toBeVisible();
  return frame;
}

async function download(page: Page, frame: ReturnType<Page['frameLocator']>) {
  await frame.getByRole('button', { name: '양식 저장' }).click();
  const event = page.waitForEvent('download');
  await frame.getByRole('button', { name: '다운로드' }).click();
  const file = await event;
  return {
    name: file.suggestedFilename(),
    bytes: new Uint8Array(await readFile(await file.path())),
  };
}

test('글자·체크·라디오·선택 칸을 채우고, 한글은 고른 글꼴로 넣는다', async ({ page, baseURL }) => {
  const requests: Request[] = [];
  page.on('request', (request) => requests.push(request));
  const frame = await openTool(page);
  requests.length = 0;
  await expect(frame.getByRole('button', { name: '양식 저장' })).toBeDisabled();

  await frame.getByLabel('name').fill('홍길동');
  // 한글을 적으면 글꼴을 고르게 한다
  await expect(
    frame.getByText('적은 글자를 쓰려면 아래에서 글꼴을 고르세요.', { exact: false }),
  ).toBeVisible();
  await frame.getByRole('button', { name: '기본 고딕 받기' }).click();
  await frame.getByLabel('agree').check();
  await frame.getByLabel('size: L').check();
  await frame.getByLabel('city').selectOption('Busan');
  await expect(frame.getByText('4칸을 고쳤습니다.', { exact: false })).toBeVisible();

  const { name, bytes } = await download(page, frame);
  expect(name).toBe('application_작성.pdf');
  const form = (await PDFDocument.load(bytes)).getForm();
  expect(form.getTextField('name').getText()).toBe('홍길동');
  expect(form.getCheckBox('agree').isChecked()).toBe(true);
  expect(form.getRadioGroup('size').getSelected()).toBe('L');
  expect(form.getDropdown('city').getSelected()).toEqual(['Busan']);
  expectLocalOnly(page, requests, baseURL!);
});

test('굳히면 칸이 사라지고 적은 글자가 쪽에 남는다', async ({ page }) => {
  const frame = await openTool(page);
  await frame.getByLabel('name').fill('Alice Kim');
  await frame.getByLabel('칸을 글자로 굳히기', { exact: false }).check();
  const { bytes } = await download(page, frame);
  expect((await PDFDocument.load(bytes)).getForm().getFields()).toHaveLength(0);
  const doc = await getDocument({ data: bytes.slice() }).promise;
  const content = await (await doc.getPage(1)).getTextContent();
  expect(content.items.map((item) => ('str' in item ? item.str : '')).join('')).toContain(
    'Alice Kim',
  );
});

test('입력 칸이 없는 PDF는 편집 도구를 안내한다', async ({ page }) => {
  await page.goto('/pdf/fill-form/');
  const frame = page.frameLocator('iframe[data-tool-frame]');
  const doc = await PDFDocument.create();
  doc.addPage([200, 200]);
  await frame.locator('input[type=file]').setInputFiles({
    name: 'plain.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from(await doc.save()),
  });
  await expect(frame.getByText('채울 수 있는 입력 칸이 없습니다', { exact: false })).toBeVisible();
});

test('한글을 굳히면 고른 글꼴로 그린 글자가 쪽에 남는다', async ({ page }) => {
  const frame = await openTool(page);
  await frame.getByLabel('name').fill('김철수');
  await frame.getByRole('button', { name: '기본 고딕 받기' }).click();
  await frame.getByLabel('칸을 글자로 굳히기', { exact: false }).check();
  const { bytes } = await download(page, frame);
  const doc = await getDocument({ data: bytes.slice() }).promise;
  const content = await (await doc.getPage(1)).getTextContent();
  expect(content.items.map((item) => ('str' in item ? item.str : '')).join('')).toContain('김철수');
});
