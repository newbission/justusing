/**
 * 이미지 자르기·회전 E2E. 빌드 결과에서 돌린다 (playwright.config.ts 참고).
 *
 * 네 칸 색 이미지(quadrants.png, 40×30: 왼쪽 위 빨강·오른쪽 위 초록·왼쪽 아래 파랑·오른쪽 아래 흰색)를
 * 돌리고 뒤집고 잘라 PNG로 받아, 결과의 크기와 귀퉁이 색이 맞는지 본다.
 */
import type { FrameLocator } from '@playwright/test';
import { expect, test, type Page } from './test';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const fixture = (name: string) => fileURLToPath(new URL(`../fixtures/${name}`, import.meta.url));

async function openTool(page: Page, file: string) {
  await page.goto('/image/crop/');
  const frame = page.frameLocator('iframe[data-tool-frame]');
  await frame.locator('input[type=file]').first().setInputFiles(fixture(file));
  return frame;
}

/** 받은 이미지의 가로·세로와 네 귀퉁이(한 화소 안쪽) 색 */
async function corners(page: Page, bytes: Uint8Array) {
  return page.evaluate(async (data) => {
    const bitmap = await createImageBitmap(new Blob([new Uint8Array(data)]));
    const { width, height } = bitmap;
    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(bitmap, 0, 0);
    const name = (x: number, y: number) => {
      const [r, g, b] = ctx.getImageData(x, y, 1, 1).data;
      if (r! > 200 && g! > 200 && b! > 200) return 'white';
      if (r! > 200) return 'red';
      if (g! > 200) return 'green';
      if (b! > 200) return 'blue';
      return `${r},${g},${b}`;
    };
    return {
      width,
      height,
      corners: [
        name(1, 1),
        name(width - 2, 1),
        name(1, height - 2),
        name(width - 2, height - 2),
      ] as string[],
    };
  }, Array.from(bytes));
}

async function download(page: Page, frame: FrameLocator) {
  const event = page.waitForEvent('download');
  await frame.getByRole('button', { name: '자른 이미지 받기' }).click();
  const file = await event;
  return {
    name: file.suggestedFilename(),
    bytes: new Uint8Array(await readFile(await file.path())),
  };
}

test('오른쪽으로 돌리고 좌우로 뒤집은 결과를 받는다', async ({ page }) => {
  const frame = await openTool(page, 'quadrants.png');
  await expect(frame.getByText('결과 40 × 30 px · PNG')).toBeVisible();
  await frame.getByRole('button', { name: '오른쪽으로 90°' }).click();
  await expect(frame.getByText('결과 30 × 40 px · PNG')).toBeVisible();
  const turned = await download(page, frame);
  expect(turned.name).toBe('quadrants_편집.png');
  expect(await corners(page, turned.bytes)).toEqual({
    width: 30,
    height: 40,
    // 시계 방향으로 돌리면 왼쪽 아래(파랑)가 왼쪽 위로 온다
    corners: ['blue', 'red', 'white', 'green'],
  });
  await expect(frame.getByText('받았습니다: 30 × 40 px')).toBeVisible();

  await frame.getByRole('button', { name: '좌우 뒤집기' }).click();
  const flipped = await download(page, frame);
  expect((await corners(page, flipped.bytes)).corners).toEqual(['red', 'blue', 'green', 'white']);
});

test('숫자로 적은 영역만 남긴다', async ({ page }) => {
  const frame = await openTool(page, 'quadrants.png');
  await frame.getByLabel('폭 (px)').fill('20');
  await frame.getByLabel('폭 (px)').press('Enter');
  await frame.getByLabel('높이 (px)').fill('15');
  await frame.getByLabel('높이 (px)').press('Enter');
  await frame.getByLabel('왼쪽 (px)').fill('20');
  await frame.getByLabel('왼쪽 (px)').press('Enter');
  await expect(frame.getByText('결과 20 × 15 px')).toBeVisible();
  const file = await download(page, frame);
  expect(await corners(page, file.bytes)).toEqual({
    width: 20,
    height: 15,
    corners: ['green', 'green', 'green', 'green'],
  });
});

test('비율을 고르면 그 비율로 자르고, 돌리면 비율도 돌아간다', async ({ page }) => {
  const frame = await openTool(page, 'quadrants.png');
  await frame.getByText('1:1', { exact: true }).click();
  await expect(frame.getByText('결과 30 × 30 px')).toBeVisible();
  await frame.getByText('4:3', { exact: true }).click();
  await expect(frame.getByText('결과 40 × 30 px')).toBeVisible();
  await frame.getByRole('button', { name: '왼쪽으로 90°' }).click();
  await expect(frame.getByText('결과 30 × 40 px')).toBeVisible();
  await expect(frame.getByRole('radio', { name: '3:4' })).toBeChecked();
  // 비율을 지킬 때는 모서리 손잡이만 있다
  await expect(frame.getByRole('button', { name: '위쪽 변' })).toHaveCount(0);
  await frame.getByText('자유', { exact: true }).click();
  await expect(frame.getByRole('button', { name: '위쪽 변' })).toBeVisible();
});

test('영역과 손잡이를 방향키로 옮긴다', async ({ page }) => {
  const frame = await openTool(page, 'quadrants.png');
  const corner = frame.getByRole('button', { name: '오른쪽 아래 모서리' });
  await corner.press('ArrowLeft');
  await corner.press('ArrowUp');
  await expect(frame.getByText('결과 39 × 29 px')).toBeVisible();
  const area = frame.getByRole('button', { name: '남길 영역 (방향키로 옮기기)' });
  await area.press('ArrowRight');
  await expect(frame.getByLabel('왼쪽 (px)')).toHaveValue('1');
  await frame.getByRole('button', { name: '처음으로' }).click();
  await expect(frame.getByText('결과 40 × 30 px')).toBeVisible();
});

test('휴대폰 사진의 방향 정보대로 세워 연다', async ({ page }) => {
  const frame = await openTool(page, 'rotated.jpg');
  await expect(frame.getByText('결과 300 × 400 px · JPG')).toBeVisible();
  const file = await download(page, frame);
  expect(file.name).toBe('rotated_편집.jpg');
  const result = await corners(page, file.bytes);
  expect([result.width, result.height]).toEqual([300, 400]);
});

test('예시 사진의 기울기를 바로잡아 같은 크기로 받는다', async ({ page }) => {
  await page.goto('/image/crop/');
  const frame = page.frameLocator('iframe[data-tool-frame]');
  await frame.getByRole('button', { name: '예시 파일로 해 보기' }).click();
  await expect(frame.getByText('결과 1,600 × 1,200 px · JPG')).toBeVisible();
  const slider = frame.getByLabel('기울기 바로잡기');
  await slider.fill('4');
  await expect(frame.getByText('4.0°')).toBeVisible();
  const file = await download(page, frame);
  expect(file.name).toBe('예시-기운사진_편집.jpg');
  const result = await corners(page, file.bytes);
  expect([result.width, result.height]).toEqual([1600, 1200]);
  await frame.getByRole('button', { name: '0°로' }).click();
  await expect(frame.getByText('0.0°')).toBeVisible();
});

test('열 수 없는 파일은 알린다', async ({ page }) => {
  const frame = await openTool(page, 'broken.png');
  await expect(frame.getByRole('alert')).toHaveText(
    '이 이미지를 열 수 없습니다. 다른 파일을 골라 주세요.',
  );
});
