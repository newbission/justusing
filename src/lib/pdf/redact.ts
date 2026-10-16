/**
 * 가리기(영구 삭제) 화면 쪽 처리. 가린 쪽을 그림으로 그려 가린 자리를 검게 칠하고,
 * 고치기 워커가 그 그림과 나머지 쪽으로 새 PDF를 만든다 (redact-pages.ts).
 * 파일은 메모리에서만 다룬다.
 */
import { modifyPdf } from './modify';
import type { PDFDocumentProxy } from './pdfjs';
import { encodeBitmap, renderPageBitmap } from './render-image';

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
  // 칠하기와 JPG 저장은 무거워 워커에서 한다
  return encodeBitmap(bitmap, 'image/jpeg', JPEG_QUALITY, boxes);
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

/** 글자 폭을 재는 칸 (글꼴 크기 100px로 재고 비율만 쓴다) */
let ruler: OffscreenCanvasRenderingContext2D | undefined;

/**
 * 한 글자 조각(폭 width) 안에서 at번째부터 length글자가 차지하는 구간 [시작, 끝].
 * pdf.js는 조각 전체 폭만 알려 주므로 비슷한 글꼴(sans-serif 등)로 잰 폭의 비율로 나눈다.
 * 실제 글꼴과 폭이 다를 수 있어, 조각 끝에서 멀수록 넓게 여유를 둔다 (덜 가리는 것보다 더 가리는 편이 낫다)
 */
function matchSpan(
  str: string,
  at: number,
  length: number,
  width: number,
  height: number,
  family: string,
): [number, number] {
  ruler ??= new OffscreenCanvas(1, 1).getContext('2d')!;
  ruler.font = `100px ${family}`;
  const total = ruler.measureText(str).width;
  const ratio = (end: number) =>
    total > 0 ? ruler!.measureText(str.slice(0, end)).width / total : end / str.length;
  const start = width * ratio(at);
  const end = width * ratio(at + length);
  const margin = (edge: number) => height * 0.25 + Math.min(edge, width - edge) * 0.25;
  return [Math.max(0, start - margin(start)), Math.min(width, end + margin(end))];
}

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
      const family = content.styles[item.fontName]?.fontFamily ?? 'sans-serif';
      for (let at = text.indexOf(needle); at !== -1; at = text.indexOf(needle, at + 1)) {
        const [s0, s1] = matchSpan(item.str, at, needle.length, item.width, height, family);
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
