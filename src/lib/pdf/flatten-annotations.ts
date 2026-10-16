/**
 * 주석(양식 입력값·서명·도장·메모 표시 등)이 화면에 보이는 모양을 쪽 내용에 그려 넣는다 (워커에서 쓴다).
 * 쪽 내용만 옮기는 처리(모아찍기의 embedPages 등)는 주석을 옮기지 못해, 그대로 두면 입력한 값이 사라진다.
 * 그리는 방법은 PDF 규격(ISO 32000 12.5.5)의 주석 모양 그리기를 따른다.
 */
import {
  PDFArray,
  PDFContentStream,
  PDFDict,
  PDFName,
  PDFNumber,
  PDFRef,
  PDFStream,
  concatTransformationMatrix,
  drawObject,
  popGraphicsState,
  pushGraphicsState,
  type PDFPage,
} from '@cantoo/pdf-lib';

/** /F 플래그: 숨김(2), 화면에 안 보임(32) */
const HIDDEN = 2;
const NO_VIEW = 32;

type Matrix = [number, number, number, number, number, number];

function numbers(value: unknown, count: number): number[] | undefined {
  if (!(value instanceof PDFArray) || value.size() !== count) return undefined;
  const out = value.asArray().map((item) => (item instanceof PDFNumber ? item.asNumber() : NaN));
  return out.every(Number.isFinite) ? out : undefined;
}

/** 주석이 지금 보이는 모양 (/AP /N, 상태가 여럿이면 /AS로 고른 것) */
function normalAppearance(annot: PDFDict): PDFRef | undefined {
  const lookup = annot.context.lookup.bind(annot.context);
  const ap = lookup(annot.get(PDFName.of('AP')));
  if (!(ap instanceof PDFDict)) return undefined;
  let normal = ap.get(PDFName.of('N'));
  const resolved = lookup(normal);
  if (resolved instanceof PDFDict && !(resolved instanceof PDFStream)) {
    const state = annot.get(PDFName.of('AS'));
    if (!(state instanceof PDFName)) return undefined;
    normal = resolved.get(state);
  }
  if (normal instanceof PDFRef) return lookup(normal) instanceof PDFStream ? normal : undefined;
  // 직접 들어 있는 스트림은 참조로 등록해야 쪽 자원에서 부를 수 있다
  if (normal instanceof PDFStream) return annot.context.register(normal);
  return undefined;
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
    if (annot.get(PDFName.of('Subtype')) === PDFName.of('Popup')) continue;
    const flags = context.lookup(annot.get(PDFName.of('F')));
    const flagValue = flags instanceof PDFNumber ? flags.asNumber() : 0;
    if (flagValue & (HIDDEN | NO_VIEW)) continue;
    const rect = numbers(context.lookup(annot.get(PDFName.of('Rect'))), 4);
    const appearance = normalAppearance(annot);
    if (!rect || !appearance) continue;
    const stream = context.lookup(appearance) as PDFStream;
    const bbox = numbers(context.lookup(stream.dict.get(PDFName.of('BBox'))), 4);
    if (!bbox) continue;
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
      // 쪽 내용이 그래픽 상태를 되돌리지 않고 끝나도 주석 모양이 엉뚱한 자리에 그려지지 않게 q…Q로 감싼다
      page.node.normalize();
      if (page.node.Contents()) {
        const start = context.register(PDFContentStream.of(context.obj({}), [pushGraphicsState()]));
        const end = context.register(PDFContentStream.of(context.obj({}), [popGraphicsState()]));
        page.node.wrapContentStreams(start, end);
      }
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
