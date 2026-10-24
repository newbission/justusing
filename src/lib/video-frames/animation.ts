/**
 * 동영상 구간을 움직이는 그림(GIF·WebP)으로 (동영상을 GIF로).
 *
 * 화면(이 파일)이 숨은 <video>로 장면을 하나씩 찾아가 canvas로 줄여 화소를 뽑고(FrameReader),
 * 워커(animation.worker.ts)가 받는 대로 GIF·WebP로 묶는다. 장면을 모두 쌓아 두지 않아 긴 구간도 메모리가 늘지 않는다.
 * 이 모듈은 동영상을 GIF로 도구 frame에서만 불러온다 (gifenc는 워커에만 들어간다).
 */
import workerUrl from './animation.worker.ts?worker&url';
import { createWorker } from '../worker';
import { frameDelays, frameTimes } from './times';
import type { FrameReader } from './video';

export type AnimationFormat = 'gif' | 'webp';

/** 워커가 저장에 쓰는 설정 */
export interface EncodeSettings {
  format: AnimationFormat;
  width: number;
  height: number;
  /** GIF 색 수 (2~256) */
  colors: number;
  /** GIF 순서 디더링 */
  dither: boolean;
  /** WebP 화질 (0~1) */
  quality: number;
  /** 계속 반복 (아니면 한 번 재생) */
  loop: boolean;
}

export interface AnimationSettings extends EncodeSettings {
  /** 구간 (초) */
  start: number;
  end: number;
  /** 초당 장면 수 */
  fps: number;
}

export type AnimationRequest =
  | { id: number; kind: 'start'; settings: EncodeSettings; samples: Uint8ClampedArray[] }
  | { id: number; kind: 'frame'; pixels: Uint8ClampedArray; delay: number }
  | { id: number; kind: 'finish' }
  | { id: number; kind: 'cancel' }
  | {
      id: number;
      kind: 'estimate';
      settings: EncodeSettings;
      samples: Uint8ClampedArray[];
      pairs: [Uint8ClampedArray, Uint8ClampedArray][];
      count: number;
    };

/** encode: 저장하다 실패(대개 메모리), webp: 이 브라우저가 WebP로 저장하지 못함 */
export type AnimationFailure = 'encode' | 'webp' | 'seek';

export type AnimationResponse =
  | { id: number; kind: 'ok' }
  | { id: number; kind: 'done'; bytes: Uint8Array }
  | { id: number; kind: 'estimated'; bytes: number }
  | { id: number; kind: 'error'; reason: AnimationFailure };

export class AnimationError extends Error {
  constructor(readonly reason: AnimationFailure) {
    super(reason);
  }
}

/** 색 표를 만들 때 모으는 장면 수 (구간 곳곳에서 고르게) */
const PALETTE_SAMPLES = 12;
/** 용량 예상에 실제로 저장해 보는 이어진 두 장면 묶음 수 */
const ESTIMATE_PAIRS = 3;
/** 워커에 먼저 보내 두는 장면 수 (장면 찾기와 저장이 겹치게, 메모리는 이만큼만) */
const IN_FLIGHT = 4;

let workerPromise: Promise<Worker> | undefined;
let nextId = 0;

type Ask = AnimationRequest extends infer R
  ? R extends AnimationRequest
    ? Omit<R, 'id'>
    : never
  : never;

async function ask(request: Ask, transfer: Transferable[] = []): Promise<AnimationResponse> {
  const worker = await (workerPromise ??= createWorker(workerUrl));
  const id = nextId++;
  return new Promise((resolve) => {
    const finish = () => {
      worker.removeEventListener('message', listener);
      worker.removeEventListener('error', onError);
    };
    const listener = (event: MessageEvent<AnimationResponse>) => {
      if (event.data.id !== id) return;
      finish();
      resolve(event.data);
    };
    // 워커가 죽으면(메모리 부족) 답이 오지 않는다. 다음에는 새 워커를 띄운다
    const onError = () => {
      finish();
      worker.terminate();
      workerPromise = undefined;
      resolve({ id, kind: 'error', reason: 'encode' });
    };
    worker.addEventListener('message', listener);
    worker.addEventListener('error', onError);
    worker.postMessage({ ...request, id } as AnimationRequest, transfer);
  });
}

function expectOk(response: AnimationResponse): AnimationResponse {
  if (response.kind === 'error') throw new AnimationError(response.reason);
  return response;
}

function encodeSettings(settings: AnimationSettings): EncodeSettings {
  const { format, width, height, colors, dither, quality, loop } = settings;
  return { format, width, height, colors, dither, quality, loop };
}

/** 장면 시각들에서 고르게 count개 */
function spread(times: number[], count: number): number[] {
  const k = Math.min(count, times.length);
  return Array.from({ length: k }, (_, i) => times[Math.floor(((i + 0.5) * times.length) / k)]!);
}

async function grab(reader: FrameReader, time: number, settings: AnimationSettings) {
  try {
    return (await reader.pixels(time, settings.width, settings.height)).data;
  } catch {
    throw new AnimationError('seek');
  }
}

function checkAbort(signal?: AbortSignal) {
  if (signal?.aborted) throw new DOMException('그만두었습니다', 'AbortError');
}

/** 색 표용 장면 (GIF만 쓴다) */
async function paletteSamples(
  reader: FrameReader,
  times: number[],
  settings: AnimationSettings,
  signal?: AbortSignal,
): Promise<Uint8ClampedArray[]> {
  if (settings.format !== 'gif') return [];
  const samples: Uint8ClampedArray[] = [];
  for (const time of spread(times, PALETTE_SAMPLES)) {
    checkAbort(signal);
    samples.push(await grab(reader, time, settings));
  }
  return samples;
}

/** 이 설정으로 만들면 대략 몇 바이트인지 */
export async function estimateSize(
  reader: FrameReader,
  settings: AnimationSettings,
  signal?: AbortSignal,
): Promise<number> {
  const times = frameTimes(settings.start, settings.end, settings.fps);
  const samples = await paletteSamples(reader, times, settings, signal);
  const pairs: [Uint8ClampedArray, Uint8ClampedArray][] = [];
  const starts = times.length > 1 ? spread(times.slice(0, -1), ESTIMATE_PAIRS) : times;
  for (const time of starts) {
    checkAbort(signal);
    const a = await grab(reader, time, settings);
    const b = times.length > 1 ? await grab(reader, time + 1 / settings.fps, settings) : a.slice();
    pairs.push([a, b]);
  }
  checkAbort(signal);
  const response = expectOk(
    await ask({
      kind: 'estimate',
      settings: encodeSettings(settings),
      samples,
      pairs,
      count: times.length,
    }),
  );
  return response.kind === 'estimated' ? response.bytes : 0;
}

/** 구간을 움직이는 그림 파일 하나로. onProgress(장면 수, 전체) */
export async function makeAnimation(
  reader: FrameReader,
  settings: AnimationSettings,
  onProgress: (done: number, total: number) => void,
  signal?: AbortSignal,
): Promise<Uint8Array> {
  const times = frameTimes(settings.start, settings.end, settings.fps);
  const delays = frameDelays(times.length, settings.fps);
  onProgress(0, times.length);
  try {
    const samples = await paletteSamples(reader, times, settings, signal);
    checkAbort(signal);
    expectOk(
      await ask(
        { kind: 'start', settings: encodeSettings(settings), samples },
        samples.map((sample) => sample.buffer),
      ),
    );
    const pending: Promise<AnimationResponse>[] = [];
    let done = 0;
    const settle = async () => {
      expectOk(await pending.shift()!);
      onProgress(++done, times.length);
    };
    for (let i = 0; i < times.length; i++) {
      checkAbort(signal);
      const pixels = await grab(reader, times[i]!, settings);
      pending.push(ask({ kind: 'frame', pixels, delay: delays[i]! }, [pixels.buffer]));
      if (pending.length >= IN_FLIGHT) await settle();
    }
    while (pending.length > 0) await settle();
    checkAbort(signal);
    const response = expectOk(await ask({ kind: 'finish' }));
    if (response.kind !== 'done') throw new AnimationError('encode');
    return response.bytes;
  } catch (error) {
    // 그만두었거나 실패하면 워커가 쥔 장면을 버린다
    await ask({ kind: 'cancel' });
    throw error;
  }
}

/** 이 브라우저가 WebP로 저장할 수 있는지 (Safari는 못 한다) */
export function canEncodeWebp(): boolean {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 1;
    return canvas.toDataURL('image/webp').startsWith('data:image/webp');
  } catch {
    return false;
  }
}
