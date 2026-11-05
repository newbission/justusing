/**
 * 고른 글꼴로 PDF 쪽 위에 글자를 넣는다 (글자 워터마크, 머리말·꼬리말, PDF 편집, 양식 채우기).
 * 글자를 PDF에 넣으려면 글꼴이 필요해 글꼴 엔진(fontkit)을 쓰는 따로 된 워커(text-pdf.worker.ts)가 한다.
 * 쓰는 글자만 골라 넣으므로(subset) 결과 PDF는 글꼴 전체만큼 커지지 않는다.
 * 이 모듈을 import한 도구 frame에서만 로드된다.
 */
import workerUrl from './text-pdf.worker.ts?worker&url';
import { createWorkerClient } from '../worker-client';
import type { WatermarkOptions } from './watermark';
import type { HeaderFooterOptions } from './header-footer';
import type { EditOptions } from './edit';
import type { FillFormOptions } from './fill-form';

export type TextJob =
  | ({ kind: 'watermark' } & WatermarkOptions)
  | ({ kind: 'header-footer' } & HeaderFooterOptions)
  | ({ kind: 'edit' } & EditOptions)
  | ({ kind: 'fill-form' } & FillFormOptions);

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

const ask = createWorkerClient<TextRequest, TextResponse>(workerUrl);

/** 원본 바이트와 글꼴은 복사해서 보내므로 그대로 남는다 (설정을 바꿔 다시 만들 수 있게) */
export async function runTextJob(
  source: { bytes: Uint8Array; password?: string },
  job: TextJob,
): Promise<Uint8Array> {
  const response = await ask({ bytes: source.bytes, password: source.password, job });
  if (response.kind === 'done') return response.bytes;
  if (response.kind === 'missing') throw new MissingGlyphsError(response.chars);
  throw new Error(response.message);
}
