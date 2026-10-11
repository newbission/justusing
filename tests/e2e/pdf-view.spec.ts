/**
 * PDF 보기 E2E. 빌드 결과에서 돌린다 (playwright.config.ts 참고).
 *
 * 핵심은 "파일이 기기를 떠나지 않는다"는 약속을 매번 확인하는 것:
 * - 파일을 연 뒤 생긴 요청이 모두 우리 사이트로만 갔고, 본문을 실은 요청이 없다
 * - 도구 화면은 출처 없는 격리 frame이라 바깥 페이지와 서로 접근할 수 없다
 * - 도구 화면 안에서 외부로 연결하려 하면 CSP가 막는다
 */
import { expect, test, type Page, type Request } from '@playwright/test';
import { fileURLToPath } from 'node:url';

const fixture = (name: string) => fileURLToPath(new URL(`../fixtures/${name}`, import.meta.url));

async function openViewer(page: Page) {
  await page.goto('/pdf/view/');
  const frame = page.frameLocator('iframe[data-tool-frame]');
  await frame.locator('input[type=file]').waitFor({ state: 'attached' });
  return frame;
}

/** 도구 frame의 실제 Frame 객체 (frame 안에서 스크립트를 돌릴 때) */
function toolFrame(page: Page) {
  const frame = page.frames().find((f) => f.url().includes('/pdf/view/frame/'));
  if (!frame) throw new Error('도구 frame을 찾지 못했습니다');
  return frame;
}

test('PDF를 열면 페이지가 그려지고 이동·확대가 된다', async ({ page }) => {
  const frame = await openViewer(page);
  await frame.locator('input[type=file]').setInputFiles(fixture('three-pages.pdf'));

  await expect(frame.getByText('1 / 3')).toBeVisible();
  await expect(frame.getByRole('img', { name: '1페이지' })).toBeVisible();

  await frame.getByRole('button', { name: '다음 페이지' }).click();
  await expect(frame.getByText('2 / 3')).toBeVisible();

  const zoomBefore = await frame.locator('.zoom').textContent();
  await frame.getByRole('button', { name: '확대' }).click();
  await expect(frame.locator('.zoom')).not.toHaveText(zoomBefore ?? '');
});

test('파일을 연 뒤의 모든 요청은 우리 사이트로만 가고 본문이 없다', async ({ page, baseURL }) => {
  const requests: Request[] = [];
  page.on('request', (request) => requests.push(request));

  const frame = await openViewer(page);
  requests.length = 0; // 페이지를 여는 요청은 빼고, 파일을 고른 뒤부터 센다
  await frame.locator('input[type=file]').setInputFiles(fixture('korean.pdf'));
  await expect(frame.getByText('1 / 1')).toBeVisible();
  await page.waitForLoadState('networkidle');

  const origin = new URL(baseURL!).origin;
  for (const request of requests) {
    const url = new URL(request.url());
    if (url.protocol === 'blob:' || url.protocol === 'data:') continue;
    expect(url.origin, request.url()).toBe(origin);
    expect(request.method(), request.url()).toBe('GET');
    expect(request.postData(), request.url()).toBeNull();
  }
});

test('도구 화면은 출처 없는 격리 frame이다', async ({ page }) => {
  await openViewer(page);
  const frame = toolFrame(page);

  expect(await frame.evaluate(() => self.origin)).toBe('null');
  // 바깥 페이지 DOM에 접근할 수 없다
  expect(
    await frame.evaluate(() => {
      try {
        return Boolean(window.parent.document);
      } catch {
        return 'blocked';
      }
    }),
  ).toBe('blocked');
  // 바깥 페이지도 frame 안을 볼 수 없다
  expect(
    await page.evaluate(() => {
      const iframe = document.querySelector<HTMLIFrameElement>('iframe[data-tool-frame]');
      return iframe?.contentDocument ?? 'blocked';
    }),
  ).toBe('blocked');
});

test('도구 화면 안에서 외부 연결은 CSP가 막는다', async ({ page }) => {
  await openViewer(page);
  const result = await toolFrame(page).evaluate(async () => {
    try {
      await fetch('https://example.com/');
      return 'allowed';
    } catch {
      return 'blocked';
    }
  });
  expect(result).toBe('blocked');
});

test('한글 PDF가 그려진다 (CMap을 우리 사이트에서 받음)', async ({ page }) => {
  const frame = await openViewer(page);
  await frame.locator('input[type=file]').setInputFiles(fixture('korean.pdf'));
  await expect(frame.getByText('1 / 1')).toBeVisible();

  // 캔버스에 어두운 픽셀(글자)이 그려졌는지 본다
  await expect
    .poll(() =>
      toolFrame(page).evaluate(() => {
        const canvas = document.querySelector('canvas');
        const ctx = canvas?.getContext('2d');
        if (!canvas || !ctx) return 0;
        const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
        let dark = 0;
        for (let i = 0; i < data.length; i += 4) if (data[i]! < 100) dark++;
        return dark;
      }),
    )
    .toBeGreaterThan(500);
});

test('암호 PDF: 틀리면 안내하고, 맞으면 열린다', async ({ page }) => {
  const frame = await openViewer(page);
  await frame.locator('input[type=file]').setInputFiles(fixture('encrypted.pdf'));

  await frame.getByLabel('PDF 암호').fill('0000');
  await frame.getByRole('button', { name: '열기' }).click();
  await expect(frame.getByText('암호가 맞지 않습니다.')).toBeVisible();

  await frame.getByLabel('PDF 암호').fill('1234');
  await frame.getByLabel('PDF 암호').press('Enter');
  await expect(frame.getByText('1 / 1')).toBeVisible();
});

test('PDF가 아닌 파일은 안내 문구를 보여준다', async ({ page }) => {
  const frame = await openViewer(page);
  await frame.locator('input[type=file]').setInputFiles({
    name: 'not-a-pdf.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('this is not a pdf'),
  });
  await expect(frame.getByRole('alert')).toContainText('PDF를 열 수 없습니다');
});
