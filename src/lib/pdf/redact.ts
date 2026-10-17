/**
 * 가리기(영구 삭제) 화면 쪽 처리. 가린 쪽을 그림으로 그려 가린 자리를 검게 칠하고,
 * 고치기 워커가 그 그림과 나머지 쪽으로 새 PDF를 만든다 (redact-pages.ts).
 * 파일은 메모리에서만 다룬다.
 */
import { modifyPdf } from './modify';
import { SHARED_CONTENT } from './modify-errors';
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
  // 가리지 않은 쪽은 인쇄용 주석만 쪽에 그려 넣으므로(flattenAnnotations) 가린 쪽도 같은 기준으로 그린다
  const { bitmap } = await renderPageBitmap(await doc.getPage(index + 1), REDACT_DPI, 'print');
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
  try {
    return await modifyPdf(source, { kind: 'redact', pages });
  } catch (error) {
    // 가린 쪽과 내용을 같이 쓰는 쪽이 있으면 그 쪽도 (가릴 자리 없이) 그림으로 그려 다시 만든다
    if (!(error instanceof Error) || !error.message.startsWith(SHARED_CONTENT)) throw error;
    const shared = error.message.slice(SHARED_CONTENT.length).split(',').map(Number);
    for (const index of shared) pages.push({ index, jpg: await paintPage(source.doc, index, []) });
    pages.sort((a, b) => a.index - b.index);
    return modifyPdf(source, { kind: 'redact', pages });
  }
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

/** 글자 묶음 단위로 나누기 (언어와 무관) */
const segmenter = new Intl.Segmenter('en', { granularity: 'grapheme' });

/**
 * 글자마다 소문자로 바꾸고, 바꾼 글의 각 자리(UTF-16)가 원문의 어디서 왔는지 함께 돌려준다.
 * 소문자로 바꾸면 길이가 달라지는 글자(İ → i̇ 등)가 있어 바꾼 글의 위치를 원문에 그대로 쓸 수 없다.
 * from[j]: 바꾼 글 j번째 자리를 만든 원문 글자의 시작, to[j]: 그 글자의 끝
 */
function folded(str: string): { text: string; from: number[]; to: number[] } {
  let text = '';
  const from: number[] = [];
  const to: number[] = [];
  // 글자 단위(자모로 나눠 적은 한글 '한' 같은 묶음 포함)로 나눠, 생김새가 같은 글자는 같게 맞춘다:
  // 합자 ﬁ → fi, 전각 Ａ → A, 자모로 나눈 한글 → 완성형 (NFKC). 공백 종류(줄 안 띄움 등)는 공백 하나로
  for (const { segment, index } of segmenter.segment(str)) {
    let normal = segment.normalize('NFKC');
    if (/^\s+$/u.test(normal)) {
      // 이어지는 공백은 하나로 본다
      if (text.endsWith(' ')) continue;
      normal = ' ';
    }
    // 브라우저 언어(터키어의 I → ı 등)에 따라 달라지지 않게 언어와 무관한 소문자로 바꾼다
    const lower = normal.toLowerCase();
    text += lower;
    for (let k = 0; k < lower.length; k++) {
      from.push(index);
      to.push(index + segment.length);
    }
  }
  return { text, from, to };
}

/** 글자 조각 하나 (pdf.js의 TextItem) 와 찾기에 쓰는 값들 */
interface Piece {
  str: string;
  width: number;
  /** 소문자로 바꾼 글과 원문 위치 (folded) */
  text: string;
  from: number[];
  to: number[];
  /** 조각의 시작점(PDF 좌표)과 글자 방향·위 방향 단위 벡터 */
  e: number;
  f: number;
  dir: [number, number];
  top: [number, number];
  height: number;
  family: string;
  rtl: boolean;
  eol: boolean;
  /** 앞 조각과 공백 하나쯤 떨어져 있지만 글에는 공백이 없다 (찾을 때 공백을 넣어 잇는다) */
  space?: boolean;
  prefix?: Float64Array;
}

/**
 * 뒤 조각이 앞 조각에 이어 같은 줄에 놓였는지 (글꼴·모양이 바뀌어 조각이 나뉜 경우).
 * 이어지면 둘 사이가 공백만큼 떨어졌는지 next.space에 적는다
 */
function continues(prev: Piece, next: Piece): boolean {
  if (prev.eol) return false;
  if (prev.dir[0] * next.dir[0] + prev.dir[1] * next.dir[1] < 0.99) return false;
  const endX = prev.e + prev.dir[0] * prev.width;
  const endY = prev.f + prev.dir[1] * prev.width;
  const dx = next.e - endX;
  const dy = next.f - endY;
  const along = dx * prev.dir[0] + dy * prev.dir[1];
  const across = dx * prev.top[0] + dy * prev.top[1];
  const size = Math.max(prev.height, next.height);
  if (!(Math.abs(across) < size * 0.5 && along > -size * 0.5 && along < size * 1.5)) return false;
  // 글자 크기의 0.15배보다 넓게 띄웠으면 화면에서는 띄어 보인다 (공백 글자 폭은 보통 0.25배쯤)
  next.space = along > size * 0.15 && !/\s$/.test(prev.str) && !/^\s/.test(next.str);
  return true;
}

/**
 * 쪽들에서 글자를 찾아 가릴 자리를 만든다. 대소문자는 가리지 않는다.
 * 같은 줄에 바로 이어 놓인 조각들(글꼴이 바뀌어 나뉜 경우 등)은 이어서 찾는다 (줄이 바뀐 곳에 걸친 말은 못 찾는다)
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
    // 같은 줄에 이어 놓인 조각끼리 묶는다
    const lines: Piece[][] = [];
    for (const item of content.items) {
      if (!('str' in item)) continue;
      const [a, b, c, d, e, f] = item.transform as number[];
      const along = Math.hypot(a!, b!);
      const up = Math.hypot(c!, d!);
      if (!item.str || along === 0 || up === 0) {
        // 빈 조각은 줄 끝 표시만 옮긴다
        const last = lines.at(-1)?.at(-1);
        if (last && 'hasEOL' in item && item.hasEOL) last.eol = true;
        continue;
      }
      const piece: Piece = {
        str: item.str,
        width: item.width,
        ...folded(item.str),
        e: e!,
        f: f!,
        // 글자 방향과 위 방향 (회전한 글자도 따라간다)
        dir: [a! / along, b! / along],
        top: [c! / up, d! / up],
        height: item.height || up,
        family: content.styles[item.fontName]?.fontFamily ?? 'sans-serif',
        rtl: item.dir === 'rtl' || RTL.test(item.str),
        eol: item.hasEOL,
      };
      const line = lines.at(-1);
      if (line && continues(line.at(-1)!, piece)) line.push(piece);
      else lines.push([piece]);
    }
    for (const line of lines) {
      const text = line.map((piece) => (piece.space ? ' ' : '') + piece.text).join('');
      for (let at = text.indexOf(needle); at !== -1; at = text.indexOf(needle, at + 1)) {
        // 찾은 말이 걸친 조각마다 그 부분을 재고, 모두 덮는 상자 하나로 합친다
        const xs: number[] = [];
        const ys: number[] = [];
        let offset = 0;
        for (const piece of line) {
          if (piece.space) offset += 1;
          const startIn = Math.max(at, offset) - offset;
          const endIn = Math.min(at + needle.length, offset + piece.text.length) - offset;
          offset += piece.text.length;
          if (startIn >= endIn) continue;
          // 찾은 조각에서만, 조각마다 한 번 잰다
          piece.prefix ??= prefixWidths(piece.str, piece.family);
          // 원문 위치로 옮겨 잰다 (찾은 첫 자리를 만든 글자의 시작부터 마지막 자리를 만든 글자의 끝까지)
          const start = piece.from[startIn]!;
          const end = piece.to[endIn - 1]!;
          // 오른쪽에서 왼쪽으로 쓰는 글자(히브리어·아랍어 등)가 섞이면 글자 순서와 놓인 자리가 달라
          // 찾은 말의 자리를 알 수 없으므로 조각 전체를 가린다
          const [s0, s1] = piece.rtl
            ? [0, piece.width]
            : matchSpan(piece.prefix, start, end - start, piece.width, piece.height);
          for (const s of [s0, s1]) {
            for (const t of [-piece.height * DESCENT, piece.height]) {
              const [x, y] = viewport.convertToViewportPoint(
                piece.e + piece.dir[0] * s + piece.top[0] * t,
                piece.f + piece.dir[1] * s + piece.top[1] * t,
              );
              xs.push(x! / viewport.width);
              ys.push(y! / viewport.height);
            }
          }
        }
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
