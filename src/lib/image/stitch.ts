/**
 * 사진 여러 장을 한 장으로 잇는다 (이미지 이어 붙이기). 겹친 부분 찾기와 그리기·저장은 워커(stitch.worker.ts)가 한다.
 * 파일은 복사하지 않고 넘기고, 어디로도 보내지 않는다.
 */
import workerUrl from './stitch.worker.ts?worker&url';
import { createWorker } from '../worker';
import { readable } from './heif';
import type { OutputType } from './process';
import type { Seam, StitchLayout } from './stitch-layout';

export type StitchFormat = 'jpg' | 'png' | 'webp';
export type Background = 'white' | 'black' | 'transparent';

export const STITCH_TYPES: Record<StitchFormat, OutputType> = {
  jpg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
};

/** 원본 파일, 또는 브라우저가 못 읽는 HEIC를 libheif로 바로 세워 푼 그림 (워커에 넘길 때 바꾼다) */
type Source = Blob | ImageBitmap;

export interface StitchJob {
  /** layout.pieces의 index 순서대로 */
  files: Source[];
  layout: StitchLayout;
  background: Background;
  format: StitchFormat;
  /** JPG·WebP 화질 (0~1) */
  quality: number;
  /** 이 높이(결과 화소)를 넘지 않게 여러 장으로 나눈다. 글 줄을 자르지 않게 빈 줄에서 자른다 */
  chunk?: number;
}

/** decode: 읽지 못한 사진, tooLarge: 이 브라우저가 그리지 못하는 크기, encode: 그 형식으로 저장하지 못함 */
export type StitchFailure = 'decode' | 'tooLarge' | 'encode';

export type StitchRequest =
  | {
      id: number;
      kind: 'seam';
      a: { key: number; file: Source };
      b: { key: number; file: Source };
    }
  | { id: number; kind: 'forget'; keys: number[] }
  | { id: number; kind: 'stitch'; job: StitchJob };

export type StitchResponse =
  | { id: number; kind: 'seam'; seam?: Seam }
  | { id: number; kind: 'forget' }
  | { id: number; kind: 'stitch'; parts: Uint8Array[] }
  | { id: number; kind: 'error'; reason: StitchFailure };

export class StitchError extends Error {
  constructor(readonly reason: StitchFailure) {
    super(reason);
  }
}

let workerPromise: Promise<Worker> | undefined;
let nextId = 0;

/** 요청 종류마다 id를 뺀 것 (Omit은 종류를 나눠 보지 않아 직접 나눈다) */
type Ask = StitchRequest extends infer R
  ? R extends StitchRequest
    ? Omit<R, 'id'>
    : never
  : never;

/** 앞 요청이 끝나야 다음 요청을 보낸다. 큰 사진 여러 장이 한꺼번에 메모리에 풀리지 않게 */
let queue: Promise<unknown> = Promise.resolve();

function ask(request: Ask): Promise<StitchResponse> {
  const next = queue.then(() => send(request));
  queue = next.catch(() => undefined);
  return next;
}

/** 브라우저가 못 읽는 HEIC를 풀어 넣은 요청과, 워커로 옮길 그림들. 풀지 못하면 HeifError */
async function prepare(request: Ask): Promise<[Ask, ImageBitmap[]]> {
  const transfer: ImageBitmap[] = [];
  const open = async (file: Source) => {
    const source = file instanceof ImageBitmap ? file : await readable(file);
    if (source instanceof ImageBitmap) transfer.push(source);
    return source;
  };
  try {
    if (request.kind === 'seam') {
      const a = { ...request.a, file: await open(request.a.file) };
      const b = { ...request.b, file: await open(request.b.file) };
      return [{ ...request, a, b }, transfer];
    }
    if (request.kind === 'stitch') {
      const files: Source[] = [];
      for (const file of request.job.files) files.push(await open(file));
      return [{ ...request, job: { ...request.job, files } }, transfer];
    }
    return [request, transfer];
  } catch (error) {
    for (const bitmap of transfer) bitmap.close();
    throw error;
  }
}

async function send(original: Ask): Promise<StitchResponse> {
  let request: Ask;
  let transfer: ImageBitmap[];
  try {
    [request, transfer] = await prepare(original);
  } catch {
    return { id: -1, kind: 'error', reason: 'decode' };
  }
  const worker = await (workerPromise ??= createWorker(workerUrl));
  const id = nextId++;
  return new Promise((resolve, reject) => {
    const finish = () => {
      worker.removeEventListener('message', listener);
      worker.removeEventListener('error', onError);
    };
    const listener = (event: MessageEvent<StitchResponse>) => {
      if (event.data.id !== id) return;
      finish();
      resolve(event.data);
    };
    // 워커가 죽으면(대개 너무 큰 결과로 메모리가 모자람) 답이 오지 않는다. 다음 요청은 새 워커로 한다
    const onError = () => {
      finish();
      worker.terminate();
      workerPromise = undefined;
      reject(new StitchError('tooLarge'));
    };
    worker.addEventListener('message', listener);
    worker.addEventListener('error', onError);
    worker.postMessage({ ...request, id } as StitchRequest, transfer);
  });
}

/**
 * 두 사진 사이에서 잘라 낼 줄 (내려 가며 찍은 화면 캡처의 겹친 부분과 고정 막대).
 * 이어진 캡처로 보이지 않으면 undefined. key는 사진마다 다른 수로, 워커가 읽은 줄 모양을 다시 쓴다
 */
export async function findSeam(
  a: { key: number; file: Blob },
  b: { key: number; file: Blob },
): Promise<Seam | undefined> {
  const response = await ask({ kind: 'seam', a, b });
  if (response.kind !== 'seam')
    throw new StitchError(response.kind === 'error' ? response.reason : 'decode');
  return response.seam;
}

/** 뺀 사진의 줄 모양을 워커에서 버린다 */
export function forgetSeams(keys: number[]): void {
  ask({ kind: 'forget', keys }).catch(() => undefined);
}

/** 이은 결과 (나누면 위에서부터 여러 장). 실패하면 StitchError */
export async function stitchImages(job: StitchJob): Promise<Uint8Array[]> {
  const response = await ask({ kind: 'stitch', job });
  if (response.kind === 'error') throw new StitchError(response.reason);
  if (response.kind !== 'stitch') throw new StitchError('encode');
  return response.parts;
}
