/**
 * 이미지 모자이크 워커 (mosaic.ts가 부른다). 사진은 메모리에서만 다룬다.
 *
 * 연 사진의 원본을 들고 있다가 저장할 때 원본 크기로 다시 그리고, 가릴 곳을 순서대로 고친다
 * (겹치면 뒤의 것이 앞의 결과 위에 걸린다). 결과를 canvas 하나에 그리지 못하는 크기면
 * (아이폰은 약 1,670만 화소까지) PNG는 줄 묶음씩 그려 이어 쓰고, JPG·WebP는 실패로 알린다.
 * 다시 그려 저장하므로 EXIF(촬영 위치·기기 정보 등)는 결과에 남지 않는다.
 *
 * 화면 미리보기도 여기서 그린다. 큰 곳을 흐리면 한 번에 1초가 넘게 걸려, 화면 스레드에서 하면 끄는 동안 멈춘다.
 * 줄인 사진을 따로 들고 있다가 같은 계산(paint)을 줄인 만큼 작게 걸어 그림으로 돌려준다.
 */
import type { Rect } from './crop-geometry';
import type { MosaicFailure, MosaicRequest, MosaicResponse } from './mosaic';
import { amountOf, boundsOf, inside, paint, type Pixels, type Region } from './mosaic-effects';
import { PngStream } from './png-stream';
import type { OutputType } from './process';
import { openUpright, usableContext, type UprightImage } from './worker-canvas';

/** 한 번에 그려 읽는 화소 수 (PNG를 줄 묶음씩 쓸 때) */
const STRIP_PIXELS = 4_000_000;

let source: ImageBitmap | undefined;
/** 화면에 넘긴 것과 같은 미리보기 사진 (미리보기를 그릴 때 바탕) */
let previewBase: ImageBitmap | undefined;
/** 미리보기를 그리는 canvas (크기가 같으면 다시 쓴다) */
let previewCanvas: OffscreenCanvas | undefined;

class Failure extends Error {
  constructor(readonly reason: MosaicFailure) {
    super(reason);
  }
}

async function open(file: Blob, previewSide: number) {
  source?.close();
  source = undefined;
  previewBase?.close();
  previewBase = undefined;
  let opened: UprightImage;
  try {
    opened = await openUpright(file, previewSide);
  } catch {
    throw new Failure('decode');
  }
  source = opened.source;
  // 화면에 넘기는 미리보기는 옮겨지므로(transfer) 미리보기를 그릴 바탕을 하나 더 둔다
  previewBase = await createImageBitmap(opened.preview);
  return { width: source.width, height: source.height, preview: opened.preview };
}

/** 미리보기 사진에 가릴 곳을 걸어 그림으로 돌려준다 (자리·칸 크기는 줄인 만큼 작게) */
function renderPreview(regions: Region[]): ImageBitmap {
  if (!source || !previewBase) throw new Failure('decode');
  const { width, height } = previewBase;
  if (previewCanvas?.width !== width || previewCanvas.height !== height) {
    previewCanvas = new OffscreenCanvas(width, height);
  }
  const ctx = previewCanvas.getContext('2d', { willReadFrequently: true })!;
  ctx.clearRect(0, 0, width, height);
  ctx.drawImage(previewBase, 0, 0);
  const scale = width / source.width;
  const size = { x: 0, y: 0, width, height };
  for (const region of regions) applyRegion(ctx, region, size, scale);
  return previewCanvas.transferToImageBitmap();
}

/**
 * 가릴 곳 하나를 canvas에 건다 (그 자리의 화소만 읽어 고쳐 다시 쓴다).
 * scale은 canvas가 원본보다 줄어든 비율 (저장은 1, 미리보기는 미리보기 폭 / 원본 폭)
 */
function applyRegion(
  ctx: OffscreenCanvasRenderingContext2D,
  region: Region,
  size: Rect,
  scale = 1,
) {
  const area = {
    x: region.x * scale,
    y: region.y * scale,
    width: region.width * scale,
    height: region.height * scale,
  };
  const box = boundsOf(area, size.width, size.height);
  if (box.width === 0 || box.height === 0) return;
  const pixels = ctx.getImageData(box.x, box.y, box.width, box.height);
  paint(pixels, shift(area, box), region.shape, region.effect, amountOf(region) * scale);
  ctx.putImageData(pixels, box.x, box.y);
}

/** 사진 기준 자리를 box 기준 자리로 */
function shift(area: Rect, box: Rect): Rect {
  return { x: area.x - box.x, y: area.y - box.y, width: area.width, height: area.height };
}

/** 고친 가릴 곳 하나 (줄 묶음으로 저장할 때) */
interface Painted {
  region: Region;
  box: Rect;
  pixels: Pixels;
}

/** target(사진의 targetBox 자리)에 고친 가릴 곳의 화소를 가릴 곳 안만 옮긴다 */
function overlay(target: Pixels, targetBox: Rect, painted: Painted) {
  const { region, box, pixels } = painted;
  const x0 = Math.max(targetBox.x, box.x);
  const x1 = Math.min(targetBox.x + targetBox.width, box.x + box.width);
  const y0 = Math.max(targetBox.y, box.y);
  const y1 = Math.min(targetBox.y + targetBox.height, box.y + box.height);
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      if (!inside(region, region.shape, x, y)) continue;
      const from = ((y - box.y) * box.width + (x - box.x)) * 4;
      const to = ((y - targetBox.y) * targetBox.width + (x - targetBox.x)) * 4;
      target.data[to] = pixels.data[from]!;
      target.data[to + 1] = pixels.data[from + 1]!;
      target.data[to + 2] = pixels.data[from + 2]!;
      target.data[to + 3] = pixels.data[from + 3]!;
    }
  }
}

/**
 * canvas 하나에 그리지 못하는 PNG: 가릴 곳마다 먼저 고쳐 두고(앞의 가릴 곳 결과를 겹친 곳에 반영해
 * 한 번에 그릴 때와 같게), 사진을 줄 묶음씩 그려 고친 화소를 덮어 이어 쓴다
 */
async function pngInStrips(image: ImageBitmap, regions: Region[]): Promise<Uint8Array> {
  const { width, height } = image;
  const painted: Painted[] = [];
  for (const region of regions) {
    const box = boundsOf(region, width, height);
    if (box.width === 0 || box.height === 0) continue;
    const canvas = new OffscreenCanvas(box.width, box.height);
    const ctx = usableContext(canvas);
    if (!ctx) throw new Failure('tooLarge');
    ctx.clearRect(0, 0, box.width, box.height);
    ctx.drawImage(image, -box.x, -box.y);
    const pixels = ctx.getImageData(0, 0, box.width, box.height);
    canvas.width = 0;
    canvas.height = 0;
    for (const earlier of painted) overlay(pixels, box, earlier);
    paint(pixels, shift(region, box), region.shape, region.effect, amountOf(region));
    painted.push({ region, box, pixels });
  }

  const rows = Math.max(1, Math.min(1024, Math.floor(STRIP_PIXELS / width)));
  const ctx = usableContext(new OffscreenCanvas(width, Math.min(rows, height)));
  if (!ctx) throw new Failure('tooLarge');
  const png = new PngStream(width, height, true);
  for (let top = 0; top < height; top += rows) {
    const count = Math.min(rows, height - top);
    ctx.clearRect(0, 0, width, count);
    ctx.drawImage(image, 0, -top);
    const strip = ctx.getImageData(0, 0, width, count);
    const stripBox = { x: 0, y: top, width, height: count };
    for (const done of painted) overlay(strip, stripBox, done);
    await png.write(strip.data, count);
  }
  return png.finish();
}

async function save(regions: Region[], type: OutputType, quality: number) {
  // 워커가 죽었다 살아났으면 원본이 없다 (화면은 사진을 다시 열게 한다)
  if (!source) throw new Failure('decode');
  const size = { x: 0, y: 0, width: source.width, height: source.height };
  const canvas = new OffscreenCanvas(size.width, size.height);
  const ctx = usableContext(canvas);
  if (!ctx) {
    canvas.width = 0;
    canvas.height = 0;
    if (type === 'image/png') return pngInStrips(source, regions);
    throw new Failure('tooLarge');
  }
  try {
    ctx.clearRect(0, 0, size.width, size.height);
    if (type === 'image/jpeg') {
      // JPG에는 투명이 없어 흰 바탕 위에 그린다 (그냥 저장하면 투명한 곳이 검게 된다)
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, size.width, size.height);
    }
    ctx.drawImage(source, 0, 0);
    for (const region of regions) applyRegion(ctx, region, size);
    let blob: Blob;
    try {
      blob = await canvas.convertToBlob({ type, quality });
    } catch {
      throw new Failure('tooLarge');
    }
    // 저장하지 못하는 형식이면 브라우저가 몰래 PNG로 준다 (WebP를 못 쓰는 Safari)
    if (blob.type !== type) throw new Failure('encode');
    return new Uint8Array(await blob.arrayBuffer());
  } finally {
    canvas.width = 0;
    canvas.height = 0;
  }
}

/**
 * 요청은 온 순서대로 하나씩 처리한다. 큰 사진 A를 여는 사이 B를 열면 B가 먼저 끝나고
 * 늦게 끝난 A가 원본을 덮어써, 화면은 B인데 A를 저장하게 된다
 */
let queue: Promise<void> = Promise.resolve();

addEventListener('message', (event: MessageEvent<MosaicRequest>) => {
  queue = queue.then(() => handle(event.data)).catch(() => undefined);
});

async function handle(request: MosaicRequest) {
  const send = (response: MosaicResponse, transfer: Transferable[] = []) =>
    postMessage(response, { transfer });
  try {
    if (request.kind === 'open') {
      const opened = await open(request.file, request.previewSide);
      send({ id: request.id, kind: 'opened', ...opened }, [opened.preview]);
    } else if (request.kind === 'preview') {
      const image = renderPreview(request.regions);
      send({ id: request.id, kind: 'previewed', image }, [image]);
    } else {
      const bytes = await save(request.regions, request.type, request.quality);
      send({ id: request.id, kind: 'exported', bytes }, [bytes.buffer]);
    }
  } catch (error) {
    send({
      id: request.id,
      kind: 'error',
      reason:
        error instanceof Failure ? error.reason : request.kind === 'open' ? 'decode' : 'tooLarge',
    });
  }
}
