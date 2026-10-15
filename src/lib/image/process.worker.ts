/**
 * 이미지 처리 워커 (process.ts가 여러 개를 띄워 동시에 쓴다).
 * 이미지를 바로 세워 읽고, 크기를 바꾸고, 원하는 형식으로 다시 저장한다. 파일은 메모리에서만 다룬다.
 * 다시 그려 저장하므로 EXIF(촬영 위치·기기 정보 등)는 결과에 남지 않는다.
 */
// UPNG.js가 워커에서 찾는 전역을 먼저 마련한다 (순서를 바꾸면 안 된다)
import './upng-globals';
import UPNG from 'upng-js';
import type { ProcessRequest, ProcessResponse } from './process';

/**
 * 크게 줄일 때는 절반씩 나눠 줄인다. 한 번에 많이 줄이면 브라우저에 따라
 * 가는 선이 끊기고 자글자글해진다.
 */
function scaleDown(
  source: ImageBitmap | OffscreenCanvas,
  width: number,
  height: number,
): OffscreenCanvas {
  let current: ImageBitmap | OffscreenCanvas = source;
  while (current.width / 2 >= width && current.height / 2 >= height) {
    const half = new OffscreenCanvas(Math.ceil(current.width / 2), Math.ceil(current.height / 2));
    const context = half.getContext('2d')!;
    context.imageSmoothingQuality = 'high';
    context.drawImage(current, 0, 0, half.width, half.height);
    release(current);
    current = half;
  }
  const canvas = new OffscreenCanvas(width, height);
  const context = canvas.getContext('2d')!;
  context.imageSmoothingQuality = 'high';
  context.drawImage(current, 0, 0, width, height);
  release(current);
  return canvas;
}

/** 큰 그림의 메모리를 바로 돌려준다 */
function release(image: ImageBitmap | OffscreenCanvas) {
  if (image instanceof ImageBitmap) image.close();
  else {
    image.width = 0;
    image.height = 0;
  }
}

async function encode(
  canvas: OffscreenCanvas,
  options: ProcessRequest['options'],
): Promise<Uint8Array> {
  const { width, height } = canvas;
  if (options.type === 'image/png') {
    // 브라우저의 PNG 저장은 색을 줄이지 못해 UPNG로 저장한다 (색 수 0이면 무손실)
    const pixels = canvas.getContext('2d')!.getImageData(0, 0, width, height).data;
    return new Uint8Array(UPNG.encode([pixels.buffer], width, height, options.pngColors));
  }
  let target = canvas;
  if (options.type === 'image/jpeg') {
    // JPG에는 투명이 없어 흰 바탕 위에 그린다 (그냥 저장하면 투명한 곳이 검게 된다)
    target = new OffscreenCanvas(width, height);
    const context = target.getContext('2d')!;
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, width, height);
    context.drawImage(canvas, 0, 0);
  }
  try {
    const blob = await target.convertToBlob({ type: options.type, quality: options.quality });
    // 저장하지 못하는 형식이면 브라우저가 말없이 PNG로 준다 (예: WebP를 못 쓰는 Safari)
    if (blob.type !== options.type) throw new Error('unsupported output');
    return new Uint8Array(await blob.arrayBuffer());
  } finally {
    if (target !== canvas) release(target);
  }
}

addEventListener('message', async (event: MessageEvent<ProcessRequest>) => {
  const { id, file, options } = event.data;
  const send = (response: ProcessResponse, transfer: Transferable[] = []) =>
    postMessage(response, { transfer });

  let bitmap: ImageBitmap;
  try {
    // 휴대폰 사진의 EXIF 방향을 적용해 바로 세운다
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    send({ id, kind: 'error', reason: 'decode' });
    return;
  }

  const width = Math.max(1, Math.round(options.size?.width ?? bitmap.width));
  const height = Math.max(1, Math.round(options.size?.height ?? bitmap.height));
  let canvas: OffscreenCanvas | undefined;
  try {
    canvas = scaleDown(bitmap, width, height);
    const bytes = await encode(canvas, options);
    send({ id, kind: 'done', bytes, width, height }, [bytes.buffer]);
  } catch {
    send({ id, kind: 'error', reason: 'encode' });
  } finally {
    bitmap.close();
    if (canvas) release(canvas);
  }
});
