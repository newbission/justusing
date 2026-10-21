/**
 * 얼굴 찾기. 사진에서 얼굴의 점 478개(눈·코·입·턱·얼굴 윤곽)를 찾는다 (MediaPipe Face Landmarker).
 * 배경을 바꿀 때는 같은 엔진으로 사람과 배경을 나눈다 (Selfie Segmenter).
 *
 * 엔진과 모델은 처음 쓸 때 받는다 (크기를 화면에 밝히고 묻는다). 받은 데이터는 바깥 페이지가
 * 이 브라우저에 보관한다 (src/lib/data-store.ts). 찾기는 워커 하나에서 한다.
 */
import type { DataFile } from '../../frame/data';
import { createWorker } from '../worker';
import catalog from './catalog.json';
import workerUrl from './face.worker.ts?worker&url';

/** 보관소에서 받기 동의를 기억하는 이름 */
export const FACE_CONSENT = 'face';

/** 내용이 바뀌면 주소도 바뀌게 해 예전 보관본을 쓰지 않는다 */
const versioned = (file: DataFile): DataFile => ({
  ...file,
  path: `${file.path}?v=${file.sha256.slice(0, 12)}`,
});
const FACE_ENGINE = versioned(catalog.engine);
const FACE_MODEL = versioned(catalog.model);
const FACE_SEGMENTER = versioned(catalog.segmenter);
export const FACE_FILES: DataFile[] = [FACE_ENGINE, FACE_MODEL, FACE_SEGMENTER];

/** 사진 안의 위치. 0~1 비율 (왼쪽 위가 0) */
export interface Point {
  x: number;
  y: number;
}

export type FaceRequest =
  | { id: number; type: 'init'; engine: Uint8Array; model: Uint8Array; segmenter: Uint8Array }
  | { id: number; type: 'detect'; bitmap: ImageBitmap }
  | { id: number; type: 'segment'; bitmap: ImageBitmap };

export type FaceResponse =
  | { id: number; kind: 'ready' }
  | { id: number; kind: 'faces'; faces: Point[][] }
  | { id: number; kind: 'mask'; mask: Mask }
  | { id: number; kind: 'error'; message: string };

/** 사람일 가능성 (0~255, 한 줄씩). 넣은 사진과 크기가 같다 */
export interface Mask {
  data: Uint8Array;
  width: number;
  height: number;
}

let nextId = 0;

function call(worker: Worker, request: FaceRequest, transfer: Transferable[] = []) {
  return new Promise<FaceResponse>((resolve) => {
    const onMessage = (event: MessageEvent<FaceResponse>) => {
      if (event.data.id !== request.id) return;
      done();
      resolve(event.data);
    };
    // 메모리가 모자라 워커가 죽으면 메시지가 오지 않는다. 기다리지 않고 실패로 끝낸다
    const onError = () => {
      done();
      resolve({ id: request.id, kind: 'error', message: 'worker crashed' });
    };
    const done = () => {
      worker.removeEventListener('message', onMessage);
      worker.removeEventListener('error', onError);
    };
    worker.addEventListener('message', onMessage);
    worker.addEventListener('error', onError);
    worker.postMessage(request, transfer);
  });
}

export class FaceFinder {
  private constructor(private worker: Worker | undefined) {}

  /** 엔진을 띄운다. data: loadData로 받아 확인한 바이트 (경로 → 바이트). 워커로 넘어가 비워진다 */
  static async create(data: Map<string, Uint8Array>): Promise<FaceFinder> {
    const worker = await createWorker(workerUrl);
    const finder = new FaceFinder(worker);
    const engine = data.get(FACE_ENGINE.path)!;
    const model = data.get(FACE_MODEL.path)!;
    const segmenter = data.get(FACE_SEGMENTER.path)!;
    // 17MB를 화면 스레드에서 복사하지 않게 넘겨준다 (받은 바이트는 여기서만 쓴다)
    const response = await call(worker, { id: nextId++, type: 'init', engine, model, segmenter }, [
      ...new Set([engine.buffer, model.buffer, segmenter.buffer]),
    ]);
    if (response.kind === 'error') {
      finder.dispose();
      throw new Error(response.message);
    }
    return finder;
  }

  /** 사진의 얼굴들 (얼굴마다 점 478개). bitmap은 워커로 넘어가 닫힌다 */
  async detect(bitmap: ImageBitmap): Promise<Point[][]> {
    if (!this.worker) throw new Error('disposed');
    const response = await call(this.worker, { id: nextId++, type: 'detect', bitmap }, [bitmap]);
    if (response.kind === 'error') throw new Error(response.message);
    if (response.kind !== 'faces') throw new Error('unexpected response');
    return response.faces;
  }

  /** 사람과 배경을 나눈다. bitmap은 워커로 넘어가 닫힌다 */
  async segment(bitmap: ImageBitmap): Promise<Mask> {
    if (!this.worker) throw new Error('disposed');
    const response = await call(this.worker, { id: nextId++, type: 'segment', bitmap }, [bitmap]);
    if (response.kind === 'error') throw new Error(response.message);
    if (response.kind !== 'mask') throw new Error('unexpected response');
    return response.mask;
  }

  dispose() {
    this.worker?.terminate();
    this.worker = undefined;
  }
}
