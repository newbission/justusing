/**
 * PDF 글자 인식(OCR) E2E. 빌드 결과에서 돌린다 (playwright.config.ts 참고).
 *
 * 글자를 찍은 그림만 든 PDF(스캔본)를 만들어 인식하고, 받은 PDF에서 글자를 찾을 수 있는지,
 * 글자가 화면에 보이는 자리(회전한 쪽 포함)에 들어갔는지 확인한다.
 */
import { expect, test, type Page, type Request } from './test';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { PDFDocument, StandardFonts, degrees } from '@cantoo/pdf-lib';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { expectLocalOnly } from './local-only';

const fixture = (name: string) => fileURLToPath(new URL(`../fixtures/${name}`, import.meta.url));

const TEXT_PAGE = 'This page already has plenty of selectable text, so OCR skips it entirely.';

/** 1쪽: 스캔본(쪽 번호만 글자), 2쪽: 눕혀 저장하고 /Rotate 90으로 세운 스캔본, 3쪽: 글자가 있는 쪽 */
async function scannedPdf() {
  const doc = await PDFDocument.create();
  const scan = await doc.embedPng(await readFile(fixture('scan.png')));
  // 그림 1240×600을 가로 595pt에 맞춘다
  const width = 595;
  const height = (width * scan.height) / scan.width;
  const first = doc.addPage([width, height]);
  first.drawImage(scan, { x: 0, y: 0, width, height });
  // 화면에서 시계 방향으로 90° 돌려 보이므로, 내용은 반시계 방향으로 눕혀 넣는다
  const rotated = doc.addPage([height, width]);
  rotated.setRotation(degrees(90));
  rotated.drawImage(scan, { x: height, y: 0, width, height, rotate: degrees(90) });
  const font = await doc.embedFont(StandardFonts.Helvetica);
  // 스캔한 쪽에 쪽 번호만 글자로 있으면 본문은 그림이므로 그래도 읽는다
  first.drawText('- 1 -', { x: width / 2, y: 8, size: 8, font });
  doc.addPage([width, height]).drawText(TEXT_PAGE, { x: 20, y: 100, size: 10, font });
  return Buffer.from(await doc.save());
}

/** 쪽마다 글자와, 화면에 보이는 모습(회전 적용) 기준 자리 */
async function placedWords(bytes: Uint8Array) {
  const doc = await getDocument({ data: bytes.slice() }).promise;
  const pages = [];
  for (let number = 1; number <= doc.numPages; number++) {
    const page = await doc.getPage(number);
    const viewport = page.getViewport({ scale: 1 });
    const content = await page.getTextContent();
    pages.push({
      width: viewport.width,
      height: viewport.height,
      text: content.items.map((item) => ('str' in item ? item.str : '')).join(' '),
      words: content.items.flatMap((item) => {
        if (!('str' in item) || !item.str.trim()) return [];
        const [x, y] = viewport.convertToViewportPoint(item.transform[4], item.transform[5]);
        return [{ str: item.str, x: x!, y: y! }];
      }),
    });
  }
  return pages;
}

async function openOcr(page: Page) {
  await page.goto('/pdf/ocr/');
  const frame = page.frameLocator('iframe[data-tool-frame]');
  await frame.locator('input[type=file]').setInputFiles({
    name: 'scan.pdf',
    mimeType: 'application/pdf',
    buffer: await scannedPdf(),
  });
  return frame;
}

test('스캔본의 글자를 읽어 보이는 자리에 넣고, 글자가 있는 쪽은 건너뛴다', async ({
  page,
  baseURL,
}) => {
  test.setTimeout(180_000);
  const requests: Request[] = [];
  page.on('request', (request) => requests.push(request));
  const frame = await openOcr(page);
  requests.length = 0;

  // 처음에는 데이터를 받기 전이라 실행할 수 없고, 받을 크기를 알려 준다
  await expect(frame.getByRole('button', { name: '글자 인식' })).toBeDisabled();
  await frame.getByRole('button', { name: /^데이터 받기 \(\d+\.\dMB\)$/ }).click();
  await expect(frame.getByText('글자 인식 데이터가 준비되었습니다.')).toBeVisible({
    timeout: 60_000,
  });
  await frame.getByRole('button', { name: '글자 인식' }).click();
  await expect(frame.getByRole('button', { name: 'PDF 다운로드' })).toBeVisible({
    timeout: 150_000,
  });
  await expect(frame.getByText('2쪽에서 글자', { exact: false })).toBeVisible();

  const event = page.waitForEvent('download');
  await frame.getByRole('button', { name: 'PDF 다운로드' }).click();
  const file = await event;
  expect(file.suggestedFilename()).toBe('scan_글자인식.pdf');
  const pages = await placedWords(new Uint8Array(await readFile(await file.path())));
  expect(pages).toHaveLength(3);

  for (const [index, result] of pages.slice(0, 2).entries()) {
    expect(result.text, `${index + 1}쪽`).toContain('다람쥐');
    expect(result.text, `${index + 1}쪽`).toContain('quick');
    // 화면에서 한글 줄이 위, 영어 줄이 아래에 있고 둘 다 왼쪽에서 시작한다
    const korean = result.words.find((word) => word.str.includes('다람쥐'))!;
    const english = result.words.find((word) => word.str.includes('quick'))!;
    expect(korean.y, `${index + 1}쪽`).toBeLessThan(english.y);
    expect(korean.x, `${index + 1}쪽`).toBeLessThan(result.width * 0.3);
    expect(korean.y, `${index + 1}쪽`).toBeLessThan(result.height * 0.5);
  }
  // 글자가 있던 쪽은 다시 읽지 않는다
  expect(pages[2]!.text.trim()).toBe(TEXT_PAGE);

  // 읽은 글자만 TXT로
  const textEvent = page.waitForEvent('download');
  await frame.getByRole('button', { name: 'TXT 다운로드' }).click();
  const text = await readFile(await (await textEvent).path(), 'utf8');
  expect(text).toContain('--- 1쪽 ---');
  expect(text).toContain('다람쥐');

  // 받은 것은 우리 사이트의 데이터뿐이다
  expectLocalOnly(page, requests, baseURL!);
});

test('받은 데이터는 다시 받지 않고, 보관본이 지워지면 다시 묻는다', async ({ page }) => {
  let frame = await openOcr(page);
  await frame.getByRole('button', { name: /^데이터 받기/ }).click();
  await expect(frame.getByText('글자 인식 데이터가 준비되었습니다.')).toBeVisible({
    timeout: 60_000,
  });

  // 다시 열면 바로 준비된다 (받지 않는다)
  const fetched: string[] = [];
  page.on('request', (request) => {
    if (request.url().includes('/data/ocr/')) fetched.push(request.url());
  });
  frame = await openOcr(page);
  await expect(frame.getByText('글자 인식 데이터가 준비되었습니다.')).toBeVisible();
  await expect(frame.getByRole('button', { name: '글자 인식' })).toBeEnabled();
  expect(fetched).toEqual([]);

  // 보관본이 지워지면 몰래 받지 않고 다시 묻는다
  await page.evaluate(() => caches.delete('justusing-data-v1'));
  frame = await openOcr(page);
  await expect(
    frame.getByText('전에 받은 데이터가 브라우저에서 지워졌습니다.', { exact: false }),
  ).toBeVisible();
  await expect(frame.getByRole('button', { name: '글자 인식' })).toBeDisabled();
  expect(fetched).toEqual([]);
});
