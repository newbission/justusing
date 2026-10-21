/**
 * 증명사진의 사진 다루기 워커를 띄우고 부른다 (photo.worker.ts).
 *
 * 휴대폰 사진은 수천만 화소라 읽기·줄이기·결과 그리기·JPG 만들기를 화면 스레드에서 하면 화면이 멈춘다.
 * 워커가 원본을 들고 있고, 화면에는 미리보기용 작은 사진과 살피기용 픽셀만 넘긴다.
 */
import { createWorker } from '../worker';
import type { Matte, Placement, Thumb } from './id-photo';
import workerUrl from './photo.worker.ts?worker&url';

export type PhotoRequest =
  | { id: number; type: 'open'; file: File; previewSide: number; thumbSide: number }
  | { id: number; type: 'export'; placement: Placement; background?: Background };

export type PhotoResponse =
  | {
      id: number;
      kind: 'opened';
      width: number;
      height: number;
      preview: ImageBitmap;
      thumb: Thumb;
    }
  | { id: number; kind: 'exported'; bytes: Uint8Array }
  | { id: number; kind: 'error'; message: string };

/** 바꿀 배경: 색과 사람·배경을 나눈 결과 */
export interface Background {
  color: string;
  matte: Matte;
}

export interface OpenedPhoto {
  width: number;
  height: number;
  /** 미리보기·얼굴 찾기용으로 줄인 사진 */
  preview: ImageBitmap;
  /** 정수리·배경을 살필 작은 사진의 픽셀 */
  thumb: Thumb;
}

let nextId = 0;

export class PhotoWorker {
  private worker: Promise<Worker> | undefined;

  private async call(request: PhotoRequest): Promise<PhotoResponse> {
    this.worker ??= createWorker(workerUrl);
    const worker = await this.worker;
    return new Promise((resolve) => {
      const onMessage = (event: MessageEvent<PhotoResponse>) => {
        if (event.data.id !== request.id) return;
        done();
        resolve(event.data);
      };
      // 메모리가 모자라 워커가 죽으면 메시지가 오지 않는다. 다음에는 새 워커를 띄운다
      const onError = () => {
        done();
        this.dispose();
        resolve({ id: request.id, kind: 'error', message: 'worker crashed' });
      };
      const done = () => {
        worker.removeEventListener('message', onMessage);
        worker.removeEventListener('error', onError);
      };
      worker.addEventListener('message', onMessage);
      worker.addEventListener('error', onError);
      worker.postMessage(request);
    });
  }

  /** 사진을 연다. 워커가 원본을 들고 있다가 export에 쓴다 (새로 열면 바뀐다) */
  async open(file: File, previewSide: number, thumbSide: number): Promise<OpenedPhoto> {
    const response = await this.call({ id: nextId++, type: 'open', file, previewSide, thumbSide });
    if (response.kind !== 'opened')
      throw new Error(response.kind === 'error' ? response.message : 'unexpected');
    return response;
  }

  /** 마지막으로 연 사진에서 칸을 잘라 결과 JPG를 만든다 (background가 있으면 배경을 바꾼다) */
  async export(placement: Placement, background?: Background): Promise<Uint8Array> {
    const response = await this.call({ id: nextId++, type: 'export', placement, background });
    if (response.kind !== 'exported')
      throw new Error(response.kind === 'error' ? response.message : 'unexpected');
    return response.bytes;
  }

  dispose() {
    this.worker?.then((worker) => worker.terminate()).catch(() => {});
    this.worker = undefined;
  }
}
