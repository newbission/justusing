/**
 * 아이폰 Safari처럼 큰 canvas를 만들지 못하는 브라우저를 흉내 낸다 (이미지 자르기·모자이크·이어 붙이기 E2E).
 *
 * 이미지 도구 워커는 전역 `__canvasPixelLimit`보다 큰 canvas를 만들지 못한 것으로 본다
 * (src/lib/image/worker-canvas.ts). 크롬은 작은 시험 이미지를 늘 canvas 하나로 저장하므로, 한계를 낮춰
 * 줄 묶음 저장(PngStream·JpegStream)으로 가게 한다.
 */
import { expect, type Page } from './test';

/** 떠 있는 워커 모두의 canvas 한계를 pixels로 낮춘다. 워커가 뜬 뒤(이미지를 연 뒤) 부른다 */
export async function limitCanvas(page: Page, pixels: number) {
  await expect.poll(() => page.workers().length).toBeGreaterThan(0);
  for (const worker of page.workers()) {
    await worker.evaluate((limit) => {
      (globalThis as { __canvasPixelLimit?: number }).__canvasPixelLimit = limit;
    }, pixels);
  }
}

/** 두 이미지를 브라우저로 열어 가로·세로와 RGB 값의 평균 차이(0~255)를 잰다 */
export async function difference(page: Page, a: Uint8Array, b: Uint8Array) {
  return page.evaluate(
    async ([first, second]) => {
      const read = async (data: number[]) => {
        const bitmap = await createImageBitmap(new Blob([new Uint8Array(data)]));
        const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(bitmap, 0, 0);
        return ctx.getImageData(0, 0, bitmap.width, bitmap.height);
      };
      const x = await read(first!);
      const y = await read(second!);
      let total = 0;
      let count = 0;
      if (x.width === y.width && x.height === y.height) {
        for (let i = 0; i < x.data.length; i += 4) {
          for (let c = 0; c < 3; c++) total += Math.abs(x.data[i + c]! - y.data[i + c]!);
          count += 3;
        }
      }
      return {
        sizes: [
          [x.width, x.height],
          [y.width, y.height],
        ],
        mean: count ? total / count : Infinity,
      };
    },
    [Array.from(a), Array.from(b)],
  );
}

/** JPEG 파일인지 (SOI 표시로 시작) */
export function isJpeg(bytes: Uint8Array): boolean {
  return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
}
