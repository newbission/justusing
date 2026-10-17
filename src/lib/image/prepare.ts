/**
 * 이미지 파일을 PDF에 넣을 수 있게 준비한다 (이미지를 PDF로 도구).
 * 모든 처리는 메모리 안에서만 한다. 파일은 어디로도 전송되지 않는다.
 *
 * PDF(pdf-lib)는 JPG·PNG만 그대로 넣을 수 있다. 그 밖의 형식(WebP 등)은 브라우저가 읽어
 * PNG로 바꾼다. 휴대폰 사진은 JPG 안에 '돌려서 보라'는 표시(EXIF 방향)만 있고 화소는 누워 있어,
 * 그대로 넣으면 PDF에서 옆으로 눕는다. 그런 사진은 바로 세운 뒤 JPG로 다시 만든다.
 *
 * 다시 만드는 일은 화면이 멈추지 않도록 워커에서 한다(images-to-pdf.worker.ts가 toEmbeddable을 부른다).
 * 그래서 화면 canvas 대신 OffscreenCanvas를 쓴다.
 */

import { stripJpegMetadata } from './jpeg-metadata';

export interface ImageInfo {
  /** 바로 세운 뒤의 가로·세로 화소 */
  width: number;
  height: number;
}

export interface EmbeddableImage extends ImageInfo {
  kind: 'jpg' | 'png';
  bytes: Uint8Array;
}

/** 다시 만드는 JPG의 화질 (0~1) */
const JPEG_QUALITY = 0.92;

const isJpeg = (bytes: Uint8Array) => bytes[0] === 0xff && bytes[1] === 0xd8;
const isPng = (bytes: Uint8Array) =>
  bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;

/**
 * JPG의 EXIF 방향 값 (1~8). 없으면 1(그대로).
 * APP1 'Exif' 조각의 첫 IFD에서 0x0112 태그만 찾는다.
 */
export function jpegOrientation(bytes: Uint8Array): number {
  try {
    return readOrientation(bytes);
  } catch {
    // 망가진 EXIF(범위 밖을 가리키는 값)는 방향 정보가 없는 것으로 본다. 사진은 그대로 쓸 수 있다
    return 1;
  }
}

function readOrientation(bytes: Uint8Array): number {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 2;
  while (offset + 4 <= view.byteLength) {
    if (view.getUint8(offset) !== 0xff) return 1;
    const marker = view.getUint8(offset + 1);
    const length = view.getUint16(offset + 2);
    // SOS(0xDA) 뒤는 화소 데이터라 더 찾지 않는다
    if (marker === 0xda) return 1;
    if (marker === 0xe1 && view.getUint32(offset + 4) === 0x45786966 /* 'Exif' */) {
      const tiff = offset + 10;
      const little = view.getUint16(tiff) === 0x4949;
      const ifd = tiff + view.getUint32(tiff + 4, little);
      const count = view.getUint16(ifd, little);
      for (let i = 0; i < count; i++) {
        const entry = ifd + 2 + i * 12;
        if (entry + 12 > view.byteLength) return 1;
        if (view.getUint16(entry, little) === 0x0112) {
          const value = view.getUint16(entry + 8, little);
          return value >= 1 && value <= 8 ? value : 1;
        }
      }
      return 1;
    }
    offset += 2 + length;
  }
  return 1;
}

/** 바로 세운 이미지를 읽는다. 브라우저가 읽지 못하는 형식이면 오류를 던진다. */
async function decode(file: Blob): Promise<ImageBitmap> {
  return createImageBitmap(file, { imageOrientation: 'from-image' });
}

/** 크기만 읽는다 (목록에 보여 줄 때) */
export async function readImageInfo(file: Blob): Promise<ImageInfo> {
  const bitmap = await decode(file);
  const info = { width: bitmap.width, height: bitmap.height };
  bitmap.close();
  return info;
}

async function redraw(file: Blob, type: 'image/jpeg' | 'image/png'): Promise<EmbeddableImage> {
  const bitmap = await decode(file);
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  try {
    const context = canvas.getContext('2d')!;
    if (type === 'image/jpeg') {
      // JPG에는 투명이 없어 흰 바탕을 깐다
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, canvas.width, canvas.height);
    }
    context.drawImage(bitmap, 0, 0);
    const blob = await canvas.convertToBlob({ type, quality: JPEG_QUALITY });
    return {
      kind: type === 'image/jpeg' ? 'jpg' : 'png',
      bytes: new Uint8Array(await blob.arrayBuffer()),
      width: bitmap.width,
      height: bitmap.height,
    };
  } finally {
    bitmap.close();
    // 큰 canvas의 메모리를 바로 돌려준다
    canvas.width = 0;
    canvas.height = 0;
  }
}

/**
 * PDF에 넣을 바이트로 만든다. 바꿀 필요가 없으면 원본 바이트를 그대로 쓴다 (화질 그대로).
 * 결과에는 사진의 촬영 정보가 남지 않는다: JPG는 정보 조각을 떼고, PNG는 pdf-lib가 픽셀만 옮기고, 다시 그린 것은 새로 만든다
 */
export async function toEmbeddable(file: Blob): Promise<EmbeddableImage> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (isJpeg(bytes)) {
    if (jpegOrientation(bytes) === 1) {
      // 원본 그대로 넣되, 받는 사람에게 갈 필요 없는 촬영 정보(위치·카메라 등)는 뗀다
      const clean = stripJpegMetadata(bytes);
      // 구조를 읽지 못해 정보를 떼지 못하면 다시 그려 저장한다 (촬영 정보가 남지 않게)
      if (!clean) return redraw(file, 'image/jpeg');
      return { kind: 'jpg', bytes: clean, ...(await readImageInfo(file)) };
    }
    return redraw(file, 'image/jpeg');
  }
  if (isPng(bytes)) return { kind: 'png', bytes, ...(await readImageInfo(file)) };
  return redraw(file, 'image/png');
}
