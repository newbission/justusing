/**
 * 이미지 처리 워커 (process.ts가 여러 개를 띄워 동시에 쓴다).
 * 이미지를 바로 세워 읽고, 크기를 바꾸고, 원하는 형식으로 다시 저장한다. 파일은 메모리에서만 다룬다.
 * 다시 그려 저장하므로 EXIF(촬영 위치·기기 정보 등)는 결과에 남지 않는다.
 */
// UPNG.js가 워커에서 찾는 전역을 먼저 마련한다 (순서를 바꾸면 안 된다)
import './upng-globals';
import UPNG from 'upng-js';
import type { OutputType, OverReason, ProcessRequest, ProcessResponse } from './process';
import {
  KEEP_SIZE_FLOOR,
  MAX_ROUNDS,
  MIN_LONG_SIDE,
  PNG_COLORS_KEEP_SIZE,
  PNG_COLORS_RESIZE,
  REFERENCE_COLORS,
  REFERENCE_QUALITY,
  RESIZE_FLOOR,
  highestFitting,
  nextScale,
  qualitySteps,
} from './fit-size';

/**
 * 크게 줄일 때는 절반씩 나눠 줄인다. 한 번에 많이 줄이면 브라우저에 따라
 * 가는 선이 끊기고 자글자글해진다. 받은 그림(source)은 닫지 않는다 (용량 맞추기가 여러 크기로 다시 그린다)
 */
function scaleDown(source: ImageBitmap, width: number, height: number): OffscreenCanvas {
  let current: ImageBitmap | OffscreenCanvas = source;
  while (current.width / 2 >= width && current.height / 2 >= height) {
    const half: OffscreenCanvas = new OffscreenCanvas(
      Math.ceil(current.width / 2),
      Math.ceil(current.height / 2),
    );
    const context = half.getContext('2d')!;
    context.imageSmoothingQuality = 'high';
    context.drawImage(current, 0, 0, half.width, half.height);
    if (current !== source) release(current);
    current = half;
  }
  const canvas = new OffscreenCanvas(width, height);
  const context = canvas.getContext('2d')!;
  context.imageSmoothingQuality = 'high';
  context.drawImage(current, 0, 0, width, height);
  if (current !== source) release(current);
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

/** JPG에는 투명이 없어 흰 바탕 위에 그린다 (그냥 저장하면 투명한 곳이 검게 된다) */
function onWhite(canvas: OffscreenCanvas): OffscreenCanvas {
  const target = new OffscreenCanvas(canvas.width, canvas.height);
  const context = target.getContext('2d')!;
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, target.width, target.height);
  context.drawImage(canvas, 0, 0);
  return target;
}

/** 투명하거나 반투명한 화소가 있는지 */
function hasAlpha(canvas: OffscreenCanvas): boolean {
  const pixels = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height).data;
  for (let i = 3; i < pixels.length; i += 4) if (pixels[i]! < 255) return true;
  return false;
}

/** 그대로 저장한다. JPG는 이미 흰 바탕 위에 그린 canvas를 받는다 */
async function save(
  canvas: OffscreenCanvas,
  type: OutputType,
  quality: number,
  pngColors: number,
): Promise<Uint8Array> {
  const { width, height } = canvas;
  if (type === 'image/png' && pngColors > 0) {
    // 브라우저의 PNG 저장은 색을 줄이지 못해 UPNG로 저장한다.
    // 색을 줄이지 않을 때는 브라우저가 더 빨라서 아래에서 브라우저로 저장한다
    const pixels = canvas.getContext('2d')!.getImageData(0, 0, width, height).data;
    return new Uint8Array(UPNG.encode([pixels.buffer], width, height, pngColors));
  }
  const blob = await canvas.convertToBlob({ type, quality });
  // 저장하지 못하는 형식이면 브라우저가 말없이 PNG로 준다 (예: WebP를 못 쓰는 Safari)
  if (blob.type !== type) throw new Error('unsupported output');
  return new Uint8Array(await blob.arrayBuffer());
}

async function encode(
  canvas: OffscreenCanvas,
  options: ProcessRequest['options'],
): Promise<Uint8Array> {
  if (options.type !== 'image/jpeg') {
    return save(canvas, options.type, options.quality, options.pngColors);
  }
  const target = onWhite(canvas);
  try {
    return await save(target, options.type, options.quality, 0);
  } finally {
    release(target);
  }
}

type FitResponse =
  | {
      kind: 'done';
      bytes: Uint8Array;
      width: number;
      height: number;
      quality?: number;
      colors?: number;
      flattened: boolean;
    }
  | { kind: 'over'; smallest: number; reason: OverReason };

/**
 * limit 바이트 이하가 되게 화질(PNG는 색 수)을 낮추고, 그래도 크면 resize일 때 가로·세로를 줄인다 (fit-size.ts).
 * 크기마다 한 번 그리고, 그 그림으로 화질만 바꿔 여러 번 저장해 본다.
 */
async function fit(
  bitmap: ImageBitmap,
  type: OutputType,
  limit: { bytes: number; resize: boolean },
  /** 원본에 투명이 있을 수 있다 (JPG가 아닌 원본). JPG로 저장하면 흰색이 되는지 알려 준다 */
  mayHaveAlpha: boolean,
): Promise<FitResponse> {
  const png = type === 'image/png';
  const steps: readonly number[] = png
    ? limit.resize
      ? PNG_COLORS_RESIZE
      : PNG_COLORS_KEEP_SIZE
    : qualitySteps(limit.resize ? RESIZE_FLOOR : KEEP_SIZE_FLOOR);
  const reference = png ? REFERENCE_COLORS : REFERENCE_QUALITY;
  let scale = 1;
  let flattened = false;
  let smallest = Infinity;
  for (let round = 0; round < MAX_ROUNDS; round++) {
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const drawn = scaleDown(bitmap, width, height);
    if (round === 0 && type === 'image/jpeg' && mayHaveAlpha) flattened = hasAlpha(drawn);
    const canvas = type === 'image/jpeg' ? onWhite(drawn) : drawn;
    if (canvas !== drawn) release(drawn);
    try {
      const encode = (step: number) =>
        png ? save(canvas, type, 0, step) : save(canvas, type, step, 0);
      const found = await highestFitting(steps, limit.bytes, encode);
      if (found.fits) {
        const done = { kind: 'done', bytes: found.bytes, width, height, flattened } as const;
        return png ? { ...done, colors: found.step } : { ...done, quality: found.step };
      }
      smallest = Math.min(smallest, found.smallest);
      if (!limit.resize) return { kind: 'over', smallest, reason: 'keep-size' };
      // 어림 화질로 저장한 용량에서 다음 크기를 정한다 (줄인 크기에서 그 화질 안팎으로 맞는다)
      const referenceBytes = (await encode(reference)).length;
      const next = nextScale(scale, referenceBytes, limit.bytes);
      if (Math.max(bitmap.width, bitmap.height) * next < MIN_LONG_SIDE) {
        return { kind: 'over', smallest, reason: 'too-small' };
      }
      scale = next;
    } finally {
      release(canvas);
    }
  }
  return { kind: 'over', smallest, reason: 'too-small' };
}

addEventListener('message', async (event: MessageEvent<ProcessRequest>) => {
  const { id, file, options } = event.data;
  const send = (response: ProcessResponse, transfer: Transferable[] = []) =>
    postMessage(response, { transfer });

  let bitmap: ImageBitmap;
  try {
    // 휴대폰 사진의 EXIF 방향을 적용해 바로 세운다 (libheif로 푼 HEIC는 이미 바로 선 그림으로 온다)
    bitmap =
      file instanceof ImageBitmap
        ? file
        : await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    send({ id, kind: 'error', reason: 'decode' });
    return;
  }

  if (options.limit) {
    try {
      const result = await fit(bitmap, options.type, options.limit, file.type !== 'image/jpeg');
      if (result.kind === 'done') send({ id, ...result }, [result.bytes.buffer]);
      else send({ id, ...result });
    } catch {
      send({ id, kind: 'error', reason: 'encode' });
    } finally {
      bitmap.close();
    }
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
