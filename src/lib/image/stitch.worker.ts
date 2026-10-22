/**
 * 이어 붙이기 워커 (stitch.ts가 부른다). 사진은 메모리에서만 다룬다.
 *
 * - 겹친 부분 찾기: 사진을 바로 세워 줄 묶음씩 읽어 줄 모양을 만들고(사진마다 한 번, key로 보관) 두 장을 비교한다
 * - 잇기: 결과를 위에서부터 줄 묶음씩 그린다. PNG는 묶음마다 이어 써서 결과 크기에 한계가 없고,
 *   JPG·WebP는 브라우저 저장을 써야 해서 결과(나누면 한 장)를 canvas 하나에 그린다
 * - 나누기: 정한 높이를 넘지 않게 자르되, 그 앞 4분의 1 안에서 한 색으로 된 줄(글 줄 사이)을 찾아 자른다
 */
import { PngStream } from './png-stream';
import { SignatureBuilder, detectSeam, type RowSignature } from './stitch-detect';
import { STITCH_TYPES, type StitchJob, type StitchRequest, type StitchResponse } from './stitch';

/** 한 번에 그려 읽는 화소 수 (줄 묶음 높이를 정한다) */
const STRIP_PIXELS = 4_000_000;
/** 한 색 줄로 보는 화소 차이 */
const BLANK_TOLERANCE = 6;

const signatures = new Map<number, RowSignature>();

class Failure extends Error {
  constructor(readonly reason: 'decode' | 'tooLarge' | 'encode') {
    super(reason);
  }
}

async function decode(file: Blob): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    throw new Failure('decode');
  }
}

function stripRows(width: number): number {
  return Math.max(1, Math.min(1024, Math.floor(STRIP_PIXELS / width)));
}

function context(canvas: OffscreenCanvas): OffscreenCanvasRenderingContext2D {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Failure('tooLarge');
  return ctx;
}

async function signatureOf(key: number, file: Blob): Promise<RowSignature> {
  const cached = signatures.get(key);
  if (cached) return cached;
  const bitmap = await decode(file);
  try {
    const { width, height } = bitmap;
    const builder = new SignatureBuilder(width, height);
    const rows = stripRows(width);
    const canvas = new OffscreenCanvas(width, rows);
    const ctx = context(canvas);
    for (let y = 0; y < height; y += rows) {
      const count = Math.min(rows, height - y);
      ctx.clearRect(0, 0, width, rows);
      ctx.drawImage(bitmap, 0, -y);
      builder.add(ctx.getImageData(0, 0, width, count).data, count);
    }
    signatures.set(key, builder.signature);
    return builder.signature;
  } finally {
    bitmap.close();
  }
}

/** 이을 사진들을 결과의 [y, y + rows) 줄에 그린다 */
function drawRows(
  ctx: OffscreenCanvasRenderingContext2D,
  job: StitchJob,
  bitmaps: ImageBitmap[],
  y: number,
  rows: number,
) {
  const { width } = job.layout;
  ctx.clearRect(0, 0, width, rows);
  if (job.background !== 'transparent') {
    ctx.fillStyle = job.background === 'black' ? '#000' : '#fff';
    ctx.fillRect(0, 0, width, rows);
  }
  ctx.imageSmoothingQuality = 'high';
  for (const piece of job.layout.pieces) {
    if (piece.dy >= y + rows || piece.dy + piece.dh <= y) continue;
    ctx.drawImage(
      bitmaps[piece.index]!,
      piece.sx,
      piece.sy,
      piece.sw,
      piece.sh,
      piece.dx,
      piece.dy - y,
      piece.dw,
      piece.dh,
    );
  }
}

/**
 * [from, to) 줄 가운데 아래에서부터 처음 만나는 한 색 줄. 없으면 undefined.
 * 줄 묶음씩 아래에서부터 그려 본다 (넓은 결과에서 탐색 canvas가 브라우저 면적 한계를 넘지 않게)
 */
function blankRow(job: StitchJob, bitmaps: ImageBitmap[], from: number, to: number) {
  const { width } = job.layout;
  const strip = stripRows(width);
  const ctx = context(new OffscreenCanvas(width, Math.min(strip, to - from)));
  for (let end = to; end > from; end -= strip) {
    const start = Math.max(from, end - strip);
    const rows = end - start;
    drawRows(ctx, job, bitmaps, start, rows);
    const data = ctx.getImageData(0, 0, width, rows).data;
    for (let r = rows - 1; r >= 0; r--) {
      const at = r * width * 4;
      let blank = true;
      for (let i = at + 4; i < at + width * 4 && blank; i++) {
        if (Math.abs(data[i]! - data[at + (i % 4)]!) > BLANK_TOLERANCE) blank = false;
      }
      if (blank) return start + r;
    }
  }
  return undefined;
}

/** 나눌 곳 (각 장의 시작 줄, 첫 장 0 포함) */
function cuts(job: StitchJob, bitmaps: ImageBitmap[]): number[] {
  const { height } = job.layout;
  const chunk = job.chunk;
  const starts = [0];
  if (!chunk) return starts;
  let y = 0;
  while (height - y > chunk) {
    const target = y + chunk;
    const search = Math.max(1, Math.floor(chunk / 4));
    y = blankRow(job, bitmaps, target - search, target) ?? target;
    starts.push(y);
  }
  return starts;
}

/** 결과의 [y, y + rows) 줄을 한 파일로 저장한다 */
async function encode(
  job: StitchJob,
  bitmaps: ImageBitmap[],
  y: number,
  rows: number,
): Promise<Uint8Array> {
  const { width } = job.layout;
  if (job.format === 'png') {
    const png = new PngStream(width, rows, job.background === 'transparent');
    const strip = stripRows(width);
    const ctx = context(new OffscreenCanvas(width, Math.min(strip, rows)));
    for (let at = 0; at < rows; at += strip) {
      const count = Math.min(strip, rows - at);
      drawRows(ctx, job, bitmaps, y + at, count);
      await png.write(ctx.getImageData(0, 0, width, count).data, count);
    }
    return png.finish();
  }

  const canvas = new OffscreenCanvas(width, rows);
  const ctx = context(canvas);
  // 브라우저 한계를 넘는 canvas는 오류 없이 아무것도 그리지 않는다 (Safari). 맨 끝 화소로 확인한다
  ctx.fillStyle = '#010203';
  ctx.fillRect(width - 1, rows - 1, 1, 1);
  const probe = ctx.getImageData(width - 1, rows - 1, 1, 1).data;
  if (probe[0] !== 1 || probe[1] !== 2 || probe[2] !== 3) throw new Failure('tooLarge');
  drawRows(ctx, job, bitmaps, y, rows);
  const type = STITCH_TYPES[job.format];
  let blob: Blob;
  try {
    blob = await canvas.convertToBlob({ type, quality: job.quality });
  } catch {
    throw new Failure('tooLarge');
  }
  // 저장하지 못하는 형식이면 브라우저가 몰래 PNG로 준다 (WebP를 못 쓰는 Safari)
  if (blob.type !== type) throw new Failure('encode');
  return new Uint8Array(await blob.arrayBuffer());
}

async function stitch(job: StitchJob): Promise<Uint8Array[]> {
  const bitmaps: ImageBitmap[] = [];
  try {
    for (const file of job.files) bitmaps.push(await decode(file));
    const starts = cuts(job, bitmaps);
    const parts: Uint8Array[] = [];
    for (const [i, start] of starts.entries()) {
      const end = starts[i + 1] ?? job.layout.height;
      parts.push(await encode(job, bitmaps, start, end - start));
    }
    return parts;
  } finally {
    for (const bitmap of bitmaps) bitmap.close();
  }
}

addEventListener('message', async (event: MessageEvent<StitchRequest>) => {
  const request = event.data;
  const send = (response: StitchResponse, transfer: Transferable[] = []) =>
    postMessage(response, { transfer });
  try {
    if (request.kind === 'seam') {
      const a = await signatureOf(request.a.key, request.a.file);
      const b = await signatureOf(request.b.key, request.b.file);
      send({ id: request.id, kind: 'seam', seam: detectSeam(a, b) });
    } else if (request.kind === 'forget') {
      for (const key of request.keys) signatures.delete(key);
      send({ id: request.id, kind: 'forget' });
    } else {
      const parts = await stitch(request.job);
      send(
        { id: request.id, kind: 'stitch', parts },
        parts.map((part) => part.buffer),
      );
    }
  } catch (error) {
    send({
      id: request.id,
      kind: 'error',
      reason: error instanceof Failure ? error.reason : 'tooLarge',
    });
  }
});
