/**
 * 증명사진의 사진 다루기 워커 (photo.ts가 부른다). 원본을 읽어 줄인 사본을 만들고, 결과 JPG를 그린다.
 * 사진은 메모리에서만 다룬다.
 */
import { exportJpeg, type Thumb } from './id-photo';
import type { PhotoRequest, PhotoResponse } from './photo';

/** 마지막으로 연 원본 */
let original: ImageBitmap | undefined;

async function shrink(source: ImageBitmap, side: number) {
  const scale = Math.min(1, side / Math.max(source.width, source.height));
  const bitmap = await createImageBitmap(source, {
    resizeWidth: Math.max(1, Math.round(source.width * scale)),
    resizeHeight: Math.max(1, Math.round(source.height * scale)),
    resizeQuality: 'high',
  });
  return { bitmap, scale };
}

async function open(request: Extract<PhotoRequest, { type: 'open' }>) {
  original?.close();
  original = undefined;
  // 휴대폰 사진의 방향(EXIF)은 브라우저가 맞춰 읽는다
  const bitmap = await createImageBitmap(request.file);
  original = bitmap;
  const preview = (await shrink(bitmap, request.previewSide)).bitmap;
  const small = await shrink(bitmap, request.thumbSide);
  const canvas = new OffscreenCanvas(small.bitmap.width, small.bitmap.height);
  const context = canvas.getContext('2d', { willReadFrequently: true })!;
  context.drawImage(small.bitmap, 0, 0);
  small.bitmap.close();
  const thumb: Thumb = {
    data: context.getImageData(0, 0, canvas.width, canvas.height).data,
    width: canvas.width,
    height: canvas.height,
    scale: small.scale,
  };
  const response: PhotoResponse = {
    id: request.id,
    kind: 'opened',
    width: bitmap.width,
    height: bitmap.height,
    preview,
    thumb,
  };
  postMessage(response, { transfer: [preview, thumb.data.buffer] });
}

async function exportPhoto(request: Extract<PhotoRequest, { type: 'export' }>) {
  if (!original) throw new Error('no photo');
  const blob = await exportJpeg(original, request.placement);
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const response: PhotoResponse = { id: request.id, kind: 'exported', bytes };
  postMessage(response, { transfer: [bytes.buffer] });
}

addEventListener('message', async (event: MessageEvent<PhotoRequest>) => {
  const request = event.data;
  try {
    if (request.type === 'open') await open(request);
    else await exportPhoto(request);
  } catch (error) {
    postMessage({
      id: request.id,
      kind: 'error',
      message: error instanceof Error ? error.message : String(error),
    } satisfies PhotoResponse);
  }
});
