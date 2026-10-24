/**
 * 이미지 한 장을 PDF에 넣을 수 있게 준비한다 (이미지 넣기·서명 이미지 올리기).
 * 실제 일은 워커(embed.worker.ts)가 prepare.ts의 toEmbeddable로 한다. 파일은 복사하지 않고 넘긴다.
 * 브라우저가 못 읽는 HEIC(아이폰 사진)는 먼저 libheif로 바로 세운 JPG로 바꾼다 (heif.ts, 그때만 엔진을 받는다).
 */
import workerUrl from './embed.worker.ts?worker&url';
import { createWorker } from '../worker';
import { heifToJpeg, needsHeifDecoder } from './heif';
import type { EmbeddableImage } from './prepare';

/** 브라우저가 못 읽는 HEIC를 JPG로 바꿀 때의 화질 (prepare.ts가 사진을 다시 만들 때와 같다) */
const HEIF_JPEG_QUALITY = 0.92;

export interface EmbedRequest {
  id: number;
  file: Blob;
}

export type EmbedResponse =
  | { id: number; kind: 'done'; embed: EmbeddableImage }
  | { id: number; kind: 'error'; message: string };

let workerPromise: Promise<Worker> | undefined;
let nextId = 0;

/**
 * PDF에 넣을 바이트와 화면에 그릴 그림(preview: 원본, 또는 HEIC를 바꾼 JPG).
 * 읽지 못하는 이미지면 예외
 */
export async function embedImage(file: Blob): Promise<{ embed: EmbeddableImage; preview: Blob }> {
  const preview = (await needsHeifDecoder(file))
    ? (await heifToJpeg(file, { quality: HEIF_JPEG_QUALITY })).jpeg
    : file;
  const worker = await (workerPromise ??= createWorker(workerUrl));
  const id = nextId++;
  return new Promise((resolve, reject) => {
    const listener = (event: MessageEvent<EmbedResponse>) => {
      if (event.data.id !== id) return;
      worker.removeEventListener('message', listener);
      if (event.data.kind === 'done') resolve({ embed: event.data.embed, preview });
      else reject(new Error(event.data.message));
    };
    worker.addEventListener('message', listener);
    worker.postMessage({ id, file: preview } satisfies EmbedRequest);
  });
}
