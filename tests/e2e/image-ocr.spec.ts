/**
 * 이미지 글자 추출(OCR) E2E. 빌드 결과에서 돌린다 (playwright.config.ts 참고).
 *
 * 견본(서류 사진·대화 캡처)의 알려진 글자를 읽는지, 어두운 말풍선 속 밝은 글자·옆으로 누운 이미지·기운 이미지도
 * 읽는지, 복사·TXT·고쳐 쓰기, 못 여는 파일, PDF 글자 인식과 데이터를 함께 쓰는지 확인한다.
 */
import { expect, test, type Page } from './test';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const sample = (name: string) =>
  fileURLToPath(new URL(`../../public/samples/ko/${name}`, import.meta.url));
const fixture = (name: string) => fileURLToPath(new URL(`../fixtures/${name}`, import.meta.url));

const DOC = '예시-서류사진2.jpg';
const CHAT = '예시-대화캡처1.png';

async function openTool(page: Page) {
  await page.goto('/image/ocr/');
  return page.frameLocator('iframe[data-tool-frame]');
}

/** 데이터를 받아 준비한다 */
async function prepare(frame: ReturnType<Page['frameLocator']>) {
  await frame.getByRole('button', { name: /^데이터 받기 \(\d+\.\dMB\)$/ }).click();
  await expect(frame.getByText('글자 인식 데이터가 준비되었습니다.')).toBeVisible({
    timeout: 60_000,
  });
}

/** 견본을 브라우저에서 돌려 PNG로 만든다 (사진에 방향 정보가 없는, 눕거나 기운 이미지) */
async function turned(page: Page, name: string, degrees: number) {
  const bytes = await readFile(sample(name));
  const png = await page.evaluate(
    async ({ data, degrees }) => {
      const bitmap = await createImageBitmap(new Blob([new Uint8Array(data)]));
      const radians = (degrees * Math.PI) / 180;
      const width = Math.round(
        Math.abs(bitmap.width * Math.cos(radians)) + Math.abs(bitmap.height * Math.sin(radians)),
      );
      const height = Math.round(
        Math.abs(bitmap.width * Math.sin(radians)) + Math.abs(bitmap.height * Math.cos(radians)),
      );
      const canvas = new OffscreenCanvas(width, height);
      const context = canvas.getContext('2d')!;
      context.fillStyle = '#fff';
      context.fillRect(0, 0, width, height);
      context.translate(width / 2, height / 2);
      context.rotate(radians);
      context.drawImage(bitmap, -bitmap.width / 2, -bitmap.height / 2);
      const blob = await canvas.convertToBlob({ type: 'image/png' });
      return Array.from(new Uint8Array(await blob.arrayBuffer()));
    },
    { data: Array.from(bytes), degrees },
  );
  return Buffer.from(png);
}

test('서류 사진과 대화 캡처의 글자를 읽어 복사하고 TXT로 받는다', async ({ page }) => {
  test.setTimeout(180_000);
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
  const frame = await openTool(page);
  await frame.locator('input[type=file]').setInputFiles([sample(DOC), sample(CHAT)]);

  // 데이터를 받기 전에는 읽을 수 없다
  await expect(frame.getByRole('button', { name: '글자 인식' })).toBeDisabled();
  await prepare(frame);
  await frame.getByRole('button', { name: '글자 인식' }).click();
  await expect(frame.getByRole('button', { name: 'TXT 다운로드' })).toBeVisible({
    timeout: 150_000,
  });
  await expect(frame.getByText('이미지 2장에서 글자', { exact: false })).toBeVisible();

  const doc = frame.getByRole('textbox', { name: `${DOC}에서 읽은 글자` });
  const chat = frame.getByRole('textbox', { name: `${CHAT}에서 읽은 글자` });
  await expect(doc).toHaveValue(/재직 증명서/);
  await expect(doc).toHaveValue(/홍길동/);
  await expect(doc).toHaveValue(/2020년 3월 2일/);
  await expect(chat).toHaveValue(/내일 회의 자료 다 됐나요\?/);
  // 초록 말풍선 속 흰 글자 (바탕이 다른 곳을 다시 읽어 더한 줄)
  await expect(chat).toHaveValue(/오늘 저녁까지 올릴게요/);
  await expect(chat).toHaveValue(/몇 시부터인가요\?/);
  // 위에서부터 읽은 순서
  const chatText = await chat.inputValue();
  expect(chatText.indexOf('내일 회의')).toBeLessThan(chatText.indexOf('오늘 저녁까지'));
  expect(chatText.indexOf('오늘 저녁까지')).toBeLessThan(chatText.indexOf('좋아요.'));

  // 읽은 줄을 이미지 위에 상자로 보여 준다
  const boxes = frame.getByRole('img', { name: `${DOC}에서 읽은 줄의 자리` });
  expect(await boxes.locator('polygon').count()).toBeGreaterThanOrEqual(5);

  // 틀린 글자를 고쳐 쓰면 복사·TXT에 그대로 들어간다
  await doc.fill(`${await doc.inputValue()}\n고쳐 쓴 줄`);

  await frame.getByRole('button', { name: '모두 복사' }).click();
  await expect(frame.getByText('글자를 복사했습니다.')).toBeVisible();
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  expect(copied).toContain(`--- ${DOC} ---`);
  expect(copied).toContain(`--- ${CHAT} ---`);
  expect(copied).toContain('고쳐 쓴 줄');

  const event = page.waitForEvent('download');
  await frame.getByRole('button', { name: 'TXT 다운로드' }).click();
  const file = await event;
  expect(file.suggestedFilename()).toBe('이미지_글자인식.txt');
  const text = await readFile(await file.path(), 'utf8');
  expect(text.startsWith('﻿')).toBe(true);
  expect(text).toContain('\r\n');
  expect(text).toContain('재직 증명서');
  expect(text).toContain('고쳐 쓴 줄');
  expect(text).toContain('오늘 저녁까지 올릴게요');

  // 한 장만 복사
  await frame.getByRole('button', { name: `${CHAT}의 글자 복사` }).click();
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe(chatText);
});

test('옆으로 누운 이미지와 기운 이미지를 바로 세워 읽고, 못 여는 파일은 빼고 읽는다', async ({
  page,
}) => {
  test.setTimeout(180_000);
  const frame = await openTool(page);
  await frame.locator('input[type=file]').setInputFiles([
    { name: 'sideways.png', mimeType: 'image/png', buffer: await turned(page, DOC, 90) },
    { name: 'tilted.png', mimeType: 'image/png', buffer: await turned(page, DOC, 12) },
    { name: 'broken.png', mimeType: 'image/png', buffer: await readFile(fixture('broken.png')) },
  ]);
  await expect(frame.getByText('열 수 없는 이미지입니다. 빼고 읽습니다.')).toBeVisible();
  await prepare(frame);
  await expect(frame.getByText('이미지 2장의 글자를 읽습니다.')).toBeVisible();
  await frame.getByRole('button', { name: '글자 인식' }).click();
  await expect(frame.getByRole('button', { name: 'TXT 다운로드' })).toBeVisible({
    timeout: 170_000,
  });
  for (const name of ['sideways.png', 'tilted.png']) {
    const box = frame.getByRole('textbox', { name: `${name}에서 읽은 글자` });
    await expect(box, name).toHaveValue(/재직 증명서/);
    await expect(box, name).toHaveValue(/2020년 3월 2일/);
  }
  // 한 장만 받으면 원래 이름을 붙인다
  await frame.getByRole('button', { name: 'sideways.png 빼기' }).click();
  const event = page.waitForEvent('download');
  await frame.getByRole('button', { name: 'TXT 다운로드' }).click();
  expect((await event).suggestedFilename()).toBe('tilted_글자인식.txt');
});

test('PDF 글자 인식에서 받은 데이터를 다시 받지 않는다', async ({ page }) => {
  await page.goto('/pdf/ocr/');
  const pdfFrame = page.frameLocator('iframe[data-tool-frame]');
  await pdfFrame.locator('input[type=file]').setInputFiles(fixture('three-pages.pdf'));
  await prepare(pdfFrame);

  const fetched: string[] = [];
  page.on('request', (request) => {
    if (request.url().includes('/data/ocr/')) fetched.push(request.url());
  });
  const frame = await openTool(page);
  await frame.locator('input[type=file]').setInputFiles(sample(DOC));
  await expect(frame.getByText('글자 인식 데이터가 준비되었습니다.')).toBeVisible();
  await expect(frame.getByRole('button', { name: '글자 인식' })).toBeEnabled();
  expect(fetched).toEqual([]);
});
