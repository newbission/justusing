/**
 * HEIC·HEIF 사진을 libheif(WebAssembly)로 푸는 워커 (heif.ts가 띄운다). 사진은 메모리에서만 다룬다.
 *
 * - 엔진 바이트는 화면이 우리 사이트에서 받아 넘겨준다 (init). 글루는 이 워커에 함께 번들한다
 * - 대표 그림(primary) 하나만 푼다. 라이브 포토·연사처럼 여러 장이 든 파일도 사진 앱이 보여 주는 그 한 장이다
 * - libheif가 회전·뒤집기(irot·imir)를 적용해 바로 세운 그림을 주고, 10·12비트(HDR 포함)는 8비트로 줄여 준다
 * - 색 공간이 Display P3(아이폰)이면 그 표시를 달아 넘겨, 그리는 쪽이 일반 화면 색(sRGB)으로 바꾸게 한다
 */
import libheif from 'libheif-js/libheif-wasm/libheif.js';
import { heifColorSpace, type HeifColorSpace } from './heif-container';
import type { HeifRequest, HeifResponse } from './heif';

type Lib = ReturnType<typeof libheif>;

/** libheif가 푼 그림의 한 면 (RGBA를 한 면에 섞어 받는다) */
interface Channel {
  id: unknown;
  width: number;
  height: number;
  /** 한 줄의 바이트 수. 폭×4보다 길 수 있다 (줄 끝 채움) */
  stride: number;
  data: Uint8Array;
}

interface DecodedImage {
  code?: unknown;
  image: Parameters<Lib['heif_image_release']>[0];
  channels: Channel[];
}

let ready: Promise<Lib> | undefined;

function load(wasm: ArrayBuffer): Promise<Lib> {
  return new Promise((resolve, reject) => {
    // Emscripten은 넘긴 객체를 그대로 모듈로 쓴다. 바이트를 넘기면 엔진을 받으러 가지 않는다
    const module: Record<string, unknown> = {
      wasmBinary: wasm,
      onRuntimeInitialized: () => resolve(module as unknown as Lib),
      onAbort: (reason: unknown) => reject(new Error(`libheif: ${String(reason)}`)),
    };
    try {
      libheif(module);
    } catch (error) {
      reject(error);
    }
  });
}

class DecodeError extends Error {}

/** 대표 그림을 RGBA 8비트로 푼다 */
async function decodePrimary(heif: Lib, bytes: Uint8Array) {
  const context = heif.heif_context_alloc();
  try {
    const read = heif.heif_context_read_from_memory(context, bytes);
    if (read.code !== heif.heif_error_code.heif_error_Ok)
      throw new DecodeError(String(read.message));
    const handle = heif.heif_js_context_get_primary_image_handle(context);
    if (!handle || handle.code) throw new DecodeError('no primary image');
    try {
      const decoded: DecodedImage = await heif.heif_js_decode_image2(
        handle,
        heif.heif_colorspace.heif_colorspace_RGB,
        heif.heif_chroma.heif_chroma_interleaved_RGBA,
      );
      if (!decoded || decoded.code) throw new DecodeError('decode failed');
      try {
        const channel =
          decoded.channels.find(
            (channel) => channel.id === heif.heif_channel.heif_channel_interleaved,
          ) ?? decoded.channels[0];
        if (!channel) throw new DecodeError('no pixels');
        const { width, height, stride, data } = channel;
        const row = width * 4;
        // 엔진 메모리가 아니라 새 배열로 옮긴다 (그림을 놓으면 엔진 쪽 메모리는 다시 쓰인다)
        const pixels = new Uint8ClampedArray(row * height);
        if (stride === row) pixels.set(data.subarray(0, row * height));
        else {
          for (let y = 0; y < height; y++) {
            pixels.set(data.subarray(y * stride, y * stride + row), y * row);
          }
        }
        return { pixels, width, height };
      } finally {
        heif.heif_image_release(decoded.image);
      }
    } finally {
      heif.heif_image_handle_release(handle);
    }
  } finally {
    heif.heif_context_free(context);
  }
}

function imageData(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  space: HeifColorSpace,
) {
  const data = pixels as Uint8ClampedArray<ArrayBuffer>;
  if (space === 'display-p3') {
    try {
      return new ImageData(data, width, height, { colorSpace: 'display-p3' });
    } catch {
      // P3를 모르는 브라우저는 그대로 둔다 (색이 조금 옅게 보일 뿐이다)
    }
  }
  return new ImageData(data, width, height);
}

async function handle(request: Extract<HeifRequest, { type: 'decode' }>): Promise<void> {
  const send = (response: HeifResponse, transfer: Transferable[] = []) =>
    postMessage(response, { transfer });
  try {
    if (!ready) throw new Error('not initialized');
    const heif = await ready;
    const bytes = new Uint8Array(await request.file.arrayBuffer());
    const { pixels, width, height } = await decodePrimary(heif, bytes);
    const data = imageData(pixels, width, height, heifColorSpace(bytes));
    if (!request.jpeg) {
      const bitmap = await createImageBitmap(data);
      send({ id: request.id, kind: 'image', bitmap }, [bitmap]);
      return;
    }
    // 화면에 그리거나(브라우저가 HEIC를 그리지 못해 <img>에 원본을 쓸 수 없다) PDF에 넣을 JPG
    const scale = Math.min(1, (request.jpeg.side ?? Infinity) / Math.max(width, height));
    const picture =
      scale < 1
        ? await createImageBitmap(data, {
            resizeWidth: Math.max(1, Math.round(width * scale)),
            resizeHeight: Math.max(1, Math.round(height * scale)),
            resizeQuality: 'high',
          })
        : await createImageBitmap(data);
    const canvas = new OffscreenCanvas(picture.width, picture.height);
    const context = canvas.getContext('2d')!;
    // JPG에는 투명이 없어 흰 바탕을 깐다
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(picture, 0, 0);
    picture.close();
    const jpeg = await canvas.convertToBlob({ type: 'image/jpeg', quality: request.jpeg.quality });
    canvas.width = 0;
    canvas.height = 0;
    send({ id: request.id, kind: 'jpeg', width, height, jpeg });
  } catch (error) {
    send({
      id: request.id,
      kind: 'error',
      message: error instanceof DecodeError ? 'decode' : 'engine',
    });
  }
}

addEventListener('message', (event: MessageEvent<HeifRequest>) => {
  const request = event.data;
  if (request.type === 'init') ready = load(request.wasm);
  else void handle(request);
});
