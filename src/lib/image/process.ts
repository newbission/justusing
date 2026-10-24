/**
 * 이미지 한 장을 읽어 크기를 바꾸고 원하는 형식으로 다시 저장한다 (이미지 압축·크기 조절·용량 맞추기 도구).
 *
 * 여러 장을 넣으면 워커 여러 개(process.worker.ts)가 기기의 CPU 수에 맞춰 나눠 처리한다.
 * 이 모듈을 import한 도구 frame에서만 로드된다. 파일은 어디로도 보내지 않는다.
 */
import workerUrl from './process.worker.ts?worker&url';
import { createWorker } from '../worker';
import { readable } from './heif';

export type OutputType = 'image/jpeg' | 'image/png' | 'image/webp';

export interface ProcessOptions {
  type: OutputType;
  /** JPG·WebP 화질 (0~1) */
  quality: number;
  /** PNG 색 수. 0이면 색을 줄이지 않는다 (무손실) */
  pngColors: number;
  /** 결과 가로·세로 화소. 없으면 원본 크기 그대로 */
  size?: { width: number; height: number };
  /**
   * 이 용량(바이트) 이하로 맞춘다 (fitImage). 화질(PNG는 색 수)을 낮추고, resize면 가로·세로도 줄인다.
   * 이때 quality·pngColors는 쓰지 않는다 (fit-size.ts가 정한다)
   */
  limit?: { bytes: number; resize: boolean };
}

export interface ProcessRequest {
  id: number;
  /** 원본 파일, 또는 브라우저가 못 읽는 HEIC를 libheif로 풀어 바로 세운 그림 (heif.ts) */
  file: Blob | ImageBitmap;
  options: ProcessOptions;
}

export interface ProcessResult {
  bytes: Uint8Array;
  width: number;
  height: number;
  /** 용량을 맞췄을 때 쓴 JPG·WebP 화질 (0~1) */
  quality?: number;
  /** 용량을 맞췄을 때 쓴 PNG 색 수 (0 = 줄이지 않음) */
  colors?: number;
  /** JPG로 저장하며 투명한 곳을 흰색으로 채웠다 */
  flattened?: boolean;
}

/** 용량을 맞추지 못한 까닭. keep-size: 크기를 그대로 두고는 못 줄임, too-small: 크기를 줄여도 목표가 너무 작음 */
export type OverReason = 'keep-size' | 'too-small';

export type ProcessResponse =
  | ({ id: number; kind: 'done' } & ProcessResult)
  /** decode: 브라우저가 읽지 못하는 이미지, encode: 이 브라우저가 그 형식으로 저장하지 못함 */
  | { id: number; kind: 'error'; reason: 'decode' | 'encode' }
  /** 가장 작게 해도 상한을 넘는다 (limit). smallest는 그때의 용량 */
  | { id: number; kind: 'over'; smallest: number; reason: OverReason };

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
  // 브라우저가 못 읽는 HEIC는 일을 시작할 때 푼다 (한꺼번에 미리 풀면 큰 그림이 모두 메모리에 남는다)
  let file: Blob | ImageBitmap;
  try {
    file = await readable(task.request.file as Blob);
  } catch {
    task.resolve({ id: task.request.id, kind: 'error', reason: 'decode' });
    return;
  }
  const release = () => {
    if (file instanceof ImageBitmap) file.close();
  };
  let worker: Worker;
  try {
    worker = await take();
  } catch (error) {
    release();
    task.reject(error);
    return;
  }
  await new Promise<void>((done) => {
    const finish = () => {
      worker.removeEventListener('message', listener);
      worker.removeEventListener('error', onError);
      task.signal?.removeEventListener('abort', onAbort);
      done();
    };
    // 워커가 죽으면(메모리 부족 등) 답이 오지 않으므로 이 일을 실패로 끝내고 워커를 버린다
    const onError = () => {
      finish();
      worker.terminate();
      task.resolve({ id: task.request.id, kind: 'error', reason: 'encode' });
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
    worker.addEventListener('error', onError);
    task.signal?.addEventListener('abort', onAbort, { once: true });
    if (task.signal?.aborted) {
      release();
      onAbort();
    } else {
      worker.postMessage({ ...task.request, file } satisfies ProcessRequest, {
        transfer: file instanceof ImageBitmap ? [file] : [],
      });
    }
  });
}

/** 일을 줄에 세운다. 여러 장을 한꺼번에 불러도 워커 수만큼만 동시에 돈다 */
function enqueue(
  file: Blob,
  options: ProcessOptions,
  signal?: AbortSignal,
): Promise<ProcessResponse> {
  return new Promise((resolve, reject) => {
    queue.push({ request: { id: nextId++, file, options }, signal, reject, resolve });
    pump();
  });
}

/**
 * 이미지 한 장을 처리한다.
 * signal로 그만두면 기다리던 일은 시작하지 않고, 하던 일은 워커째 멈춘다 (AbortError).
 */
export async function processImage(
  file: Blob,
  options: Omit<ProcessOptions, 'limit'>,
  signal?: AbortSignal,
): Promise<ProcessResult> {
  const response = await enqueue(file, options, signal);
  if (response.kind === 'done') return response;
  throw new ImageProcessError(response.kind === 'error' ? response.reason : 'encode');
}

/**
 * 이미지 한 장을 limit 바이트 이하로 저장한다 (용량 맞추기). 화질 탐색도 워커 안에서 한다.
 * 맞추지 못하면 { over: true }와 가장 작게 했을 때의 용량을 돌려준다. 읽기·저장 실패는 ImageProcessError
 */
export async function fitImage(
  file: Blob,
  options: Pick<ProcessOptions, 'type'> & Required<Pick<ProcessOptions, 'limit'>>,
  signal?: AbortSignal,
): Promise<
  ({ over: false } & ProcessResult) | { over: true; smallest: number; reason: OverReason }
> {
  const response = await enqueue(file, { ...options, quality: 0, pngColors: 0 }, signal);
  if (response.kind === 'done') return { ...response, over: false };
  if (response.kind === 'over') {
    return { over: true, smallest: response.smallest, reason: response.reason };
  }
  throw new ImageProcessError(response.reason);
}
