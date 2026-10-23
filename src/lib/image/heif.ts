/**
 * HEIC·HEIF 사진(아이폰 사진) 읽기. 화면 스레드에서 부른다.
 *
 * Safari는 HEIC를 스스로 읽지만 크롬·엣지·파이어폭스는 못 읽는다. 그런 브라우저에서만 libheif(+libde265,
 * WebAssembly, LGPL-3.0)로 푼다 (heif.worker.ts). 다른 이미지 도구는 받은 파일을 `readable()`에 거쳐 워커에
 * 넘기면, 브라우저가 못 읽는 HEIC만 바로 세운 ImageBitmap으로 바뀌어 간다.
 *
 * 엔진(libheif.wasm, 약 1.4MB, 압축해 보내면 약 0.5MB)은 빌드 때 /_astro/에 따로 나가고, 브라우저가 못 읽는
 * HEIC를 처음 풀 때만 받는다. 받는 곳은 우리 사이트뿐이고, 사진은 어디로도 보내지 않는다.
 * 고르는 법과 라이선스 처리는 docs/features/image-heic-to-jpg/README.md.
 */
import wasmUrl from 'libheif-js/libheif-wasm/libheif.wasm?url';
import { createWorker } from '../worker';
import { isHeifHead } from './heif-container';
import workerUrl from './heif.worker.ts?worker&url';

export type HeifRequest =
  | { type: 'init'; wasm: ArrayBuffer }
  /** preview: 긴 변을 이만큼 줄인 JPG를 달라 (없으면 원래 크기 ImageBitmap) */
  | { type: 'decode'; id: number; file: Blob; preview?: number };

export type HeifResponse =
  | { id: number; kind: 'image'; bitmap: ImageBitmap }
  | { id: number; kind: 'preview'; width: number; height: number; preview: Blob }
  /** decode: 깨졌거나 풀 수 없는 파일, engine: 엔진을 띄우지 못함·메모리 부족 */
  | { id: number; kind: 'error'; message: 'decode' | 'engine' };

export class HeifError extends Error {
  constructor(readonly reason: 'decode' | 'engine') {
    super(reason);
  }
}

/**
 * 브라우저가 HEIC를 스스로 읽는지 확인하는 16×16 HEIC (pillow-heif로 만든 초록 칸, 435바이트).
 * 한 번만 확인한다
 */
const PROBE =
  'AAAAHGZ0eXBoZWljAAAAAG1pZjFoZWljbWlhZgAAAWltZXRhAAAAAAAAACFoZGxyAAAAAAAAAABwaWN0AAAAAAAAAAAAAAAAAAAAAA5waXRtAAAAAAABAAAAImlsb2MAAAAAREAAAQABAAAAAAGNAAEAAAAAAAAAJgAAACNpaW5mAAAAAAABAAAAFWluZmUCAAAAAAEAAGh2YzEAAAAA6WlwcnAAAADKaXBjbwAAAHZodmNDAQNwAAAAAAAAAAAAHvAA/P34+AAADwMgAAEAGEABDAH//wNwAAADAJAAAAMAAAMAHroCQCEAAQAqQgEBA3AAAAMAkAAAAwAAAwAeoCCBBZbqrprm4CGgwIAAAAMAgAAAAwCEIgABAAZEAcFzwYkAAAAUaXNwZQAAAAAAAABAAAAAQAAAAChjbGFwAAAAEAAAAAEAAAAQAAAAAf///9AAAAAC////0AAAAAIAAAAQcGl4aQAAAAADCAgIAAAAF2lwbWEAAAAAAAAAAQABBIECgwQAAAAubWRhdAAAACIoAa8EEhNM4Pjpwmg9T/3GL3rryftAqyvjSZ93sRiSqf+g';

let native: Promise<boolean> | undefined;

/** 이 브라우저가 HEIC를 스스로 읽는지 (Safari) */
export function browserReadsHeif(): Promise<boolean> {
  return (native ??= createImageBitmap(
    new Blob([Uint8Array.from(atob(PROBE), (c) => c.charCodeAt(0))], { type: 'image/heic' }),
  ).then(
    (bitmap) => {
      bitmap.close();
      return true;
    },
    () => false,
  ));
}

/** 파일 머리로 HEIC·HEIF인지 본다 (이름·형식 표시는 믿지 않는다) */
export async function isHeif(file: Blob): Promise<boolean> {
  return isHeifHead(new Uint8Array(await file.slice(0, 64).arrayBuffer()));
}

/** 이 파일을 libheif로 풀어야 하는지 (HEIC인데 브라우저가 못 읽음) */
export async function needsHeifDecoder(file: Blob): Promise<boolean> {
  return (await isHeif(file)) && !(await browserReadsHeif());
}

// ── 워커 (CPU 수에 맞춰 1~2개. 큰 사진 한 장을 풀 때 엔진이 150MB쯤 쓴다) ──

const MAX_WORKERS = Math.max(1, Math.min(2, (navigator.hardwareConcurrency || 2) - 1));
let wasm: Promise<ArrayBuffer> | undefined;
let live = 0;
const idle: Worker[] = [];
const waiting: { resolve: (worker: Worker) => void; reject: (error: unknown) => void }[] = [];
let nextId = 0;

async function spawn(): Promise<Worker> {
  wasm ??= fetch(wasmUrl).then((response) => {
    if (!response.ok) throw new Error(`libheif: ${response.status}`);
    return response.arrayBuffer();
  });
  let bytes: ArrayBuffer;
  try {
    bytes = await wasm;
  } catch (error) {
    wasm = undefined; // 다음에 다시 받아 본다
    throw error;
  }
  const worker = await createWorker(workerUrl);
  const copy = bytes.slice(0);
  worker.postMessage({ type: 'init', wasm: copy } satisfies HeifRequest, [copy]);
  return worker;
}

async function acquire(): Promise<Worker> {
  const worker = idle.pop();
  if (worker) return worker;
  if (live >= MAX_WORKERS)
    return new Promise((resolve, reject) => waiting.push({ resolve, reject }));
  live++;
  try {
    return await spawn();
  } catch (error) {
    live--;
    throw error;
  }
}

function release(worker: Worker) {
  const next = waiting.shift();
  if (next) next.resolve(worker);
  else idle.push(worker);
}

/** 죽은 워커를 버리고, 기다리던 일이 있으면 새 워커를 띄워 준다 */
function discard(worker: Worker) {
  worker.terminate();
  live--;
  const next = waiting.shift();
  if (next) acquire().then(next.resolve, next.reject);
}

async function call(file: Blob, preview?: number): Promise<HeifResponse> {
  let worker: Worker;
  try {
    worker = await acquire();
  } catch {
    throw new HeifError('engine');
  }
  const id = nextId++;
  return new Promise((resolve) => {
    const done = () => {
      worker.removeEventListener('message', onMessage);
      worker.removeEventListener('error', onError);
    };
    const onMessage = (event: MessageEvent<HeifResponse>) => {
      if (event.data.id !== id) return;
      done();
      release(worker);
      resolve(event.data);
    };
    // 메모리가 모자라 워커가 죽으면 답이 오지 않는다. 그 워커는 버린다
    const onError = () => {
      done();
      discard(worker);
      resolve({ id, kind: 'error', message: 'engine' });
    };
    worker.addEventListener('message', onMessage);
    worker.addEventListener('error', onError);
    worker.postMessage({ type: 'decode', id, file, preview } satisfies HeifRequest);
  });
}

/** HEIC를 libheif로 풀어 바로 세운 원래 크기 그림으로. 실패하면 HeifError */
export async function decodeHeif(file: Blob): Promise<ImageBitmap> {
  const response = await call(file);
  if (response.kind === 'image') return response.bitmap;
  throw new HeifError(response.kind === 'error' ? response.message : 'decode');
}

/** HEIC를 libheif로 풀어 가로·세로와 긴 변을 side로 줄인 JPG 미리보기를 만든다. 실패하면 HeifError */
export async function previewHeif(
  file: Blob,
  side: number,
): Promise<{ width: number; height: number; preview: Blob }> {
  const response = await call(file, side);
  if (response.kind === 'preview') return response;
  throw new HeifError(response.kind === 'error' ? response.message : 'decode');
}

/**
 * 워커에 넘길 사진. 브라우저가 못 읽는 HEIC만 풀어 바로 세운 ImageBitmap으로 바꾸고, 나머지는 파일 그대로.
 * ImageBitmap은 워커에 넘길 때 transfer한다. 실패하면 HeifError
 */
export async function readable(file: Blob): Promise<Blob | ImageBitmap> {
  return (await needsHeifDecoder(file)) ? decodeHeif(file) : file;
}

/** 사진을 바로 세워 읽는다 (화면 스레드). 브라우저가 못 읽는 HEIC는 libheif로 */
export async function decodeImage(file: Blob): Promise<ImageBitmap> {
  if (await needsHeifDecoder(file)) return decodeHeif(file);
  return createImageBitmap(file, { imageOrientation: 'from-image' });
}
