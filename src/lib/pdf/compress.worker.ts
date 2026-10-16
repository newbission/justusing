/**
 * PDF 압축 워커 (compress.ts가 부른다). pdf-lib로 파일을 열어 줄일 만한 사진을 꺼내고(scan),
 * 사진 워커들이 줄인 사진을 받아 바꿔 넣은 뒤 저장한다(finish). 파일은 메모리에서만 다룬다.
 */
import {
  PDFArray,
  PDFDict,
  PDFDocument,
  PDFName,
  PDFNumber,
  PDFRawStream,
  PDFRef,
  PDFStream,
  type PDFObject,
} from '@cantoo/pdf-lib';
import type { PdfRequest, PdfResponse, SourceImage } from './compress';
import { removeUnused } from './remove-unused';

/** 이보다 작은 사진은 줄여도 얼마 안 돼 건드리지 않는다 (아이콘·로고 등) */
const MIN_IMAGE_BYTES = 20_000;
/** 압축 안 된 스트림을 이 크기 이상이면 압축한다 */
const MIN_STREAM_BYTES = 1_024;

/** scan과 finish 사이에 열어 둔 문서와 꺼낸 사진들의 자리 */
const open = new Map<number, { doc: PDFDocument; refs: PDFRef[] }>();

const name = (value: string) => PDFName.of(value);

/** Filter가 이것 하나뿐인지 (이름 또는 한 칸짜리 배열) */
function singleFilter(dict: PDFDict): string | undefined {
  const filter = dict.lookup(name('Filter'));
  if (filter === undefined) return '';
  if (filter instanceof PDFName) return filter.decodeText();
  if (filter instanceof PDFArray && filter.size() === 1) {
    const only = filter.lookup(0);
    if (only instanceof PDFName) return only.decodeText();
  }
  return undefined;
}

/** 색 수: 회색 1, RGB 3. 그 밖(CMYK·색 목록·특수 색)은 undefined */
function colorCount(dict: PDFDict): 1 | 3 | undefined {
  const space = dict.lookup(name('ColorSpace'));
  const of = (value: string) =>
    value === 'DeviceGray' || value === 'CalGray'
      ? 1
      : value === 'DeviceRGB' || value === 'CalRGB'
        ? 3
        : undefined;
  if (space instanceof PDFName) return of(space.decodeText());
  if (space instanceof PDFArray && space.size() >= 1) {
    const kind = space.lookup(0);
    if (!(kind instanceof PDFName)) return undefined;
    if (kind.decodeText() === 'ICCBased') {
      const profile = space.lookup(1);
      const n = profile instanceof PDFStream ? profile.dict.lookup(name('N')) : undefined;
      if (n instanceof PDFNumber)
        return n.asNumber() === 1 ? 1 : n.asNumber() === 3 ? 3 : undefined;
      return undefined;
    }
    return of(kind.decodeText());
  }
  return undefined;
}

function numberOf(dict: PDFDict | undefined, key: string): number | undefined {
  const value = dict?.lookup(name(key));
  return value instanceof PDFNumber ? value.asNumber() : undefined;
}

/** 다른 사진의 투명도(SMask)·가림(Mask)으로 쓰이는 사진. 바꾸면 모양이 어긋날 수 있어 둔다 */
function maskRefs(doc: PDFDocument): Set<PDFRef> {
  const masks = new Set<PDFRef>();
  for (const [, object] of doc.context.enumerateIndirectObjects()) {
    if (!(object instanceof PDFStream)) continue;
    for (const key of ['SMask', 'Mask']) {
      const value = object.dict.get(name(key));
      if (value instanceof PDFRef) masks.add(value);
    }
  }
  return masks;
}

/** 이 객체가 줄일 수 있는 사진이면 꺼낸다 */
/**
 * 쪽·Form 리소스가 장치 색을 다른 색공간으로 바꿔 쓰는지 (DefaultGray·DefaultRGB).
 * 그러면 회색 사진을 DeviceRGB로 바꿀 때 적용되는 색 변환이 달라진다.
 */
function hasDefaultColorSpaces(doc: PDFDocument): boolean {
  for (const [, object] of doc.context.enumerateIndirectObjects()) {
    const dicts =
      object instanceof PDFDict ? [object] : object instanceof PDFStream ? [object.dict] : [];
    for (const dict of dicts) {
      const resources = dict.lookup(name('Resources'));
      const spaces =
        resources instanceof PDFDict ? resources.lookup(name('ColorSpace')) : undefined;
      if (
        spaces instanceof PDFDict &&
        (spaces.has(name('DefaultGray')) || spaces.has(name('DefaultRGB')))
      )
        return true;
    }
  }
  return false;
}

function sourceImage(object: PDFObject, grayAllowed: boolean): SourceImage | undefined {
  if (!(object instanceof PDFRawStream)) return undefined;
  const { dict, contents } = object;
  if (dict.lookup(name('Subtype')) !== name('Image')) return undefined;
  if (contents.length < MIN_IMAGE_BYTES) return undefined;
  // 글자 모양 가림(ImageMask), 색 뒤집기(Decode), 색으로 투명 처리(Mask 배열)는 다시 저장하면 달라진다
  if (dict.lookup(name('ImageMask'))?.toString() === 'true') return undefined;
  if (dict.has(name('Decode')) || dict.lookup(name('Mask')) instanceof PDFArray) return undefined;
  // 미리 섞은 색(Matte)을 쓰는 투명도는 사진과 크기가 같아야 하고 색도 맞물려 있어 건드리지 않는다
  const softMask = dict.lookup(name('SMask'));
  if (softMask instanceof PDFStream && softMask.dict.has(name('Matte'))) return undefined;
  const colors = colorCount(dict);
  if (!colors) return undefined;
  // 다시 저장한 JPG는 늘 3색이다. 3색 색공간(보정·ICC 포함)은 화소 값을 그대로 두고 색공간도 그대로
  // 두면 같은 색이 되지만, 회색은 DeviceRGB로 바꿔야 해서 보정·ICC가 없는 DeviceGray만 다룬다
  if (colors === 1 && (!grayAllowed || dict.lookup(name('ColorSpace')) !== name('DeviceGray')))
    return undefined;
  const filter = singleFilter(dict);
  if (filter === 'DCTDecode') {
    // 색 변환 설정(ColorTransform)이 붙은 JPG는 브라우저가 다른 색으로 읽을 수 있다
    if (dict.has(name('DecodeParms'))) return undefined;
    return { kind: 'jpeg', bytes: contents.slice() };
  }
  if (filter !== 'FlateDecode' && filter !== '') return undefined;
  if (numberOf(dict, 'BitsPerComponent') !== 8) return undefined;
  const width = numberOf(dict, 'Width');
  const height = numberOf(dict, 'Height');
  if (!width || !height) return undefined;
  let parms = dict.lookup(name('DecodeParms'));
  if (parms instanceof PDFArray) parms = parms.lookup(0);
  const parmsDict = parms instanceof PDFDict ? parms : undefined;
  // 예측 설정은 Flate가 있을 때만 쓰인다 (필터 없는 스트림에 남은 DecodeParms는 무시된다)
  const predictor = filter === 'FlateDecode' ? (numberOf(parmsDict, 'Predictor') ?? 1) : 1;
  // TIFF 예측(2)은 거의 쓰이지 않아 다루지 않는다
  if (predictor !== 1 && predictor < 10) return undefined;
  // 예측의 한 줄 길이는 Colors·Columns로 정해진다. 사진 크기와 같을 때만 다룬다
  if (
    predictor >= 10 &&
    ((numberOf(parmsDict, 'Colors') ?? 1) !== colors ||
      (numberOf(parmsDict, 'Columns') ?? 1) !== width ||
      (numberOf(parmsDict, 'BitsPerComponent') ?? 8) !== 8)
  )
    return undefined;
  return {
    kind: 'pixels',
    bytes: contents.slice(),
    deflated: filter === 'FlateDecode',
    width,
    height,
    colors,
    predictor,
  };
}

async function deflate(bytes: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([bytes as BlobPart])
    .stream()
    .pipeThrough(new CompressionStream('deflate'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** 압축 없이 들어 있는 스트림(쪽 내용·글꼴 등)을 Flate로 압축한다. 손실이 없다 */
async function deflateRaw(doc: PDFDocument) {
  for (const [ref, object] of doc.context.enumerateIndirectObjects()) {
    if (!(object instanceof PDFRawStream)) continue;
    if (object.dict.has(name('Filter')) || object.contents.length < MIN_STREAM_BYTES) continue;
    const packed = await deflate(object.contents);
    if (packed.length >= object.contents.length) continue;
    const dict = object.dict.clone(doc.context);
    dict.set(name('Filter'), name('FlateDecode'));
    // 필터가 없어 무시되던 예측 설정이 새 Flate에 붙어 쓰이지 않게 지운다
    dict.delete(name('DecodeParms'));
    doc.context.assign(ref, PDFRawStream.of(dict, packed));
  }
}

addEventListener('message', async (event: MessageEvent<PdfRequest>) => {
  const request = event.data;
  const { id } = request;
  const send = (response: PdfResponse, transfer: Transferable[] = []) =>
    postMessage(response, { transfer });
  try {
    if (request.kind === 'drop') {
      open.delete(id);
      return;
    }
    if (request.kind === 'scan') {
      // 암호 PDF는 받은 암호로 풀어서 연다. 결과에는 암호가 없다 (암호 해제 도구와 같음)
      const doc = await PDFDocument.load(request.bytes, { password: request.password ?? '' });
      // 쓰지 않는 옛 사진까지 줄이느라 시간·메모리를 쓰지 않게 먼저 지운다
      removeUnused(doc);
      const masks = maskRefs(doc);
      const grayAllowed = !hasDefaultColorSpaces(doc);
      const refs: PDFRef[] = [];
      const images: SourceImage[] = [];
      for (const [ref, object] of doc.context.enumerateIndirectObjects()) {
        if (masks.has(ref)) continue;
        const image = sourceImage(object, grayAllowed);
        if (!image) continue;
        refs.push(ref);
        images.push(image);
      }
      open.set(id, { doc, refs });
      send(
        { id, kind: 'images', images },
        images.map((image) => image.bytes.buffer),
      );
      return;
    }

    const opened = open.get(id);
    if (!opened) throw new Error('no document');
    open.delete(id);
    const { doc, refs } = opened;
    for (const { index, bytes, width, height } of request.replacements) {
      const ref = refs[index]!;
      const old = doc.context.lookup(ref);
      if (!(old instanceof PDFRawStream)) continue;
      // 크기·형식만 바꾸고 색공간·투명도(SMask) 같은 나머지 설정은 그대로 둔다 (회색은 RGB로)
      const dict = old.dict.clone(doc.context);
      for (const key of ['Filter', 'DecodeParms', 'Length']) dict.delete(name(key));
      dict.set(name('Width'), PDFNumber.of(width));
      dict.set(name('Height'), PDFNumber.of(height));
      if (colorCount(dict) === 1) dict.set(name('ColorSpace'), name('DeviceRGB'));
      dict.set(name('BitsPerComponent'), PDFNumber.of(8));
      dict.set(name('Filter'), name('DCTDecode'));
      doc.context.assign(ref, PDFRawStream.of(dict, bytes));
    }
    await deflateRaw(doc);
    const out = await doc.save({ useObjectStreams: true });
    send({ id, kind: 'done', bytes: out }, [out.buffer]);
  } catch (error) {
    open.delete(id);
    send({ id, kind: 'error', message: error instanceof Error ? error.message : String(error) });
  }
});
