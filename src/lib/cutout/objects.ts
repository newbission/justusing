/**
 * 물체 나누기 (배경 지우기). 사진에서 누른 곳의 물체·사람·동물을 배경과 나눈다 (MediaPipe MagicTouch).
 *
 * 엔진과 모델은 처음 쓸 때 받는다 (크기를 화면에 밝히고 묻는다). 받은 데이터는 바깥 페이지가 이 브라우저에
 * 보관한다 (src/lib/data-store.ts). 엔진은 증명사진과 같은 파일이라, 증명사진에서 받았으면 모델만 받는다.
 * 나누기는 워커 하나에서 한 번에 하나씩 한다. 사진이 여러 장이어도 워커에는 한 장만 두고, 요청마다 어느 사진인지(photo)
 * 함께 보내 워커가 다른 사진의 그림·마스크로 나누지 않게 한다.
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
  /** bitmap을 주면 그 사진(photo)으로 바꾸고 나눈다. 없으면 워커가 들고 있는 사진이 photo여야 한다 */
  | { id: number; type: 'segment'; photo: number; points: Point[]; bitmap?: ImageBitmap };

export type ObjectsResponse =
  | { id: number; kind: 'ready' }
  | { id: number; kind: 'mask'; photo: number; mask: Mask; coverage: number }
  /** 워커가 들고 있는 사진이 photo가 아니다 (사진을 함께 보내야 한다) */
  | { id: number; kind: 'stale' }
  | { id: number; kind: 'error'; message: string };

/** 나눈 결과. needImage: 워커에 그 사진이 없어 사진을 함께 보내야 한다 */
export type Segmented = { mask: Mask; coverage: number } | 'needImage';

let nextId = 0;

export class ObjectFinder {
  /** 요청은 한 번에 하나씩 (워커는 사진 한 장만 든다) */
  private queue: Promise<unknown> = Promise.resolve();
  /** 워커가 들고 있는 사진 */
  private loaded: number | undefined;

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

  /** 워커가 이 사진을 들고 있는지 (아니면 segment에 사진을 함께 넘긴다) */
  holds(photo: number): boolean {
    return this.loaded === photo;
  }

  /**
   * 사진 photo에서 점들이 가리키는 물체를 모두 남긴 마스크 (사진과 같은 크기)와, 그중 물체로 볼 만한 곳(절반 넘게 확신)의
   * 비율. bitmap을 주면 워커의 사진을 이것으로 바꾼다 (워커로 넘어간다). 주지 않았는데 워커에 다른 사진이 있으면
   * 'needImage'. 앞선 요청이 끝난 뒤에 보내므로 다른 사진의 요청과 섞이지 않는다
   */
  segment(photo: number, points: Point[], bitmap?: ImageBitmap): Promise<Segmented> {
    const next = this.queue.then(async (): Promise<Segmented> => {
      if (!bitmap && this.loaded !== photo) return 'needImage';
      if (bitmap) this.loaded = undefined;
      const response = await this.call(
        { id: nextId++, type: 'segment', photo, points, bitmap },
        bitmap ? [bitmap] : [],
      );
      if (bitmap) this.loaded = photo;
      if (response.kind === 'stale') {
        this.loaded = undefined;
        return 'needImage';
      }
      if (response.kind !== 'mask' || response.photo !== photo)
        throw new Error('unexpected response');
      return { mask: response.mask, coverage: response.coverage };
    });
    this.queue = next.catch(() => undefined);
    return next;
  }

  dispose() {
    this.worker?.terminate();
    this.worker = undefined;
  }
}
