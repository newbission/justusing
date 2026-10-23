/**
 * 사진을 다시 그려 저장하는 워커들이 같이 쓰는 부분 (자르기·회전, 모자이크, 이어 붙이기).
 * 워커 안에서만 부른다 (OffscreenCanvas).
 */
import { PngStream } from './png-stream';
import type { OutputType } from './process';

export interface UprightImage {
  /** 바로 세운 원본 (워커가 들고 있다가 저장에 쓴다) */
  source: ImageBitmap;
  /** 긴 변을 previewSide 이하로 줄인 미리보기 (화면에 넘긴다) */
  preview: ImageBitmap;
}

/** 사진을 EXIF 방향대로 바로 세워 읽고 미리보기를 만든다. 읽지 못하면 예외 */
export async function openUpright(file: Blob, previewSide: number): Promise<UprightImage> {
  // 휴대폰 사진의 EXIF 방향을 적용해 바로 세운다
  const source = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const { width, height } = source;
  const scale = Math.min(1, previewSide / Math.max(width, height));
  try {
    const preview = await createImageBitmap(source, {
      resizeWidth: Math.max(1, Math.round(width * scale)),
      resizeHeight: Math.max(1, Math.round(height * scale)),
      resizeQuality: 'high',
    });
    return { source, preview };
  } catch (error) {
    source.close();
    throw error;
  }
}

/** canvas를 만들었는지 맨 끝 화소로 확인한다. 한계를 넘으면 오류 없이 아무것도 그리지 않는다 (Safari) */
export function usableContext(
  canvas: OffscreenCanvas,
): OffscreenCanvasRenderingContext2D | undefined {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return undefined;
  const x = canvas.width - 1;
  const y = canvas.height - 1;
  ctx.fillStyle = '#010203';
  ctx.fillRect(x, y, 1, 1);
  const probe = ctx.getImageData(x, y, 1, 1).data;
  return probe[0] === 1 && probe[1] === 2 && probe[2] === 3 ? ctx : undefined;
}

/** 한 번에 그려 읽는 화소 수 (줄 묶음 저장) */
const STRIP_PIXELS = 4_000_000;

/** 폭이 width인 결과를 줄 묶음으로 그릴 때 한 묶음의 줄 수 */
export function stripRows(width: number): number {
  return Math.max(1, Math.min(1024, Math.floor(STRIP_PIXELS / width)));
}

/** tooLarge: 이 브라우저가 그리지 못하는 크기, encode: 그 형식으로 저장하지 못함 */
export class SaveFailure extends Error {
  constructor(readonly reason: 'tooLarge' | 'encode') {
    super(reason);
  }
}

/** 결과의 [top, top + rows) 줄을 ctx(폭 = 결과 폭)에 그려 RGBA 화소로 돌려준다 */
export type StripPainter = (
  ctx: OffscreenCanvasRenderingContext2D,
  top: number,
  rows: number,
) => Uint8ClampedArray;

/** 저장할 결과를 그리는 방법 (canvas 하나에 한꺼번에, 또는 줄 묶음씩) */
export interface Drawing {
  width: number;
  height: number;
  /** 결과 전체를 ctx(결과 크기)에 그린다 */
  whole(ctx: OffscreenCanvasRenderingContext2D): void;
  /** 줄 묶음 저장을 준비하고 줄 묶음을 그리는 함수를 준다. 줄 묶음으로 저장할 때만 한 번 부른다 */
  strips(): StripPainter;
}

export interface SaveOptions {
  /** PNG 줄 묶음 저장에 투명도를 담는다 (아니면 RGB로 저장해 작아진다) */
  alpha?: boolean;
  /** canvas 하나에 그릴 수 있어도 PNG는 줄 묶음으로 저장한다 (직접 만든 PNG가 더 작을 때) */
  pngStrips?: boolean;
}

/**
 * 결과를 type으로 저장한다. canvas 하나에 그릴 수 있으면 브라우저 저장(convertToBlob)을 쓰고,
 * 못 그리면(아이폰은 약 1,670만 화소까지) PNG는 줄 묶음씩 그려 이어 쓴다. 그 밖의 형식은 SaveFailure('tooLarge')
 */
export async function saveDrawing(
  drawing: Drawing,
  type: OutputType,
  quality: number,
  { alpha = true, pngStrips = false }: SaveOptions = {},
): Promise<Uint8Array> {
  if (!(pngStrips && type === 'image/png')) {
    const saved = await saveWhole(drawing, type, quality);
    if (saved) return saved;
  }
  if (type !== 'image/png') throw new SaveFailure('tooLarge');
  const { width, height } = drawing;
  const rows = stripRows(width);
  const canvas = new OffscreenCanvas(width, Math.min(rows, height));
  try {
    const ctx = usableContext(canvas);
    if (!ctx) throw new SaveFailure('tooLarge');
    const draw = drawing.strips();
    const png = new PngStream(width, height, alpha);
    for (let top = 0; top < height; top += rows) {
      const count = Math.min(rows, height - top);
      await png.write(draw(ctx, top, count), count);
    }
    return await png.finish();
  } finally {
    canvas.width = 0;
    canvas.height = 0;
  }
}

/** canvas 하나에 그려 브라우저로 저장한다. 그 크기의 canvas를 만들 수 없으면 undefined */
async function saveWhole(
  drawing: Drawing,
  type: OutputType,
  quality: number,
): Promise<Uint8Array | undefined> {
  let canvas: OffscreenCanvas;
  try {
    canvas = new OffscreenCanvas(drawing.width, drawing.height);
  } catch {
    return undefined;
  }
  try {
    const ctx = usableContext(canvas);
    if (!ctx) return undefined;
    drawing.whole(ctx);
    let blob: Blob;
    try {
      blob = await canvas.convertToBlob({ type, quality });
    } catch {
      throw new SaveFailure('tooLarge');
    }
    // 저장하지 못하는 형식이면 브라우저가 몰래 PNG로 준다 (WebP를 못 쓰는 Safari)
    if (blob.type !== type) throw new SaveFailure('encode');
    return new Uint8Array(await blob.arrayBuffer());
  } finally {
    canvas.width = 0;
    canvas.height = 0;
  }
}
