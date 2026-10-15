/**
 * 이미지 한 장을 읽어 크기를 바꾸고 원하는 형식으로 다시 저장한다 (이미지 압축·크기 조절 도구).
 *
 * 여러 장을 넣으면 워커 여러 개(process.worker.ts)가 기기의 CPU 수에 맞춰 나눠 처리한다.
 * 이 모듈을 import한 도구 frame에서만 로드된다. 파일은 어디로도 보내지 않는다.
 */
import workerUrl from './process.worker.ts?worker&url';
import { createWorker } from '../worker';

export type OutputType = 'image/jpeg' | 'image/png' | 'image/webp';

export interface ProcessOptions {
  type: OutputType;
  /** JPG·WebP 화질 (0~1) */
  quality: number;
  /** PNG 색 수. 0이면 색을 줄이지 않는다 (무손실) */
  pngColors: number;
  /** 결과 가로·세로 화소. 없으면 원본 크기 그대로 */
  size?: { width: number; height: number };
}

export interface ProcessRequest {
  id: number;
  file: Blob;
  options: ProcessOptions;
}

export type ProcessResponse =
  | { id: number; kind: 'done'; bytes: Uint8Array; width: number; height: number }
  /** decode: 브라우저가 읽지 못하는 이미지, encode: 이 브라우저가 그 형식으로 저장하지 못함 */
  | { id: number; kind: 'error'; reason: 'decode' | 'encode' };

export class ImageProcessError extends Error {
  constructor(readonly reason: 'decode' | 'encode') {
    super(reason);
  }
}

interface Task {
  request: ProcessRequest;
  resolve: (response: ProcessResponse) => void;
  reject: (reason: unknown) => void;
  signal?: AbortSignal;
}

/** 워커 수. 화면 스레드 몫으로 하나를 남기고, 큰 사진의 메모리를 생각해 4개까지 */
function poolSize(): number {
  const cores = navigator.hardwareConcurrency || 2;
  return Math.max(1, Math.min(4, cores - 1));
}

const queue: Task[] = [];
/** 일하고 있는 워커 수 */
let busy = 0;
/** 쉬고 있는 워커. 그만둔 일을 하던 워커는 끝내고 버린다 */
const idle: Worker[] = [];
let nextId = 0;

async function take(): Promise<Worker> {
  return idle.pop() ?? createWorker(workerUrl);
}

function pump() {
  while (busy < poolSize() && queue.length > 0) {
    const task = queue.shift()!;
    if (task.signal?.aborted) {
      task.reject(task.signal.reason);
      continue;
    }
    busy++;
    run(task).finally(() => {
      busy--;
      pump();
    });
  }
}

async function run(task: Task) {
  let worker: Worker;
  try {
    worker = await take();
  } catch (error) {
    task.reject(error);
    return;
  }
  await new Promise<void>((done) => {
    const finish = () => {
      worker.removeEventListener('message', listener);
      task.signal?.removeEventListener('abort', onAbort);
      done();
    };
    const listener = (event: MessageEvent<ProcessResponse>) => {
      if (event.data.id !== task.request.id) return;
      finish();
      idle.push(worker);
      task.resolve(event.data);
    };
    // 그만두면 하던 사진도 바로 멈추게 워커를 끝낸다. 다음 일은 새 워커로 한다
    const onAbort = () => {
      finish();
      worker.terminate();
      task.reject(task.signal!.reason);
    };
    worker.addEventListener('message', listener);
    task.signal?.addEventListener('abort', onAbort, { once: true });
    if (task.signal?.aborted) onAbort();
    else worker.postMessage(task.request);
  });
}

/**
 * 이미지 한 장을 처리한다. 여러 장을 한꺼번에 불러도 워커 수만큼만 동시에 돈다.
 * signal로 그만두면 기다리던 일은 시작하지 않고, 하던 일은 워커째 멈춘다 (AbortError).
 */
export function processImage(
  file: Blob,
  options: ProcessOptions,
  signal?: AbortSignal,
): Promise<{ bytes: Uint8Array; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    queue.push({
      request: { id: nextId++, file, options },
      signal,
      reject,
      resolve: (response) => {
        if (response.kind === 'done') resolve(response);
        else reject(new ImageProcessError(response.reason));
      },
    });
    pump();
  });
}
