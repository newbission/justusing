/**
 * 증명사진의 사진 다루기 워커를 띄우고 부른다 (photo.worker.ts).
 *
 * 휴대폰 사진은 수천만 화소라 읽기·줄이기·결과 그리기·JPG 만들기를 화면 스레드에서 하면 화면이 멈춘다.
 * 워커가 원본을 들고 있고, 화면에는 미리보기용 작은 사진과 살피기용 픽셀만 넘긴다.
 */
import { readable } from '../image/heif';
import { createWorker } from '../worker';
import type { Matte, Output, Placement, Thumb } from './id-photo';
import workerUrl from './photo.worker.ts?worker&url';

export type PhotoRequest =
  | {
      id: number;
      type: 'open';
      /** 원본 파일, 또는 브라우저가 못 읽는 HEIC를 libheif로 바로 세워 푼 그림 */
      file: Blob | ImageBitmap;
      previewSide: number;
      thumbSide: number;
    }
  | {
      id: number;
      type: 'export';
      placement: Placement;
      output: Output;
      background?: Background;
    }
  | { id: number; type: 'cutout'; matte: Matte; scale: number };

export type PhotoResponse =
  | {
      id: number;
      kind: 'opened';
      width: number;
      height: number;
      preview: ImageBitmap;
      thumb: Thumb;
    }
  | { id: number; kind: 'exported'; bytes: Uint8Array; fits: boolean }
  | { id: number; kind: 'cutout'; image: ImageBitmap; x: number; y: number }
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

  /** 앞 요청이 끝나야 다음 요청을 만든다 (아래 open 참고) */
  private queue: Promise<unknown> = Promise.resolve();

  /**
   * 요청을 부른 순서대로 보낸다. 열기는 HEIC 풀기까지 줄 안에서 한다: 크롬에서 HEIC를 푸는 동안 다른 사진을
   * 열면 그 사진이 먼저 워커에 가고, 늦게 풀린 HEIC가 워커의 원본을 덮어 저장이 화면과 다른 사진을 쓴다
   */
  private ask(make: () => Promise<[PhotoRequest, Transferable[]]>): Promise<PhotoResponse> {
    const next = this.queue.then(async () => this.call(...(await make())));
    this.queue = next.catch(() => undefined);
    return next;
  }

  private async call(request: PhotoRequest, transfer: Transferable[] = []): Promise<PhotoResponse> {
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
      worker.postMessage(request, transfer);
    });
  }

  /**
   * 사진을 연다. 워커가 원본을 들고 있다가 export에 쓴다 (새로 열면 바뀐다).
   * 브라우저가 못 읽는 HEIC(아이폰 사진)는 libheif로 풀어 넘긴다
   */
  async open(file: File, previewSide: number, thumbSide: number): Promise<OpenedPhoto> {
    const response = await this.ask(async () => {
      const source = await readable(file);
      return [
        { id: nextId++, type: 'open', file: source, previewSide, thumbSide },
        source instanceof ImageBitmap ? [source] : [],
      ];
    });
    if (response.kind !== 'opened')
      throw new Error(response.kind === 'error' ? response.message : 'unexpected');
    return response;
  }

  /**
   * 마지막으로 연 사진에서 칸을 잘라 결과 파일을 만든다 (background가 있으면 배경을 바꾼다).
   * fits: 용량 상한 안에 들었는지
   */
  async export(
    placement: Placement,
    output: Output,
    background?: Background,
  ): Promise<{ bytes: Uint8Array; fits: boolean }> {
    const response = await this.ask(async () => [
      { id: nextId++, type: 'export', placement, output, background },
      [],
    ]);
    if (response.kind !== 'exported')
      throw new Error(response.kind === 'error' ? response.message : 'unexpected');
    return { bytes: response.bytes, fits: response.fits };
  }

  /** 원본에서 사람만 남긴 그림 (scale배 크기, 미리보기용). 다 쓰면 image를 닫는다 */
  async cutout(matte: Matte, scale: number) {
    const response = await this.ask(async () => [
      { id: nextId++, type: 'cutout', matte, scale },
      [],
    ]);
    if (response.kind !== 'cutout')
      throw new Error(response.kind === 'error' ? response.message : 'unexpected');
    return { image: response.image, x: response.x, y: response.y };
  }

  dispose() {
    this.worker?.then((worker) => worker.terminate()).catch(() => {});
    this.worker = undefined;
  }
}
