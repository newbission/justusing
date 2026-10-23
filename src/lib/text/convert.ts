/**
 * 글자 파일의 인코딩 알아내기·바꾸기 (CSV 한글 깨짐 고치기). 실제 일은 워커(convert.worker.ts)가
 * 파일을 조각씩 읽으며 한다. 수백 MB 파일도 화면이 멈추지 않는다. 파일은 어디로도 보내지 않는다.
 */
import workerUrl from './convert.worker.ts?worker&url';
import { createWorker } from '../worker';
import type { Detection, Newline, SourceEncoding, TargetFormat, Unmappable } from './encoding';

export type ConvertRequest =
  | { id: number; kind: 'detect'; file: Blob }
  | {
      id: number;
      kind: 'convert';
      file: Blob;
      source: SourceEncoding;
      target: TargetFormat;
      newline: Newline;
    };

export interface Converted {
  blob: Blob;
  /** CP949로 저장할 때 없는 글자 */
  unmappable: Unmappable;
  /** 원본 인코딩으로 읽지 못해 �로 바뀐 글자 수 (원본 인코딩을 잘못 골랐을 수 있다) */
  broken: number;
}

export type ConvertResponse =
  | {
      id: number;
      kind: 'detected';
      detection: Detection;
      /** 미리보기용 파일 앞부분 */
      head: Uint8Array;
      /** head가 파일 전체다 */
      complete: boolean;
    }
  | { id: number; kind: 'progress'; done: number; total: number }
  | ({ id: number; kind: 'converted' } & Converted)
  | { id: number; kind: 'error' };

let workerPromise: Promise<Worker> | undefined;
let nextId = 0;

export class ConvertError extends Error {}

async function ask(
  request: Omit<Extract<ConvertRequest, { kind: 'detect' }>, 'id'>,
): Promise<ConvertResponse>;
async function ask(
  request: Omit<Extract<ConvertRequest, { kind: 'convert' }>, 'id'>,
  onProgress: (done: number, total: number) => void,
): Promise<ConvertResponse>;
async function ask(
  request: Omit<ConvertRequest, 'id'>,
  onProgress?: (done: number, total: number) => void,
): Promise<ConvertResponse> {
  const worker = await (workerPromise ??= createWorker(workerUrl));
  const id = nextId++;
  return new Promise((resolve, reject) => {
    const finish = () => {
      worker.removeEventListener('message', listener);
      worker.removeEventListener('error', onError);
    };
    const listener = (event: MessageEvent<ConvertResponse>) => {
      if (event.data.id !== id) return;
      if (event.data.kind === 'progress') {
        onProgress?.(event.data.done, event.data.total);
        return;
      }
      finish();
      resolve(event.data);
    };
    // 워커가 죽으면(메모리 부족 등) 답이 오지 않는다. 이 요청을 실패로 끝내고 다음 요청은 새 워커로 한다
    const onError = () => {
      finish();
      worker.terminate();
      workerPromise = undefined;
      reject(new ConvertError());
    };
    worker.addEventListener('message', listener);
    worker.addEventListener('error', onError);
    worker.postMessage({ ...request, id } as ConvertRequest);
  });
}

/** 인코딩을 알아내고 미리보기용 앞부분을 받는다 */
export async function detectFile(
  file: Blob,
): Promise<{ detection: Detection; head: Uint8Array; complete: boolean }> {
  const response = await ask({ kind: 'detect', file });
  if (response.kind !== 'detected') throw new ConvertError();
  return response;
}

/** 원본 인코딩으로 읽어 고른 형식으로 다시 쓴다 */
export async function convertFile(
  file: Blob,
  options: { source: SourceEncoding; target: TargetFormat; newline: Newline },
  onProgress: (done: number, total: number) => void,
): Promise<Converted> {
  const response = await ask({ kind: 'convert', file, ...options }, onProgress);
  if (response.kind !== 'converted') throw new ConvertError();
  return response;
}
