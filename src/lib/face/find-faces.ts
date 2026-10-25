/**
 * 여러 얼굴 찾기 (모자이크). 사진에 찍힌 얼굴들(단체 사진의 작은 얼굴 포함)의 사각형을 찾는다
 * (MediaPipe Face Detector, BlazeFace full range).
 *
 * 엔진과 모델은 처음 쓸 때 받는다 (크기를 화면에 밝히고 묻는다). 받은 데이터는 바깥 페이지가 이 브라우저에
 * 보관한다 (src/lib/data-store.ts). 엔진은 증명사진·배경 지우기와 같은 파일이라, 그쪽에서 받았으면 모델(1.1MB)만 받는다.
 * 찾기는 워커 하나에서 한다. 이 모듈은 '얼굴 찾기'를 누를 때 불러온다 (모자이크 첫 화면을 무겁게 하지 않게).
 */
import type { DataFile } from '../../frame/data';
import { createWorker } from '../worker';
import { DETECTOR_MODEL, MEDIAPIPE_ENGINE } from './data-files';
import type { FoundFace } from './face-boxes';
import workerUrl from './find-faces.worker.ts?worker&url';

/** 보관소에서 받기 동의를 기억하는 이름 */
export const FIND_FACES_CONSENT = 'find-faces';
export const FIND_FACES_FILES: DataFile[] = [MEDIAPIPE_ENGINE, DETECTOR_MODEL];

export type FindFacesRequest =
  | { id: number; type: 'init'; engine: Uint8Array; model: Uint8Array }
  | { id: number; type: 'find'; bitmap: ImageBitmap };

export type FindFacesResponse =
  | { id: number; kind: 'ready' }
  | { id: number; kind: 'progress'; done: number; total: number }
  | { id: number; kind: 'faces'; faces: FoundFace[] }
  | { id: number; kind: 'error'; message: string };

let nextId = 0;

export class FacesFinder {
  private constructor(private worker: Worker | undefined) {}

  /** 엔진을 띄운다. data: loadData로 받아 확인한 바이트 (경로 → 바이트). 워커로 넘어가 비워진다 */
  static async create(data: Map<string, Uint8Array>): Promise<FacesFinder> {
    const worker = await createWorker(workerUrl);
    const finder = new FacesFinder(worker);
    const engine = data.get(MEDIAPIPE_ENGINE.path)!;
    const model = data.get(DETECTOR_MODEL.path)!;
    try {
      await finder.call({ id: nextId++, type: 'init', engine, model }, [
        ...new Set([engine.buffer, model.buffer]),
      ]);
    } catch (error) {
      finder.dispose();
      throw error;
    }
    return finder;
  }

  private call(
    request: FindFacesRequest,
    transfer: Transferable[] = [],
    onProgress?: (done: number, total: number) => void,
  ): Promise<FindFacesResponse> {
    const worker = this.worker;
    if (!worker) return Promise.reject(new Error('disposed'));
    return new Promise((resolve, reject) => {
      const onMessage = (event: MessageEvent<FindFacesResponse>) => {
        const response = event.data;
        if (response.id !== request.id) return;
        if (response.kind === 'progress') {
          onProgress?.(response.done, response.total);
          return;
        }
        done();
        if (response.kind === 'error') reject(new Error(response.message));
        else resolve(response);
      };
      // 메모리가 모자라 워커가 죽으면 메시지가 오지 않는다. 기다리지 않고 실패로 끝낸다
      const onError = () => {
        done();
        reject(new Error('worker crashed'));
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

  /**
   * 사진의 얼굴들 (bitmap 화소 기준 사각형). bitmap은 워커로 넘어가 닫힌다.
   * onProgress(done, total): 살펴본 조각 수
   */
  async find(
    bitmap: ImageBitmap,
    onProgress?: (done: number, total: number) => void,
  ): Promise<FoundFace[]> {
    const response = await this.call({ id: nextId++, type: 'find', bitmap }, [bitmap], onProgress);
    if (response.kind !== 'faces') throw new Error('unexpected response');
    return response.faces;
  }

  dispose() {
    this.worker?.terminate();
    this.worker = undefined;
  }
}

export { coverOf, type FoundFace } from './face-boxes';
