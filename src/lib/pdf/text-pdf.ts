/**
 * 고른 글꼴로 PDF 쪽 위에 글자를 넣는다 (글자 워터마크, 머리말·꼬리말, PDF 편집).
 * 글자를 PDF에 넣으려면 글꼴이 필요해 글꼴 엔진(fontkit)을 쓰는 따로 된 워커(text-pdf.worker.ts)가 한다.
 * 쓰는 글자만 골라 넣으므로(subset) 결과 PDF는 글꼴 전체만큼 커지지 않는다.
 * 이 모듈을 import한 도구 frame에서만 로드된다.
 */
import workerUrl from './text-pdf.worker.ts?worker&url';
import { createWorker } from '../worker';
import type { WatermarkOptions } from './watermark';
import type { HeaderFooterOptions } from './header-footer';
import type { EditOptions } from './edit';

export type TextJob =
  | ({ kind: 'watermark' } & WatermarkOptions)
  | ({ kind: 'header-footer' } & HeaderFooterOptions)
  | ({ kind: 'edit' } & EditOptions);

export interface TextRequest {
  id: number;
  bytes: Uint8Array;
  password?: string;
  job: TextJob;
}

export type TextResponse =
  | { id: number; kind: 'done'; bytes: Uint8Array }
  /** 글꼴에 없는 글자가 있다 */
  | { id: number; kind: 'missing'; chars: string[] }
  | { id: number; kind: 'error'; message: string };

export class MissingGlyphsError extends Error {
  constructor(readonly chars: string[]) {
    super('missing glyphs');
  }
}

let workerPromise: Promise<Worker> | undefined;
let nextId = 0;

/** 원본 바이트와 글꼴은 복사해서 보내므로 그대로 남는다 (설정을 바꿔 다시 만들 수 있게) */
export async function runTextJob(
  source: { bytes: Uint8Array; password?: string },
  job: TextJob,
): Promise<Uint8Array> {
  const worker = await (workerPromise ??= createWorker(workerUrl));
  const id = nextId++;
  return new Promise((resolve, reject) => {
    const listener = (event: MessageEvent<TextResponse>) => {
      if (event.data.id !== id) return;
      worker.removeEventListener('message', listener);
      if (event.data.kind === 'done') resolve(event.data.bytes);
      else if (event.data.kind === 'missing') reject(new MissingGlyphsError(event.data.chars));
      else reject(new Error(event.data.message));
    };
    worker.addEventListener('message', listener);
    worker.postMessage({
      id,
      bytes: source.bytes,
      password: source.password,
      job,
    } satisfies TextRequest);
  });
}
