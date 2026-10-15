/**
 * 여러 파일을 ZIP 하나로 묶는다 (나누기·PDF를 이미지로 결과 받기). 메모리 안에서만 만든다.
 * 묶는 일은 워커(zip.worker.ts)에서 한다. 이 모듈을 import한 도구 frame에서만 로드된다.
 */
import workerUrl from './zip.worker.ts?worker&url';
import { createWorker } from './worker';

export interface ZipRequest {
  id: number;
  /** ZIP 안의 이름 → 내용 */
  entries: Record<string, Uint8Array>;
}

export type ZipResponse =
  { id: number; kind: 'done'; bytes: Uint8Array } | { id: number; kind: 'error'; message: string };

let workerPromise: Promise<Worker> | undefined;
let nextId = 0;

/**
 * 파일들을 ZIP 하나로 묶는다. 받은 파일 바이트는 복사하지 않고 워커로 넘기므로
 * 부른 뒤에는 쓸 수 없다 (메모리를 두 배로 쓰지 않으려고).
 */
export async function makeZip(files: { name: string; bytes: Uint8Array }[]): Promise<Uint8Array> {
  const entries: Record<string, Uint8Array> = {};
  for (const { name, bytes } of files) {
    // 같은 이름이 있으면 뒤에 번호를 붙인다 (ZIP 안에서 덮어써지지 않게)
    let unique = name;
    for (let n = 2; unique in entries; n++) unique = name.replace(/(\.[^.]+)?$/, ` (${n})$1`);
    entries[unique] = bytes;
  }

  const worker = await (workerPromise ??= createWorker(workerUrl));
  const id = nextId++;
  return new Promise((resolve, reject) => {
    const listener = (event: MessageEvent<ZipResponse>) => {
      if (event.data.id !== id) return;
      worker.removeEventListener('message', listener);
      if (event.data.kind === 'done') resolve(event.data.bytes);
      else reject(new Error(event.data.message));
    };
    worker.addEventListener('message', listener);
    // 같은 버퍼를 두 번 넘기면 오류가 나므로 겹치지 않게 모은다
    const buffers = new Set(Object.values(entries).map((bytes) => bytes.buffer));
    worker.postMessage({ id, entries } satisfies ZipRequest, [...buffers]);
  });
}
