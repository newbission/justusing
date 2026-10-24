/**
 * 동영상 소리 추출 E2E. 빌드 결과에서 돌린다 (playwright.config.ts 참고).
 *
 * clip.mp4(AAC)·clip.webm(Opus)에서 소리를 뽑아 받은 파일의 형식·코덱·길이를 본다. 화면 트랙은 없어야 한다.
 */
import { expect, test } from './test';
import { fixture, inspect, openVideoTool, runAndDownload } from './video';

test('AAC 소리는 다시 인코딩 없이 M4A로 꺼낸다', async ({ page }) => {
  const frame = await openVideoTool(page, 'extract-audio', 'clip.mp4');
  await expect(frame.getByText('AAC · 48kHz · 스테레오')).toBeVisible();
  await expect(frame.getByRole('radio', { name: /M4A \(원래 소리 그대로\)/ })).toBeChecked();
  // 이미 AAC라 'M4A로 다시 저장'은 보이지 않는다
  await expect(frame.getByRole('radio')).toHaveCount(2);
  await expect(frame.getByText(/^M4A로 저장 · 예상 약 \d+KB$/)).toBeVisible();

  const file = await runAndDownload(page, frame, '소리 뽑기', '받기');
  expect(file.name).toBe('clip_소리.m4a');
  await expect(frame.getByText(/^뽑았습니다: 0:06\.0 · \d+KB · M4A$/)).toBeVisible();
  const facts = await inspect(file.bytes);
  expect(facts.video).toBeUndefined();
  expect(facts.audio).toMatchObject({ codec: 'aac', sampleRate: 48000, channels: 2 });
  expect(facts.duration).toBeCloseTo(6, 1);
});

test('WebM의 Opus 소리는 OGG로 꺼내고, WAV로 풀어 저장할 수도 있다', async ({ page }) => {
  const frame = await openVideoTool(page, 'extract-audio', 'clip.webm');
  const ogg = await runAndDownload(page, frame, '소리 뽑기', '받기');
  expect(ogg.name).toBe('clip_소리.ogg');
  const oggFacts = await inspect(ogg.bytes);
  expect(oggFacts.format).toBe('Ogg');
  expect(oggFacts.audio?.codec).toBe('opus');
  expect(oggFacts.duration).toBeCloseTo(4, 0);

  await frame.getByRole('radio', { name: /WAV/ }).check();
  await expect(frame.getByText(/^WAV로 저장 · 예상 약/)).toBeVisible();
  const wav = await runAndDownload(page, frame, '소리 뽑기', '받기');
  expect(wav.name).toBe('clip_소리.wav');
  const wavFacts = await inspect(wav.bytes);
  expect(wavFacts.format).toBe('WAVE');
  expect(wavFacts.audio).toMatchObject({ codec: 'pcm-s16', channels: 2 });
  expect(wavFacts.duration).toBeCloseTo(4, 0);
});

test('AAC로 저장할 수 있는 브라우저는 Opus 소리를 M4A로 다시 저장한다', async ({ page }) => {
  const frame = await openVideoTool(page, 'extract-audio', 'clip.webm');
  const aac = frame.getByRole('radio', { name: /M4A \(AAC로 다시 저장\)/ });
  // AAC 인코더가 없는 브라우저(일부 리눅스 빌드 등)는 고를 수 없게 하고 까닭을 보인다
  if (!(await aac.isEnabled())) {
    await expect(frame.getByText('이 브라우저는 AAC로 저장하지 못합니다.')).toBeVisible();
    return;
  }
  await aac.check();
  const file = await runAndDownload(page, frame, '소리 뽑기', '받기');
  expect(file.name).toBe('clip_소리.m4a');
  expect((await inspect(file.bytes)).audio?.codec).toBe('aac');
});

test('WAV에 그대로 못 담는 PCM(빅엔디언)은 풀어서 WAV로 저장한다', async ({ page }) => {
  // 카메라 MOV에 흔한 빅엔디언 16비트 PCM(twos)
  const frame = await openVideoTool(page, 'extract-audio', 'pcm-be.mov');
  await expect(frame.getByRole('radio', { name: /원래 소리 그대로/ })).toBeDisabled();
  await expect(frame.getByText(/이 소리 코덱은 그대로 담을 파일 형식이 없어/)).toBeVisible();
  await expect(frame.getByRole('radio', { name: /WAV \(압축 없음\)/ })).toBeChecked();
  const file = await runAndDownload(page, frame, '소리 뽑기', '받기');
  expect(file.name).toBe('pcm-be_소리.wav');
  const facts = await inspect(file.bytes);
  expect(facts.audio).toMatchObject({ codec: 'pcm-s16', channels: 2 });
  expect(facts.duration).toBeCloseTo(2, 0);
});

test('WebCodecs가 없으면 원래 소리 그대로만 꺼낼 수 있다', async ({ page }) => {
  await page.addInitScript(() => {
    for (const name of ['VideoDecoder', 'VideoEncoder', 'AudioDecoder', 'AudioEncoder']) {
      delete (globalThis as Record<string, unknown>)[name];
    }
  });
  const frame = await openVideoTool(page, 'extract-audio', 'clip.mp4');
  await expect(frame.getByRole('radio', { name: /WAV/ })).toBeDisabled();
  await expect(
    frame.getByText('이 브라우저는 이 소리(AAC)를 풀지 못해 WAV로 저장할 수 없습니다.'),
  ).toBeVisible();
  const file = await runAndDownload(page, frame, '소리 뽑기', '받기');
  expect((await inspect(file.bytes)).audio?.codec).toBe('aac');
});

test('소리 없는 동영상은 알린다 (영어 화면)', async ({ page }) => {
  await page.goto('/en/video/extract-audio/');
  const frame = page.frameLocator('iframe[data-tool-frame]');
  await frame.locator('input[type=file]').first().setInputFiles(fixture('silent.mp4'));
  await expect(frame.getByRole('alert')).toHaveText(
    'This video has no sound. Please choose a video with sound.',
  );
});
