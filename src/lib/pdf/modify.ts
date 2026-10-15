/**
 * PDF 하나를 고쳐서 새 PDF를 만든다: 암호 풀기·걸기, 쪽 번호, 이미지 찍기(이미지 넣기·서명), 자르기.
 * 실제 처리는 워커(modify.worker.ts)에서 pdf-lib로 한다. 이 모듈을 import한 도구 frame에서만 로드된다.
 *
 * 쪽 위의 자리는 화면에 보이는 쪽 기준 비율(0~1, 왼쪽 위가 0,0)로 넘긴다. 쪽의 회전과
 * 보이는 영역(CropBox)은 워커가 PDF 좌표로 바꿀 때 계산한다 (화면과 결과가 같은 자리가 된다).
 */
import workerUrl from './modify.worker.ts?worker&url';
import { createWorker } from '../worker';

/** 화면에 보이는 쪽 기준 사각형. 모두 0~1 비율, 왼쪽 위가 (0, 0) */
export interface PageRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type NumberPosition = 'bottom-center' | 'bottom-right' | 'top-right';
export type NumberFormat = 'plain' | 'of-total' | 'dashes';

export type ModifyJob =
  /** 암호를 풀고(인쇄·복사 제한도 함께) 암호 없는 PDF로 */
  | { kind: 'unlock' }
  /** 열 때 암호를 묻는 PDF로 (AES-256) */
  | { kind: 'protect'; password: string }
  /** 모든 쪽에 쪽 번호. start는 첫 쪽에 붙일 번호 */
  | { kind: 'page-numbers'; position: NumberPosition; format: NumberFormat; start: number }
  /** 고른 쪽들의 같은 자리에 이미지를 찍는다 (pages는 0부터) */
  | {
      kind: 'stamp-image';
      image: { kind: 'jpg' | 'png'; bytes: Uint8Array };
      rect: PageRect;
      pages: number[];
    }
  /** 고른 쪽들의 보이는 영역을 rect로 줄인다 (pages는 0부터) */
  | { kind: 'crop'; rect: PageRect; pages: number[] };

export interface ModifyRequest {
  id: number;
  bytes: Uint8Array;
  password?: string;
  job: ModifyJob;
}

export type ModifyResponse =
  { id: number; kind: 'done'; bytes: Uint8Array } | { id: number; kind: 'error'; message: string };

let workerPromise: Promise<Worker> | undefined;
let nextId = 0;

/** 원본 바이트는 복사해서 보내므로 그대로 남는다 (같은 파일로 다시 만들 수 있게). */
export async function modifyPdf(
  source: { bytes: Uint8Array; password?: string },
  job: ModifyJob,
): Promise<Uint8Array> {
  const worker = await (workerPromise ??= createWorker(workerUrl));
  const id = nextId++;
  return new Promise((resolve, reject) => {
    const listener = (event: MessageEvent<ModifyResponse>) => {
      if (event.data.id !== id) return;
      worker.removeEventListener('message', listener);
      if (event.data.kind === 'done') resolve(event.data.bytes);
      else reject(new Error(event.data.message));
    };
    worker.addEventListener('message', listener);
    worker.postMessage({
      id,
      bytes: source.bytes,
      password: source.password,
      job,
    } satisfies ModifyRequest);
  });
}
