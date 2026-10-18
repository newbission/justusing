/**
 * PDF 한 쪽을 이미지 파일(JPG·PNG)로 그린다 (PDF를 이미지로 도구).
 * 화면에 없는 canvas에 그리고(pdf.js는 화면 스레드에서 그리되 짧게 끊어서 그린다),
 * 이미지로 저장하는 일은 워커(encode-image.worker.ts)에서 한다. 어디로도 보내지 않는다.
 */
import workerUrl from './encode-image.worker.ts?worker&url';
import { createWorker } from '../worker';
import type { PDFPageProxy } from './pdfjs';

export type ImageFormat = 'jpg' | 'png';

export const IMAGE_TYPES: Record<ImageFormat, string> = {
  jpg: 'image/jpeg',
  png: 'image/png',
};

/**
 * canvas 한 장의 최대 화소 수. 브라우저마다 한계가 있고(iOS Safari 약 1,670만),
 * 넘으면 빈 이미지가 나온다. A4 300 DPI(약 870만)는 그대로 그려진다.
 */
const MAX_PIXELS = 16_000_000;
/** canvas 한 변의 최대 화소. 면적과 따로 한계가 있다 (아주 길쭉한 쪽). Safari가 가장 작다 */
const MAX_SIDE = 16_384;

/** JPG 화질 (0~1). 글자가 번지지 않을 만큼 높게 둔다 */
const JPEG_QUALITY = 0.92;

/** 그림 위에 검게 칠할 자리. 그림 크기 대비 비율(0~1), 왼쪽 위가 (0, 0) (가리기) */
export interface FillRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface EncodeRequest {
  id: number;
  bitmap: ImageBitmap;
  type: string;
  quality: number;
  fill?: FillRect[];
}

export type EncodeResponse =
  { id: number; kind: 'done'; bytes: Uint8Array } | { id: number; kind: 'error'; message: string };

let workerPromise: Promise<Worker> | undefined;
let nextId = 0;

/**
 * 그린 쪽을 워커에서 이미지 바이트로 바꾼다. bitmap은 워커로 넘어가 닫힌다.
 * fill: 저장하기 전에 검게 칠할 자리 (가리기)
 */
export async function encodeBitmap(
  bitmap: ImageBitmap,
  type: string,
  quality = JPEG_QUALITY,
  fill?: FillRect[],
): Promise<Uint8Array> {
  const worker = await (workerPromise ??= createWorker(workerUrl));
  const id = nextId++;
  return new Promise((resolve, reject) => {
    const listener = (event: MessageEvent<EncodeResponse>) => {
      if (event.data.id !== id) return;
      worker.removeEventListener('message', listener);
      if (event.data.kind === 'done') resolve(event.data.bytes);
      else reject(new Error(event.data.message));
    };
    worker.addEventListener('message', listener);
    worker.postMessage({ id, bitmap, type, quality, fill } satisfies EncodeRequest, [bitmap]);
  });
}

/**
 * 한 쪽을 dpi 해상도로 그린 그림. 너무 크면 한계 안으로 줄이고, 실제로 그린 해상도를 함께 돌려준다.
 * 화면에 보이는 대로(쪽 회전·보이는 영역 반영) 그린다.
 */
export async function renderPageBitmap(
  page: PDFPageProxy,
  dpi: number,
  /** 'print': 인쇄할 때 보이는 주석으로 그린다 (화면 전용 주석은 빼고, 인쇄 전용은 넣는다) */
  intent: 'display' | 'print' = 'display',
): Promise<{ bitmap: ImageBitmap; dpi: number }> {
  let scale = dpi / 72;
  let viewport = page.getViewport({ scale });
  const shrink = Math.min(
    1,
    Math.sqrt(MAX_PIXELS / (viewport.width * viewport.height)),
    MAX_SIDE / viewport.width,
    MAX_SIDE / viewport.height,
  );
  if (shrink < 1) {
    scale *= shrink;
    viewport = page.getViewport({ scale });
  }

  const canvas = document.createElement('canvas');
  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);
  try {
    // 배경이 투명한 PDF도 JPG처럼 흰 종이로 보이게 흰색을 깐다
    await page.render({ canvas, viewport, background: '#ffffff', intent }).promise;
    return { bitmap: await createImageBitmap(canvas), dpi: scale * 72 };
  } finally {
    // 큰 canvas의 메모리를 바로 돌려준다 (쪽이 많으면 쌓여서 탭이 죽을 수 있다)
    canvas.width = 0;
    canvas.height = 0;
    page.cleanup();
  }
}

/** 한 쪽을 dpi 해상도로 그린 이미지 바이트. 너무 크면 한계 안으로 줄인다. */
export async function renderPageImage(
  page: PDFPageProxy,
  dpi: number,
  format: ImageFormat,
): Promise<Uint8Array> {
  const { bitmap } = await renderPageBitmap(page, dpi);
  // 저장(인코딩)은 무거워서 워커에서 한다. 그린 화소만 넘긴다
  return encodeBitmap(bitmap, IMAGE_TYPES[format]);
}
