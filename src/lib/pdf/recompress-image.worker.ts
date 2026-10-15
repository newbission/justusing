/**
 * 사진 다시 저장 워커 (compress.ts가 여러 개를 띄워 동시에 쓴다).
 * PDF 안의 사진 하나를 읽어 크기를 줄이고 JPG로 다시 저장한다. 원본보다 충분히 작아지지 않으면 건너뛴다.
 * 파일은 메모리에서만 다룬다.
 */
import type { ImageRequest, ImageResponse, SourceImage } from './compress';

/** 사진을 원본보다 이만큼 이상 작게 만들었을 때만 바꾼다 (화질만 잃고 용량은 그대로인 일을 막음) */
const MIN_SAVING = 0.9;

async function inflate(bytes: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([bytes as BlobPart])
    .stream()
    .pipeThrough(new DecompressionStream('deflate'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

function paeth(a: number, b: number, c: number): number {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
}

/** PNG 예측(줄마다 앞에 붙은 필터 종류)을 풀어 화소만 남긴다 */
function unpredict(data: Uint8Array, width: number, height: number, colors: number): Uint8Array {
  const row = width * colors;
  const out = new Uint8Array(row * height);
  for (let y = 0; y < height; y++) {
    const filter = data[y * (row + 1)];
    const src = y * (row + 1) + 1;
    const dst = y * row;
    for (let x = 0; x < row; x++) {
      const raw = data[src + x]!;
      const left = x >= colors ? out[dst + x - colors]! : 0;
      const up = y > 0 ? out[dst - row + x]! : 0;
      const upLeft = y > 0 && x >= colors ? out[dst - row + x - colors]! : 0;
      const predicted =
        filter === 1
          ? left
          : filter === 2
            ? up
            : filter === 3
              ? (left + up) >> 1
              : filter === 4
                ? paeth(left, up, upLeft)
                : 0;
      out[dst + x] = (raw + predicted) & 0xff;
    }
  }
  return out;
}

/** 사진을 그릴 수 있는 모양으로 연다 */
async function open(image: SourceImage): Promise<ImageBitmap | ImageData> {
  if (image.kind === 'jpeg') {
    return createImageBitmap(new Blob([image.bytes as BlobPart], { type: 'image/jpeg' }));
  }
  const { width, height, colors } = image;
  let data = image.deflated ? await inflate(image.bytes) : image.bytes;
  if (image.predictor >= 10) data = unpredict(data, width, height, colors);
  if (data.length < width * height * colors) throw new Error('short image data');
  const rgba = new Uint8ClampedArray(width * height * 4);
  for (let i = 0, j = 0; i < width * height; i++, j += colors) {
    rgba[i * 4] = data[j]!;
    rgba[i * 4 + 1] = data[colors === 3 ? j + 1 : j]!;
    rgba[i * 4 + 2] = data[colors === 3 ? j + 2 : j]!;
    rgba[i * 4 + 3] = 255;
  }
  return new ImageData(rgba, width, height);
}

addEventListener('message', async (event: MessageEvent<ImageRequest>) => {
  const { id, image, quality, maxSide } = event.data;
  const send = (response: ImageResponse, transfer: Transferable[] = []) =>
    postMessage(response, { transfer });
  let canvas: OffscreenCanvas | undefined;
  try {
    const source = await open(image);
    const scale = Math.min(1, maxSide / Math.max(source.width, source.height));
    const width = Math.max(1, Math.round(source.width * scale));
    const height = Math.max(1, Math.round(source.height * scale));
    canvas = new OffscreenCanvas(width, height);
    const context = canvas.getContext('2d')!;
    if (source instanceof ImageData) {
      if (scale === 1) context.putImageData(source, 0, 0);
      else {
        const bitmap = await createImageBitmap(source);
        context.imageSmoothingQuality = 'high';
        context.drawImage(bitmap, 0, 0, width, height);
        bitmap.close();
      }
    } else {
      context.imageSmoothingQuality = 'high';
      context.drawImage(source, 0, 0, width, height);
      source.close();
    }
    const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality });
    if (blob.size >= image.bytes.length * MIN_SAVING) {
      send({ id, kind: 'skip' });
      return;
    }
    const bytes = new Uint8Array(await blob.arrayBuffer());
    send({ id, kind: 'done', bytes, width, height }, [bytes.buffer]);
  } catch {
    // 브라우저가 읽지 못하는 사진(손상, 드문 형식)은 원본 그대로 둔다
    send({ id, kind: 'skip' });
  } finally {
    if (canvas) {
      canvas.width = 0;
      canvas.height = 0;
    }
  }
});
