/**
 * 가리기(영구 삭제): 가린 쪽은 가린 자리를 검게 칠한 그림으로 바꾸고, 나머지 쪽만 새 PDF로 옮긴다
 * (modify.worker.ts에서 쓴다).
 *
 * 가린 글자가 파일 어디에도 남지 않게 하는 것이 목적이다. 그래서 원래 PDF를 고치지 않고 새 PDF를 만든다.
 * pdf-lib는 쓰지 않는 객체도 저장하므로, 원래 PDF를 고치면 지운 쪽의 내용이 파일 안에 남는다.
 * 옮기는 쪽에서도 다른 쪽(가린 쪽)을 가리키는 것을 끊는다:
 * - 주석은 보이는 모양만 쪽에 그려 넣고 뺀다 (링크·메모가 가린 쪽을 가리킬 수 있다)
 * - 쪽끼리 같이 쓰는 자원 목록에서 이 쪽이 쓰지 않는 것(가린 쪽의 그림·글꼴 등)을 뺀다
 * - 기사 흐름(/B), 쪽 동작(/AA), 앱 데이터(/PieceInfo), 쪽 첨부 파일(/AF) 등을 뺀다
 * 책갈피·문서 정보·양식처럼 문서 전체에 딸린 것은 옮기지 않는다.
 */
import {
  PDFArray,
  PDFDict,
  PDFDocument,
  PDFName,
  PDFRawStream,
  PDFStream,
  decodePDFRawStream,
  type PDFPage,
} from '@cantoo/pdf-lib';
import { flattenAnnotations, renderMissingFormAppearances } from './flatten-annotations';
import { userUnit, viewSize } from './page-geometry';

/** 쪽 자원 중 내용에서 이름으로 부르는 것들 */
const NAMED = ['XObject', 'Font', 'ExtGState', 'Pattern', 'Shading', 'ColorSpace', 'Properties'];
/**
 * 다른 쪽이나 문서 전체를 가리킬 수 있어 빼는 쪽 항목: 기사 흐름, 쪽 동작, 앱 데이터, 미리보기 그림,
 * 쪽 정보, 쪽에 딸린 첨부 파일(PDF 2.0), 문서 부분(PDF 2.0), 분판 정보(다른 쪽을 가리킨다)
 */
const DROP = ['B', 'AA', 'PieceInfo', 'Thumb', 'Metadata', 'AF', 'DPart', 'SeparationInfo'];

function streamText(stream: PDFStream): string {
  const bytes =
    stream instanceof PDFRawStream ? decodePDFRawStream(stream).decode() : stream.getContents();
  // 이름은 ASCII라 바이트를 그대로 글자로 읽어도 된다
  let text = '';
  for (let i = 0; i < bytes.length; i += 8192) {
    text += String.fromCharCode(...bytes.subarray(i, i + 8192));
  }
  return text;
}

/** 내용 스트림들에 나오는 이름들 (/Im1 Do, /F1 Tf …). #xx로 적은 글자는 풀어서 */
function usedNames(streams: PDFStream[]): Set<string> {
  const names = new Set<string>();
  for (const stream of streams) {
    for (const match of streamText(stream).matchAll(/\/([^\s/[\]()<>{}%]+)/g)) {
      names.add(
        match[1]!.replace(/#([0-9a-fA-F]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16))),
      );
    }
  }
  return names;
}

/**
 * 자원 목록을 새로 만들어, 내용(streams)에서 부르지 않는 것은 뺀다. 남긴 것 중 자기 내용과 자원을 가진 것
 * (묶음 그림, 무늬, 투명 마스크의 그림, Type3 글꼴)도 같은 방법으로 정리한다.
 * 원래 목록은 다른 쪽과 같이 쓸 수 있어 고치지 않고 새로 만든다 (원래 PDF는 저장하지 않으므로
 * 묶음 그림 자체는 고쳐도 된다)
 */
function pruneResources(
  holder: PDFDict,
  resources: PDFDict | undefined,
  streams: PDFStream[],
  visited: Set<PDFDict>,
) {
  if (!resources) return;
  const context = holder.context;
  const used = usedNames(streams);
  const own = context.obj({});
  for (const [key, value] of resources.entries()) {
    const entry = context.lookup(value);
    if (!NAMED.includes(key.decodeText()) || !(entry instanceof PDFDict)) {
      own.set(key, value);
      continue;
    }
    const kept = context.obj({});
    for (const [name, item] of entry.entries()) {
      if (!used.has(name.decodeText())) continue;
      kept.set(name, item);
      pruneNested(context.lookup(item), visited);
    }
    own.set(key, kept);
  }
  holder.set(PDFName.of('Resources'), own);
}

/** 자원 하나 안에 다시 내용과 자원이 있으면 정리한다 */
function pruneNested(object: unknown, visited: Set<PDFDict>) {
  const dict = object instanceof PDFStream ? object.dict : object;
  if (!(dict instanceof PDFDict) || visited.has(dict)) return;
  visited.add(dict);
  const context = dict.context;
  const resources = context.lookup(dict.get(PDFName.of('Resources')));
  const own = resources instanceof PDFDict ? resources : undefined;
  // 묶음 그림(Form)·바둑무늬(PatternType 1): 자기 내용으로 부르는 것만 남긴다
  if (object instanceof PDFStream && (own || dict.has(PDFName.of('PatternType')))) {
    pruneResources(dict, own, [object], visited);
  }
  // 투명 마스크(ExtGState /SMask /G)의 그림
  const softMask = context.lookup(dict.get(PDFName.of('SMask')));
  if (softMask instanceof PDFDict)
    pruneNested(context.lookup(softMask.get(PDFName.of('G'))), visited);
  // Type3 글꼴: 글자 모양 프로그램들이 부르는 것만 남긴다
  const procs = context.lookup(dict.get(PDFName.of('CharProcs')));
  if (procs instanceof PDFDict) {
    const glyphs = procs
      .values()
      .map((item) => context.lookup(item))
      .filter((item): item is PDFStream => item instanceof PDFStream);
    pruneResources(dict, own, glyphs, visited);
  }
}

/** 쪽의 자원 목록을 쪽 내용 기준으로 정리한다 */
function prunePage(page: PDFPage) {
  const context = page.doc.context;
  const contents = context.lookup(page.node.get(PDFName.of('Contents')));
  const streams = (
    contents instanceof PDFArray
      ? contents.asArray().map((item) => context.lookup(item))
      : [contents]
  ).filter((item): item is PDFStream => item instanceof PDFStream);
  pruneResources(page.node, page.node.Resources(), streams, new Set());
}

/**
 * pages: 가린 쪽 번호(0부터) → 가린 자리를 칠한 JPG. 화면에 보이는 모습(회전·보이는 영역)대로 그린 것
 */
export async function redact(
  source: PDFDocument,
  pages: { index: number; jpg: Uint8Array }[],
): Promise<PDFDocument> {
  const out = await PDFDocument.create();
  const rasters = new Map(pages.map((page) => [page.index, page.jpg]));
  // 양식 입력값은 쪽에 그려 넣어야 옮겨진다 (모양이 없으면 먼저 만든다). 그림으로 바꾸는 쪽의 칸은 옮기지 않는다
  renderMissingFormAppearances(
    source,
    source.getPages().filter((_, index) => !rasters.has(index)),
  );
  for (const [index, page] of source.getPages().entries()) {
    const jpg = rasters.get(index);
    if (jpg) {
      // 보이는 크기(pt) 그대로 그림 한 장짜리 쪽
      const unit = userUnit(page);
      const view = viewSize(page);
      const width = view.width * unit;
      const height = view.height * unit;
      const image = await out.embedJpg(jpg);
      out.addPage([width, height]).drawImage(image, { x: 0, y: 0, width, height });
      continue;
    }
    flattenAnnotations(page);
    for (const key of DROP) page.node.delete(PDFName.of(key));
    prunePage(page);
    const [copied] = await out.copyPages(source, [index]);
    out.addPage(copied!);
  }
  return out;
}
