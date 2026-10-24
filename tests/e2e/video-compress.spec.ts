/**
 * 동영상 용량 줄이기 E2E. 빌드 결과에서 돌린다 (playwright.config.ts 참고).
 *
 * clip.mp4(6초, 1280×720, 1초마다 색이 바뀜)를 다시 저장해 받은 파일의 해상도·코덱·길이·소리와
 * 장면 색이 그대로인지 본다.
 */
import { expect, test } from './test';
import { statSync } from 'node:fs';
import { colorAt, fixture, fixtureKB, inspect, openVideoTool, runAndDownload } from './video';

test('480p로 줄이면 H.264 MP4로 다시 저장하고 소리는 그대로 옮긴다', async ({ page }) => {
  const frame = await openVideoTool(page, 'compress', 'clip.mp4');
  // 원래 크기보다 작은 해상도만 고를 수 있다 (720p는 원래 크기와 같아 없다)
  await expect(frame.getByRole('radio')).toHaveCount(2 + 2 + 3);
  await expect(frame.getByRole('radio', { name: '원래 크기 (1280×720)' })).toBeChecked();
  await frame.getByRole('radio', { name: '480p (854×480)' }).check();
  await frame.getByText('낮음', { exact: true }).click();
  await expect(
    frame.getByText(new RegExp(`^예상 약 .+ \\(원본 ${fixtureKB('clip.mp4')}\\)$`)),
  ).toBeVisible();
  await expect(frame.getByText(/화면은 H\.264, 그릇은 MP4로 저장합니다/)).toBeVisible();
  await expect(
    frame.getByText(/소리는 다시 인코딩하지 않고 그대로 옮깁니다 \(AAC\)/),
  ).toBeVisible();

  const file = await runAndDownload(page, frame, '줄이기', '받기');
  expect(file.name).toBe('clip_줄임.mp4');
  expect(file.bytes.length).toBeLessThan(statSync(fixture('clip.mp4')).size * 0.7);
  await expect(
    frame.getByText(new RegExp(`^${fixtureKB('clip.mp4')} → .+ \\(\\d+% 줄임\\) · 854×480$`)),
  ).toBeVisible();
  const facts = await inspect(file.bytes);
  expect(facts.video).toMatchObject({ codec: 'avc', width: 854, height: 480 });
  expect(facts.audio).toMatchObject({ codec: 'aac', sampleRate: 48000, channels: 2 });
  expect(facts.duration).toBeCloseTo(6, 0);
  expect(await colorAt(page, file.bytes, 'video/mp4', 0.5)).toBe('red');
  expect(await colorAt(page, file.bytes, 'video/mp4', 3.5)).toBe('yellow');
});

test('목표 용량으로 줄이고, 소리보다 작은 용량은 막는다', async ({ page }) => {
  const frame = await openVideoTool(page, 'compress', 'clip.webm');
  await frame.getByText('목표 용량으로', { exact: true }).click();
  const target = frame.getByRole('textbox', { name: '목표 용량 (MB)' });
  await target.fill('0.001');
  await expect(
    frame.getByText('이 용량은 소리만으로도 넘칩니다. 더 크게 적어 주세요.'),
  ).toBeVisible();
  await expect(frame.getByRole('button', { name: '줄이기', exact: true })).toBeDisabled();

  await target.fill('0.15');
  await expect(
    frame.getByText(new RegExp(`^예상 약 \\d+KB \\(원본 ${fixtureKB('clip.webm')}\\)$`)),
  ).toBeVisible();
  const file = await runAndDownload(page, frame, '줄이기', '받기');
  expect(file.name).toBe('clip_줄임.mp4');
  // 인코더가 목표를 조금 넘을 수 있다
  expect(file.bytes.length).toBeLessThan(0.15 * 1024 * 1024 * 1.4);
  const facts = await inspect(file.bytes);
  expect(facts.video).toMatchObject({ codec: 'avc', width: 640, height: 360 });
  // Opus 소리는 AAC로 다시 저장한다 (AAC로 저장하지 못하는 브라우저는 MP4에 들어가는 Opus를 그대로 옮긴다)
  expect(['aac', 'opus']).toContain(facts.audio?.codec);
});

test('WebCodecs가 없는 브라우저에서는 미리 알리고 시작하지 않는다', async ({ page }) => {
  await page.addInitScript(() => {
    for (const name of ['VideoDecoder', 'VideoEncoder', 'AudioDecoder', 'AudioEncoder']) {
      delete (globalThis as Record<string, unknown>)[name];
    }
  });
  const frame = await openVideoTool(page, 'compress', 'clip.mp4');
  await expect(
    frame.getByText(/이 브라우저는 동영상을 다시 저장하는 기능\(WebCodecs\)이 없습니다/),
  ).toBeVisible();
  await expect(frame.getByRole('button', { name: '줄이기', exact: true })).toBeDisabled();
});

test('원본보다 작아지지 않으면 받지 않게 알린다 (영어 화면, 소리 없는 동영상)', async ({
  page,
}) => {
  await page.goto('/en/video/compress/');
  const frame = page.frameLocator('iframe[data-tool-frame]');
  // 한 가지 색만 이어지는 3초짜리 4KB 동영상: 다시 저장하면 오히려 커진다
  await frame.locator('input[type=file]').first().setInputFiles(fixture('silent.mp4'));
  await expect(frame.getByText('This video has no sound.')).toBeVisible();
  await frame.getByRole('button', { name: 'Compress', exact: true }).click();
  await expect(frame.getByText(/^The result \(.+\) is not smaller than the original/)).toBeVisible({
    timeout: 60_000,
  });
  await expect(frame.getByRole('button', { name: 'Download' })).toHaveCount(0);
  await expect(frame.getByRole('button', { name: 'Compress', exact: true })).toBeDisabled();
  // 설정을 바꾸면 다시 해 볼 수 있다
  await frame.getByText('Low', { exact: true }).click();
  await expect(frame.getByRole('button', { name: 'Compress', exact: true })).toBeEnabled();
});
