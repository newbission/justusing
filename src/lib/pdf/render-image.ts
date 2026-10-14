/**
 * PDF 한 쪽을 이미지 파일(JPG·PNG)로 그린다 (PDF를 이미지로 도구).
 * 화면에 없는 canvas에 그려 바이트로 바꿀 뿐, 어디로도 보내지 않는다.
 */
import type { PDFPageProxy } from './pdfjs';

export type ImageFormat = 'jpg' | 'png';

export const IMAGE_TYPES: Record<ImageFormat, string> = {
  jpg: 'image/jpeg',
  png: 'image/png',
};

/**
 * canvas 한 장의 최대 화소 수. 브라우저마다 한계가 있고(iOS Safari 약 1,670만),
 * 넘으면 빈 이미지가 나온다. A4 300 DPI(약 870만)는 그대로 그려진다.
 */
const MAX_PIXELS = 16_000_000;

/** JPG 화질 (0~1). 글자가 번지지 않을 만큼 높게 둔다 */
const JPEG_QUALITY = 0.92;

/** 한 쪽을 dpi 해상도로 그린 이미지 바이트. 너무 크면 한계 안으로 줄인다. */
export async function renderPageImage(
  page: PDFPageProxy,
  dpi: number,
  format: ImageFormat,
): Promise<Uint8Array> {
  let viewport = page.getViewport({ scale: dpi / 72 });
  const pixels = viewport.width * viewport.height;
  if (pixels > MAX_PIXELS) {
    viewport = page.getViewport({ scale: (dpi / 72) * Math.sqrt(MAX_PIXELS / pixels) });
  }

  const canvas = document.createElement('canvas');
  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);
  try {
    // 배경이 투명한 PDF도 JPG처럼 흰 종이로 보이게 흰색을 깐다
    await page.render({ canvas, viewport, background: '#ffffff' }).promise;
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, IMAGE_TYPES[format], JPEG_QUALITY),
    );
    if (!blob) throw new Error('canvas.toBlob failed');
    return new Uint8Array(await blob.arrayBuffer());
  } finally {
    // 큰 canvas의 메모리를 바로 돌려준다 (쪽이 많으면 쌓여서 탭이 죽을 수 있다)
    canvas.width = 0;
    canvas.height = 0;
    page.cleanup();
  }
}
