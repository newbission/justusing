/**
 * PDF 용량을 줄인다 (PDF 압축 도구). 글자·도형은 그대로 두고 PDF 안의 사진만 다시 저장한다.
 *
 * 1. PDF 워커(compress.worker.ts)가 pdf-lib로 파일을 열어 줄일 만한 사진을 꺼낸다.
 * 2. 사진 워커(recompress-image.worker.ts) 여러 개가 기기의 CPU 수에 맞춰 동시에 사진을 줄인다.
 * 3. PDF 워커가 더 작아진 사진만 바꿔 넣고, 쓰지 않는 객체를 지우고, 압축 안 된 내용을 압축해 저장한다.
 *
 * 이 모듈을 import한 도구 frame에서만 로드된다. 파일은 어디로도 보내지 않는다.
 */
import pdfWorkerUrl from './compress.worker.ts?worker&url';
import imageWorkerUrl from './recompress-image.worker.ts?worker&url';
import { createWorker } from '../worker';

export type CompressLevel = 'light' | 'balanced' | 'strong';

/** 단계별 사진 화질(JPG 0~1)과 사진 한 변의 최대 화소 */
export const LEVELS: Record<CompressLevel, { quality: number; maxSide: number }> = {
  light: { quality: 0.85, maxSide: 3000 },
  balanced: { quality: 0.72, maxSide: 2000 },
  strong: { quality: 0.55, maxSide: 1400 },
};

/** PDF 안의 사진 하나. JPG는 파일 그대로, 그 밖에는 화소(압축됐으면 Flate)로 넘긴다 */
export type SourceImage =
  | { kind: 'jpeg'; bytes: Uint8Array }
  | {
      kind: 'pixels';
      bytes: Uint8Array;
      /** Flate로 압축돼 있는지 */
      deflated: boolean;
      width: number;
      height: number;
      /** 1 회색, 3 RGB (한 색 8비트) */
      colors: 1 | 3;
      /** PNG 예측(10 이상)이 걸려 있으면 그 값, 없으면 1 */
      predictor: number;
    };

export interface ImageRequest {
  id: number;
  image: SourceImage;
  quality: number;
  maxSide: number;
}

export type ImageResponse =
  | { id: number; kind: 'done'; bytes: Uint8Array; width: number; height: number }
  /** 줄일 수 없거나 읽을 수 없는 사진. 원본 그대로 둔다 */
  | { id: number; kind: 'skip' };

export interface Replacement {
  index: number;
  bytes: Uint8Array;
  width: number;
  height: number;
}

export type PdfRequest =
  | { id: number; kind: 'scan'; bytes: Uint8Array; password?: string }
  | { id: number; kind: 'finish'; replacements: Replacement[] }
  /** 사진을 줄이다 실패했을 때 열어 둔 문서를 놓는다 (답 없음) */
  | { id: number; kind: 'drop' };

export type PdfResponse =
  | { id: number; kind: 'images'; images: SourceImage[] }
  | { id: number; kind: 'done'; bytes: Uint8Array }
  | { id: number; kind: 'error'; message: string };

let pdfWorker: Promise<Worker> | undefined;
let imageWorkers: Promise<Worker[]> | undefined;
let nextId = 0;

/** 사진 워커 수. 화면 스레드와 PDF 워커 몫으로 하나를 남기고, 메모리를 생각해 4개까지 */
function poolSize(): number {
  const cores = navigator.hardwareConcurrency || 2;
  return Math.max(1, Math.min(4, cores - 1));
}

function ask<T extends { id: number }>(
  worker: Worker,
  message: ImageRequest | PdfRequest,
  transfer: Transferable[] = [],
) {
  return new Promise<T>((resolve) => {
    const listener = (event: MessageEvent<T>) => {
      if (event.data.id !== message.id) return;
      worker.removeEventListener('message', listener);
      resolve(event.data);
    };
    worker.addEventListener('message', listener);
    worker.postMessage(message, transfer);
  });
}

/** 사진들을 워커 여러 개에 나눠 줄인다. 하나 끝날 때마다 onProgress */
async function shrinkImages(
  images: SourceImage[],
  level: CompressLevel,
  onProgress: (done: number, total: number) => void,
): Promise<Replacement[]> {
  const workers = await (imageWorkers ??= Promise.all(
    Array.from({ length: poolSize() }, () => createWorker(imageWorkerUrl)),
  ));
  const { quality, maxSide } = LEVELS[level];
  const replacements: Replacement[] = [];
  let next = 0;
  let done = 0;
  onProgress(0, images.length);

  async function run(worker: Worker) {
    while (next < images.length) {
      const index = next++;
      const image = images[index]!;
      const response = await ask<ImageResponse>(
        worker,
        { id: nextId++, image, quality, maxSide } satisfies ImageRequest,
        [image.bytes.buffer],
      );
      if (response.kind === 'done') {
        replacements.push({
          index,
          bytes: response.bytes,
          width: response.width,
          height: response.height,
        });
      }
      onProgress(++done, images.length);
    }
  }

  await Promise.all(workers.map(run));
  return replacements;
}

/** 원본 바이트는 복사해서 보내므로 그대로 남는다 (다른 단계로 다시 줄일 수 있게). */
export async function compressPdf(
  source: { bytes: Uint8Array; password?: string },
  level: CompressLevel,
  onProgress: (done: number, total: number) => void,
): Promise<Uint8Array> {
  const worker = await (pdfWorker ??= createWorker(pdfWorkerUrl));
  const id = nextId++;

  const scanned = await ask<PdfResponse>(worker, {
    id,
    kind: 'scan',
    bytes: source.bytes,
    password: source.password,
  } satisfies PdfRequest);
  if (scanned.kind === 'error') throw new Error(scanned.message);
  if (scanned.kind !== 'images') throw new Error('unexpected response');

  let replacements: Replacement[];
  try {
    replacements = await shrinkImages(scanned.images, level, onProgress);
  } catch (error) {
    worker.postMessage({ id, kind: 'drop' } satisfies PdfRequest);
    throw error;
  }
  const finished = await ask<PdfResponse>(
    worker,
    { id, kind: 'finish', replacements } satisfies PdfRequest,
    replacements.map((r) => r.bytes.buffer),
  );
  if (finished.kind === 'error') throw new Error(finished.message);
  if (finished.kind !== 'done') throw new Error('unexpected response');
  return finished.bytes;
}
