/**
 * PDF 안의 사진 꺼내기 워커 (extract-images.ts가 부른다). 파일은 메모리에서만 다룬다.
 *
 * 쪽(과 쪽 안의 묶음 그림)이 쓰는 사진을 찾아, 같은 사진은 한 번만 꺼낸다.
 * - JPG(DCT)는 파일 안의 바이트 그대로 (화질 손실 없음). 투명도가 붙어 있으면 PNG로 합친다
 * - JPEG 2000(JPX)은 그대로 .jp2
 * - 그 밖에 흔한 형식(Flate, 8비트 이하 회색·RGB·색 목록, 투명도)은 화소를 풀어 PNG로
 * - 흑백 팩스(CCITT·JBIG2), CMYK 화소, 16비트, 보정 색공간, 쪽 내용에 바로 써 넣은 그림은 꺼내지 못한 것으로 센다
 * - ICC RGB 색공간이면 PNG에 그 프로필을 넣는다
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
  PDFString,
  PDFHexString,
  decodePDFRawStream,
} from '@cantoo/pdf-lib';
import type { ExtractRequest, ExtractResponse, ExtractedImage } from './extract-images';
import { inflate, unpredict } from './image-pixels';

const name = (value: string) => PDFName.of(value);

function numberOf(dict: PDFDict | undefined, key: string): number | undefined {
  const value = dict?.lookup(name(key));
  return value instanceof PDFNumber ? value.asNumber() : undefined;
}

/** 필터 이름들 (없으면 빈 배열) */
function filters(dict: PDFDict): string[] {
  const value = dict.lookup(name('Filter'));
  if (value instanceof PDFName) return [value.decodeText()];
  if (value instanceof PDFArray) {
    return value.asArray().map((item) => {
      const resolved = dict.context.lookup(item);
      return resolved instanceof PDFName ? resolved.decodeText() : '?';
    });
  }
  return [];
}

/** 색 읽는 법: 한 화소의 성분 수, 색 목록이면 그 목록, ICC 색공간이면 그 프로필 */
type Colors =
  | { components: 1 | 3; icc?: Uint8Array }
  | { components: 1; palette: Uint8Array; paletteColors: 1 | 3; icc?: Uint8Array };

/**
 * 기본 색공간의 성분 수 (회색 1, RGB 3)와 ICC 프로필. 보정 색공간(CalRGB·CalGray)처럼
 * 색을 바꿔야 하는데 바꿀 수 없는 것은 undefined (꺼내지 못한 것으로 센다)
 */
function baseSpace(space: unknown, dict: PDFDict): { n: 1 | 3; icc?: Uint8Array } | undefined {
  const lookup = dict.context.lookup.bind(dict.context);
  const resolved = lookup(space as PDFRef);
  if (resolved instanceof PDFName) {
    const value = resolved.decodeText();
    if (value === 'DeviceGray' || value === 'G') return { n: 1 };
    if (value === 'DeviceRGB' || value === 'RGB') return { n: 3 };
    return undefined;
  }
  if (resolved instanceof PDFArray && resolved.size() >= 1) {
    const kind = resolved.lookup(0);
    if (kind !== name('ICCBased')) return undefined;
    const profile = resolved.lookup(1);
    if (!(profile instanceof PDFRawStream)) return undefined;
    const n = numberOf(profile.dict, 'N');
    // RGB 프로필은 PNG에 같이 넣어 보기 프로그램이 색을 맞추게 한다.
    // 회색 프로필은 거의 감마 2.2 회색(sGray)이라 회색 그대로 쓴다 (RGB PNG에는 회색 프로필을 넣을 수 없다)
    if (n === 3) return { n: 3, icc: decodePDFRawStream(profile).decode() };
    if (n === 1) return { n: 1 };
    return undefined;
  }
  return undefined;
}

function colorsOf(dict: PDFDict): Colors | undefined {
  const space = dict.lookup(name('ColorSpace'));
  if (space instanceof PDFArray && space.lookup(0) === name('Indexed')) {
    const base = baseSpace(space.get(1), dict);
    // [/Indexed 기본색공간 최댓값 색목록]
    const table = space.lookup(3);
    if (!base) return undefined;
    let palette: Uint8Array | undefined;
    if (table instanceof PDFString) palette = table.asBytes();
    else if (table instanceof PDFHexString) palette = table.asBytes();
    else if (table instanceof PDFRawStream) palette = decodePDFRawStream(table).decode();
    if (!palette) return undefined;
    return { components: 1, palette, paletteColors: base.n, icc: base.icc };
  }
  const base = baseSpace(space, dict);
  return base ? { components: base.n, icc: base.icc } : undefined;
}

/** 스트림의 화소 바이트 (Flate·예측을 풀어서). 다른 필터면 undefined */
async function rawPixels(
  stream: PDFRawStream,
  width: number,
  height: number,
  components: number,
  bits: number,
) {
  const list = filters(stream.dict);
  if (list.length > 1 || (list.length === 1 && list[0] !== 'FlateDecode')) return undefined;
  const bytesPerRow = Math.ceil((width * components * bits) / 8);
  let data = list.length === 1 ? await inflate(stream.contents) : stream.contents;
  let parms = stream.dict.lookup(name('DecodeParms'));
  if (parms instanceof PDFArray) parms = parms.lookup(0);
  const predictor = list.length === 1 ? (numberOf(parms as PDFDict, 'Predictor') ?? 1) : 1;
  if (predictor >= 10) {
    // PNG 예측은 화소 단위(8비트면 성분 수 바이트), 8비트 미만이면 1바이트 단위로 앞 화소를 본다
    data =
      bits === 8
        ? unpredict(data, width, height, components)
        : unpredict(data, bytesPerRow, height, 1);
  } else if (predictor !== 1) return undefined;
  return data.length >= bytesPerRow * height ? data : undefined;
}

/** 1·2·4·8비트 값을 한 줄씩 읽는다 */
function sample(row: Uint8Array, offset: number, x: number, bits: number): number {
  if (bits === 8) return row[offset + x]!;
  const bit = x * bits;
  const byte = row[offset + (bit >> 3)]!;
  return (byte >> (8 - bits - (bit & 7))) & ((1 << bits) - 1);
}

/** 투명도(SMask)를 같은 크기의 0~255 값으로. 없거나 다룰 수 없으면 undefined */
async function alphaOf(dict: PDFDict, width: number, height: number) {
  const mask = dict.lookup(name('SMask'));
  if (!(mask instanceof PDFRawStream)) return undefined;
  if (numberOf(mask.dict, 'Width') !== width || numberOf(mask.dict, 'Height') !== height) {
    return undefined;
  }
  if ((numberOf(mask.dict, 'BitsPerComponent') ?? 8) !== 8) return undefined;
  return rawPixels(mask, width, height, 1, 8);
}

/** 화소를 풀어 RGBA로 (ICC 색공간이면 그 프로필과 함께). 다룰 수 없는 형식이면 undefined */
async function decodePixels(
  stream: PDFRawStream,
): Promise<{ pixels: ImageData; icc?: Uint8Array } | undefined> {
  const { dict } = stream;
  const width = numberOf(dict, 'Width');
  const height = numberOf(dict, 'Height');
  const bits = numberOf(dict, 'BitsPerComponent') ?? 8;
  if (!width || !height || dict.has(name('Decode'))) return undefined;
  const colors = colorsOf(dict);
  if (!colors) return undefined;
  const indexed = 'palette' in colors;
  // 색 목록은 1·2·4·8비트, 회색·RGB는 8비트만
  if (indexed ? ![1, 2, 4, 8].includes(bits) : bits !== 8) return undefined;
  // 색으로 투명 처리(/Mask 배열: 성분마다 [최소 최대])는 알파로 바꾼다. 그림으로 가리는 /Mask는 다루지 않는다
  const maskValue = dict.lookup(name('Mask'));
  let colorKey: number[] | undefined;
  if (maskValue instanceof PDFArray) {
    colorKey = maskValue.asArray().map((item) => {
      const value = dict.context.lookup(item);
      return value instanceof PDFNumber ? value.asNumber() : NaN;
    });
    if (colorKey.length !== colors.components * 2 || !colorKey.every(Number.isFinite)) {
      return undefined;
    }
  } else if (maskValue !== undefined) {
    return undefined;
  }
  const keyed = (...components: number[]) =>
    !!colorKey && components.every((c, i) => c >= colorKey[i * 2]! && c <= colorKey[i * 2 + 1]!);
  const bytesPerRow = Math.ceil((width * colors.components * bits) / 8);
  const data = await rawPixels(stream, width, height, colors.components, bits);
  if (!data) return undefined;
  const alpha = await alphaOf(dict, width, height);
  const rgba = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    const offset = y * bytesPerRow;
    for (let x = 0; x < width; x++) {
      const out = (y * width + x) * 4;
      let transparent: boolean;
      if (indexed) {
        const p = colors.palette;
        const n = colors.paletteColors;
        const index = sample(data, offset, x, bits);
        const i = index * n;
        rgba[out] = p[i] ?? 0;
        rgba[out + 1] = p[n === 3 ? i + 1 : i] ?? 0;
        rgba[out + 2] = p[n === 3 ? i + 2 : i] ?? 0;
        transparent = keyed(index);
      } else if (colors.components === 3) {
        rgba[out] = data[offset + x * 3]!;
        rgba[out + 1] = data[offset + x * 3 + 1]!;
        rgba[out + 2] = data[offset + x * 3 + 2]!;
        transparent = keyed(rgba[out]!, rgba[out + 1]!, rgba[out + 2]!);
      } else {
        rgba[out] = rgba[out + 1] = rgba[out + 2] = data[offset + x]!;
        transparent = keyed(rgba[out]!);
      }
      rgba[out + 3] = transparent ? 0 : alpha ? alpha[y * width + x]! : 255;
    }
  }
  return { pixels: new ImageData(rgba, width, height), icc: colors.icc };
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (const byte of bytes) c = CRC_TABLE[(c ^ byte) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** PNG에 ICC 프로필(iCCP)을 넣는다. 머리(IHDR) 바로 뒤에 둔다 */
async function withIcc(png: Uint8Array, icc: Uint8Array): Promise<Uint8Array> {
  const compressed = new Uint8Array(
    await new Response(
      new Blob([icc as BlobPart]).stream().pipeThrough(new CompressionStream('deflate')),
    ).arrayBuffer(),
  );
  // 이름 "ICC" + 0 + 압축 방식 0 + zlib 프로필
  const data = new Uint8Array([...new TextEncoder().encode('ICC'), 0, 0, ...compressed]);
  const typed = new Uint8Array([...new TextEncoder().encode('iCCP'), ...data]);
  const chunk = new Uint8Array(12 + data.length);
  const view = new DataView(chunk.buffer);
  view.setUint32(0, data.length);
  chunk.set(typed, 4);
  view.setUint32(8 + data.length, crc32(typed));
  // PNG 서명 8바이트 + IHDR(길이 4 + 종류 4 + 내용 13 + CRC 4)
  const ihdrEnd = 8 + 25;
  const out = new Uint8Array(png.length + chunk.length);
  out.set(png.subarray(0, ihdrEnd));
  out.set(chunk, ihdrEnd);
  out.set(png.subarray(ihdrEnd), ihdrEnd + chunk.length);
  return out;
}

async function png(image: ImageData | ImageBitmap): Promise<Uint8Array> {
  const canvas = new OffscreenCanvas(image.width, image.height);
  const context = canvas.getContext('2d')!;
  if (image instanceof ImageData) context.putImageData(image, 0, 0);
  else context.drawImage(image, 0, 0);
  const blob = await canvas.convertToBlob({ type: 'image/png' });
  return new Uint8Array(await blob.arrayBuffer());
}

/** JPG에 투명도를 합쳐 PNG로 */
async function jpegWithAlpha(stream: PDFRawStream, alpha: Uint8Array) {
  const bitmap = await createImageBitmap(
    new Blob([stream.contents as BlobPart], { type: 'image/jpeg' }),
    { imageOrientation: 'none' },
  );
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  const context = canvas.getContext('2d')!;
  context.drawImage(bitmap, 0, 0);
  bitmap.close();
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
  for (let i = 0; i < alpha.length && i * 4 + 3 < pixels.data.length; i++) {
    pixels.data[i * 4 + 3] = alpha[i]!;
  }
  return png(pixels);
}

/** 사진 하나를 꺼낸다. 다룰 수 없으면 undefined */
async function extract(
  stream: PDFRawStream,
): Promise<Omit<ExtractedImage, 'page' | 'index'> | undefined> {
  const { dict } = stream;
  const width = numberOf(dict, 'Width') ?? 0;
  const height = numberOf(dict, 'Height') ?? 0;
  const list = filters(dict);
  const last = list.at(-1);
  if (list.length === 1 && last === 'DCTDecode') {
    const alpha = await alphaOf(dict, width, height);
    if (alpha) return { ext: 'png', bytes: await jpegWithAlpha(stream, alpha), width, height };
    return { ext: 'jpg', bytes: stream.contents.slice(), width, height };
  }
  if (list.length === 1 && last === 'JPXDecode') {
    return { ext: 'jp2', bytes: stream.contents.slice(), width, height };
  }
  const decoded = await decodePixels(stream);
  if (!decoded) return undefined;
  const bytes = await png(decoded.pixels);
  return {
    ext: 'png',
    bytes: decoded.icc ? await withIcc(bytes, decoded.icc) : bytes,
    width,
    height,
  };
}

/** 스트림을 풀어 글자로 (이름·숫자만 읽으므로 바이트를 그대로 글자로 본다) */
function streamText(stream: PDFStream): string {
  let bytes: Uint8Array;
  try {
    bytes =
      stream instanceof PDFRawStream ? decodePDFRawStream(stream).decode() : stream.getContents();
  } catch {
    return '';
  }
  let text = '';
  for (let i = 0; i < bytes.length; i += 8192) {
    text += String.fromCharCode(...bytes.subarray(i, i + 8192));
  }
  return text;
}

/**
 * 쪽 내용에 바로 써 넣은 그림(BI … ID … EI) 중 짧은 변이 minSide 이상인 것의 수.
 * 이런 그림은 따로 된 객체가 아니라 꺼내지 않고, 꺼내지 못한 수로 알린다
 */
function countInline(streams: PDFStream[], minSide: number): number {
  let count = 0;
  for (const stream of streams) {
    for (const match of streamText(stream).matchAll(/\bBI\b([\s\S]*?)\bID\b/g)) {
      const head = match[1]!;
      const width = Number(/\/(?:W|Width)\s+(\d+)/.exec(head)?.[1] ?? 0);
      const height = Number(/\/(?:H|Height)\s+(\d+)/.exec(head)?.[1] ?? 0);
      if (Math.min(width, height) >= minSide) count++;
    }
  }
  return count;
}

/** 쪽마다 그 쪽(과 쪽 안의 묶음 그림)이 쓰는 사진. 같은 사진은 처음 나온 쪽에만 */
function collect(doc: PDFDocument) {
  const seen = new Set<PDFRef>();
  const visitedForms = new Set<PDFRef>();
  const found: { ref: PDFRef; stream: PDFRawStream; page: number }[] = [];
  /** 쪽과 묶음 그림의 내용 (바로 써 넣은 그림을 세려고) */
  const contents: PDFStream[] = [];
  const walk = (resources: PDFDict | undefined, page: number) => {
    const xobjects = resources?.lookup(name('XObject'));
    if (!(xobjects instanceof PDFDict)) return;
    for (const [, value] of xobjects.entries()) {
      if (!(value instanceof PDFRef)) continue;
      const object = doc.context.lookup(value);
      if (!(object instanceof PDFStream)) continue;
      const subtype = object.dict.lookup(name('Subtype'));
      if (subtype === name('Image')) {
        // 글자 모양 가림(ImageMask)은 사진이 아니다
        if (object.dict.lookup(name('ImageMask'))?.toString() === 'true') continue;
        if (seen.has(value) || !(object instanceof PDFRawStream)) continue;
        seen.add(value);
        found.push({ ref: value, stream: object, page });
      } else if (subtype === name('Form') && !visitedForms.has(value)) {
        visitedForms.add(value);
        contents.push(object);
        walk(object.dict.lookup(name('Resources')) as PDFDict | undefined, page);
      }
    }
  };
  doc.getPages().forEach((page, index) => {
    const value = doc.context.lookup(page.node.get(name('Contents')));
    const streams =
      value instanceof PDFArray ? value.asArray().map((item) => doc.context.lookup(item)) : [value];
    contents.push(...streams.filter((item): item is PDFStream => item instanceof PDFStream));
    walk(page.node.Resources(), index);
  });
  return { found, contents };
}

addEventListener('message', async (event: MessageEvent<ExtractRequest>) => {
  const { id, bytes, password, minSide } = event.data;
  const send = (response: ExtractResponse, transfer: Transferable[] = []) =>
    postMessage(response, { transfer });
  try {
    const doc = await PDFDocument.load(bytes, { password: password ?? '' });
    const collected = collect(doc);
    const found = collected.found.filter(({ stream }) => {
      const width = numberOf(stream.dict, 'Width') ?? 0;
      const height = numberOf(stream.dict, 'Height') ?? 0;
      return Math.min(width, height) >= minSide;
    });
    let failed = countInline(collected.contents, minSide);
    for (const [index, { stream, page }] of found.entries()) {
      let image: Awaited<ReturnType<typeof extract>>;
      try {
        image = await extract(stream);
      } catch {
        image = undefined;
      }
      if (image) {
        send({ id, kind: 'image', image: { ...image, page, index } }, [image.bytes.buffer]);
      } else {
        failed++;
      }
      send({ id, kind: 'progress', done: index + 1, total: found.length });
    }
    send({ id, kind: 'done', failed });
  } catch (error) {
    send({ id, kind: 'error', message: error instanceof Error ? error.message : String(error) });
  }
});
