/**
 * 파일 끌어다 놓기 E2E. 파일이 바깥 페이지가 아니라 격리 frame 안으로만 들어가는지 확인한다.
 */
import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const pdfBytes = [
  ...readFileSync(fileURLToPath(new URL('../fixtures/three-pages.pdf', import.meta.url))),
];

async function openViewer(page: Page) {
  await page.goto('/pdf/view/');
  await page
    .frameLocator('iframe[data-tool-frame]')
    .locator('input[type=file]')
    .waitFor({ state: 'attached' });
}

function toolFrame(page: Page) {
  const frame = page.frames().find((f) => f.url().includes('/pdf/view/frame/'));
  if (!frame) throw new Error('도구 frame을 찾지 못했습니다');
  return frame;
}

/** 바깥 페이지에서 파일을 끌고 들어오는 상황을 흉내 낸다 */
async function dragEnterOuterPage(page: Page) {
  await page.evaluate(() => {
    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(new File(['x'], 'a.pdf', { type: 'application/pdf' }));
    document.body.dispatchEvent(new DragEvent('dragenter', { bubbles: true, dataTransfer }));
  });
}

test('바깥 페이지에 놓은 파일은 다른 스크립트가 받지 못한다', async ({ page }) => {
  await openViewer(page);
  const result = await page.evaluate(() => {
    const seen: string[] = [];
    // 페이지에 나중에 붙은 스크립트(광고 등)라고 가정
    addEventListener('drop', () => seen.push('window'), true);
    document.addEventListener('drop', () => seen.push('document'));
    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(new File(['%PDF-secret'], 'secret.pdf', { type: 'application/pdf' }));
    document.body.dispatchEvent(
      new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer }),
    );
    return seen;
  });
  expect(result).toEqual([]);
});

test('파일을 끌어오면 도구 화면이 화면 전체로 넓어지고, 놓으면 열린 뒤 원래대로 돌아온다', async ({
  page,
}) => {
  await openViewer(page);
  const iframe = page.locator('iframe[data-tool-frame]');

  await dragEnterOuterPage(page);
  await expect(iframe).toHaveAttribute('data-drag-active', '');
  const viewport = page.viewportSize()!;
  const box = (await iframe.boundingBox())!;
  expect(box.width).toBe(viewport.width);
  expect(box.height).toBe(viewport.height);

  // 넓어진 frame 안에 놓는다
  await toolFrame(page).evaluate((bytes) => {
    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(
      new File([new Uint8Array(bytes)], 'three-pages.pdf', { type: 'application/pdf' }),
    );
    document.body.dispatchEvent(
      new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer }),
    );
    document.body.dispatchEvent(
      new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer }),
    );
  }, pdfBytes);

  await expect(page.frameLocator('iframe[data-tool-frame]').getByText('1 / 3')).toBeVisible();
  await expect(iframe).not.toHaveAttribute('data-drag-active');
});

test('끌다가 놓지 않고 벗어나면 원래 크기로 돌아온다', async ({ page }) => {
  await openViewer(page);
  const iframe = page.locator('iframe[data-tool-frame]');

  await dragEnterOuterPage(page);
  await expect(iframe).toHaveAttribute('data-drag-active', '');
  // frame 위에서 dragover가 더 오지 않으면 끝난 것으로 보고 돌아온다
  await expect(iframe).not.toHaveAttribute('data-drag-active', { timeout: 3000 });
});
