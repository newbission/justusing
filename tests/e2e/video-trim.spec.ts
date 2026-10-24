/**
 * 동영상 자르기 E2E. 빌드 결과에서 돌린다 (playwright.config.ts 참고).
 *
 * clip.mp4(6초, 1초마다 색이 바뀜, 키프레임 0·2·4초)를 잘라 받은 파일의 길이·크기·트랙과
 * 첫 장면의 색(어디서 잘렸는지)을 본다.
 */
import { expect, test } from './test';
import type { FrameLocator } from '@playwright/test';
import { colorAt, fixture, inspect, openVideoTool, runAndDownload } from './video';

async function setTimes(frame: FrameLocator, start: string, end: string) {
  await frame.getByRole('textbox', { name: '끝' }).fill(end);
  await frame.getByRole('textbox', { name: '끝' }).press('Enter');
  await frame.getByRole('textbox', { name: '시작' }).fill(start);
  await frame.getByRole('textbox', { name: '시작' }).press('Enter');
}

test('빠르게 자르면 다시 인코딩 없이 고른 시점부터 재생된다', async ({ page }) => {
  const frame = await openVideoTool(page, 'trim', 'clip.mp4');
  await expect(frame.getByText('clip.mp4')).toBeVisible();
  await expect(frame.getByText('0:06.0 · 87KB · 1280×720 · H.264 · AAC')).toBeVisible();
  await setTimes(frame, '2.5', '4.2');
  await expect(frame.getByText('0:02.5 ~ 0:04.2 (0:01.7) 남기기')).toBeVisible();

  const file = await runAndDownload(page, frame, '자르기', '받기');
  expect(file.name).toBe('clip_자름.mp4');
  await expect(frame.getByText(/잘랐습니다: 0:01\.7/)).toBeVisible();
  const facts = await inspect(file.bytes);
  // 그릇만 읽으면 편집 목록으로 가린 뒤쪽 장면(한 장 안팎)까지 센다
  expect(facts.duration).toBeGreaterThan(1.65);
  expect(facts.duration).toBeLessThan(1.85);
  expect(facts.video).toMatchObject({ codec: 'avc', width: 1280, height: 720 });
  expect(facts.audio?.codec).toBe('aac');
  // 다시 인코딩하지 않았으므로 2초 키프레임부터 담겨 있다 (편집 목록으로 앞 0.5초는 보이지 않음)
  expect(facts.video!.firstTimestamp).toBeCloseTo(-0.5, 2);
  // 2.5초는 파랑(2~3초), 3.5초 뒤인 1.0초는 노랑(3~4초)
  expect(await colorAt(page, file.bytes, 'video/mp4', 0.05)).toBe('blue');
  expect(await colorAt(page, file.bytes, 'video/mp4', 1.0)).toBe('yellow');
});

test('정확하게 자르면 고른 장면이 첫 장면이 된다', async ({ page }) => {
  const frame = await openVideoTool(page, 'trim', 'clip.mp4');
  await setTimes(frame, '1.5', '3.5');
  await frame.getByRole('radio', { name: /정확하게/ }).check();
  const file = await runAndDownload(page, frame, '자르기', '받기');
  const facts = await inspect(file.bytes);
  expect(facts.duration).toBeCloseTo(2, 1);
  expect(facts.video).toMatchObject({ codec: 'avc', width: 1280, height: 720 });
  expect(facts.video!.firstTimestamp).toBeGreaterThanOrEqual(0);
  expect(facts.audio?.codec).toBe('aac');
  expect(await colorAt(page, file.bytes, 'video/mp4', 0.05)).toBe('green');
  expect(await colorAt(page, file.bytes, 'video/mp4', 1.2)).toBe('blue');
});

test('손잡이를 방향키로 옮기고 지금 위치를 시작으로 고른다', async ({ page }) => {
  const frame = await openVideoTool(page, 'trim', 'clip.mp4');
  const start = frame.getByRole('slider', { name: '시작' });
  await start.press('Shift+ArrowRight');
  await start.press('Shift+ArrowRight');
  await start.press('ArrowRight');
  await expect(frame.getByRole('textbox', { name: '시작' })).toHaveValue('0:02.10');
  const end = frame.getByRole('slider', { name: '끝' });
  await end.press('Shift+ArrowLeft');
  await expect(frame.getByRole('textbox', { name: '끝' })).toHaveValue('0:05.00');
  await expect(end).toHaveAttribute('aria-valuetext', '0:05.0');
  // 끝 손잡이를 옮기면 미리보기도 그 위치로 가므로, 그 위치를 시작으로 고르면 너무 짧다
  await frame.getByRole('button', { name: '지금 위치를 시작으로' }).click();
  await expect(frame.getByRole('textbox', { name: '시작' })).toHaveValue('0:04.90');
  await expect(frame.getByText('0:04.9 ~ 0:05.0 (0:00.1) 남기기')).toBeVisible();
});

test('WebM도 같은 형식으로 자른다', async ({ page }) => {
  const frame = await openVideoTool(page, 'trim', 'clip.webm');
  await setTimes(frame, '1', '3');
  const file = await runAndDownload(page, frame, '자르기', '받기');
  expect(file.name).toBe('clip_자름.webm');
  const facts = await inspect(file.bytes);
  expect(facts.format).toBe('WebM');
  expect(facts.video).toMatchObject({ codec: 'vp9', width: 640, height: 360 });
  expect(facts.audio?.codec).toBe('opus');
});

test('WebCodecs가 없는 브라우저는 빠르게 자르기만 된다', async ({ page }) => {
  // 도구 frame에서 WebCodecs를 없앤다 (예전 Safari처럼)
  await page.addInitScript(() => {
    for (const name of ['VideoDecoder', 'VideoEncoder', 'AudioDecoder', 'AudioEncoder']) {
      delete (globalThis as Record<string, unknown>)[name];
    }
  });
  const frame = await openVideoTool(page, 'trim', 'clip.mp4');
  await expect(frame.getByRole('radio', { name: /정확하게/ })).toBeDisabled();
  await expect(
    frame.getByText('이 브라우저에서는 다시 인코딩할 수 없어 빠르게 자르기만 됩니다.'),
  ).toBeVisible();
  await setTimes(frame, '0', '2');
  const file = await runAndDownload(page, frame, '자르기', '받기');
  expect((await inspect(file.bytes)).duration).toBeCloseTo(2, 1);
});

test('동영상이 아니거나 다룰 수 없는 코덱이면 알린다', async ({ page }) => {
  let frame = await openVideoTool(page, 'trim', 'broken-video.mp4');
  await expect(frame.getByRole('alert')).toContainText('이 파일을 동영상으로 열 수 없습니다');
  await expect(frame.getByText('동영상 파일 선택')).toBeVisible();

  frame = await openVideoTool(page, 'trim', 'mpeg4-part2.mp4');
  await expect(frame.getByRole('alert')).toContainText('이 동영상의 코덱은 다룰 수 없습니다');
});

test('영어 화면', async ({ page }) => {
  await page.goto('/en/video/trim/');
  const frame = page.frameLocator('iframe[data-tool-frame]');
  await frame.locator('input[type=file]').first().setInputFiles(fixture('silent.mp4'));
  await expect(frame.getByText('0:03.0 · 4KB · 640×360 · H.264 · No sound')).toBeVisible();
  await expect(frame.getByRole('button', { name: 'Trim', exact: true })).toBeVisible();
});
