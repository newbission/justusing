// 각 출발 도구의 실제 결과가 다음 도구에서 새 파일 선택 없이 열리는지 확인한다.
import type { FrameLocator } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { expect, test, type Page } from './test';

const fixture = (name: string) => fileURLToPath(new URL(`../fixtures/${name}`, import.meta.url));

const destinations = {
  'image/crop': '이미지 자르기·회전',
  'image/remove-bg': '이미지 배경 제거',
  'image/compress': '이미지 압축',
  'image/mosaic': '이미지 모자이크',
  'image/id-photo': '증명사진 만들기',
  'pdf/from-image': '이미지를 PDF로',
};

async function openTool(page: Page, id: string, file: string) {
  await page.goto(`/${id}/`);
  const frame = page.frameLocator('iframe[data-tool-frame]');
  await frame.locator('input[type=file]').first().setInputFiles(fixture(file));
  return frame;
}

async function send(page: Page, frame: FrameLocator, to: keyof typeof destinations) {
  await frame.getByRole('button', { name: '다음 도구로', exact: true }).click();
  await frame.getByRole('button', { name: destinations[to], exact: true }).click();
  await expect(page).toHaveURL(`/${to}/`);
}

const conversions = [
  ['image/compress', 'photo.jpg', '압축하기', 'photo_압축.jpg', '1200×900'],
  ['image/resize', 'photo.jpg', '크기 바꾸기', 'photo_600x450.jpg', '600×450'],
  ['image/convert', 'screen.png', '변환하기', 'screen.jpg', '800×600'],
  ['image/heic-to-jpg', 'iphone.heic', '변환하기', 'iphone.jpg', '300×400'],
] as const;

for (const [source, input, action, output, dimensions] of conversions) {
  test(`${source}의 결과를 이미지를 PDF로에서 연다`, async ({ page }) => {
    const frame = await openTool(page, source, input);
    await frame.getByRole('button', { name: action, exact: true }).click();
    await send(page, frame, 'pdf/from-image');
    await expect(frame.getByTitle(output, { exact: true })).toBeVisible();
    await expect(frame.getByText(dimensions, { exact: false })).toBeVisible();
    await expect(frame.getByRole('button', { name: 'PDF 만들기' })).toBeEnabled();
  });
}

for (const target of [
  'image/remove-bg',
  'image/compress',
  'image/mosaic',
  'pdf/from-image',
] as const) {
  test(`자른 사진을 ${destinations[target]}에서 연다`, async ({ page }) => {
    const frame = await openTool(page, 'image/crop', 'quadrants.png');
    await send(page, frame, target);
    await expect(frame.getByTitle('quadrants_편집.png', { exact: true })).toBeVisible();
    if (target === 'image/mosaic') {
      await frame.getByRole('button', { name: '가릴 곳 추가' }).click();
      await send(page, frame, 'pdf/from-image');
      await expect(frame.getByTitle('quadrants_편집_모자이크.png', { exact: true })).toBeVisible();
      await expect(frame.getByText('40×30', { exact: false })).toBeVisible();
    }
  });
}

for (const target of ['image/id-photo', 'pdf/from-image'] as const) {
  test(`배경을 지운 PNG를 ${destinations[target]}에서 연다`, async ({ page }) => {
    test.setTimeout(120_000);
    const frame = await openTool(page, 'image/remove-bg', 'face.jpg');
    await frame.getByRole('button', { name: /^데이터 받기/ }).click();
    await expect(frame.getByRole('button', { name: 'PNG 다운로드' })).toBeEnabled({
      timeout: 60_000,
    });
    await send(page, frame, target);
    await expect(frame.getByTitle('face_배경제거.png', { exact: true })).toBeVisible();
    if (target === 'image/id-photo') {
      await expect(frame.getByRole('button', { name: 'JPG 다운로드' })).toBeEnabled();
      await expect(frame.getByRole('button', { name: /^데이터 받기/ })).toBeVisible();
    } else {
      await expect(frame.getByText('800×1200', { exact: false })).toBeVisible();
    }
  });
}

for (const target of ['image/crop', 'image/remove-bg'] as const) {
  test(`동영상의 선택한 장면을 ${destinations[target]}에서 연다`, async ({ page }) => {
    const frame = await openTool(page, 'video/frame-capture', 'color-steps.mp4');
    const time = frame.getByLabel('위치 (초)');
    await time.fill('1.5');
    await time.press('Enter');
    await expect(frame.getByText('지금 장면 0:01.50 · JPG')).toBeVisible();
    await send(page, frame, target);
    await expect(frame.getByTitle('color-steps_00m01.50s.jpg', { exact: true })).toBeVisible();
    if (target === 'image/remove-bg') {
      await expect(frame.getByRole('button', { name: /^데이터 받기/ })).toBeVisible();
    }
  });
}

test('여러 장면은 한 장 전용 도구를 비활성화하고 네 쪽 PDF로 저장된다', async ({ page }) => {
  const frame = await openTool(page, 'video/frame-capture', 'color-steps.mp4');
  await frame.getByText('일정 간격으로 여러 장', { exact: true }).click();
  await expect(frame.getByText('4장 · JPG · ZIP')).toBeVisible();
  await frame.getByRole('button', { name: '다음 도구로', exact: true }).click();
  await expect(
    frame.getByRole('button', { name: /이미지 자르기·회전.*한 장일 때만/ }),
  ).toBeDisabled();
  await frame.getByRole('button', { name: destinations['pdf/from-image'], exact: true }).click();
  await expect(page).toHaveURL('/pdf/from-image/');
  await expect(frame.getByText('320×180', { exact: false })).toHaveCount(4);
  await frame.getByRole('button', { name: 'PDF 만들기' }).click();
  const event = page.waitForEvent('download');
  await frame.getByRole('button', { name: '다운로드' }).click();
  const file = await event;
  expect(file.suggestedFilename()).toBe('color-steps_00m00.00s.pdf');
  const pdf = getDocument({ data: new Uint8Array(await readFile(await file.path())) });
  try {
    expect((await pdf.promise).numPages).toBe(4);
  } finally {
    await pdf.destroy();
  }
});

test('PDF에서 고른 한 쪽을 자르기에서 연다', async ({ page }) => {
  const frame = await openTool(page, 'pdf/to-image', 'three-pages.pdf');
  await frame.getByText('선택 추출', { exact: true }).click();
  await frame.getByRole('button', { name: '2쪽' }).click();
  await frame.getByRole('button', { name: '이미지로 변환' }).click();
  await send(page, frame, 'image/crop');
  await expect(frame.getByTitle('three-pages_2.jpg', { exact: true })).toBeVisible();
  await expect(frame.getByRole('button', { name: '자른 이미지 받기' })).toBeEnabled();
});

test('도구를 받는 동안 다른 사진을 열면 늦게 온 전환이 새 작업을 덮지 않는다', async ({ page }) => {
  const frame = await openTool(page, 'image/crop', 'quadrants.png');
  let resume!: () => void;
  const paused = new Promise<void>((resolve) => (resume = resolve));
  const pattern = '**/_chain/image/mosaic.json';
  await page.route(pattern, async (route) => {
    await paused;
    await route.continue();
  });
  const pending = page.waitForRequest(pattern);
  await frame.getByRole('button', { name: '다음 도구로', exact: true }).click();
  await frame.getByRole('button', { name: destinations['image/mosaic'], exact: true }).click();
  await pending;
  try {
    await frame.getByRole('button', { name: '다른 이미지' }).click();
    await frame.locator('input[type=file]').first().setInputFiles(fixture('wide.png'));
    await expect(frame.getByTitle('wide.png', { exact: true })).toBeVisible();
  } finally {
    resume();
  }
  await page.waitForLoadState('networkidle');
  await expect(page).toHaveURL('/image/crop/');
  await expect(frame.getByTitle('wide.png', { exact: true })).toBeVisible();
  await send(page, frame, 'pdf/from-image');
  await expect(frame.getByTitle('wide_편집.png', { exact: true })).toBeVisible();
});
