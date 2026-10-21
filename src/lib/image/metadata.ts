/**
 * 사진의 촬영 정보를 읽고 지운다 (위치정보 지우기). 실제 일은 워커(metadata.worker.ts)가
 * photo-metadata.ts로 한다. 파일은 복사하지 않고 넘기고, 어디로도 보내지 않는다.
 */
import workerUrl from './metadata.worker.ts?worker&url';
import { createWorker } from '../worker';
import type { CleanMode, PhotoInfo } from './photo-metadata';

export type { CleanMode, PhotoInfo };

export type MetadataRequest =
  | { id: number; kind: 'read'; file: Blob }
  | { id: number; kind: 'clean'; file: Blob; mode: CleanMode };

export type MetadataResponse =
  | { id: number; kind: 'read'; info: PhotoInfo }
  /** bytes가 없으면 지울 것이 없었다. info는 지운 결과를 다시 읽은 것 */
  | { id: number; kind: 'clean'; bytes?: Uint8Array; info: PhotoInfo }
  /** 구조를 읽지 못한 파일 */
  | { id: number; kind: 'error' };

let workerPromise: Promise<Worker> | undefined;
let nextId = 0;

/** 요청 종류마다 id를 뺀 것 (Omit은 종류를 나눠 보지 않아 직접 나눈다) */
type Ask = MetadataRequest extends infer R
  ? R extends MetadataRequest
    ? Omit<R, 'id'>
    : never
  : never;

/** 앞 요청이 끝나야 다음 요청을 보낸다. 큰 사진 여러 장의 전체 복사본이 한꺼번에 메모리에 오르지 않게 */
let queue: Promise<unknown> = Promise.resolve();

function ask(request: Ask): Promise<MetadataResponse> {
  const next = queue.then(() => send(request));
  queue = next.catch(() => undefined);
  return next;
}

async function send(request: Ask): Promise<MetadataResponse> {
  const worker = await (workerPromise ??= createWorker(workerUrl));
  const id = nextId++;
  return new Promise((resolve, reject) => {
    const finish = () => {
      worker.removeEventListener('message', listener);
      worker.removeEventListener('error', onError);
    };
    const listener = (event: MessageEvent<MetadataResponse>) => {
      if (event.data.id !== id) return;
      finish();
      resolve(event.data);
    };
    // 워커가 죽으면(메모리 부족 등) 답이 오지 않는다. 이 요청을 실패로 끝내고 다음 요청은 새 워커로 한다
    const onError = () => {
      finish();
      worker.terminate();
      workerPromise = undefined;
      reject(new MetadataError());
    };
    worker.addEventListener('message', listener);
    worker.addEventListener('error', onError);
    worker.postMessage({ ...request, id } as MetadataRequest);
  });
}

export class MetadataError extends Error {}

/** 사진에 든 촬영 정보. 읽지 못하는 파일이면 MetadataError */
export async function readMetadata(file: Blob): Promise<PhotoInfo> {
  const response = await ask({ kind: 'read', file });
  if (response.kind !== 'read') throw new MetadataError();
  return response.info;
}

/** 정보를 지운 파일과 그 결과의 정보. 지울 것이 없으면 bytes가 없다 */
export async function removeMetadata(
  file: Blob,
  mode: CleanMode,
): Promise<{ bytes?: Uint8Array; info: PhotoInfo }> {
  const response = await ask({ kind: 'clean', file, mode });
  if (response.kind !== 'clean') throw new MetadataError();
  return response;
}
