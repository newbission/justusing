/**
 * 동영상 도구 E2E 도우미: 도구 열기, 받은 결과 읽기(트랙·길이·크기), 결과의 한 장면 색 보기.
 *
 * 결과 파일은 테스트(Node)에서 mediabunny로 읽는다. 도구와 같은 라이브러리지만 여기서는 그릇만 읽고
 * (풀기는 하지 않는다), 장면 색은 브라우저의 <video>가 직접 풀어 본다 (도구와 다른 길).
 */
import type { FrameLocator } from '@playwright/test';
import { ALL_FORMATS, BufferSource, EncodedPacketSink, Input } from 'mediabunny';
import { statSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import type { Page } from './test';

export const fixture = (name: string) =>
  fileURLToPath(new URL(`../fixtures/${name}`, import.meta.url));

/** 테스트 파일 크기를 화면처럼 적은 것 (formatSize와 같게, 1MB 아래만) */
export const fixtureKB = (name: string) => `${Math.round(statSync(fixture(name)).size / 1024)}KB`;

export async function openVideoTool(page: Page, tool: string, file: string) {
  await page.goto(`/video/${tool}/`);
  const frame = page.frameLocator('iframe[data-tool-frame]');
  await frame.locator('input[type=file]').first().setInputFiles(fixture(file));
  return frame;
}

/**
 * 동영상 인코더가 폭 maxWidth까지만 저장할 수 있는 브라우저처럼 만든다 (일부 휴대폰의 4K 같은 경우).
 * 도구 frame을 포함해 모든 문서의 VideoEncoder.isConfigSupported를 바꾼다
 */
export async function limitEncoderWidth(page: Page, maxWidth: number) {
  await page.addInitScript((max) => {
    const encoder = (globalThis as { VideoEncoder?: typeof VideoEncoder }).VideoEncoder;
    if (!encoder) return;
    const original = encoder.isConfigSupported.bind(encoder);
    encoder.isConfigSupported = async (config) =>
      config.width > max ? { supported: false, config } : original(config);
  }, maxWidth);
}

/** 버튼을 눌러 일을 끝낸 뒤 '받기'로 받은 파일 */
export async function runAndDownload(
  page: Page,
  frame: FrameLocator,
  run: string,
  download: string,
) {
  await frame.getByRole('button', { name: run, exact: true }).click();
  const button = frame.getByRole('button', { name: download, exact: true });
  await button.waitFor({ timeout: 60_000 });
  const event = page.waitForEvent('download');
  await button.click();
  const file = await event;
  return {
    name: file.suggestedFilename(),
    bytes: new Uint8Array(await readFile(await file.path())),
  };
}

export interface MediaFacts {
  duration: number;
  format: string;
  video?: { codec: string | null; width: number; height: number; firstTimestamp: number };
  audio?: { codec: string | null; sampleRate: number; channels: number };
}

/** 받은 파일의 그릇·길이·트랙 (풀지 않고 그릇만 읽는다) */
export async function inspect(bytes: Uint8Array): Promise<MediaFacts> {
  const input = new Input({ source: new BufferSource(bytes), formats: ALL_FORMATS });
  try {
    const format = (await input.getFormat()).name;
    const video = await input.getPrimaryVideoTrack();
    const audio = await input.getPrimaryAudioTrack();
    const facts: MediaFacts = { duration: await input.computeDuration(), format };
    if (video) {
      const first = await new EncodedPacketSink(video).getFirstPacket();
      facts.video = {
        codec: await video.getCodec(),
        width: await video.getDisplayWidth(),
        height: await video.getDisplayHeight(),
        firstTimestamp: first?.timestamp ?? 0,
      };
    }
    if (audio) {
      facts.audio = {
        codec: await audio.getCodec(),
        sampleRate: await audio.getSampleRate(),
        channels: await audio.getNumberOfChannels(),
      };
    }
    return facts;
  } finally {
    input.dispose();
  }
}

/**
 * 결과 동영상의 time초 장면 가운데 색 이름 (clip.mp4·clip.webm은 1초마다 색이 바뀐다).
 * 바깥 페이지(격리 frame이 아닌 곳)의 <video>로 푼다
 */
export async function colorAt(page: Page, bytes: Uint8Array, type: string, time: number) {
  return page.evaluate(
    async ({ data, type, time }) => {
      const video = document.createElement('video');
      video.muted = true;
      video.src = URL.createObjectURL(new Blob([new Uint8Array(data)], { type }));
      await new Promise((resolve, reject) => {
        video.onloadeddata = resolve;
        video.onerror = () => reject(new Error('재생할 수 없음'));
      });
      video.currentTime = time;
      await new Promise((resolve) => (video.onseeked = resolve));
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(video, 0, 0);
      const [r, g, b] = ctx.getImageData(canvas.width / 2, canvas.height / 2, 1, 1).data;
      const high = (value: number) => value! > 160;
      const name = `${high(r!) ? 'R' : ''}${high(g!) ? 'G' : ''}${high(b!) ? 'B' : ''}`;
      return (
        { R: 'red', G: 'green', B: 'blue', RG: 'yellow', RB: 'magenta', GB: 'cyan' }[name] ??
        `${r},${g},${b}`
      );
    },
    { data: Array.from(bytes), type, time },
  );
}
