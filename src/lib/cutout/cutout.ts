/**
 * 배경 지우기의 사진 다루기. 읽기·미리보기 그리기·저장은 워커(cutout.worker.ts)가 한다. 파일은 어디로도 보내지 않는다.
 *
 * - CutoutPhoto: 고치는 사진 한 장의 미리보기를 그리는 워커 하나. 사진 번호(photo)를 요청마다 보내
 *   다른 사진을 연 뒤에 늦게 온 예전 사진의 마스크·미리보기 요청이 섞이지 않게 한다
 * - CutoutJobs: 여러 장을 미리 나눌 사진 만들기·목록 그림·원본 크기 저장. 필요한 것을 모두 보내고 결과만 받는다.
 *   기기의 CPU 수에 맞춘 워커 여러 개가 나눠 한다. 원본은 처리하는 동안만 워커가 든다
 */
import { readable } from '../image/heif';
import type { OutputType } from '../image/process';
import { createWorker } from '../worker';
import workerUrl from './cutout.worker.ts?worker&url';
import type { Look, Mask } from './matte';

/** decode: 읽지 못한 사진, tooLarge: 이 브라우저가 그리지 못하는 크기, encode: 그 형식으로 저장하지 못함, empty: 남은 곳이 없음 */
export type CutoutFailure = 'decode' | 'tooLarge' | 'encode' | 'empty';

/** 미리보기·저장에서 물체에 맞춰 자를 자리 (사진에 대한 0~1 비율) */
export interface TrimBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type CutoutRequest =
  | {
      id: number;
      kind: 'open';
      photo: number;
      file: Blob | ImageBitmap;
      previewSide: number;
      analysisSide: number;
    }
  | { id: number; kind: 'mask'; photo: number; mask: Mask }
  | { id: number; kind: 'preview'; photo: number; look: Look }
  | {
      id: number;
      kind: 'prepare';
      file: Blob | ImageBitmap;
      /** 물체 나누기용 사진의 긴 변. 0이면 만들지 않는다 (크기·목록 그림만) */
      analysisSide: number;
      /** 목록 그림 바탕의 긴 변. 0이면 만들지 않는다 */
      thumbSide: number;
    }
  | { id: number; kind: 'thumb'; base: ImageBitmap; mask: Mask; look: Look }
  | {
      id: number;
      kind: 'export';
      file: Blob | ImageBitmap;
      mask: Mask;
      look: Look;
      type: OutputType;
      quality: number;
    };

export type CutoutResponse =
  | {
      id: number;
      kind: 'opened';
      width: number;
      height: number;
      preview: ImageBitmap;
      analysis: ImageBitmap;
    }
  | { id: number; kind: 'done' }
  | { id: number; kind: 'previewed'; image: ImageBitmap; box?: TrimBox }
  | {
      id: number;
      kind: 'prepared';
      width: number;
      height: number;
      analysis?: ImageBitmap;
      thumb?: ImageBitmap;
    }
  | { id: number; kind: 'thumbed'; image: ImageBitmap }
  | { id: number; kind: 'exported'; bytes: Uint8Array; width: number; height: number }
  /** stale: 워커가 고치는 사진이 요청한 사진이 아니다 */
  | { id: number; kind: 'error'; reason: CutoutFailure | 'stale' };

export class CutoutError extends Error {
  constructor(readonly reason: CutoutFailure | 'stale') {
    super(reason);
  }
}

export interface OpenedPhoto {
  /** 바로 세운 원본의 가로·세로 */
  width: number;
  height: number;
  /** 긴 변을 previewSide 이하로 줄인 미리보기 */
  preview: ImageBitmap;
  /** 긴 변을 analysisSide 이하로 줄인 물체 나누기용 사진 */
  analysis: ImageBitmap;
}

export interface PreparedPhoto {
  /** 바로 세운 원본의 가로·세로 */
  width: number;
  height: number;
  analysis?: ImageBitmap;
  thumb?: ImageBitmap;
}

type Ask = CutoutRequest extends infer R
  ? R extends CutoutRequest
    ? Omit<R, 'id'>
    : never
  : never;

let nextId = 0;

/** 넘길 것: 사진(ImageBitmap)과 마스크는 복사하지 않고 넘긴다 (부른 쪽은 사본을 보낸다) */
function transferOf(request: Ask): Transferable[] {
  const list: Transferable[] = [];
  if ('file' in request && request.file instanceof ImageBitmap) list.push(request.file);
  if ('mask' in request) list.push(request.mask.data.buffer);
  if ('base' in request) list.push(request.base);
  return list;
}

/** 브라우저가 못 읽는 HEIC는 화면에서 libheif로 풀어 넘긴다 */
async function withReadable(request: Ask): Promise<Ask | undefined> {
  if (!('file' in request) || request.file instanceof ImageBitmap) return request;
  try {
    return { ...request, file: await readable(request.file) } as Ask;
  } catch {
    return undefined;
  }
}

/**
 * 워커에 요청 하나를 보내고 답을 기다린다. 워커가 죽으면(대개 큰 사진으로 메모리가 모자람) 답이 오지 않으므로
 * crashed를 부르고 tooLarge로 끝낸다
 */
function post(
  worker: Worker,
  request: Ask,
  crashed: () => void,
  signal?: AbortSignal,
): Promise<CutoutResponse> {
  const id = nextId++;
  return new Promise((resolve) => {
    const finish = () => {
      worker.removeEventListener('message', listener);
      worker.removeEventListener('error', onError);
      signal?.removeEventListener('abort', onAbort);
    };
    const listener = (event: MessageEvent<CutoutResponse>) => {
      if (event.data.id !== id) return;
      finish();
      resolve(event.data);
    };
    const onError = () => {
      finish();
      crashed();
      resolve({ id, kind: 'error', reason: 'tooLarge' });
    };
    // 그만두면 하던 일째로 워커를 버린다 (큰 사진을 그리던 메모리도 돌려준다)
    const onAbort = () => {
      finish();
      crashed();
      resolve({ id, kind: 'error', reason: 'stale' });
    };
    worker.addEventListener('message', listener);
    worker.addEventListener('error', onError);
    signal?.addEventListener('abort', onAbort);
    worker.postMessage({ ...request, id } as CutoutRequest, transferOf(request));
  });
}

function fail(response: CutoutResponse, fallback: CutoutFailure): never {
  throw new CutoutError(response.kind === 'error' ? response.reason : fallback);
}

/** 고치는 사진 한 장의 미리보기 워커 */
export class CutoutPhoto {
  private worker: Promise<Worker> | undefined;
  /**
   * 요청은 부른 순서대로 보낸다. 열기는 HEIC 풀기까지 줄 안에서 한다: 크롬에서 HEIC를 푸는 동안 다른 사진을 열면
   * 그 사진이 먼저 워커에 가고, 늦게 풀린 HEIC가 워커의 사진을 덮어 화면과 다른 사진을 그린다
   */
  private queue: Promise<unknown> = Promise.resolve();

  private ask(request: Ask): Promise<CutoutResponse> {
    const next = this.queue.then(async (): Promise<CutoutResponse> => {
      const ready = await withReadable(request);
      if (!ready) return { id: -1, kind: 'error', reason: 'decode' };
      this.worker ??= createWorker(workerUrl);
      const worker = await this.worker;
      return post(worker, ready, () => this.dispose());
    });
    this.queue = next.catch(() => undefined);
    return next;
  }

  /** 사진 photo를 연다. 워커는 미리보기 사진만 들고 있다 (새로 열면 바뀐다) */
  async open(
    photo: number,
    file: Blob,
    previewSide: number,
    analysisSide: number,
  ): Promise<OpenedPhoto> {
    const response = await this.ask({ kind: 'open', photo, file, previewSide, analysisSide });
    if (response.kind === 'opened') return response;
    fail(response, 'decode');
  }

  /** 사진 photo의 물체 마스크를 바꾼다 (물체 나누기용 사진 크기). mask는 워커로 넘어가 비워진다 */
  async setMask(photo: number, mask: Mask): Promise<void> {
    const response = await this.ask({ kind: 'mask', photo, mask });
    if (response.kind !== 'done') fail(response, 'decode');
  }

  /** 사진 photo의 결과를 미리보기 크기로 그린다. box: 물체에 맞춰 자르면 남을 자리 (look.trim일 때) */
  async preview(photo: number, look: Look): Promise<{ image: ImageBitmap; box?: TrimBox }> {
    const response = await this.ask({ kind: 'preview', photo, look });
    if (response.kind === 'previewed') return response;
    fail(response, 'decode');
  }

  dispose() {
    this.worker?.then((worker) => worker.terminate()).catch(() => {});
    this.worker = undefined;
  }
}

/** 동시에 도는 워커 수. 화면 스레드 몫으로 하나를 남기고, 큰 사진을 원본 크기로 여럿 들지 않게 3개까지 */
export function jobLimit(): number {
  const cores = navigator.hardwareConcurrency || 2;
  return Math.max(1, Math.min(3, cores - 1));
}

interface Job {
  request: Ask;
  signal?: AbortSignal;
  resolve: (response: CutoutResponse) => void;
}

/** 들고 있지 않는 일(미리 나눌 사진 만들기·목록 그림·저장)을 워커 여러 개가 나눠 한다 */
export class CutoutJobs {
  private waiting: Job[] = [];
  private idle: Worker[] = [];
  private running = 0;
  private workers = new Set<Worker>();

  private run(request: Ask, signal?: AbortSignal): Promise<CutoutResponse> {
    return new Promise((resolve) => {
      this.waiting.push({ request, signal, resolve });
      this.pump();
    });
  }

  private pump() {
    while (this.running < jobLimit() && this.waiting.length > 0) {
      const job = this.waiting.shift()!;
      if (job.signal?.aborted) {
        job.resolve({ id: -1, kind: 'error', reason: 'stale' });
        continue;
      }
      this.running++;
      this.work(job).finally(() => {
        this.running--;
        this.pump();
      });
    }
  }

  private async work(job: Job) {
    // 브라우저가 못 읽는 HEIC는 일을 시작할 때 푼다 (한꺼번에 미리 풀면 큰 그림이 모두 메모리에 남는다)
    const ready = await withReadable(job.request);
    if (!ready) {
      job.resolve({ id: -1, kind: 'error', reason: 'decode' });
      return;
    }
    if (job.signal?.aborted) {
      for (const item of transferOf(ready)) if (item instanceof ImageBitmap) item.close();
      job.resolve({ id: -1, kind: 'error', reason: 'stale' });
      return;
    }
    let worker: Worker;
    try {
      worker = this.idle.pop() ?? (await createWorker(workerUrl));
    } catch {
      job.resolve({ id: -1, kind: 'error', reason: 'decode' });
      return;
    }
    this.workers.add(worker);
    let alive = true;
    const response = await post(
      worker,
      ready,
      () => {
        alive = false;
        this.workers.delete(worker);
        worker.terminate();
      },
      job.signal,
    );
    if (alive) this.idle.push(worker);
    job.resolve(response);
  }

  /** 사진을 읽어 크기와 물체 나누기용 사진(긴 변 analysisSide)·목록 그림 바탕(긴 변 thumbSide)을 만든다. 0이면 만들지 않는다 */
  async prepare(file: Blob, analysisSide: number, thumbSide: number): Promise<PreparedPhoto> {
    const response = await this.run({ kind: 'prepare', file, analysisSide, thumbSide });
    if (response.kind === 'prepared') return response;
    fail(response, 'decode');
  }

  /** 목록에 보일 작은 결과 그림. base와 mask는 워커로 넘어가 비워진다 */
  async thumb(base: ImageBitmap, mask: Mask, look: Look): Promise<ImageBitmap> {
    const response = await this.run({ kind: 'thumb', base, mask, look });
    if (response.kind === 'thumbed') return response.image;
    fail(response, 'tooLarge');
  }

  /** 원본 크기로 결과를 저장한다. mask는 워커로 넘어가 비워진다. 실패하면 CutoutError (그만두면 'stale') */
  async export(
    file: Blob,
    mask: Mask,
    look: Look,
    type: OutputType,
    quality: number,
    signal?: AbortSignal,
  ): Promise<{ bytes: Uint8Array; width: number; height: number }> {
    const response = await this.run({ kind: 'export', file, mask, look, type, quality }, signal);
    if (response.kind === 'exported') return response;
    fail(response, 'encode');
  }

  dispose() {
    for (const job of this.waiting.splice(0)) {
      job.resolve({ id: -1, kind: 'error', reason: 'stale' });
    }
    for (const worker of this.workers) worker.terminate();
    this.workers.clear();
    this.idle = [];
  }
}
