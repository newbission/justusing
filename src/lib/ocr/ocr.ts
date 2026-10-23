/**
 * 글자 인식(OCR). 쪽 그림에서 글자를 읽고, 원래 쪽 위에 겹칠 투명 글자층을 만든다.
 *
 * 엔진과 언어 데이터는 처음 쓸 때 받는다 (크기를 화면에 밝히고 묻는다). 받은 데이터는 바깥 페이지가
 * 이 브라우저에 보관한다 (src/lib/data-store.ts). 인식은 워커 여러 개가 쪽을 나눠 맡는다.
 */
import type { DataFile } from '../../frame/data';
import { createWorker } from '../worker';
import type { ImageLine } from './image-read';
import catalog from './catalog.json';
import workerUrl from './ocr.worker.ts?worker&url';

export type OcrLang = 'kor' | 'eng';
export const OCR_LANGS: OcrLang[] = ['kor', 'eng'];

/** 보관소에서 받기 동의를 기억하는 이름 */
export const OCR_CONSENT = 'ocr';

/** 내용이 바뀌면 주소도 바뀌게 해 예전 보관본을 쓰지 않는다 */
const versioned = (file: DataFile): DataFile => ({
  ...file,
  path: `${file.path}?v=${file.sha256.slice(0, 12)}`,
});
export const OCR_ENGINE = versioned(catalog.engine);
export const OCR_LANG_FILES: Record<OcrLang, DataFile> = {
  kor: versioned(catalog.kor),
  eng: versioned(catalog.eng),
};

/** 고른 언어로 인식할 때 받아야 하는 파일들 */
export const ocrFiles = (langs: OcrLang[]): DataFile[] => [
  OCR_ENGINE,
  ...langs.map((lang) => OCR_LANG_FILES[lang]),
];

export type OcrRequest =
  | {
      id: number;
      type: 'init';
      engine: Uint8Array;
      langs: { code: OcrLang; data: Uint8Array }[];
    }
  | { id: number; type: 'page'; bitmap: ImageBitmap; dpi: number }
  | { id: number; type: 'image'; image: Blob };

export type OcrResponse =
  | { id: number; kind: 'ready' }
  | { id: number; kind: 'page'; text: string; layer: Uint8Array }
  | ({ id: number; kind: 'image' } & ImageResult)
  | { id: number; kind: 'error'; message: string };

export interface OcrResult {
  text: string;
  /** 쪽 하나짜리 PDF. 그림 없이 보이지 않는 글자만 들어 있다 */
  layer: Uint8Array;
}

/** 사진·화면 캡처 한 장을 읽은 결과 */
export interface ImageResult {
  text: string;
  /** 읽은 줄과 그 자리 (바로 세운 그림 기준 화소) */
  lines: ImageLine[];
  /** 바로 세운 그림의 가로·세로 */
  width: number;
  height: number;
}

let nextId = 0;
/** 메모리가 모자라 워커가 죽었을 때의 오류 */
const CRASHED = 'worker crashed';

function call(worker: Worker, request: OcrRequest, transfer: Transferable[] = []) {
  return new Promise<OcrResponse>((resolve) => {
    const onMessage = (event: MessageEvent<OcrResponse>) => {
      if (event.data.id !== request.id) return;
      done();
      resolve(event.data);
    };
    // 메모리가 모자라 워커가 죽으면 메시지가 오지 않는다. 기다리지 않고 실패로 끝낸다
    const onError = () => {
      done();
      resolve({ id: request.id, kind: 'error', message: CRASHED });
    };
    const done = () => {
      worker.removeEventListener('message', onMessage);
      worker.removeEventListener('error', onError);
    };
    worker.addEventListener('message', onMessage);
    worker.addEventListener('error', onError);
    worker.postMessage(request, transfer);
  });
}

/** 워커 수. 인식 엔진 하나가 메모리를 많이 써서(언어 데이터 포함 100MB 안팎) 3개까지만 */
function poolSize(pages: number): number {
  const cores = navigator.hardwareConcurrency || 2;
  const memory = (navigator as { deviceMemory?: number }).deviceMemory;
  const limit = memory !== undefined && memory <= 4 ? 1 : 3;
  return Math.max(1, Math.min(cores - 1, limit, pages));
}

export class OcrPool {
  private constructor(private workers: Worker[]) {}

  /** 엔진을 띄운다. data: loadData로 받아 확인한 바이트 (경로 → 바이트) */
  static async create(
    data: Map<string, Uint8Array>,
    langs: OcrLang[],
    pages: number,
  ): Promise<OcrPool> {
    const engine = data.get(OCR_ENGINE.path)!;
    const langData = langs.map((code) => ({ code, data: data.get(OCR_LANG_FILES[code].path)! }));
    const workers = await Promise.all(
      Array.from({ length: poolSize(pages) }, () => createWorker(workerUrl)),
    );
    const pool = new OcrPool(workers);
    try {
      const ready = await Promise.all(
        workers.map((worker) =>
          // 워커마다 복사본을 준다 (넘겨주면 다음 워커가 쓸 수 없다)
          call(worker, { id: nextId++, type: 'init', engine, langs: langData }),
        ),
      );
      const failed = ready.find((response) => response.kind === 'error');
      if (failed?.kind === 'error') throw new Error(failed.message);
    } catch (error) {
      pool.dispose();
      throw error;
    }
    return pool;
  }

  get size() {
    return this.workers.length;
  }

  /**
   * 일감을 워커에 나눠 맡긴다. 쉬는 워커가 다음 일감을 가져간다.
   * job이 false를 돌려주면 그 워커는 더 쓰지 않는다 (죽은 워커). 남은 일감을 돌려준다
   */
  private async each<T>(
    items: T[],
    job: (worker: Worker, item: T) => Promise<boolean | void>,
  ): Promise<T[]> {
    const queue = [...items];
    await Promise.all(
      this.workers.map(async (worker) => {
        for (let item = queue.shift(); item !== undefined; item = queue.shift()) {
          if ((await job(worker, item)) === false) return;
        }
      }),
    );
    return queue;
  }

  /**
   * 쪽들을 워커에 나눠 인식한다. render(i)가 i번째 쪽 그림을 그려 준다.
   * onPage(i, 결과): 쪽 하나가 끝날 때마다 (순서는 섞일 수 있다)
   */
  async run(
    indices: number[],
    render: (index: number) => Promise<{ bitmap: ImageBitmap; dpi: number }>,
    onPage: (index: number, result: OcrResult) => void,
  ): Promise<void> {
    await this.each(indices, async (worker, index) => {
      const { bitmap, dpi } = await render(index);
      const response = await call(worker, { id: nextId++, type: 'page', bitmap, dpi }, [bitmap]);
      if (response.kind === 'error') throw new Error(response.message);
      if (response.kind === 'page') onPage(index, response);
    });
  }

  /**
   * 사진·화면 캡처들을 워커에 나눠 읽는다. 한 장이 실패해도 나머지는 계속 읽는다.
   * onImage(i, 결과 또는 실패): 한 장이 끝날 때마다 (순서는 섞일 수 있다)
   */
  async images(
    images: Blob[],
    onImage: (index: number, result: ImageResult | Error) => void,
  ): Promise<void> {
    const left = await this.each([...images.keys()], async (worker, index) => {
      const response = await call(worker, { id: nextId++, type: 'image', image: images[index]! });
      if (response.kind === 'image') {
        const { text, lines, width, height } = response;
        onImage(index, { text, lines, width, height });
        return true;
      }
      const message = response.kind === 'error' ? response.message : 'unexpected';
      onImage(index, new Error(message));
      return message !== CRASHED;
    });
    // 워커가 모두 죽어 남은 그림은 실패로 알린다
    for (const index of left) onImage(index, new Error(CRASHED));
  }

  dispose() {
    for (const worker of this.workers) worker.terminate();
    this.workers = [];
  }
}
