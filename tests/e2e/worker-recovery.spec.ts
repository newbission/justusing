/** 배포 CSP·격리 frame에서 워커 실패 후 같은 파일/설정으로 다시 실행한다. */
import { test, expect, type Page } from './test';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';
import { PDFDocument } from '@cantoo/pdf-lib';
import { unzipSync } from 'fflate';

const fixture = (name: string) => fileURLToPath(new URL(`../fixtures/${name}`, import.meta.url));
type Frame = ReturnType<Page['frameLocator']>;

const tools = [
  { label: '조립', tool: 'rotate', worker: 'assemble', run: 'PDF 회전', pages: 3 },
  { label: '수정', tool: 'page-numbers', worker: 'modify', run: '쪽 번호 넣기', pages: 3 },
  { label: '글자', tool: 'watermark', worker: 'text-pdf', run: '워터마크 넣기', pages: 3 },
  { label: '이미지 PDF', tool: 'from-image', worker: 'images-to-pdf', run: 'PDF 만들기', pages: 1 },
  { label: 'ZIP', tool: 'split', worker: 'zip', run: 'PDF 나누기', pages: 3 },
] as const;

async function prepare(page: Page, tool: (typeof tools)[number]['tool']): Promise<Frame> {
  await page.goto(`/pdf/${tool}/`);
  const frame = page.frameLocator('iframe[data-tool-frame]');
  await frame
    .locator('input[type=file]')
    .setInputFiles(fixture(tool === 'from-image' ? 'wide.png' : 'three-pages.pdf'));
  if (tool === 'rotate') await frame.getByRole('button', { name: '전체 ↻' }).click();
  if (tool === 'split') await frame.getByText('한 장씩 나누기').click();
  if (tool === 'watermark') {
    await frame.getByRole('button', { name: '기본 고딕 받기' }).click();
    await frame.getByLabel('넣을 글자').fill('COPY');
  }
  return frame;
}

for (const tool of tools) {
  for (const failure of ['다운로드 실패', '실행 오류'] as const) {
    test(`${tool.label}: ${failure} 뒤 새로고침 없이 다시 실행해 결과를 받는다`, async ({
      page,
    }) => {
      let attempts = 0;
      await page.route(`**/${tool.worker}.worker-*.js`, (route) => {
        if (++attempts !== 1) return route.continue();
        if (failure === '다운로드 실패') return route.abort('failed');
        // 실제 Worker에서 요청을 받은 뒤 예외를 내어 error 이벤트를 만든다.
        return route.fulfill({
          contentType: 'text/javascript',
          body: "addEventListener('message', () => { throw new Error('test worker failure'); });",
        });
      });
      const frame = await prepare(page, tool.tool);
      const run = frame.getByRole('button', { name: tool.run, exact: true });
      await expect(run).toBeEnabled();
      await run.click();
      await expect(frame.locator('.action-text strong')).toBeVisible({ timeout: 4000 });
      await expect(run).toBeEnabled();
      expect(attempts).toBe(1);

      // 파일과 설정은 고르지 않는다. 두 번째에는 원래 워커를 읽는다.
      await run.click();
      const download = frame.getByRole('button', { name: '다운로드', exact: true });
      await expect(download).toBeVisible({ timeout: 8000 });
      expect(attempts).toBe(2);
      const event = page.waitForEvent('download');
      await download.click();
      const bytes = new Uint8Array(await readFile(await (await event).path()));
      if (tool.tool === 'split') {
        const entries = Object.values(unzipSync(bytes));
        expect(entries).toHaveLength(tool.pages);
        for (const entry of entries) expect((await PDFDocument.load(entry)).getPageCount()).toBe(1);
      } else {
        const doc = await PDFDocument.load(bytes);
        expect(doc.getPageCount()).toBe(tool.pages);
        if (tool.tool === 'rotate')
          expect(doc.getPages().map((p) => p.getRotation().angle)).toEqual([90, 90, 90]);
      }
    });
  }
}

for (const failure of ['messageerror', 'postMessage 실패'] as const) {
  test(`조립: ${failure} 뒤 대기를 끝내고 다시 실행한다`, async ({ page }) => {
    await page.addInitScript((failure) => {
      const OriginalWorker = globalThis.Worker;
      let injected = false;
      // 브라우저에서 재현하기 어려운 전송 오류를 조립 요청 한 번에만 주입한다.
      globalThis.Worker = class extends OriginalWorker {
        postMessage(message: unknown, options: Transferable[] | StructuredSerializeOptions = []) {
          if (
            !injected &&
            message &&
            typeof message === 'object' &&
            'job' in message &&
            message.job &&
            typeof message.job === 'object' &&
            'outputs' in message.job
          ) {
            injected = true;
            if (failure === 'postMessage 실패')
              throw new DOMException('test send failure', 'DataCloneError');
            queueMicrotask(() => this.dispatchEvent(new MessageEvent('messageerror')));
            return;
          }
          if (Array.isArray(options)) super.postMessage(message, options);
          else super.postMessage(message, options);
        }
      };
    }, failure);
    const frame = await prepare(page, 'rotate');
    const run = frame.getByRole('button', { name: 'PDF 회전', exact: true });
    await run.click();
    await expect(frame.locator('.action-text strong')).toBeVisible();
    await expect(run).toBeEnabled();
    await run.click();
    const event = page.waitForEvent('download');
    await frame.getByRole('button', { name: '다운로드', exact: true }).click();
    const doc = await PDFDocument.load(await readFile(await (await event).path()));
    expect(doc.getPages().map((p) => p.getRotation().angle)).toEqual([90, 90, 90]);
  });
}
