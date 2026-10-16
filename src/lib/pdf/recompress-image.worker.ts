/**
 * 사진 다시 저장 워커 (compress.ts가 여러 개를 띄워 동시에 쓴다).
 * PDF 안의 사진 하나를 읽어 크기를 줄이고 JPG로 다시 저장한다. 원본보다 충분히 작아지지 않으면 건너뛴다.
 * 파일은 메모리에서만 다룬다.
 */
import type { ImageRequest, ImageResponse, SourceImage } from './compress';
import { inflate, unpredict } from './image-pixels';

/** 사진을 원본보다 이만큼 이상 작게 만들었을 때만 바꾼다 (화질만 잃고 용량은 그대로인 일을 막음) */
const MIN_SAVING = 0.9;

/** 사진을 그릴 수 있는 모양으로 연다 */
async function open(image: SourceImage): Promise<ImageBitmap | ImageData> {
  if (image.kind === 'jpeg') {
    // 화소 값을 그대로 읽는다. 색공간은 PDF가 정하므로 JPG 안의 ICC로 바꾸지 않고,
    // 방향도 PDF 쪽이 정하므로 JPG 안의 EXIF 방향으로 돌리지 않는다
    return createImageBitmap(new Blob([image.bytes as BlobPart], { type: 'image/jpeg' }), {
      colorSpaceConversion: 'none',
      imageOrientation: 'none',
    });
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
