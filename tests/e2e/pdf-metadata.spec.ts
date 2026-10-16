/**
 * PDF 문서 정보 E2E. 빌드 결과에서 돌린다 (playwright.config.ts 참고).
 *
 * 받은 PDF의 Info를 pdf-lib로 읽어, 적은 값이 들어갔는지와 "모두 지우기"가 숨은 정보를 지웠는지 확인한다.
 */
import { expect, test, type Page, type Request } from './test';
import { readFile } from 'node:fs/promises';
import { PDFDict, PDFDocument, PDFName, PDFString } from '@cantoo/pdf-lib';
import { expectLocalOnly } from './local-only';

const infoOf = (doc: PDFDocument) => doc.context.lookup(doc.context.trailerInfo.Info) as PDFDict;

async function infoPdf() {
  const doc = await PDFDocument.create();
  doc.addPage([200, 200]);
  doc.setTitle('Old title');
  doc.setAuthor('Kim Secret');
  doc.setCreator('Secret Office 2026');
  doc.setProducer('Secret PDF Maker');
  doc.setCreationDate(new Date(2026, 0, 2, 3, 4));
  // 워드 등이 더하는 사용자 정의 항목
  infoOf(doc).set(PDFName.of('Company'), PDFString.of('Secret Corp'));
  // 따로 된 객체로 들어 있는 XMP (참조만 끊으면 파일에 남는다)
  doc.catalog.set(
    PDFName.of('Metadata'),
    doc.context.register(
      doc.context.stream('<x:xmpmeta><dc:creator>XMP Secret Kim</dc:creator></x:xmpmeta>', {
        Type: 'Metadata',
        Subtype: 'XML',
      }),
    ),
  );
  return Buffer.from(await doc.save({ updateFieldAppearances: false }));
}

async function openTool(page: Page) {
  await page.goto('/pdf/metadata/');
  const frame = page.frameLocator('iframe[data-tool-frame]');
  await frame.locator('input[type=file]').setInputFiles({
    name: 'report.pdf',
    mimeType: 'application/pdf',
    buffer: await infoPdf(),
  });
  await expect(frame.getByLabel('제목')).toHaveValue('Old title');
  return frame;
}

async function download(page: Page, frame: ReturnType<Page['frameLocator']>) {
  await frame.getByRole('button', { name: '저장', exact: true }).click();
  const event = page.waitForEvent('download');
  await frame.getByRole('button', { name: '다운로드' }).click();
  const file = await event;
  const bytes = new Uint8Array(await readFile(await file.path()));
  return {
    name: file.suggestedFilename(),
    bytes,
    doc: await PDFDocument.load(bytes, { updateMetadata: false }),
  };
}

test('제목·작성자를 바꾸고, 비운 칸은 지운다', async ({ page, baseURL }) => {
  const requests: Request[] = [];
  page.on('request', (request) => requests.push(request));
  const frame = await openTool(page);
  requests.length = 0;
  await expect(frame.getByText('Secret Office 2026')).toBeVisible();
  await frame.getByLabel('제목').fill('2026년 3분기 보고서');
  await frame.getByLabel('작성자').fill('');
  await frame.getByLabel('키워드 (쉼표로 구분)').fill('보고서, 분기');
  const { name, doc } = await download(page, frame);
  expect(name).toBe('report_정보.pdf');
  expect(doc.getTitle()).toBe('2026년 3분기 보고서');
  expect(doc.getAuthor()).toBeUndefined();
  expect(doc.getKeywords()).toBe('보고서, 분기');
  // 만든 프로그램은 그대로 둔다 (pdf-lib가 자기 이름으로 바꾸지 않게)
  expect(doc.getCreator()).toBe('Secret Office 2026');
  expectLocalOnly(page, requests, baseURL!);
});

test('모두 지우기는 만든 프로그램·날짜·사용자 정의 항목까지 지운다', async ({ page }) => {
  const frame = await openTool(page);
  await frame.getByLabel('문서 정보 모두 지우기', { exact: false }).check();
  await expect(frame.getByLabel('제목')).toBeDisabled();
  const { doc, bytes } = await download(page, frame);
  expect(doc.getTitle()).toBeUndefined();
  expect(doc.getAuthor()).toBeUndefined();
  expect(doc.getCreator()).toBeUndefined();
  expect(doc.getProducer()).toBeUndefined();
  expect(doc.getCreationDate()).toBeUndefined();
  expect(infoOf(doc).get(PDFName.of('Company'))).toBeUndefined();
  expect(doc.catalog.get(PDFName.of('Metadata'))).toBeUndefined();
  expect(Buffer.from(bytes).toString('latin1')).not.toContain('XMP Secret Kim');
});
