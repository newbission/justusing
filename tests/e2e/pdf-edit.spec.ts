/**
 * PDF 편집 E2E. 빌드 결과에서 돌린다 (playwright.config.ts 참고).
 * 쪽 위에 글자를 넣고 사각형을 그려 받은 PDF를 직접 읽어 확인한다.
 */
import { expect, test, type Page, type Request } from './test';
import type { FrameLocator } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { getDocument, OPS } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { expectLocalOnly } from './local-only';

const fixture = (name: string) => fileURLToPath(new URL(`../fixtures/${name}`, import.meta.url));

async function openTool(page: Page) {
  await page.goto('/pdf/edit/');
  const frame = page.frameLocator('iframe[data-tool-frame]');
  await frame.locator('input[type=file]').first().setInputFiles(fixture('three-pages.pdf'));
  await expect(frame.locator('.overlay')).toBeVisible();
  return frame;
}

/** 쪽 위의 비율 자리(0~1)를 화면 좌표로. 화면이 움직였을 수 있어 매번 다시 잰다 */
async function at(frame: FrameLocator, x: number, y: number) {
  const overlay = frame.locator('.overlay');
  await overlay.scrollIntoViewIfNeeded();
  const box = (await overlay.boundingBox())!;
  return { x: box.x + box.width * x, y: box.y + box.height * y };
}

async function drawRect(
  page: Page,
  frame: FrameLocator,
  from: [number, number],
  to: [number, number],
) {
  const a = await at(frame, ...from);
  const b = await at(frame, ...to);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move(b.x, b.y, { steps: 5 });
  await page.mouse.up();
}

async function download(page: Page, frame: FrameLocator) {
  await frame.getByRole('button', { name: '편집한 PDF 만들기' }).click();
  const event = page.waitForEvent('download');
  await frame.getByRole('button', { name: '다운로드' }).click();
  const file = await event;
  return {
    name: file.suggestedFilename(),
    bytes: new Uint8Array(await readFile(await file.path())),
  };
}

async function firstPage(bytes: Uint8Array) {
  const task = getDocument({ data: bytes.slice() });
  const doc = await task.promise;
  const page = await doc.getPage(1);
  const text = (await page.getTextContent()).items.map((item) => ('str' in item ? item.str : ''));
  const ops = (await page.getOperatorList()).fnArray;
  await task.destroy();
  return { text, fills: ops.filter((fn) => fn === OPS.constructPath || fn === OPS.fill).length };
}

test('글자를 넣고 흰색으로 가리고 형광펜을 칠한다', async ({ page, baseURL }) => {
  const requests: Request[] = [];
  page.on('request', (request) => requests.push(request));
  const frame = await openTool(page);
  requests.length = 0;

  await frame.getByRole('button', { name: '기본 고딕 받기' }).click();
  await expect(frame.getByText('받음')).toBeVisible();
  const point = await at(frame, 0.2, 0.4);
  await page.mouse.click(point.x, point.y);
  await frame.getByLabel('글자 (줄바꿈 가능)').fill('수정된 금액 15,000원\n둘째 줄');

  await frame.getByText('흰색으로 가리기').click();
  await expect(frame.getByText('아래 글자는 파일에 남아', { exact: false })).toBeVisible();
  await drawRect(page, frame, [0.1, 0.05], [0.5, 0.12]);
  await frame.getByText('형광펜', { exact: true }).first().click();
  await drawRect(page, frame, [0.15, 0.6], [0.7, 0.65]);
  await expect(frame.getByText('3개를 PDF에 넣습니다.')).toBeVisible();

  const { name, bytes } = await download(page, frame);
  expect(name).toBe('three-pages_편집.pdf');
  const result = await firstPage(bytes);
  expect(result.text).toContain('Page 1');
  expect(result.text).toContain('수정된 금액 15,000원');
  expect(result.text).toContain('둘째 줄');
  // 흰색 가리기·형광펜 두 사각형
  expect(result.fills).toBeGreaterThanOrEqual(2);
  expectLocalOnly(page, requests, baseURL!);
});

test('가리기만 하면 글꼴 없이 만들고, 키보드로 지울 수 있다', async ({ page }) => {
  const frame = await openTool(page);
  await frame.getByText('흰색으로 가리기').click();
  await drawRect(page, frame, [0.1, 0.1], [0.4, 0.2]);
  await drawRect(page, frame, [0.1, 0.5], [0.4, 0.6]);
  await expect(frame.getByText('넣은 것 2개')).toBeVisible();

  // 마지막으로 그린 것은 골라져 있다. Delete로 지운다
  await frame.getByRole('button', { name: '흰색 가리기' }).last().focus();
  await page.keyboard.press('Delete');
  await expect(frame.getByText('넣은 것 1개')).toBeVisible();

  const { bytes } = await download(page, frame);
  const result = await firstPage(bytes);
  expect(result.text).toContain('Page 1');
  expect(result.fills).toBeGreaterThanOrEqual(1);
});

test('가린 자리를 글자 도구로 누르면 그 위에 새 글자 상자를 만든다', async ({ page }) => {
  const frame = await openTool(page);
  await frame.getByText('흰색으로 가리기').click();
  await drawRect(page, frame, [0.1, 0.1], [0.5, 0.2]);
  await expect(frame.getByText('넣은 것 1개')).toBeVisible();

  await frame.getByText('글자 넣기').click();
  const inside = await at(frame, 0.3, 0.15);
  await page.mouse.click(inside.x, inside.y);
  // 사각형을 옮기지 않고 새 글자 상자를 연다 (빈 글자 상자는 개수에 넣지 않는다)
  await frame.getByLabel('글자 (줄바꿈 가능)').fill('고친 글자');
  await expect(frame.getByText('넣은 것 2개')).toBeVisible();
});

test('키보드만으로 사각형을 넣고 크기를 바꾼다', async ({ page }) => {
  const frame = await openTool(page);
  await frame.getByText('흰색으로 가리기').click();
  await frame.getByRole('button', { name: '가운데에 가리기 넣기' }).focus();
  await page.keyboard.press('Enter');
  await expect(frame.getByText('넣은 것 1개')).toBeVisible();

  // 새로 넣은 사각형에 포커스가 간다. Alt+화살표로 넓히고 화살표로 옮긴다
  const box = frame.getByRole('button', { name: '흰색 가리기' });
  await expect(box).toBeFocused();
  const before = (await box.boundingBox())!;
  await page.keyboard.press('Alt+ArrowRight');
  await page.keyboard.press('Shift+ArrowUp');
  const after = (await box.boundingBox())!;
  expect(after.width).toBeGreaterThan(before.width);
  expect(after.y).toBeLessThan(before.y);

  const { bytes } = await download(page, frame);
  expect((await firstPage(bytes)).fills).toBeGreaterThanOrEqual(1);
});

test('Tab으로 옮겨 가기만 해도 고르고, 잘못된 글자 크기는 되돌린다', async ({ page }) => {
  const frame = await openTool(page);
  await frame.getByText('흰색으로 가리기').click();
  await drawRect(page, frame, [0.1, 0.1], [0.4, 0.2]);
  // 빈 곳을 눌러 고르기를 풀면 아래 칸이 닫힌다
  await frame.getByText('고르기·옮기기').click();
  const empty = await at(frame, 0.8, 0.3);
  await page.mouse.click(empty.x, empty.y);
  await expect(frame.getByText('고른 것:', { exact: false })).toBeHidden();
  await frame.getByRole('button', { name: '흰색 가리기' }).focus();
  await expect(frame.getByText('고른 것:', { exact: false })).toBeVisible();

  // 글자 크기 칸에 범위 밖 값을 적으면 칸을 떠날 때 실제로 쓰는 크기로 되돌린다
  await frame.getByText('글자 넣기').click();
  await frame.getByRole('button', { name: '기본 고딕 받기' }).click();
  const point = await at(frame, 0.2, 0.6);
  await page.mouse.click(point.x, point.y);
  await frame.getByLabel('글자 (줄바꿈 가능)').fill('크기');
  const size = frame.getByLabel('글자 크기 (pt)');
  const before = await size.inputValue();
  await size.fill('500');
  await size.blur();
  await expect(size).toHaveValue(before);
});

test('글자를 넣었는데 글꼴이 없으면 받으라고 알린다', async ({ page }) => {
  const frame = await openTool(page);
  const point = await at(frame, 0.3, 0.3);
  await page.mouse.click(point.x, point.y);
  await frame.getByLabel('글자 (줄바꿈 가능)').fill('안녕하세요');
  await expect(frame.getByText('글자를 넣으려면 아래에서 글꼴을 받아 고르세요.')).toBeVisible();
  await expect(frame.getByRole('button', { name: '편집한 PDF 만들기' })).toBeDisabled();
});
