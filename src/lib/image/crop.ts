/**
 * 이미지 한 장을 자르고 돌린다 (이미지 자르기·회전). 읽기·저장은 워커(crop.worker.ts)가 하고,
 * 워커가 원본을 들고 있다가 저장할 때 쓴다. 화면에는 줄인 미리보기만 넘긴다. 파일은 어디로도 보내지 않는다.
 */
import workerUrl from './crop.worker.ts?worker&url';
import { createWorker } from '../worker';
import { readable } from './heif';
import type { Rect, Turn } from './crop-geometry';
import type { OutputType } from './process';

/** decode: 읽지 못한 사진, tooLarge: 이 브라우저가 그리지 못하는 크기, encode: 그 형식으로 저장하지 못함 */
export type CropFailure = 'decode' | 'tooLarge' | 'encode';

export type CropRequest =
  | { id: number; kind: 'open'; file: Blob | ImageBitmap; previewSide: number }
  | { id: number; kind: 'export'; turn: Turn; rect: Rect; type: OutputType; quality: number };

export type CropResponse =
  | { id: number; kind: 'opened'; width: number; height: number; preview: ImageBitmap }
  | { id: number; kind: 'exported'; bytes: Uint8Array }
  | { id: number; kind: 'error'; reason: CropFailure };

export class CropError extends Error {
  constructor(readonly reason: CropFailure) {
    super(reason);
  }
}

export interface OpenedImage {
  /** 바로 세운 원본의 가로·세로 */
  width: number;
  height: number;
  /** 긴 변을 previewSide 이하로 줄인 미리보기 */
  preview: ImageBitmap;
}

let workerPromise: Promise<Worker> | undefined;
let nextId = 0;

type Ask = CropRequest extends infer R ? (R extends CropRequest ? Omit<R, 'id'> : never) : never;

async function ask(request: Ask): Promise<CropResponse> {
  const worker = await (workerPromise ??= createWorker(workerUrl));
  const id = nextId++;
  return new Promise((resolve) => {
    const finish = () => {
      worker.removeEventListener('message', listener);
      worker.removeEventListener('error', onError);
    };
    const listener = (event: MessageEvent<CropResponse>) => {
      if (event.data.id !== id) return;
      finish();
      resolve(event.data);
    };
    // 워커가 죽으면(대개 큰 사진으로 메모리가 모자람) 답이 오지 않는다. 원본도 잃었으니 다음에는 새로 연다
    const onError = () => {
      finish();
      worker.terminate();
      workerPromise = undefined;
      resolve({ id, kind: 'error', reason: 'tooLarge' });
    };
    worker.addEventListener('message', listener);
    worker.addEventListener('error', onError);
    // libheif로 푼 HEIC 그림은 옮겨 준다 (복사하지 않게)
    const transfer =
      request.kind === 'open' && request.file instanceof ImageBitmap ? [request.file] : [];
    worker.postMessage({ ...request, id } as CropRequest, transfer);
  });
}

/**
 * 사진을 연다. 워커가 원본을 들고 있다가 저장에 쓴다 (새로 열면 바뀐다).
 * 브라우저가 못 읽는 HEIC는 libheif로 풀어 넘긴다
 */
export async function openImage(file: Blob, previewSide: number): Promise<OpenedImage> {
  let source: Blob | ImageBitmap;
  try {
    source = await readable(file);
  } catch {
    throw new CropError('decode');
  }
  const response = await ask({ kind: 'open', file: source, previewSide });
  if (response.kind === 'opened') return response;
  throw new CropError(response.kind === 'error' ? response.reason : 'decode');
}

/** 마지막으로 연 사진을 돌리고 잘라 저장한다. 실패하면 CropError */
export async function exportImage(
  turn: Turn,
  rect: Rect,
  type: OutputType,
  quality: number,
): Promise<Uint8Array> {
  const response = await ask({ kind: 'export', turn, rect, type, quality });
  if (response.kind === 'exported') return response.bytes;
  throw new CropError(response.kind === 'error' ? response.reason : 'encode');
}
