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
  PDFNumber,
  PDFRawStream,
  PDFStream,
  decodePDFRawStream,
  type PDFObject,
  type PDFPage,
} from '@cantoo/pdf-lib';
import { GS_FONT, contentUsage, type FormLookup, type ResourceUse } from './content-usage';
import { flattenAnnotations, renderMissingFormAppearances } from './flatten-annotations';
import { userUnit, viewSize } from './page-geometry';

/** 쪽 자원 중 내용에서 이름으로 부르는 것들 */
const NAMED = ['XObject', 'Font', 'ExtGState', 'Pattern', 'Shading', 'ColorSpace', 'Properties'];
/**
 * 남긴 자원(그림·묶음 그림·글꼴 등)에서 빼는 항목: 첨부 파일, 앱 데이터, XMP(사진 설명 등),
 * 그림의 대체 그림(/Alternates, 화면에 보이지 않지만 다른 그림을 가리킬 수 있다),
 * 다른 PDF 쪽을 가리키는 연결(/Ref, 파일을 품을 수 있다)과 인쇄용 원본 파일 연결(/OPI).
 * 묶음 그림은 자기 내용(대신 보여 주는 모습)만 남는다
 */
const NESTED_DROP = ['AF', 'PieceInfo', 'Metadata', 'Alternates', 'Ref', 'OPI'];
/** 장치 색공간 대신 저절로 쓰이는 기본 색공간 */
const DEFAULT_SPACES = ['DefaultGray', 'DefaultRGB', 'DefaultCMYK'];
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

/** 한 번의 가리기에서 정리한 것들 */
interface Pruning {
  /** 이미 정리한 사전 (같이 쓰는 묶음 그림을 두 번 정리하지 않게) */
  visited: Set<PDFDict>;
  /** Type3 글꼴 → 남길 쪽에서 실제로 찍은 글자 코드 (모든 쪽을 훑은 뒤 한 번에 정리한다) */
  type3: Map<PDFDict, Set<number>>;
}

/**
 * 자원 목록을 새로 만들어, 내용(streams)에서 연산자로 부르지 않는 것은 뺀다 (/F1 Tf는 글꼴 F1만 남긴다).
 * 남긴 것 중 자기 내용과 자원을 가진 것(묶음 그림, 무늬, 투명 마스크의 그림)도 같은 방법으로 정리하고,
 * Type3 글꼴은 찍은 글자를 모아 두었다가 나중에 정리한다.
 * 원래 목록은 다른 쪽과 같이 쓸 수 있어 고치지 않고 새로 만든다 (원래 PDF는 저장하지 않으므로
 * 묶음 그림 자체는 고쳐도 된다)
 */
function pruneResources(
  holder: PDFDict,
  resources: PDFDict | undefined,
  streams: PDFStream[],
  pruning: Pruning,
) {
  if (!resources) return;
  const context = holder.context;
  // 묶음 그림은 부른 자리에서 이어서 훑는다. 자원 목록이 없는 것은 그 목록을 물려받고(예전 방식),
  // 있는 것도 부른 자리의 글꼴로 찍은 글자는 그 글꼴의 것이다
  const stateFont = stateFontIn(resources);
  const scan = (texts: string[]) =>
    contentUsage(texts, formsIn(resources), (name) => stateFont(name) instanceof PDFDict);
  const usage = scan(streams.map(streamText));
  // 투명 마스크(/SMask /G)의 묶음 그림이 자원 목록 없이 이 목록을 물려받으면 그 내용도 이 목록 기준으로 센다
  const states = context.lookup(resources.get(PDFName.of('ExtGState')));
  const masked = new Set<PDFStream>();
  for (let grew = true; grew && states instanceof PDFDict;) {
    grew = false;
    for (const name of usage.resources.get('ExtGState') ?? []) {
      const state = context.lookup(states.get(PDFName.of(name)));
      const mask =
        state instanceof PDFDict ? context.lookup(state.get(PDFName.of('SMask'))) : undefined;
      const group = mask instanceof PDFDict ? context.lookup(mask.get(PDFName.of('G'))) : undefined;
      if (!(group instanceof PDFStream) || masked.has(group)) continue;
      if (group.dict.has(PDFName.of('Resources'))) continue;
      masked.add(group);
      const inner = scan([streamText(group)]);
      for (const [kind, names] of inner.resources) {
        const set = usage.resources.get(kind) ?? new Set<string>();
        for (const item of names) set.add(item);
        usage.resources.set(kind, set);
      }
      usage.text.push(...inner.text);
      grew = true;
    }
  }
  usedThroughNames(resources, usage.resources);
  const own = context.obj({});
  for (const [key, value] of resources.entries()) {
    const kind = key.decodeText();
    const entry = context.lookup(value);
    if (!NAMED.includes(kind) || !(entry instanceof PDFDict)) {
      own.set(key, value);
      continue;
    }
    const used = usage.resources.get(kind) ?? new Set<string>();
    const kept = context.obj({});
    for (const [name, item] of entry.entries()) {
      // 기본 색공간(/DefaultRGB 등)은 이름으로 부르지 않고 g·rg·k와 장치 색 그림에 저절로 쓰인다
      const implicit = kind === 'ColorSpace' && DEFAULT_SPACES.includes(name.decodeText());
      if (!implicit && !used.has(name.decodeText())) continue;
      kept.set(name, item);
      pruneNested(context.lookup(item), pruning);
    }
    own.set(key, kept);
  }
  holder.set(PDFName.of('Resources'), own);
  // Type3 글꼴로 찍은 글자 코드를 모은다
  const fonts = context.lookup(resources.get(PDFName.of('Font')));
  for (const { font, codes } of usage.text) {
    const dict = font.startsWith(GS_FONT)
      ? stateFont(font.slice(GS_FONT.length))
      : fonts instanceof PDFDict
        ? context.lookup(fonts.get(PDFName.of(font)))
        : undefined;
    const codesOf = dict instanceof PDFDict ? pruning.type3.get(dict) : undefined;
    for (const code of codes) codesOf?.add(code);
  }
}

/** 자원 목록의 그래픽 상태가 /Font [글꼴 크기]로 고른 글꼴 */
function stateFontIn(resources: PDFDict) {
  const context = resources.context;
  const states = context.lookup(resources.get(PDFName.of('ExtGState')));
  return (name: string) => {
    const state =
      states instanceof PDFDict ? context.lookup(states.get(PDFName.of(name))) : undefined;
    const font =
      state instanceof PDFDict ? context.lookup(state.get(PDFName.of('Font'))) : undefined;
    return font instanceof PDFArray ? context.lookup(font.get(0)) : undefined;
  };
}

/** 자원 목록에서 이름으로 묶음 그림을 찾는다 (그 안에서 또 부르는 것은 그 묶음 그림의 목록에서) */
function formsIn(resources: PDFDict): FormLookup {
  const context = resources.context;
  const xobjects = context.lookup(resources.get(PDFName.of('XObject')));
  return (name) => {
    const form =
      xobjects instanceof PDFDict ? context.lookup(xobjects.get(PDFName.of(name))) : undefined;
    if (!(form instanceof PDFStream)) return undefined;
    if (form.dict.get(PDFName.of('Subtype')) !== PDFName.of('Form')) return undefined;
    const own = context.lookup(form.dict.get(PDFName.of('Resources')));
    return own instanceof PDFDict
      ? {
          key: form,
          text: streamText(form),
          own: true,
          forms: formsIn(own),
          gsFont: (state: string) => stateFontIn(own)(state) instanceof PDFDict,
        }
      : { key: form, text: streamText(form), own: false };
  };
}

/**
 * 남기는 그림·음영·무늬가 사전 안에서 이름으로 부르는 같은 목록의 색공간(/ColorSpace /CS1)도 쓰는 것으로 센다.
 * 내용에는 그 이름이 나오지 않는다
 */
function usedThroughNames(resources: PDFDict, used: ResourceUse) {
  const context = resources.context;
  const spaces = used.get('ColorSpace') ?? new Set<string>();
  /** 색공간 값 안의 이름을 모두 모은다 ([/Indexed /CS1 255 …], [/Separation /Gold /CS2 …] 등) */
  const namesIn = (value: unknown, depth = 0) => {
    const resolved = context.lookup(value as PDFObject);
    if (resolved instanceof PDFName) spaces.add(resolved.decodeText());
    else if (resolved instanceof PDFArray && depth < 8) {
      for (const item of resolved.asArray()) namesIn(item, depth + 1);
    }
  };
  const addSpace = (dict: unknown) => {
    const holder = dict instanceof PDFStream ? dict.dict : dict;
    if (holder instanceof PDFDict) namesIn(holder.get(PDFName.of('ColorSpace')));
  };
  for (const kind of ['XObject', 'Shading', 'Pattern']) {
    const entry = context.lookup(resources.get(PDFName.of(kind)));
    if (!(entry instanceof PDFDict)) continue;
    for (const name of used.get(kind) ?? []) {
      const object = context.lookup(entry.get(PDFName.of(name)));
      addSpace(object);
      // 음영 무늬(PatternType 2)는 안의 음영이 색공간을 정한다
      const pattern = object instanceof PDFStream ? object.dict : object;
      if (pattern instanceof PDFDict) addSpace(context.lookup(pattern.get(PDFName.of('Shading'))));
    }
  }
  // 색공간 정의가 다른 이름 색공간을 부르면(/CS1 [/Indexed /CS2 …]) 그것도 남긴다.
  // 저절로 쓰이는 기본 색공간의 정의도 따라간다
  const defined = context.lookup(resources.get(PDFName.of('ColorSpace')));
  if (defined instanceof PDFDict) {
    for (const name of DEFAULT_SPACES) if (defined.has(PDFName.of(name))) spaces.add(name);
    for (let size = -1; size !== spaces.size;) {
      size = spaces.size;
      for (const name of [...spaces]) namesIn(defined.get(PDFName.of(name)));
    }
  }
  used.set('ColorSpace', spaces);
}

/** 자원 하나 안에 다시 내용과 자원이 있으면 정리한다 */
function pruneNested(object: unknown, pruning: Pruning) {
  const dict = object instanceof PDFStream ? object.dict : object;
  if (!(dict instanceof PDFDict) || pruning.visited.has(dict)) return;
  pruning.visited.add(dict);
  // 남긴 그림·묶음 그림·글꼴에 붙은 첨부 파일(PDF 2.0 /AF)과 앱 데이터는 옮기지 않는다
  for (const key of NESTED_DROP) dict.delete(PDFName.of(key));
  const context = dict.context;
  const resources = context.lookup(dict.get(PDFName.of('Resources')));
  const own = resources instanceof PDFDict ? resources : undefined;
  // Type3 글꼴: 어떤 글자를 쓰는지 모든 쪽을 본 뒤에 정리한다 (finishType3)
  if (dict.get(PDFName.of('Subtype')) === PDFName.of('Type3')) {
    pruning.type3.set(dict, new Set());
    return;
  }
  // 묶음 그림(Form)·바둑무늬(PatternType 1): 자기 내용으로 부르는 것만 남긴다
  if (object instanceof PDFStream && (own || dict.has(PDFName.of('PatternType')))) {
    pruneResources(dict, own, [object], pruning);
  }
  // 그래픽 상태가 /Font [글꼴 크기]로 고르는 글꼴 (Type3이면 찍은 글자 모양만 남긴다)
  const stateFont = context.lookup(dict.get(PDFName.of('Font')));
  if (stateFont instanceof PDFArray) pruneNested(context.lookup(stateFont.get(0)), pruning);
  // 투명 마스크: 그래픽 상태의 /SMask /G 묶음 그림, 그림의 /SMask·/Mask 그림
  const softMask = context.lookup(dict.get(PDFName.of('SMask')));
  if (softMask instanceof PDFStream) pruneNested(softMask, pruning);
  else if (softMask instanceof PDFDict)
    pruneNested(context.lookup(softMask.get(PDFName.of('G'))), pruning);
  const mask = context.lookup(dict.get(PDFName.of('Mask')));
  if (mask instanceof PDFStream) pruneNested(mask, pruning);
}

/** Type3 글꼴의 글자 코드 → 글자 모양 이름 (/Encoding /Differences) */
function glyphNames(font: PDFDict): Map<number, string> {
  const context = font.context;
  const names = new Map<number, string>();
  const encoding = context.lookup(font.get(PDFName.of('Encoding')));
  const differences =
    encoding instanceof PDFDict
      ? context.lookup(encoding.get(PDFName.of('Differences')))
      : undefined;
  if (!(differences instanceof PDFArray)) return names;
  let code = 0;
  for (const item of differences.asArray()) {
    const value = context.lookup(item);
    if (value instanceof PDFNumber) code = value.asNumber();
    else if (value instanceof PDFName) names.set(code++, value.decodeText());
  }
  return names;
}

/** Type3 글꼴마다 남길 쪽에서 찍은 글자의 모양(CharProcs)만 남기고, 그 모양들이 부르는 자원만 남긴다 */
function finishType3(pruning: Pruning) {
  for (const [font, codes] of pruning.type3) {
    const context = font.context;
    const procs = context.lookup(font.get(PDFName.of('CharProcs')));
    if (!(procs instanceof PDFDict)) continue;
    const names = glyphNames(font);
    // 찍은 글자 중 /Differences에 없는 것이 있으면(기본 인코딩 /BaseEncoding을 따르거나 규격 위반)
    // 어떤 모양을 쓰는지 알 수 없어 모두 남긴다
    const used = [...codes].some((code) => !names.has(code))
      ? new Set(procs.keys().map((key) => key.decodeText()))
      : new Set([...codes].map((code) => names.get(code)).filter(Boolean) as string[]);
    const kept = context.obj({});
    const streams: PDFStream[] = [];
    for (const [name, item] of procs.entries()) {
      if (!used.has(name.decodeText())) continue;
      kept.set(name, item);
      const glyph = context.lookup(item);
      if (glyph instanceof PDFStream) streams.push(glyph);
    }
    font.set(PDFName.of('CharProcs'), kept);
    const resources = context.lookup(font.get(PDFName.of('Resources')));
    pruneResources(font, resources instanceof PDFDict ? resources : undefined, streams, pruning);
  }
}

/** 쪽의 자원 목록을 쪽 내용 기준으로 정리한다 */
function prunePage(page: PDFPage, pruning: Pruning) {
  const context = page.doc.context;
  const contents = context.lookup(page.node.get(PDFName.of('Contents')));
  const streams = (
    contents instanceof PDFArray
      ? contents.asArray().map((item) => context.lookup(item))
      : [contents]
  ).filter((item): item is PDFStream => item instanceof PDFStream);
  pruneResources(page.node, page.node.Resources(), streams, pruning);
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
  // 옮길 쪽을 먼저 정리한 뒤 한 번에 복사한다. 쪽마다 따로 복사하면 같이 쓰는 글꼴·그림이 쪽 수만큼 복제된다
  const kept: number[] = [];
  const pruning: Pruning = { visited: new Set(), type3: new Map() };
  for (const [index, page] of source.getPages().entries()) {
    if (rasters.has(index)) continue;
    flattenAnnotations(page);
    for (const key of DROP) page.node.delete(PDFName.of(key));
    prunePage(page, pruning);
    kept.push(index);
  }
  // Type3 글꼴이 글자 모양 안에서 부르는 Type3 글꼴은 거의 없지만, 새로 들어오면 다시 정리한다
  for (let size = -1; size !== pruning.type3.size;) {
    size = pruning.type3.size;
    finishType3(pruning);
  }
  const copied = await out.copyPages(source, kept);
  for (const [index, page] of source.getPages().entries()) {
    const jpg = rasters.get(index);
    if (!jpg) {
      out.addPage(copied[kept.indexOf(index)]!);
      continue;
    }
    // 보이는 크기(pt) 그대로 그림 한 장짜리 쪽
    const unit = userUnit(page);
    const view = viewSize(page);
    const width = view.width * unit;
    const height = view.height * unit;
    const image = await out.embedJpg(jpg);
    out.addPage([width, height]).drawImage(image, { x: 0, y: 0, width, height });
  }
  return out;
}
