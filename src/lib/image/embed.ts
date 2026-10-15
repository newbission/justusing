/**
 * 이미지 한 장을 PDF에 넣을 수 있게 준비한다 (이미지 넣기·서명 이미지 올리기).
 * 실제 일은 워커(embed.worker.ts)가 prepare.ts의 toEmbeddable로 한다. 파일은 복사하지 않고 넘긴다.
 */
import workerUrl from './embed.worker.ts?worker&url';
import { createWorker } from '../worker';
import type { EmbeddableImage } from './prepare';

export interface EmbedRequest {
  id: number;
  file: Blob;
}

export type EmbedResponse =
  | { id: number; kind: 'done'; embed: EmbeddableImage }
  | { id: number; kind: 'error'; message: string };

let workerPromise: Promise<Worker> | undefined;
let nextId = 0;

export async function embedImage(file: Blob): Promise<EmbeddableImage> {
  const worker = await (workerPromise ??= createWorker(workerUrl));
  const id = nextId++;
  return new Promise((resolve, reject) => {
    const listener = (event: MessageEvent<EmbedResponse>) => {
      if (event.data.id !== id) return;
      worker.removeEventListener('message', listener);
      if (event.data.kind === 'done') resolve(event.data.embed);
      else reject(new Error(event.data.message));
    };
    worker.addEventListener('message', listener);
    worker.postMessage({ id, file } satisfies EmbedRequest);
  });
}
