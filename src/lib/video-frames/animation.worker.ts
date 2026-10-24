/**
 * 움직이는 그림 워커 (동영상을 GIF로). 화면이 뽑아 보낸 장면 화소를 GIF(gifenc) 또는 움직이는 WebP로 묶는다.
 * 장면은 받는 대로 바로 저장하고 버린다 (모든 장면을 메모리에 쌓지 않는다). 파일은 어디로도 보내지 않는다.
 */
import type { AnimationRequest, AnimationResponse, EncodeSettings } from './animation';
import { GifWriter } from './gif-writer';
import { Indexer, buildPalette } from './palette';
import { FRAME_OVERHEAD, muxAnimation, readStill, type WebpStill } from './webp-anim';

class EncodeFailure extends Error {}

interface GifSession {
  format: 'gif';
  writer: GifWriter;
  indexer: Indexer;
  width: number;
  height: number;
}

interface WebpSession {
  format: 'webp';
  frames: { still: WebpStill; duration: number }[];
  settings: EncodeSettings;
}

let session: GifSession | WebpSession | undefined;

/** 장면 하나를 WebP 한 장으로 저장해 그림 조각을 꺼낸다 */
async function webpStill(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  quality: number,
): Promise<WebpStill> {
  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new EncodeFailure('canvas');
  ctx.putImageData(new ImageData(pixels as Uint8ClampedArray<ArrayBuffer>, width, height), 0, 0);
  const blob = await canvas.convertToBlob({ type: 'image/webp', quality });
  // 저장하지 못하는 형식이면 브라우저가 몰래 PNG로 준다 (Safari)
  if (blob.type !== 'image/webp') throw new EncodeFailure('webp');
  return readStill(new Uint8Array(await blob.arrayBuffer()));
}

/**
 * 화면이 담아 보낸 장면(이미 결과 크기로 줄인 ImageBitmap)의 RGBA 화소. 화소 읽기를 여기서 해
 * 큰 동영상에서도 화면 스레드가 멈추지 않는다
 */
function pixelsOf(bitmap: ImageBitmap, width: number, height: number): Uint8ClampedArray {
  const canvas = new OffscreenCanvas(width, height);
  try {
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw new EncodeFailure('canvas');
    ctx.drawImage(bitmap, 0, 0, width, height);
    return ctx.getImageData(0, 0, width, height).data;
  } finally {
    bitmap.close();
    canvas.width = 0;
    canvas.height = 0;
  }
}

function startGif(settings: EncodeSettings, samples: Uint8ClampedArray[]): GifSession {
  // 투명 자리 하나를 남긴다 (gif-writer.ts)
  const palette = buildPalette(samples, Math.min(255, settings.colors));
  return {
    format: 'gif',
    writer: new GifWriter(settings.width, settings.height, palette, settings.loop),
    indexer: new Indexer(palette, settings.dither),
    width: settings.width,
    height: settings.height,
  };
}

/**
 * 용량 예상. 이어진 두 장면 묶음(pairs)을 실제로 저장해 본다: 첫 장면은 통째로, 둘째 장면은 바뀐 곳만 들어가므로
 * 예상 = 첫 장면 + (장면 수 - 1) × 바뀐 장면 평균. WebP는 장면마다 통째로 들어간다
 */
async function estimate(
  settings: EncodeSettings,
  bitmaps: ImageBitmap[],
  framePairs: [ImageBitmap, ImageBitmap][],
  count: number,
): Promise<number> {
  const { width, height } = settings;
  const samples = bitmaps.map((bitmap) => pixelsOf(bitmap, width, height));
  const pairs = framePairs.map(
    ([a, b]) => [pixelsOf(a, width, height), pixelsOf(b, width, height)] as const,
  );
  if (settings.format === 'webp') {
    let total = 0;
    let stills = 0;
    for (const pixels of pairs.flat()) {
      const still = await webpStill(pixels, width, height, settings.quality);
      total += still.chunks.reduce((sum, chunk) => sum + chunk.length, 0) + FRAME_OVERHEAD;
      stills++;
    }
    return Math.round(40 + (total / Math.max(1, stills)) * count);
  }
  let first = 0;
  let change = 0;
  for (const [a, b] of pairs) {
    const gif = startGif(settings, samples);
    gif.writer.add(gif.indexer.map(a, width, height), 100);
    const one = gif.writer.size;
    gif.writer.add(gif.indexer.map(b, width, height), 100);
    first += one;
    change += gif.writer.size - one;
  }
  const n = Math.max(1, pairs.length);
  return Math.round(first / n + (Math.max(0, count - 1) * change) / n + 1);
}

async function handle(request: AnimationRequest): Promise<AnimationResponse> {
  const { id } = request;
  switch (request.kind) {
    case 'start': {
      const { settings } = request;
      const samples = request.samples.map((bitmap) =>
        pixelsOf(bitmap, settings.width, settings.height),
      );
      session =
        settings.format === 'gif'
          ? startGif(settings, samples)
          : { format: 'webp', frames: [], settings };
      return { id, kind: 'ok' };
    }
    case 'frame': {
      if (!session) {
        request.frame.close();
        throw new EncodeFailure('session');
      }
      if (session.format === 'gif') {
        const { writer, indexer, width, height } = session;
        writer.add(
          indexer.map(pixelsOf(request.frame, width, height), width, height),
          request.delay,
        );
      } else {
        const { width, height, quality } = session.settings;
        session.frames.push({
          still: await webpStill(pixelsOf(request.frame, width, height), width, height, quality),
          duration: request.delay,
        });
      }
      return { id, kind: 'ok' };
    }
    case 'finish': {
      if (!session) throw new EncodeFailure('session');
      const done = session;
      session = undefined;
      const bytes =
        done.format === 'gif'
          ? done.writer.finish()
          : muxAnimation(
              done.frames,
              done.settings.width,
              done.settings.height,
              done.settings.loop,
            );
      return { id, kind: 'done', bytes };
    }
    case 'cancel':
      session = undefined;
      return { id, kind: 'ok' };
    case 'estimate':
      return {
        id,
        kind: 'estimated',
        bytes: await estimate(request.settings, request.samples, request.pairs, request.count),
      };
  }
}

/** WebP 저장은 비동기라 요청을 받은 순서대로 하나씩 처리한다 */
let queue: Promise<unknown> = Promise.resolve();

addEventListener('message', (event: MessageEvent<AnimationRequest>) => {
  const request = event.data;
  queue = queue.then(async () => {
    let response: AnimationResponse;
    try {
      response = await handle(request);
    } catch (error) {
      if (request.kind === 'frame' || request.kind === 'finish') session = undefined;
      response = {
        id: request.id,
        kind: 'error',
        reason: error instanceof EncodeFailure && error.message === 'webp' ? 'webp' : 'encode',
      };
    }
    const transfer = response.kind === 'done' ? [response.bytes.buffer as ArrayBuffer] : [];
    postMessage(response, { transfer });
  });
});
