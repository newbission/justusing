/**
 * 장면 한 장을 JPG·PNG로 (장면 캡처). 저장은 워커(still.worker.ts)가 한다.
 */
import workerUrl from './still.worker.ts?worker&url';
import { createWorker } from '../worker';

export type StillType = 'image/jpeg' | 'image/png';

export interface StillRequest {
  id: number;
  bitmap: ImageBitmap;
  type: StillType;
  quality: number;
}

export type StillResponse =
  { id: number; kind: 'done'; bytes: Uint8Array } | { id: number; kind: 'error' };

let workerPromise: Promise<Worker> | undefined;
let nextId = 0;

/** 장면을 저장한다. bitmap은 워커로 넘겨 닫히므로 부른 뒤에는 쓸 수 없다. 실패하면 예외 */
export async function saveStill(
  bitmap: ImageBitmap,
  type: StillType,
  quality = 0.92,
): Promise<Uint8Array> {
  const worker = await (workerPromise ??= createWorker(workerUrl));
  const id = nextId++;
  return new Promise((resolve, reject) => {
    const finish = () => {
      worker.removeEventListener('message', listener);
      worker.removeEventListener('error', onError);
    };
    const listener = (event: MessageEvent<StillResponse>) => {
      if (event.data.id !== id) return;
      finish();
      if (event.data.kind === 'done') resolve(event.data.bytes);
      else reject(new Error('장면을 저장하지 못했습니다'));
    };
    const onError = () => {
      finish();
      worker.terminate();
      workerPromise = undefined;
      reject(new Error('장면 저장 워커가 멈췄습니다'));
    };
    worker.addEventListener('message', listener);
    worker.addEventListener('error', onError);
    worker.postMessage({ id, bitmap, type, quality } satisfies StillRequest, [bitmap]);
  });
}
