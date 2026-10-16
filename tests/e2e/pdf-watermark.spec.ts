/**
 * 글자 워터마크와 글꼴 보관 E2E. 빌드 결과에서 돌린다 (playwright.config.ts 참고).
 *
 * - 받은 PDF의 모든 쪽에 워터마크 글자가 들어갔는지 PDF에서 직접 읽어 확인한다
 * - 글꼴은 바깥 페이지 보관소에 남아 다시 들어와도 받지 않는다. 지워지면 다시 받으라고 알린다
 * - 보관소가 넘긴 바이트가 목록의 SHA-256과 다르면 쓰지 않는다
 */
import { expect, test, type Page, type Request } from './test';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { expectLocalOnly } from './local-only';

const fixture = (name: string) => fileURLToPath(new URL(`../fixtures/${name}`, import.meta.url));

async function openTool(page: Page) {
  await page.goto('/pdf/watermark/');
  const frame = page.frameLocator('iframe[data-tool-frame]');
  await frame.locator('input[type=file]').setInputFiles(fixture('three-pages.pdf'));
  await expect(frame.getByText('three-pages.pdf')).toBeVisible();
  return frame;
}

/** 쪽마다 읽히는 글자 */
async function pageTexts(bytes: Uint8Array) {
  const task = getDocument({ data: bytes.slice() });
  const doc = await task.promise;
  const texts: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const content = await (await doc.getPage(i)).getTextContent();
    texts.push(content.items.map((item) => ('str' in item ? item.str : '')).join(''));
  }
  await task.destroy();
  return texts;
}

async function download(page: Page, frame: ReturnType<Page['frameLocator']>) {
  await frame.getByRole('button', { name: '워터마크 넣기' }).click();
  const event = page.waitForEvent('download');
  await frame.getByRole('button', { name: '다운로드' }).click();
  const file = await event;
  return {
    name: file.suggestedFilename(),
    bytes: new Uint8Array(await readFile(await file.path())),
  };
}

test('글꼴을 받아 모든 쪽에 워터마크를 넣는다', async ({ page, baseURL }) => {
  const requests: Request[] = [];
  page.on('request', (request) => requests.push(request));
  const frame = await openTool(page);
  requests.length = 0; // 페이지를 여는 요청은 빼고, 파일을 고른 뒤부터 센다

  await expect(frame.getByText('아래에서 글꼴을 받아 고르세요.')).toBeVisible();
  await frame.getByRole('button', { name: '나눔고딕 받기' }).click();
  await expect(frame.getByText('모든 쪽(3쪽)에 워터마크를 넣습니다.')).toBeVisible();
  await frame.getByLabel('넣을 글자').fill('사본 COPY');
  const { name, bytes } = await download(page, frame);

  expect(name).toBe('three-pages_워터마크.pdf');
  const texts = await pageTexts(bytes);
  expect(texts).toHaveLength(3);
  texts.forEach((text, i) => {
    expect(text).toContain(`Page ${i + 1}`);
    expect(text).toContain('사본 COPY');
  });
  // 쓴 글자만 넣으므로 글꼴 전체(약 300KB)만큼 커지지 않는다
  expect(bytes.length).toBeLessThan(60_000);
  expectLocalOnly(page, requests, baseURL!);
});

test('받은 글꼴은 다시 들어와도 받지 않고, 지워지면 다시 받으라고 알린다', async ({ page }) => {
  let frame = await openTool(page);
  await frame.getByRole('button', { name: '나눔고딕 받기' }).click();
  await expect(frame.getByText('받음')).toBeVisible();

  const fontRequests: string[] = [];
  page.on('request', (request) => {
    if (request.url().includes('/data/fonts/') && request.url().includes('.woff2')) {
      fontRequests.push(request.url());
    }
  });
  frame = await openTool(page);
  // 받아 둔 글꼴을 저절로 골라 바로 쓸 수 있다
  await expect(frame.getByText('모든 쪽(3쪽)에 워터마크를 넣습니다.')).toBeVisible();
  await expect(frame.getByText('받음')).toBeVisible();
  expect(fontRequests).toEqual([]);

  // 브라우저 데이터를 지운 것처럼 보관소를 비운다
  await page.evaluate(() => caches.delete('justusing-data-v1'));
  frame = await openTool(page);
  await expect(
    frame.getByText('전에 받은 글꼴이 브라우저에서 지워졌습니다.', { exact: false }),
  ).toBeVisible();
  await expect(frame.getByText('아래에서 글꼴을 받아 고르세요.')).toBeVisible();
});

test('목록과 다른 글꼴 파일은 쓰지 않는다', async ({ page }) => {
  // 보관소가 받은 파일을 바꿔치기한다 (크기·내용이 목록과 다름)
  await page.route('**/data/fonts/nanum-gothic-*', (route) =>
    route.fulfill({ body: Buffer.from('not a font'), contentType: 'font/woff2' }),
  );
  const frame = await openTool(page);
  await frame.getByRole('button', { name: '나눔고딕 받기' }).click();
  await expect(frame.getByText('글꼴을 받지 못했습니다.', { exact: false })).toBeVisible();
  await expect(frame.getByText('아래에서 글꼴을 받아 고르세요.')).toBeVisible();
});

test('내 글꼴을 올려 쓰고, 글꼴에 없는 글자는 알려 준다', async ({ page }) => {
  const frame = await openTool(page);
  // abc.otf에는 A·B·C만 있다
  await frame.locator('input[type=file][accept*=".ttf"]').setInputFiles(fixture('abc.otf'));
  await expect(frame.getByText('내 글꼴: abc')).toBeVisible();

  await frame.getByLabel('넣을 글자').fill('ABC 가');
  await frame.getByRole('button', { name: '워터마크 넣기' }).click();
  await expect(
    frame.getByText('이 글꼴에 없는 글자가 있습니다: 가', { exact: false }),
  ).toBeVisible();

  await frame.getByLabel('넣을 글자').fill('CAB');
  const { bytes } = await download(page, frame);
  for (const text of await pageTexts(bytes)) expect(text).toContain('CAB');
});
