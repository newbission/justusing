/**
 * 이미지들로 PDF 하나를 만든다 (이미지를 PDF로 도구). 이미지 한 장이 한 쪽이 된다.
 * 실제 처리는 워커(images-to-pdf.worker.ts)에서 pdf-lib로 한다. 이 모듈을 import한 도구 frame에서만 로드된다.
 */
import workerUrl from './images-to-pdf.worker.ts?worker&url';
import { createWorker } from '../worker';

/** 쪽 크기. fit은 이미지 크기 그대로 (96 DPI로 보고 pt로 바꾼다) */
export type PageSize = 'a4' | 'letter' | 'fit';

export interface ImagesToPdfJob {
  /**
   * 넣을 이미지 파일, 쪽 순서대로. 워커가 직접 읽고 필요하면 바로 세운다.
   * File은 내용을 복사하지 않고 넘어가서 사진이 많아도 메모리가 두 배로 들지 않는다.
   */
  images: Blob[];
  size: PageSize;
  /** 쪽 가장자리 여백 (pt) */
  margin: number;
}

export interface ImagesToPdfRequest {
  id: number;
  job: ImagesToPdfJob;
}

export type ImagesToPdfResponse =
  | { id: number; kind: 'progress'; done: number; total: number }
  | { id: number; kind: 'done'; bytes: Uint8Array }
  | { id: number; kind: 'error'; message: string };

let workerPromise: Promise<Worker> | undefined;
let nextId = 0;

/** onProgress는 이미지 한 장을 넣을 때마다 불린다. */
export async function imagesToPdf(
  job: ImagesToPdfJob,
  onProgress?: (done: number, total: number) => void,
): Promise<Uint8Array> {
  const worker = await (workerPromise ??= createWorker(workerUrl));
  const id = nextId++;

  return new Promise((resolve, reject) => {
    const listener = (event: MessageEvent<ImagesToPdfResponse>) => {
      const data = event.data;
      if (data.id !== id) return;
      if (data.kind === 'progress') {
        onProgress?.(data.done, data.total);
        return;
      }
      worker.removeEventListener('message', listener);
      if (data.kind === 'done') resolve(data.bytes);
      else reject(new Error(data.message));
    };
    worker.addEventListener('message', listener);
    worker.postMessage({ id, job } satisfies ImagesToPdfRequest);
  });
}
