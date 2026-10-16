/**
 * PDF 안의 사진을 꺼낸다 (사진 꺼내기 도구). 일은 워커(extract-images.worker.ts)가 한다.
 * 이 모듈을 import한 도구 frame에서만 로드된다. 파일은 어디로도 보내지 않는다.
 */
import workerUrl from './extract-images.worker.ts?worker&url';
import { createWorker } from '../worker';

export interface ExtractedImage {
  /** 처음 나온 쪽 (0부터) */
  page: number;
  /** 꺼낸 순서 (0부터) */
  index: number;
  ext: 'jpg' | 'png' | 'jp2';
  bytes: Uint8Array;
  width: number;
  height: number;
}

export interface ExtractRequest {
  id: number;
  bytes: Uint8Array;
  password?: string;
  /** 가로·세로 중 짧은 쪽이 이보다 작은 그림은 뺀다 (화소) */
  minSide: number;
}

export type ExtractResponse =
  | { id: number; kind: 'image'; image: ExtractedImage }
  | { id: number; kind: 'progress'; done: number; total: number }
  /** failed: 형식을 다룰 수 없어 꺼내지 못한 그림 수 */
  | { id: number; kind: 'done'; failed: number }
  | { id: number; kind: 'error'; message: string };

let workerPromise: Promise<Worker> | undefined;
let nextId = 0;

/**
 * 사진을 꺼낸다. 하나 꺼낼 때마다 onImage, 진행은 onProgress로 알린다.
 * 끝나면 꺼내지 못한 그림 수를 돌려준다. 원본 바이트는 복사해서 보내므로 그대로 남는다
 */
export async function extractImages(
  source: { bytes: Uint8Array; password?: string },
  minSide: number,
  onImage: (image: ExtractedImage) => void,
  onProgress: (done: number, total: number) => void,
): Promise<number> {
  const worker = await (workerPromise ??= createWorker(workerUrl));
  const id = nextId++;
  return new Promise((resolve, reject) => {
    const listener = (event: MessageEvent<ExtractResponse>) => {
      const response = event.data;
      if (response.id !== id) return;
      if (response.kind === 'image') onImage(response.image);
      else if (response.kind === 'progress') onProgress(response.done, response.total);
      else {
        worker.removeEventListener('message', listener);
        if (response.kind === 'done') resolve(response.failed);
        else reject(new Error(response.message));
      }
    };
    worker.addEventListener('message', listener);
    worker.postMessage({
      id,
      bytes: source.bytes.slice(),
      password: source.password,
      minSide,
    } satisfies ExtractRequest);
  });
}
