/**
 * 머리말·꼬리말 E2E. 빌드 결과에서 돌린다 (playwright.config.ts 참고).
 * 받은 PDF를 직접 읽어 쪽마다 자리표시가 채워졌는지, 표지 빼기가 되는지 확인한다.
 */
import { expect, test, type Page, type Request } from './test';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { expectLocalOnly } from './local-only';

const fixture = (name: string) => fileURLToPath(new URL(`../fixtures/${name}`, import.meta.url));

async function openTool(page: Page) {
  await page.goto('/pdf/header-footer/');
  const frame = page.frameLocator('iframe[data-tool-frame]');
  await frame.locator('input[type=file]').setInputFiles(fixture('three-pages.pdf'));
  await frame.getByRole('button', { name: '기본 고딕 받기' }).click();
  await expect(frame.getByText('모든 쪽(3쪽)에 넣습니다.')).toBeVisible();
  return frame;
}

/** 쪽마다 읽히는 글자들 */
async function pageTexts(bytes: Uint8Array) {
  const task = getDocument({ data: bytes.slice() });
  const doc = await task.promise;
  const texts: string[][] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const content = await (await doc.getPage(i)).getTextContent();
    texts.push(content.items.map((item) => ('str' in item ? item.str : '')).filter(Boolean));
  }
  await task.destroy();
  return texts;
}

async function download(page: Page, frame: ReturnType<Page['frameLocator']>) {
  await frame.getByRole('button', { name: '머리말·꼬리말 넣기' }).click();
  const event = page.waitForEvent('download');
  await frame.getByRole('button', { name: '다운로드' }).click();
  const file = await event;
  return {
    name: file.suggestedFilename(),
    bytes: new Uint8Array(await readFile(await file.path())),
  };
}

test('쪽마다 머리말과 채워진 쪽 번호 꼬리말을 넣는다', async ({ page, baseURL }) => {
  const requests: Request[] = [];
  page.on('request', (request) => requests.push(request));
  const frame = await openTool(page);
  requests.length = 0;

  await frame.getByLabel('머리말 (쪽 위)', { exact: true }).fill('주식회사 저스트');
  // 꼬리말 기본값은 "{쪽} / {전체}"
  const { name, bytes } = await download(page, frame);
  expect(name).toBe('three-pages_머리말.pdf');
  const texts = await pageTexts(bytes);
  texts.forEach((items, i) => {
    expect(items).toContain(`Page ${i + 1}`);
    expect(items).toContain('주식회사 저스트');
    expect(items).toContain(`${i + 1} / 3`);
  });
  expectLocalOnly(page, requests, baseURL!);
});

test('표지를 빼면 둘째 쪽부터 넣고, 쪽 번호는 첫 쪽부터 센다', async ({ page }) => {
  const frame = await openTool(page);
  await frame.getByLabel('꼬리말 (쪽 아래)', { exact: true }).fill('- {쪽} -');
  await frame.getByLabel('첫 쪽(표지)에는 넣지 않기').check();
  const { bytes } = await download(page, frame);
  const texts = await pageTexts(bytes);
  expect(texts[0]).toEqual(['Page 1']);
  expect(texts[1]).toContain('- 2 -');
  expect(texts[2]).toContain('- 3 -');
});

test('머리말·꼬리말이 모두 비면 넣을 수 없다', async ({ page }) => {
  const frame = await openTool(page);
  await frame.getByLabel('꼬리말 (쪽 아래)', { exact: true }).fill('');
  await expect(frame.getByText('머리말이나 꼬리말을 적어 주세요.')).toBeVisible();
  await expect(frame.getByRole('button', { name: '머리말·꼬리말 넣기' })).toBeDisabled();
});
