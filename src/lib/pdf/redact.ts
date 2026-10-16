/**
 * 가리기(영구 삭제) 화면 쪽 처리. 가린 쪽을 그림으로 그려 가린 자리를 검게 칠하고,
 * 고치기 워커가 그 그림과 나머지 쪽으로 새 PDF를 만든다 (redact-pages.ts).
 * 파일은 메모리에서만 다룬다.
 */
import { modifyPdf } from './modify';
import type { PDFDocumentProxy } from './pdfjs';
import { renderPageBitmap } from './render-image';

/** 가릴 자리. 화면에 보이는 쪽(회전·보이는 영역 적용) 기준 비율(0~1), 왼쪽 위가 (0, 0) */
export interface RedactBox {
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

/** 가린 쪽을 그릴 해상도. 글자가 또렷하게 읽히면서 파일이 너무 커지지 않는 정도 */
const REDACT_DPI = 200;
const JPEG_QUALITY = 0.9;

async function paintPage(doc: PDFDocumentProxy, index: number, boxes: RedactBox[]) {
  const { bitmap } = await renderPageBitmap(await doc.getPage(index + 1), REDACT_DPI);
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  const context = canvas.getContext('2d')!;
  context.drawImage(bitmap, 0, 0);
  bitmap.close();
  context.fillStyle = '#000';
  for (const box of boxes) {
    // 화소 경계에서 글자 끝이 비치지 않게 바깥으로 1화소씩 넓힌다
    const x = Math.floor(box.x * canvas.width) - 1;
    const y = Math.floor(box.y * canvas.height) - 1;
    const right = Math.ceil((box.x + box.width) * canvas.width) + 1;
    const bottom = Math.ceil((box.y + box.height) * canvas.height) + 1;
    context.fillRect(x, y, right - x, bottom - y);
  }
  const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality: JPEG_QUALITY });
  return new Uint8Array(await blob.arrayBuffer());
}

/**
 * 가린 PDF를 만든다. onPage(끝난 쪽 수, 전체): 가린 쪽을 그릴 때마다
 */
export async function redactPdf(
  source: { doc: PDFDocumentProxy; bytes: Uint8Array; password?: string },
  boxes: RedactBox[],
  onPage?: (done: number, total: number) => void,
): Promise<Uint8Array> {
  const byPage = new Map<number, RedactBox[]>();
  for (const box of boxes) byPage.set(box.page, [...(byPage.get(box.page) ?? []), box]);
  const pages: { index: number; jpg: Uint8Array }[] = [];
  for (const [index, pageBoxes] of [...byPage].sort(([a], [b]) => a - b)) {
    pages.push({ index, jpg: await paintPage(source.doc, index, pageBoxes) });
    onPage?.(pages.length, byPage.size);
  }
  return modifyPdf(source, { kind: 'redact', pages });
}

/** 글자 아래로 내려가는 부분(g, y 등)까지 덮도록 글자 높이의 이만큼 아래부터 가린다 */
const DESCENT = 0.3;

/**
 * 쪽들에서 글자를 찾아 가릴 자리를 만든다. 대소문자는 가리지 않는다.
 * 한 글자 조각 안에서만 찾는다 (줄이 바뀌거나 PDF가 글자를 나눠 둔 곳에 걸친 말은 못 찾는다)
 */
export async function findText(doc: PDFDocumentProxy, term: string): Promise<RedactBox[]> {
  const needle = term.trim().toLocaleLowerCase();
  if (!needle) return [];
  const boxes: RedactBox[] = [];
  for (let number = 1; number <= doc.numPages; number++) {
    const page = await doc.getPage(number);
    const viewport = page.getViewport({ scale: 1 });
    const content = await page.getTextContent();
    page.cleanup();
    for (const item of content.items) {
      if (!('str' in item) || !item.str) continue;
      const text = item.str.toLocaleLowerCase();
      const [a, b, c, d, e, f] = item.transform as number[];
      const along = Math.hypot(a!, b!);
      const up = Math.hypot(c!, d!);
      if (along === 0 || up === 0) continue;
      // 글자 방향과 위 방향 (회전한 글자도 따라간다)
      const dir = [a! / along, b! / along];
      const top = [c! / up, d! / up];
      const height = item.height || up;
      for (let at = text.indexOf(needle); at !== -1; at = text.indexOf(needle, at + 1)) {
        // 글자 폭을 모르므로 글자 수 비율로 나누고, 어긋남을 덮도록 양옆을 조금 넓힌다
        const pad = height * 0.15;
        const s0 = (item.width * at) / text.length - pad;
        const s1 = (item.width * (at + needle.length)) / text.length + pad;
        const corners = [s0, s1].flatMap((s) =>
          [-height * DESCENT, height].map((t) =>
            viewport.convertToViewportPoint(
              e! + dir[0]! * s + top[0]! * t,
              f! + dir[1]! * s + top[1]! * t,
            ),
          ),
        );
        const xs = corners.map(([x]) => x! / viewport.width);
        const ys = corners.map(([, y]) => y! / viewport.height);
        const x = Math.max(0, Math.min(...xs));
        const y = Math.max(0, Math.min(...ys));
        boxes.push({
          page: number - 1,
          x,
          y,
          width: Math.min(1, Math.max(...xs)) - x,
          height: Math.min(1, Math.max(...ys)) - y,
        });
      }
    }
  }
  return boxes;
}
