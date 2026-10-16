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

/** 오른쪽에서 왼쪽으로 쓰는 글자 (히브리어·아랍어·시리아어·타나어 등과 그 표시형) */
const RTL = /[\u0590-\u08ff\ufb1d-\ufdff\ufe70-\ufefc]|\ud802[\udc00-\udfff]|\ud83a/;

/** 글자 아래로 내려가는 부분(g, y 등)까지 덮도록 글자 높이의 이만큼 아래부터 가린다 */
const DESCENT = 0.3;

/** 글자 폭을 재는 칸 (글꼴 크기 100px로 재고 비율만 쓴다) */
let ruler: OffscreenCanvasRenderingContext2D | undefined;
/** 글꼴별로 잰 글자 폭 (같은 글자를 다시 재지 않게) */
const measured = new Map<string, Map<string, number>>();

/**
 * 글자 조각의 앞에서부터 i번째 글자(UTF-16 단위)까지의 폭. 글자마다 한 번씩만 재므로
 * 조각이 길고 찾은 곳이 많아도 조각 길이에 비례하는 만큼만 잰다
 */
function prefixWidths(str: string, family: string): Float64Array {
  ruler ??= new OffscreenCanvas(1, 1).getContext('2d')!;
  ruler.font = `100px ${family}`;
  let widths = measured.get(family);
  if (!widths) measured.set(family, (widths = new Map()));
  const prefix = new Float64Array(str.length + 1);
  for (let i = 0; i < str.length;) {
    const char = String.fromCodePoint(str.codePointAt(i)!);
    let width = widths.get(char);
    if (width === undefined) widths.set(char, (width = ruler.measureText(char).width));
    prefix[i + 1] = prefix[i]! + width;
    // 두 단위로 된 글자(이모지 등)의 뒤쪽 단위는 폭이 없다
    if (char.length === 2) prefix[i + 2] = prefix[i + 1]!;
    i += char.length;
  }
  return prefix;
}

/**
 * 한 글자 조각(폭 width) 안에서 at번째부터 length글자가 차지하는 구간 [시작, 끝].
 * pdf.js는 조각 전체 폭만 알려 주므로 비슷한 글꼴(sans-serif 등)로 잰 폭의 비율로 나눈다.
 * 실제 글꼴과 폭이 다를 수 있어, 조각 끝에서 멀수록 넓게 여유를 둔다 (덜 가리는 것보다 더 가리는 편이 낫다)
 */
function matchSpan(
  prefix: Float64Array,
  at: number,
  length: number,
  width: number,
  height: number,
): [number, number] {
  const count = prefix.length - 1;
  const total = prefix[count]!;
  const ratio = (end: number) => (total > 0 ? prefix[end]! / total : end / count);
  const start = width * ratio(at);
  const end = width * ratio(at + length);
  const margin = (edge: number) => height * 0.25 + Math.min(edge, width - edge) * 0.25;
  return [Math.max(0, start - margin(start)), Math.min(width, end + margin(end))];
}

/**
 * 글자마다 소문자로 바꾸고, 바꾼 글의 각 자리(UTF-16)가 원문의 어디서 왔는지 함께 돌려준다.
 * 소문자로 바꾸면 길이가 달라지는 글자(İ → i̇ 등)가 있어 바꾼 글의 위치를 원문에 그대로 쓸 수 없다.
 * from[j]: 바꾼 글 j번째 자리를 만든 원문 글자의 시작, to[j]: 그 글자의 끝
 */
function folded(str: string): { text: string; from: number[]; to: number[] } {
  let text = '';
  const from: number[] = [];
  const to: number[] = [];
  for (let i = 0; i < str.length;) {
    const char = String.fromCodePoint(str.codePointAt(i)!);
    // 브라우저 언어(터키어의 I → ı 등)에 따라 달라지지 않게 언어와 무관한 소문자로 바꾼다
    const lower = char.toLowerCase();
    text += lower;
    for (let k = 0; k < lower.length; k++) {
      from.push(i);
      to.push(i + char.length);
    }
    i += char.length;
  }
  return { text, from, to };
}

/**
 * 쪽들에서 글자를 찾아 가릴 자리를 만든다. 대소문자는 가리지 않는다.
 * 한 글자 조각 안에서만 찾는다 (줄이 바뀌거나 PDF가 글자를 나눠 둔 곳에 걸친 말은 못 찾는다)
 */
export async function findText(doc: PDFDocumentProxy, term: string): Promise<RedactBox[]> {
  const needle = folded(term.trim()).text;
  if (!needle) return [];
  const boxes: RedactBox[] = [];
  for (let number = 1; number <= doc.numPages; number++) {
    const page = await doc.getPage(number);
    const viewport = page.getViewport({ scale: 1 });
    const content = await page.getTextContent();
    page.cleanup();
    for (const item of content.items) {
      if (!('str' in item) || !item.str) continue;
      const { text, from, to } = folded(item.str);
      const [a, b, c, d, e, f] = item.transform as number[];
      const along = Math.hypot(a!, b!);
      const up = Math.hypot(c!, d!);
      if (along === 0 || up === 0) continue;
      // 글자 방향과 위 방향 (회전한 글자도 따라간다)
      const dir = [a! / along, b! / along];
      const top = [c! / up, d! / up];
      const height = item.height || up;
      const family = content.styles[item.fontName]?.fontFamily ?? 'sans-serif';
      const rtl = item.dir === 'rtl' || RTL.test(item.str);
      let prefix: Float64Array | undefined;
      for (let at = text.indexOf(needle); at !== -1; at = text.indexOf(needle, at + 1)) {
        // 찾은 조각에서만, 조각마다 한 번 잰다
        prefix ??= prefixWidths(item.str, family);
        // 원문 위치로 옮겨 잰다 (찾은 첫 자리를 만든 글자의 시작부터 마지막 자리를 만든 글자의 끝까지)
        const start = from[at]!;
        const end = to[at + needle.length - 1]!;
        // 오른쪽에서 왼쪽으로 쓰는 글자(히브리어·아랍어 등)가 섞이면 글자 순서와 놓인 자리가 달라
        // 찾은 말의 자리를 알 수 없으므로 조각 전체를 가린다
        const [s0, s1] = rtl
          ? [0, item.width]
          : matchSpan(prefix, start, end - start, item.width, height);
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
