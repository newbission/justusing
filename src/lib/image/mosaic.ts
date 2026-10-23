/**
 * 사진 한 장의 가릴 곳에 모자이크·흐림·검게 칠하기를 걸어 저장한다 (이미지 모자이크).
 * 읽기·저장은 워커(mosaic.worker.ts)가 하고, 워커가 원본을 들고 있다가 저장할 때 쓴다.
 * 화면에는 줄인 미리보기만 넘긴다. 파일은 어디로도 보내지 않는다.
 */
import workerUrl from './mosaic.worker.ts?worker&url';
import { createWorker } from '../worker';
import type { Region } from './mosaic-effects';
import type { OutputType } from './process';

/** decode: 읽지 못한 사진, tooLarge: 이 브라우저가 그리지 못하는 크기, encode: 그 형식으로 저장하지 못함 */
export type MosaicFailure = 'decode' | 'tooLarge' | 'encode';

export type MosaicRequest =
  | { id: number; kind: 'open'; file: Blob; previewSide: number }
  | { id: number; kind: 'preview'; regions: Region[] }
  | { id: number; kind: 'export'; regions: Region[]; type: OutputType; quality: number };

export type MosaicResponse =
  | { id: number; kind: 'opened'; width: number; height: number; preview: ImageBitmap }
  | { id: number; kind: 'previewed'; image: ImageBitmap }
  | { id: number; kind: 'exported'; bytes: Uint8Array }
  | { id: number; kind: 'error'; reason: MosaicFailure };

export class MosaicError extends Error {
  constructor(readonly reason: MosaicFailure) {
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

type Ask = MosaicRequest extends infer R
  ? R extends MosaicRequest
    ? Omit<R, 'id'>
    : never
  : never;

async function ask(request: Ask): Promise<MosaicResponse> {
  const worker = await (workerPromise ??= createWorker(workerUrl));
  const id = nextId++;
  return new Promise((resolve) => {
    const finish = () => {
      worker.removeEventListener('message', listener);
      worker.removeEventListener('error', onError);
    };
    const listener = (event: MessageEvent<MosaicResponse>) => {
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
    worker.postMessage({ ...request, id } as MosaicRequest);
  });
}

/** 사진을 연다. 워커가 원본을 들고 있다가 저장에 쓴다 (새로 열면 바뀐다) */
export async function openImage(file: Blob, previewSide: number): Promise<OpenedImage> {
  const response = await ask({ kind: 'open', file, previewSide });
  if (response.kind === 'opened') return response;
  throw new MosaicError(response.kind === 'error' ? response.reason : 'decode');
}

/**
 * 마지막으로 연 사진의 미리보기(openImage가 준 것과 같은 크기)에 가릴 곳을 걸어 그린다.
 * 계산은 저장과 같고(mosaic-effects.ts) 워커에서 하므로 화면이 멈추지 않는다
 */
export async function previewImage(regions: Region[]): Promise<ImageBitmap> {
  const response = await ask({ kind: 'preview', regions });
  if (response.kind === 'previewed') return response.image;
  throw new MosaicError(response.kind === 'error' ? response.reason : 'decode');
}

/** 마지막으로 연 사진의 가릴 곳을 순서대로 가려 저장한다. 실패하면 MosaicError */
export async function exportImage(
  regions: Region[],
  type: OutputType,
  quality: number,
): Promise<Uint8Array> {
  const response = await ask({ kind: 'export', regions, type, quality });
  if (response.kind === 'exported') return response.bytes;
  throw new MosaicError(response.kind === 'error' ? response.reason : 'encode');
}
