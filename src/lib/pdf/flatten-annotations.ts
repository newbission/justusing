/**
 * 주석(양식 입력값·서명·도장·메모 표시 등)이 화면에 보이는 모양을 쪽 내용에 그려 넣는다 (워커에서 쓴다).
 * 쪽 내용만 옮기는 처리(모아찍기의 embedPages 등)는 주석을 옮기지 못해, 그대로 두면 입력한 값이 사라진다.
 * 그리는 방법은 PDF 규격(ISO 32000 12.5.5)의 주석 모양 그리기를 따른다.
 */
import {
  PDFArray,
  PDFDict,
  PDFDropdown,
  PDFName,
  PDFNumber,
  PDFOptionList,
  PDFRef,
  PDFStream,
  PDFTextField,
  concatTransformationMatrix,
  drawObject,
  popGraphicsState,
  pushGraphicsState,
  StandardFonts,
  type PDFDocument,
  type PDFField,
  type PDFPage,
} from '@cantoo/pdf-lib';
import { UNRENDERED_ANNOTATION } from './modify-errors';
import { isolateContent } from './page-content';

/** /F 플래그: 숨김(2), 인쇄(4) */
const HIDDEN = 2;
const PRINT = 4;

type Matrix = [number, number, number, number, number, number];

function numbers(value: unknown, count: number): number[] | undefined {
  if (!(value instanceof PDFArray) || value.size() !== count) return undefined;
  const out = value.asArray().map((item) => (item instanceof PDFNumber ? item.asNumber() : NaN));
  return out.every(Number.isFinite) ? out : undefined;
}

/**
 * 주석이 지금 보이는 모양 (/AP /N, 상태가 여럿이면 /AS로 고른 것).
 * 모양이 아예 없으면 undefined, 지금 상태에 그릴 모양이 없으면(꺼진 체크 상자 등) 'empty'
 */
function normalAppearance(annot: PDFDict): PDFRef | 'empty' | undefined {
  const lookup = annot.context.lookup.bind(annot.context);
  const ap = lookup(annot.get(PDFName.of('AP')));
  if (!(ap instanceof PDFDict)) return undefined;
  let normal = ap.get(PDFName.of('N'));
  const resolved = lookup(normal);
  if (resolved instanceof PDFDict && !(resolved instanceof PDFStream)) {
    const state = annot.get(PDFName.of('AS'));
    normal = state instanceof PDFName ? resolved.get(state) : undefined;
    if (normal === undefined) return 'empty';
  }
  if (normal instanceof PDFRef) return lookup(normal) instanceof PDFStream ? normal : undefined;
  // 직접 들어 있는 스트림은 참조로 등록해야 쪽 자원에서 부를 수 있다
  if (normal instanceof PDFStream) return annot.context.register(normal);
  return undefined;
}

const MARKUP = ['Highlight', 'Underline', 'StrikeOut', 'Squiggly'];

/** 주석 색 (/C: 회색 1개, RGB 3개, CMYK 4개) → 채우기 연산자 */
function fillColor(annot: PDFDict, fallback: string): string {
  const value = annot.context.lookup(annot.get(PDFName.of('C')));
  const parts = value instanceof PDFArray ? value.asArray() : [];
  const c = parts.map((item) => (item instanceof PDFNumber ? item.asNumber() : NaN));
  if (!c.every(Number.isFinite)) return fallback;
  if (c.length === 1) return `${c[0]} g`;
  if (c.length === 3) return `${c.join(' ')} rg`;
  if (c.length === 4) return `${c.join(' ')} k`;
  return fallback;
}

/**
 * 모양 없이 저장된 글자 표시 주석(형광펜·밑줄·취소선)은 보기 프로그램이 /QuadPoints로 그린다.
 * 같은 방식으로 모양을 만든다. 쪽 좌표 그대로 그리도록 BBox를 Rect와 같게 둔다
 */
function markupAppearance(annot: PDFDict, rect: number[]): PDFRef | undefined {
  const subtype = annot.get(PDFName.of('Subtype'));
  if (!(subtype instanceof PDFName) || !MARKUP.includes(subtype.decodeText())) return undefined;
  const context = annot.context;
  const quads = context.lookup(annot.get(PDFName.of('QuadPoints')));
  const values = quads instanceof PDFArray ? quads.asArray() : [];
  const points = values.map((item) => (item instanceof PDFNumber ? item.asNumber() : NaN));
  if (points.length === 0 || points.length % 8 !== 0 || !points.every(Number.isFinite)) {
    return undefined;
  }
  const kind = subtype.decodeText();
  const highlight = kind === 'Highlight';
  const opacity = context.lookup(annot.get(PDFName.of('CA')));
  const alpha = opacity instanceof PDFNumber ? opacity.asNumber() : 1;
  const color = fillColor(annot, highlight ? '1 1 0 rg' : '0 0 0 rg');
  // 같은 색을 선에도 쓴다 (g/rg/k → G/RG/K)
  const stroke = color.replace(/(\S+)$/, (op) => op.toUpperCase());
  const ops = ['q', '/GS0 gs', color, stroke];
  for (let i = 0; i < points.length; i += 8) {
    // 네 점은 왼쪽 위, 오른쪽 위, 왼쪽 아래, 오른쪽 아래 순서다 (Acrobat이 쓰는 순서).
    // 기울어진 글자에서도 글자를 따라가도록 사각형이 아니라 이 네 점으로 그린다
    const [ax, ay, bx, by, cx, cy, dx, dy] = points.slice(i, i + 8) as [
      number,
      number,
      number,
      number,
      number,
      number,
      number,
      number,
    ];
    const height = Math.hypot(ax - cx, ay - cy);
    if (height === 0) continue;
    // 아래 변에서 위쪽으로 향하는 단위 벡터
    const ux = (ax - cx) / height;
    const uy = (ay - cy) / height;
    /** 아래 변에서 줄 높이의 t만큼 올라간 선 */
    const along = (t: number): [number, number, number, number] => [
      cx + ux * height * t,
      cy + uy * height * t,
      dx + ux * height * t,
      dy + uy * height * t,
    ];
    // 형광펜은 줄 전체, 밑줄은 아래쪽, 취소선은 가운데에 줄 높이의 7% 굵기로
    const line = Math.max(0.5, height * 0.07);
    if (highlight) {
      ops.push(`${ax} ${ay} m ${bx} ${by} l ${dx} ${dy} l ${cx} ${cy} l h f`);
    } else if (kind === 'Squiggly') {
      // 물결 밑줄: 아래 변을 따라 오르내리는 꺾은선
      const [x0, y0, x1, y1] = along(0.1);
      const length = Math.hypot(x1 - x0, y1 - y0);
      const wave = Math.max(1, height * 0.08);
      const step = Math.max(1, height * 0.12);
      const path = [`${x0} ${y0} m`];
      for (let at = step, up = true; at <= length; at += step, up = !up) {
        const x = x0 + ((x1 - x0) * at) / length + (up ? ux * wave : 0);
        const y = y0 + ((y1 - y0) * at) / length + (up ? uy * wave : 0);
        path.push(`${x} ${y} l`);
      }
      ops.push(`${line} w`, ...path, 'S');
    } else {
      const [x0, y0, x1, y1] = along(kind === 'StrikeOut' ? 0.5 : 0.1);
      ops.push(`${line} w ${x0} ${y0} m ${x1} ${y1} l S`);
    }
  }
  ops.push('Q');
  const stream = context.stream(ops.join('\n'), {
    Type: 'XObject',
    Subtype: 'Form',
    BBox: rect,
    Resources: {
      // 형광펜은 곱하기로 섞어 밑의 글자가 비치게 한다
      ExtGState: {
        GS0: { Type: 'ExtGState', BM: highlight ? 'Multiply' : 'Normal', ca: alpha, CA: alpha },
      },
    },
  });
  return context.register(stream);
}

/** 위젯이 인쇄되는지 (/F의 인쇄 플래그, 숨김이 아님) */
function printable(dict: PDFDict): boolean {
  const flags = dict.context.lookup(dict.get(PDFName.of('F')));
  const value = flags instanceof PDFNumber ? flags.asNumber() : 0;
  return (value & PRINT) !== 0 && (value & HIDDEN) === 0;
}

/**
 * pdf-lib가 모양으로 그릴 글자. undefined면 보기 프로그램과 같은 모양을 만들 수 없다
 * (드롭다운은 고른 값의 표시 문자열이 아니라 내보내는 값을 그린다)
 */
function fieldText(field: PDFField): string[] | undefined {
  if (field instanceof PDFTextField) return [field.getText() ?? ''];
  if (field instanceof PDFDropdown) {
    const selected = field.getSelected();
    const options = field.acroField.getOptions();
    const shown = selected.map(
      (value) =>
        options.find((option) => option.value.decodeText() === value)?.display.decodeText() ??
        value,
    );
    return shown.every((text, i) => text === selected[i]) ? selected : undefined;
  }
  // 목록 상자는 보이는 선택지를 모두 그린다
  if (field instanceof PDFOptionList) return [...field.getOptions(), ...field.getSelected()];
  return [];
}

/** 쪽들의 주석 사전 (입력 칸이 어느 쪽에 있는지 보려고) */
function widgetsOn(pages: PDFPage[]): Set<PDFDict> {
  const found = new Set<PDFDict>();
  for (const page of pages) {
    const annots = page.doc.context.lookup(page.node.get(PDFName.of('Annots')));
    if (!(annots instanceof PDFArray)) continue;
    for (const item of annots.asArray()) {
      const annot = page.doc.context.lookup(item);
      if (annot instanceof PDFDict) found.add(annot);
    }
  }
  return found;
}

/**
 * 모양 스트림(/AP) 없이 저장된 양식 입력값은 보기 프로그램이 그때그때 그린다 (NeedAppearances).
 * 평면화하려면 모양이 있어야 하므로 먼저 만든다. 만들 수 없으면(기본 글꼴에 없는 한글 등) 조용히 빼지 않고 알린다.
 */
export function renderMissingFormAppearances(doc: PDFDocument, pages?: PDFPage[]): void {
  let form;
  let missing: PDFField[];
  try {
    form = doc.getForm();
    // pages를 주면 그 쪽들에 있는 칸만 (가리기: 그림으로 바꾸는 쪽의 칸은 옮기지 않는다)
    const onPages = pages && widgetsOn(pages);
    missing = form
      .getFields()
      .filter((field) => field.needsAppearancesUpdate())
      .filter(
        (field) =>
          !onPages || field.acroField.getWidgets().some((widget) => onPages.has(widget.dict)),
      );
  } catch {
    // 양식 구조를 읽을 수 없으면 있는 모양만 쓴다
    return;
  }
  if (missing.length === 0) return;
  const font = doc.embedStandardFont(StandardFonts.Helvetica);
  // 기본 글꼴에 없는 글자는 pdf-lib가 오류 없이 빼 버리므로 먼저 확인한다
  const supported = new Set(font.getCharacterSet());
  // 인쇄되지 않는 입력 칸은 결과에 들어가지 않으므로 따지지 않는다
  const printed = missing.filter((field) =>
    field.acroField.getWidgets().some((widget) => printable(widget.dict)),
  );
  const unsupported = printed.some((field) => {
    const texts = fieldText(field);
    return (
      !texts ||
      texts.some((text) =>
        [...text].some((char) => !/[\r\n]/.test(char) && !supported.has(char.codePointAt(0)!)),
      )
    );
  });
  if (unsupported) throw new Error(UNRENDERED_ANNOTATION);
  try {
    form.updateFieldAppearances(font);
  } catch {
    throw new Error(UNRENDERED_ANNOTATION);
  }
}

/** 쪽의 주석 모양을 쪽 내용에 그려 넣고 주석은 뺀다. 그려 넣은 주석이 있으면 true */
export function flattenAnnotations(page: PDFPage): boolean {
  const context = page.doc.context;
  const annots = context.lookup(page.node.get(PDFName.of('Annots')));
  if (!(annots instanceof PDFArray)) return false;

  let drawn = false;
  let wrapped = false;
  for (const entry of annots.asArray()) {
    const annot = context.lookup(entry);
    if (!(annot instanceof PDFDict)) continue;
    // 메모 창은 종이에 보이는 것이 없다
    const subtype = annot.get(PDFName.of('Subtype'));
    if (subtype === PDFName.of('Popup')) continue;
    // 종이에 찍을 결과라 인쇄할 때 나오는 주석만 넣는다 (화면 전용 버튼·메모는 빼고, 인쇄 전용은 넣는다)
    if (!printable(annot)) continue;
    const rect = numbers(context.lookup(annot.get(PDFName.of('Rect'))), 4);
    const normal = normalAppearance(annot);
    if (normal === 'empty') continue;
    // 모양이 저장되지 않은 링크는 보이는 것이 없다 (링크 테두리는 보기 프로그램도 보통 그리지 않는다).
    // 모양이 있는 링크는 다른 주석처럼 그린다
    if (normal === undefined && subtype === PDFName.of('Link')) continue;
    const appearance = normal ?? (rect && markupAppearance(annot, rect));
    // 인쇄되는데 모양을 만들 수 없는 주석은 조용히 빼지 않고 알린다
    if (!rect || !appearance) throw new Error(UNRENDERED_ANNOTATION);
    const stream = context.lookup(appearance) as PDFStream;
    const bbox = numbers(context.lookup(stream.dict.get(PDFName.of('BBox'))), 4);
    if (!bbox) throw new Error(UNRENDERED_ANNOTATION);
    const matrix = (numbers(context.lookup(stream.dict.get(PDFName.of('Matrix'))), 6) ?? [
      1, 0, 0, 1, 0, 0,
    ]) as Matrix;

    // 모양의 BBox를 /Matrix로 옮긴 영역이 주석 Rect에 맞도록 늘리고 옮긴다
    const corners = [
      [bbox[0]!, bbox[1]!],
      [bbox[2]!, bbox[1]!],
      [bbox[0]!, bbox[3]!],
      [bbox[2]!, bbox[3]!],
    ].map(([x, y]) => [
      matrix[0] * x! + matrix[2] * y! + matrix[4],
      matrix[1] * x! + matrix[3] * y! + matrix[5],
    ]);
    const xs = corners.map((c) => c[0]!);
    const ys = corners.map((c) => c[1]!);
    const [x0, y0, x1, y1] = [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
    const [rx0, ry0, rx1, ry1] = [
      Math.min(rect[0]!, rect[2]!),
      Math.min(rect[1]!, rect[3]!),
      Math.max(rect[0]!, rect[2]!),
      Math.max(rect[1]!, rect[3]!),
    ];
    if (x1 - x0 <= 0 || y1 - y0 <= 0) continue;
    const sx = (rx1 - rx0) / (x1 - x0);
    const sy = (ry1 - ry0) / (y1 - y0);

    if (!wrapped) {
      // 쪽 내용이 그래픽 상태를 되돌리지 않고 끝나도 주석 모양이 엉뚱한 자리에 그려지지 않게 한다
      isolateContent(page);
      wrapped = true;
    }
    const name = page.node.newXObject('FlatAnnot', appearance);
    page.pushOperators(
      pushGraphicsState(),
      concatTransformationMatrix(sx, 0, 0, sy, rx0 - x0 * sx, ry0 - y0 * sy),
      drawObject(name),
      popGraphicsState(),
    );
    drawn = true;
  }
  page.node.delete(PDFName.of('Annots'));
  return drawn;
}
