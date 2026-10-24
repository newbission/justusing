/**
 * 물체 나누기 (배경 지우기). 사진에서 누른 곳의 물체·사람·동물을 배경과 나눈다 (MediaPipe MagicTouch).
 *
 * 엔진과 모델은 처음 쓸 때 받는다 (크기를 화면에 밝히고 묻는다). 받은 데이터는 바깥 페이지가 이 브라우저에
 * 보관한다 (src/lib/data-store.ts). 엔진은 증명사진과 같은 파일이라, 증명사진에서 받았으면 모델만 받는다.
 * 나누기는 워커 하나에서 한다.
 */
import type { DataFile } from '../../frame/data';
import { MEDIAPIPE_ENGINE, OBJECT_MODEL } from '../face/data-files';
import { createWorker } from '../worker';
import type { Mask, Point } from './matte';
import workerUrl from './objects.worker.ts?worker&url';

/** 보관소에서 받기 동의를 기억하는 이름 */
export const CUTOUT_CONSENT = 'cutout';
export const CUTOUT_FILES: DataFile[] = [MEDIAPIPE_ENGINE, OBJECT_MODEL];

export type ObjectsRequest =
  | { id: number; type: 'init'; engine: Uint8Array; model: Uint8Array }
  | { id: number; type: 'image'; bitmap: ImageBitmap }
  | { id: number; type: 'segment'; point: Point };

export type ObjectsResponse =
  | { id: number; kind: 'ready' }
  | { id: number; kind: 'mask'; mask: Mask }
  | { id: number; kind: 'error'; message: string };

let nextId = 0;

export class ObjectFinder {
  private constructor(private worker: Worker | undefined) {}

  /** 엔진을 띄운다. data: loadData로 받아 확인한 바이트 (경로 → 바이트). 워커로 넘어가 비워진다 */
  static async create(data: Map<string, Uint8Array>): Promise<ObjectFinder> {
    const worker = await createWorker(workerUrl);
    const finder = new ObjectFinder(worker);
    const engine = data.get(MEDIAPIPE_ENGINE.path)!;
    const model = data.get(OBJECT_MODEL.path)!;
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

  private call(request: ObjectsRequest, transfer: Transferable[] = []): Promise<ObjectsResponse> {
    const worker = this.worker;
    if (!worker) return Promise.reject(new Error('disposed'));
    return new Promise((resolve, reject) => {
      const onMessage = (event: MessageEvent<ObjectsResponse>) => {
        if (event.data.id !== request.id) return;
        done();
        if (event.data.kind === 'error') reject(new Error(event.data.message));
        else resolve(event.data);
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

  /** 나눌 사진을 바꾼다. bitmap은 워커로 넘어간다 */
  async setImage(bitmap: ImageBitmap): Promise<void> {
    await this.call({ id: nextId++, type: 'image', bitmap }, [bitmap]);
  }

  /** 마지막으로 넘긴 사진에서 point가 가리키는 물체의 마스크 (사진과 같은 크기) */
  async segment(point: Point): Promise<Mask> {
    const response = await this.call({ id: nextId++, type: 'segment', point });
    if (response.kind !== 'mask') throw new Error('unexpected response');
    return response.mask;
  }

  dispose() {
    this.worker?.terminate();
    this.worker = undefined;
  }
}
