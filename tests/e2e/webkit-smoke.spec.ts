/** 배포 출처를 로컬 빌드로 중계한다. 실제 배포 사이트에는 요청하지 않는다. */
import { test, expect } from './test';
import { siteUrl } from '../../src/site.config';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';
import { PDFDocument } from '@cantoo/pdf-lib';

const local = `http://localhost:${Number(process.env.E2E_PORT ?? 8788)}`;
const fixture = (name: string) => fileURLToPath(new URL(`../fixtures/${name}`, import.meta.url));

test.beforeEach(async ({ context }) => {
  // 브라우저가 보는 URL·CSP·응답 헤더는 배포 그대로, 응답 바이트만 로컬 wrangler에서 받는다.
  await context.route(`${siteUrl}/**`, async (route) => {
    const url = new URL(route.request().url());
    const response = await route.fetch({ url: `${local}${url.pathname}${url.search}` });
    await route.fulfill({ response });
  });
});

test('WebKit: 격리·외부 연결 차단을 유지하며 PDF를 돌려 내려받는다', async ({ page }) => {
  await page.goto('/pdf/rotate/');
  const frame = page.frameLocator('iframe[data-tool-frame]');
  await frame.locator('input[type=file]').setInputFiles(fixture('three-pages.pdf'));
  await frame.getByRole('button', { name: '전체 ↻' }).click();
  const tool = page.frames().find((frame) => frame.url().includes('/pdf/rotate/frame/'))!;
  expect(await tool.evaluate(() => self.origin)).toBe('null');
  expect(
    await tool.evaluate(() => {
      try {
        return parent.document === document;
      } catch {
        return 'blocked';
      }
    }),
  ).toBe('blocked');

  // 외부로 요청하기 전에 CSP가 막았는지 위반 이벤트로 확인한다.
  expect(
    await tool.evaluate(async () => {
      const blocked: string[] = [];
      const listener = (event: SecurityPolicyViolationEvent) =>
        blocked.push(event.effectiveDirective);
      document.addEventListener('securitypolicyviolation', listener);
      try {
        await fetch('https://example.invalid/');
      } catch {
        /* CSP가 차단한다 */
      }
      await new Promise((resolve) => setTimeout(resolve, 50));
      document.removeEventListener('securitypolicyviolation', listener);
      return blocked;
    }),
  ).toContain('connect-src');

  await frame.getByRole('button', { name: 'PDF 회전', exact: true }).click();
  const event = page.waitForEvent('download');
  await frame.getByRole('button', { name: '다운로드', exact: true }).click();
  const doc = await PDFDocument.load(await readFile(await (await event).path()));
  expect(doc.getPages().map((page) => page.getRotation().angle)).toEqual([90, 90, 90]);
});

test('WebKit: 이미지 워커로 PNG를 JPG로 바꾸고 결과를 내려받는다', async ({ page }) => {
  await page.goto('/image/convert/');
  const frame = page.frameLocator('iframe[data-tool-frame]');
  await frame.locator('input[type=file]').setInputFiles(fixture('screen.png'));
  await frame.getByRole('button', { name: '변환하기', exact: true }).click();
  const event = page.waitForEvent('download');
  await frame.getByRole('button', { name: '다운로드', exact: true }).click();
  const bytes = await readFile(await (await event).path());
  expect([...bytes.subarray(0, 2)]).toEqual([0xff, 0xd8]);
  const tool = page.frames().find((frame) => frame.url().includes('/image/convert/frame/'))!;
  const size = await tool.evaluate(
    async (data) => {
      const image = new Image();
      const url = URL.createObjectURL(new Blob([new Uint8Array(data)], { type: 'image/jpeg' }));
      try {
        image.src = url;
        await image.decode();
        return [image.naturalWidth, image.naturalHeight];
      } finally {
        URL.revokeObjectURL(url);
      }
    },
    [...bytes],
  );
  expect(size).toEqual([800, 600]);
});

test('WebKit: 한글 PDF의 보조 파일과 스타일이 CSP에서 허용된다', async ({ page }) => {
  await page.goto('/pdf/view/');
  const frame = page.frameLocator('iframe[data-tool-frame]');
  await frame.locator('input[type=file]').setInputFiles(fixture('korean.pdf'));
  await expect(frame.getByText('1 / 1')).toBeVisible();
  const tool = page.frames().find((frame) => frame.url().includes('/pdf/view/frame/'))!;
  await expect
    .poll(() =>
      tool.evaluate(() => {
        const canvas = document.querySelector('canvas');
        const context = canvas?.getContext('2d');
        if (!canvas || !context) return 0;
        const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
        let dark = 0;
        for (let i = 0; i < data.length; i += 4) if (data[i]! < 100) dark++;
        return dark;
      }),
    )
    .toBeGreaterThan(500);
  expect(
    await frame.locator('.viewer').evaluate((element) => getComputedStyle(element).display),
  ).toBe('flex');
});
