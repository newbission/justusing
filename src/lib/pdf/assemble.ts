/**
 * PDF 조립: 원본 PDF들에서 고른 페이지를 정한 순서·회전으로 모아 새 PDF를 만든다.
 * 실제 처리는 워커(assemble.worker.ts)에서 pdf-lib로 한다. 이 모듈을 import한 도구 frame에서만 로드된다.
 *
 * 합치기: 모든 파일의 모든 페이지 / 나누기: 범위마다 한 번씩 / 회전: rotate 지정 / 정리: 순서·생략
 */
import workerUrl from './assemble.worker.ts?worker&url';
import { createWorker } from '../worker';

export interface AssembleSource {
  bytes: Uint8Array;
  /** 암호 PDF면 그 암호. 결과 파일에는 암호가 걸리지 않는다. */
  password?: string;
}

export interface AssemblePage {
  /** sources 안의 순번 */
  source: number;
  /** 원본 안의 페이지 순번 (0부터). 한 결과에 같은 페이지는 한 번만 넣는다. */
  index: number;
  /** 원래 방향에 더할 시계 방향 회전 (90의 배수) */
  rotate?: number;
}

export interface AssembleJob {
  sources: AssembleSource[];
  /** 결과에 넣을 페이지, 결과 순서대로 */
  pages: AssemblePage[];
}

export interface AssembleRequest {
  id: number;
  job: AssembleJob;
}

export type AssembleResponse =
  { id: number; ok: true; bytes: Uint8Array } | { id: number; ok: false; message: string };

let workerPromise: Promise<Worker> | undefined;
let nextId = 0;

/** 새 PDF를 만들어 바이트로 돌려준다. 원본 바이트는 복사해서 보내므로 그대로 남는다. */
export async function assemblePdf(job: AssembleJob): Promise<Uint8Array> {
  const worker = await (workerPromise ??= createWorker(workerUrl));
  const id = nextId++;

  return new Promise((resolve, reject) => {
    const listener = (event: MessageEvent<AssembleResponse>) => {
      if (event.data.id !== id) return;
      worker.removeEventListener('message', listener);
      if (event.data.ok) resolve(event.data.bytes);
      else reject(new Error(event.data.message));
    };
    worker.addEventListener('message', listener);
    worker.postMessage({ id, job } satisfies AssembleRequest);
  });
}
