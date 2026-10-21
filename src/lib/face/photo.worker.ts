/**
 * 증명사진의 사진 다루기 워커 (photo.ts가 부른다). 원본을 읽어 줄인 사본을 만들고, 결과 JPG를 그린다
 * (배경을 바꾸면 원본 크기에서 사람만 남겨 그 색 위에 그린다).
 * 사진은 메모리에서만 다룬다.
 */
import { cutout, exportJpeg, type Thumb } from './id-photo';
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
  const blob = await exportJpeg(original, request.placement, request.background);
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const response: PhotoResponse = { id: request.id, kind: 'exported', bytes };
  postMessage(response, { transfer: [bytes.buffer] });
}

function cutoutPhoto(request: Extract<PhotoRequest, { type: 'cutout' }>) {
  if (!original) throw new Error('no photo');
  const piece = cutout(original, request.matte, request.scale);
  const image = piece.image.transferToImageBitmap();
  const response: PhotoResponse = { id: request.id, kind: 'cutout', image, x: piece.x, y: piece.y };
  postMessage(response, { transfer: [image] });
}

async function handle(request: PhotoRequest) {
  try {
    if (request.type === 'open') await open(request);
    else if (request.type === 'cutout') cutoutPhoto(request);
    else await exportPhoto(request);
  } catch (error) {
    postMessage({
      id: request.id,
      kind: 'error',
      message: error instanceof Error ? error.message : String(error),
    } satisfies PhotoResponse);
  }
}

/**
 * 요청은 온 순서대로 하나씩 처리한다. 큰 사진을 여는 사이 작은 사진을 열면 작은 것이 먼저 끝나고 큰 것이
 * 원본을 덮어써, 그 뒤 저장이 화면에 없는 사진을 자르게 된다. 줄 세우면 마지막에 연 사진이 원본으로 남는다
 */
let queue: Promise<void> = Promise.resolve();
addEventListener('message', (event: MessageEvent<PhotoRequest>) => {
  queue = queue.then(() => handle(event.data));
});
