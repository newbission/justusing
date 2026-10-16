/**
 * 글자 인식(OCR). 쪽 그림에서 글자를 읽고, 원래 쪽 위에 겹칠 투명 글자층을 만든다.
 *
 * 엔진과 언어 데이터는 처음 쓸 때 받는다 (크기를 화면에 밝히고 묻는다). 받은 데이터는 바깥 페이지가
 * 이 브라우저에 보관한다 (src/lib/data-store.ts). 인식은 워커 여러 개가 쪽을 나눠 맡는다.
 */
import type { DataFile } from '../../frame/data';
import { createWorker } from '../worker';
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
  | { id: number; type: 'page'; bitmap: ImageBitmap; dpi: number };

export type OcrResponse =
  | { id: number; kind: 'ready' }
  | { id: number; kind: 'page'; text: string; layer: Uint8Array }
  | { id: number; kind: 'error'; message: string };

export interface OcrResult {
  text: string;
  /** 쪽 하나짜리 PDF. 그림 없이 보이지 않는 글자만 들어 있다 */
  layer: Uint8Array;
}

let nextId = 0;

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
      resolve({ id: request.id, kind: 'error', message: 'worker crashed' });
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
   * 쪽들을 워커에 나눠 인식한다. render(i)가 i번째 쪽 그림을 그려 준다.
   * onPage(i, 결과): 쪽 하나가 끝날 때마다 (순서는 섞일 수 있다)
   */
  async run(
    indices: number[],
    render: (index: number) => Promise<{ bitmap: ImageBitmap; dpi: number }>,
    onPage: (index: number, result: OcrResult) => void,
  ): Promise<void> {
    const queue = [...indices];
    await Promise.all(
      this.workers.map(async (worker) => {
        for (let index = queue.shift(); index !== undefined; index = queue.shift()) {
          const { bitmap, dpi } = await render(index);
          const response = await call(worker, { id: nextId++, type: 'page', bitmap, dpi }, [
            bitmap,
          ]);
          if (response.kind === 'error') throw new Error(response.message);
          if (response.kind === 'page') onPage(index, response);
        }
      }),
    );
  }

  dispose() {
    for (const worker of this.workers) worker.terminate();
    this.workers = [];
  }
}
