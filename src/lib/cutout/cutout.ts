/**
 * 배경 지우기의 사진 다루기. 읽기·미리보기 그리기·저장은 워커(cutout.worker.ts)가 하고, 워커가 원본을 들고 있다가
 * 저장할 때 원본 크기로 그린다. 화면에는 줄인 미리보기와 물체 나누기용 작은 사진만 넘긴다. 파일은 어디로도 보내지 않는다.
 */
import { readable } from '../image/heif';
import type { OutputType } from '../image/process';
import { createWorker } from '../worker';
import workerUrl from './cutout.worker.ts?worker&url';
import type { Look, Mask } from './matte';

/** decode: 읽지 못한 사진, tooLarge: 이 브라우저가 그리지 못하는 크기, encode: 그 형식으로 저장하지 못함, empty: 남은 곳이 없음 */
export type CutoutFailure = 'decode' | 'tooLarge' | 'encode' | 'empty';

/** 미리보기·저장에서 물체에 맞춰 자를 자리 (사진에 대한 0~1 비율) */
export interface TrimBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type CutoutRequest =
  | {
      id: number;
      kind: 'open';
      file: Blob | ImageBitmap;
      previewSide: number;
      analysisSide: number;
    }
  | { id: number; kind: 'mask'; mask: Mask }
  | { id: number; kind: 'preview'; look: Look }
  | { id: number; kind: 'export'; look: Look; type: OutputType; quality: number };

export type CutoutResponse =
  | {
      id: number;
      kind: 'opened';
      width: number;
      height: number;
      preview: ImageBitmap;
      analysis: ImageBitmap;
    }
  | { id: number; kind: 'done' }
  | { id: number; kind: 'previewed'; image: ImageBitmap; box?: TrimBox }
  | { id: number; kind: 'exported'; bytes: Uint8Array; width: number; height: number }
  | { id: number; kind: 'error'; reason: CutoutFailure };

export class CutoutError extends Error {
  constructor(readonly reason: CutoutFailure) {
    super(reason);
  }
}

export interface OpenedPhoto {
  /** 바로 세운 원본의 가로·세로 */
  width: number;
  height: number;
  /** 긴 변을 previewSide 이하로 줄인 미리보기 */
  preview: ImageBitmap;
  /** 긴 변을 analysisSide 이하로 줄인 물체 나누기용 사진 */
  analysis: ImageBitmap;
}

type Ask = CutoutRequest extends infer R
  ? R extends CutoutRequest
    ? Omit<R, 'id'>
    : never
  : never;

let nextId = 0;

export class CutoutPhoto {
  private worker: Promise<Worker> | undefined;
  /**
   * 요청은 부른 순서대로 보낸다. 열기는 HEIC 풀기까지 줄 안에서 한다: 크롬에서 HEIC를 푸는 동안 다른 사진을 열면
   * 그 사진이 먼저 워커에 가고, 늦게 풀린 HEIC가 워커의 원본을 덮어 저장이 화면과 다른 사진을 쓴다
   */
  private queue: Promise<unknown> = Promise.resolve();

  private ask(request: Ask): Promise<CutoutResponse> {
    const next = this.queue.then(async (): Promise<CutoutResponse> => {
      if (request.kind !== 'open' || request.file instanceof ImageBitmap) return this.send(request);
      let file: ImageBitmap | Blob;
      try {
        file = await readable(request.file);
      } catch {
        return { id: -1, kind: 'error', reason: 'decode' };
      }
      return this.send({ ...request, file });
    });
    this.queue = next.catch(() => undefined);
    return next;
  }

  private async send(request: Ask): Promise<CutoutResponse> {
    this.worker ??= createWorker(workerUrl);
    const worker = await this.worker;
    const id = nextId++;
    return new Promise((resolve) => {
      const finish = () => {
        worker.removeEventListener('message', listener);
        worker.removeEventListener('error', onError);
      };
      const listener = (event: MessageEvent<CutoutResponse>) => {
        if (event.data.id !== id) return;
        finish();
        resolve(event.data);
      };
      // 워커가 죽으면(대개 큰 사진으로 메모리가 모자람) 답이 오지 않는다. 원본도 잃었으니 다음에는 새로 연다
      const onError = () => {
        finish();
        this.dispose();
        resolve({ id, kind: 'error', reason: 'tooLarge' });
      };
      worker.addEventListener('message', listener);
      worker.addEventListener('error', onError);
      const transfer: Transferable[] =
        request.kind === 'open' && request.file instanceof ImageBitmap
          ? [request.file]
          : request.kind === 'mask'
            ? [request.mask.data.buffer]
            : [];
      worker.postMessage({ ...request, id } as CutoutRequest, transfer);
    });
  }

  /**
   * 사진을 연다. 워커가 원본을 들고 있다가 저장에 쓴다 (새로 열면 바뀐다).
   * 브라우저가 못 읽는 HEIC는 libheif로 풀어 넘긴다
   */
  async open(file: Blob, previewSide: number, analysisSide: number): Promise<OpenedPhoto> {
    const response = await this.ask({ kind: 'open', file, previewSide, analysisSide });
    if (response.kind === 'opened') return response;
    throw new CutoutError(response.kind === 'error' ? response.reason : 'decode');
  }

  /** 물체 마스크를 바꾼다 (물체 나누기용 사진 크기). mask는 워커로 넘어가 비워진다 */
  async setMask(mask: Mask): Promise<void> {
    const response = await this.ask({ kind: 'mask', mask });
    if (response.kind !== 'done') {
      throw new CutoutError(response.kind === 'error' ? response.reason : 'decode');
    }
  }

  /** 미리보기 크기로 결과를 그린다. box: 물체에 맞춰 자르면 남을 자리 (look.trim일 때) */
  async preview(look: Look): Promise<{ image: ImageBitmap; box?: TrimBox }> {
    const response = await this.ask({ kind: 'preview', look });
    if (response.kind === 'previewed') return response;
    throw new CutoutError(response.kind === 'error' ? response.reason : 'decode');
  }

  /** 원본 크기로 결과를 저장한다. 실패하면 CutoutError */
  async export(
    look: Look,
    type: OutputType,
    quality: number,
  ): Promise<{ bytes: Uint8Array; width: number; height: number }> {
    const response = await this.ask({ kind: 'export', look, type, quality });
    if (response.kind === 'exported') return response;
    throw new CutoutError(response.kind === 'error' ? response.reason : 'encode');
  }

  dispose() {
    this.worker?.then((worker) => worker.terminate()).catch(() => {});
    this.worker = undefined;
  }
}
