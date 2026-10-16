/**
 * PDF 안의 사진 꺼내기 워커 (extract-images.ts가 부른다). 파일은 메모리에서만 다룬다.
 *
 * 쪽(과 쪽 안의 묶음 그림)이 쓰는 사진을 찾아, 같은 사진은 한 번만 꺼낸다.
 * - JPG(DCT)는 파일 안의 바이트 그대로 (화질 손실 없음). 투명도가 붙어 있으면 PNG로 합친다
 * - JPEG 2000(JPX)은 그대로 .jp2·.jpx·.j2k (파일 형식에 따라)
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
  type PDFObject,
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
  | {
      components: 1;
      palette: Uint8Array;
      paletteColors: 1 | 3;
      /** 색 목록의 마지막 번호 (이보다 큰 값은 마지막 색으로 본다) */
      hival: number;
      icc?: Uint8Array;
    };

/** 장치 색공간 이름 → 자원 목록에 그 대신 쓰라고 정한 기본 색공간(/DefaultRGB 등) */
function defaultSpace(device: string, resources: PDFDict | undefined): PDFObject | undefined {
  const key = {
    DeviceGray: 'DefaultGray',
    G: 'DefaultGray',
    DeviceRGB: 'DefaultRGB',
    RGB: 'DefaultRGB',
    DeviceCMYK: 'DefaultCMYK',
    CMYK: 'DefaultCMYK',
  }[device];
  const named = resources?.lookup(name('ColorSpace'));
  return key && named instanceof PDFDict ? named.get(name(key)) : undefined;
}

/**
 * 기본 색공간의 성분 수 (회색 1, RGB 3)와 ICC 프로필. 보정 색공간(CalRGB·CalGray)처럼
 * 색을 바꿔야 하는데 바꿀 수 없는 것은 undefined (꺼내지 못한 것으로 센다)
 */
function baseSpace(
  space: unknown,
  dict: PDFDict,
  resources: PDFDict | undefined,
  depth = 0,
): { n: 1 | 3; icc?: Uint8Array } | undefined {
  const lookup = dict.context.lookup.bind(dict.context);
  const resolved = lookup(space as PDFRef);
  if (resolved instanceof PDFName) {
    const value = resolved.decodeText();
    // 자원 목록의 /DefaultGray·/DefaultRGB가 있으면 장치 색공간 대신 그것으로 그린다
    const fallback = defaultSpace(value, resources);
    if (fallback !== undefined && depth < 4) {
      return baseSpace(fallback, dict, resources, depth + 1);
    }
    if (value === 'DeviceGray' || value === 'G') return { n: 1 };
    if (value === 'DeviceRGB' || value === 'RGB') return { n: 3 };
    // 자원 목록(/ColorSpace)에 정의한 이름 (예: /CS0). 잘못 서로 가리켜도 끝나게 깊이를 제한한다
    const named = resources?.lookup(name('ColorSpace'));
    if (named instanceof PDFDict && depth < 4) {
      const alias = named.get(resolved);
      if (alias) return baseSpace(alias, dict, resources, depth + 1);
    }
    return undefined;
  }
  if (resolved instanceof PDFArray && resolved.size() >= 1) {
    const kind = resolved.lookup(0);
    if (kind !== name('ICCBased')) return undefined;
    const profile = resolved.lookup(1);
    if (!(profile instanceof PDFRawStream)) return undefined;
    const n = numberOf(profile.dict, 'N');
    // 값 범위(/Range)가 0~1이 아니면 화소 값을 그 범위로 바꿔 읽어야 해서 다룰 수 없다
    const range = profile.dict.lookup(name('Range'));
    if (
      range instanceof PDFArray &&
      range.asArray().some((item, i) => {
        const value = dict.context.lookup(item);
        return !(value instanceof PDFNumber) || value.asNumber() !== i % 2;
      })
    ) {
      return undefined;
    }
    // 프로필은 PNG에 같이 넣어 보기 프로그램이 색을 맞추게 한다 (회색 프로필은 회색 PNG에 넣는다)
    if (n === 3) return { n: 3, icc: decodePDFRawStream(profile).decode() };
    if (n === 1) return { n: 1, icc: decodePDFRawStream(profile).decode() };
    return undefined;
  }
  return undefined;
}

function colorsOf(dict: PDFDict, resources: PDFDict | undefined): Colors | undefined {
  let space = dict.lookup(name('ColorSpace'));
  // 이름이면 자원 목록에서 먼저 풀어 본다 (/CS0 → [/Indexed …])
  const named = resources?.lookup(name('ColorSpace'));
  if (space instanceof PDFName && named instanceof PDFDict && named.has(space)) {
    space = named.lookup(space);
  }
  if (space instanceof PDFArray && space.lookup(0) === name('Indexed')) {
    const base = baseSpace(space.get(1), dict, resources);
    // [/Indexed 기본색공간 최댓값 색목록]
    const table = space.lookup(3);
    if (!base) return undefined;
    let palette: Uint8Array | undefined;
    if (table instanceof PDFString) palette = table.asBytes();
    else if (table instanceof PDFHexString) palette = table.asBytes();
    else if (table instanceof PDFRawStream) palette = decodePDFRawStream(table).decode();
    const hival = space.lookup(2);
    if (!palette || !(hival instanceof PDFNumber)) return undefined;
    return {
      components: 1,
      palette,
      paletteColors: base.n,
      hival: Math.max(0, Math.floor(hival.asNumber())),
      icc: base.icc,
    };
  }
  const base = baseSpace(space, dict, resources);
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
  let found = stream.dict.lookup(name('DecodeParms'));
  if (found instanceof PDFArray) found = found.lookup(0);
  const parms = found instanceof PDFDict ? found : undefined;
  const predictor = list.length === 1 ? (numberOf(parms, 'Predictor') ?? 1) : 1;
  if (predictor >= 10) {
    // 예측의 행 크기는 DecodeParms가 정한다 (없으면 PDF 기본값). 사진과 다르면 행 경계를 맞출 수 없다
    const columns = numberOf(parms, 'Columns') ?? 1;
    const colors = numberOf(parms, 'Colors') ?? 1;
    const parmBits = numberOf(parms, 'BitsPerComponent') ?? 8;
    if (columns !== width || colors !== components || parmBits !== bits) return undefined;
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

/** 다룰 수 없는 투명도. 투명도를 잃은 채 저장하지 않고 이 사진을 꺼내지 못한 것으로 센다 */
const UNSUPPORTED = 'unsupported';

/**
 * 투명도(SMask)를 사진과 같은 크기의 0~255 값으로. 없으면 undefined.
 * 1·2·4·8비트와 뒤집기(/Decode [1 0])를 다루고, 그 밖(크기가 다르거나 다른 필터 등)은 UNSUPPORTED
 */
async function alphaOf(
  dict: PDFDict,
  width: number,
  height: number,
): Promise<Uint8Array | typeof UNSUPPORTED | undefined> {
  const mask = dict.lookup(name('SMask'));
  if (mask === undefined) return undefined;
  if (!(mask instanceof PDFRawStream)) return UNSUPPORTED;
  // /Matte: 색이 배경색과 미리 섞여 있어 알파만 붙이면 가장자리에 그 색이 번진다
  if (mask.dict.has(name('Matte'))) return UNSUPPORTED;
  if (numberOf(mask.dict, 'Width') !== width || numberOf(mask.dict, 'Height') !== height) {
    return UNSUPPORTED;
  }
  const bits = numberOf(mask.dict, 'BitsPerComponent') ?? 8;
  if (![1, 2, 4, 8].includes(bits)) return UNSUPPORTED;
  const decode = mask.dict.lookup(name('Decode'));
  let inverted = false;
  if (decode instanceof PDFArray) {
    const [low, high] = decode.asArray().map((item) => {
      const value = dict.context.lookup(item);
      return value instanceof PDFNumber ? value.asNumber() : NaN;
    });
    if (low === 1 && high === 0) inverted = true;
    else if (!(low === 0 && high === 1)) return UNSUPPORTED;
  }
  const data = await rawPixels(mask, width, height, 1, bits);
  if (!data) return UNSUPPORTED;
  const bytesPerRow = Math.ceil((width * bits) / 8);
  const max = (1 << bits) - 1;
  const alpha = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const value = Math.round((sample(data, y * bytesPerRow, x, bits) * 255) / max);
      alpha[y * width + x] = inverted ? 255 - value : value;
    }
  }
  return alpha;
}

/** /Mask 배열(성분마다 [최소 최대])을 읽는다. 없으면 undefined, 그림으로 가리는 /Mask 등은 UNSUPPORTED */
function colorKeyOf(dict: PDFDict, components: number): number[] | typeof UNSUPPORTED | undefined {
  const value = dict.lookup(name('Mask'));
  // SMask가 있으면 PDF는 /Mask를 쓰지 않는다
  if (value === undefined || dict.has(name('SMask'))) return undefined;
  if (!(value instanceof PDFArray)) return UNSUPPORTED;
  const key = value.asArray().map((item) => {
    const resolved = dict.context.lookup(item);
    return resolved instanceof PDFNumber ? resolved.asNumber() : NaN;
  });
  return key.length === components * 2 && key.every(Number.isFinite) ? key : UNSUPPORTED;
}

/** 성분 값들이 색 키 범위에 모두 들면 투명 */
const inKey = (key: number[] | undefined, ...components: number[]) =>
  !!key && components.every((c, i) => c >= key[i * 2]! && c <= key[i * 2 + 1]!);

/** 화소를 풀어 RGBA로 (ICC 색공간이면 그 프로필과 함께). 다룰 수 없는 형식이면 undefined */
async function decodePixels(
  stream: PDFRawStream,
  resources: PDFDict | undefined,
): Promise<{ pixels: ImageData; icc?: Uint8Array; gray: boolean } | undefined> {
  const { dict } = stream;
  const width = numberOf(dict, 'Width');
  const height = numberOf(dict, 'Height');
  const bits = numberOf(dict, 'BitsPerComponent') ?? 8;
  if (!width || !height || dict.has(name('Decode'))) return undefined;
  const colors = colorsOf(dict, resources);
  if (!colors) return undefined;
  const indexed = 'palette' in colors;
  // 색 목록은 1·2·4·8비트, 회색·RGB는 8비트만
  if (indexed ? ![1, 2, 4, 8].includes(bits) : bits !== 8) return undefined;
  // 색으로 투명 처리(/Mask 배열)는 알파로 바꾼다. 그림으로 가리는 /Mask는 다루지 않는다
  const colorKey = colorKeyOf(dict, colors.components);
  if (colorKey === UNSUPPORTED) return undefined;
  const bytesPerRow = Math.ceil((width * colors.components * bits) / 8);
  const data = await rawPixels(stream, width, height, colors.components, bits);
  if (!data) return undefined;
  const alpha = await alphaOf(dict, width, height);
  if (alpha === UNSUPPORTED) return undefined;
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
        // 색 목록보다 큰 값은 마지막 색으로 (규격: hival로 자른다)
        const i = Math.min(index, colors.hival) * n;
        rgba[out] = p[i] ?? 0;
        rgba[out + 1] = p[n === 3 ? i + 1 : i] ?? 0;
        rgba[out + 2] = p[n === 3 ? i + 2 : i] ?? 0;
        transparent = inKey(colorKey, index);
      } else if (colors.components === 3) {
        rgba[out] = data[offset + x * 3]!;
        rgba[out + 1] = data[offset + x * 3 + 1]!;
        rgba[out + 2] = data[offset + x * 3 + 2]!;
        transparent = inKey(colorKey, rgba[out]!, rgba[out + 1]!, rgba[out + 2]!);
      } else {
        rgba[out] = rgba[out + 1] = rgba[out + 2] = data[offset + x]!;
        transparent = inKey(colorKey, rgba[out]!);
      }
      rgba[out + 3] = transparent ? 0 : alpha ? alpha[y * width + x]! : 255;
    }
  }
  return {
    pixels: new ImageData(rgba, width, height),
    icc: colors.icc,
    gray: (indexed ? colors.paletteColors : colors.components) === 1,
  };
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

/** 회색(+투명도) PNG를 직접 만든다 (canvas는 늘 RGB로 저장해 회색 ICC 프로필을 넣을 수 없다) */
async function grayPng(pixels: ImageData): Promise<Uint8Array> {
  const { width, height, data } = pixels;
  let opaque = true;
  for (let i = 3; i < data.length; i += 4) if (data[i] !== 255) opaque = false;
  const channels = opaque ? 1 : 2;
  const raw = new Uint8Array((width * channels + 1) * height);
  for (let y = 0, at = 0; y < height; y++) {
    raw[at++] = 0; // 줄마다 필터 없음
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      raw[at++] = data[i]!;
      if (!opaque) raw[at++] = data[i + 3]!;
    }
  }
  const deflated = new Uint8Array(
    await new Response(
      new Blob([raw as BlobPart]).stream().pipeThrough(new CompressionStream('deflate')),
    ).arrayBuffer(),
  );
  const chunk = (type: string, body: Uint8Array) => {
    const typed = new Uint8Array([...new TextEncoder().encode(type), ...body]);
    const out = new Uint8Array(12 + body.length);
    const view = new DataView(out.buffer);
    view.setUint32(0, body.length);
    out.set(typed, 4);
    view.setUint32(8 + body.length, crc32(typed));
    return out;
  };
  const header = new Uint8Array(13);
  const view = new DataView(header.buffer);
  view.setUint32(0, width);
  view.setUint32(4, height);
  // 8비트, 색 종류 0(회색) 또는 4(회색+투명도)
  header.set([8, opaque ? 0 : 4, 0, 0, 0], 8);
  const parts = [
    new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflated),
    chunk('IEND', new Uint8Array()),
  ];
  const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

/** 화소를 PNG로. ICC 프로필이 있으면 넣는다 (회색이면 회색 PNG로 만들어 회색 프로필을 넣는다) */
async function encodePng(pixels: ImageData, icc: Uint8Array | undefined, gray: boolean) {
  if (!icc) return png(pixels);
  return withIcc(gray ? await grayPng(pixels) : await png(pixels), icc);
}

async function png(image: ImageData | ImageBitmap): Promise<Uint8Array> {
  const canvas = new OffscreenCanvas(image.width, image.height);
  const context = canvas.getContext('2d')!;
  if (image instanceof ImageData) context.putImageData(image, 0, 0);
  else context.drawImage(image, 0, 0);
  const blob = await canvas.convertToBlob({ type: 'image/png' });
  return new Uint8Array(await blob.arrayBuffer());
}

/** JPG에 투명도(SMask)나 색 키 투명(/Mask 배열)을 합친 화소 */
async function jpegPixels(
  stream: PDFRawStream,
  alpha: Uint8Array | undefined,
  key: number[] | undefined,
  components: number,
) {
  const bitmap = await createImageBitmap(
    new Blob([stream.contents as BlobPart], { type: 'image/jpeg' }),
    // PDF는 JPG 안의 프로필을 쓰지 않으므로 그 프로필로 색을 바꾸지 않은 원래 값을 읽는다
    { imageOrientation: 'none', colorSpaceConversion: 'none' },
  );
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  const context = canvas.getContext('2d')!;
  context.drawImage(bitmap, 0, 0);
  bitmap.close();
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
  const data = pixels.data;
  for (let i = 0; i * 4 < data.length; i++) {
    const at = i * 4;
    const keyed =
      components === 3
        ? inKey(key, data[at]!, data[at + 1]!, data[at + 2]!)
        : inKey(key, data[at]!);
    data[at + 3] = keyed ? 0 : alpha ? (alpha[i] ?? 255) : 255;
  }
  return pixels;
}

/**
 * JPG의 색공간: 장치 색공간(회색·RGB·CMYK)이거나 없으면 {}, ICC 프로필이면 {icc}.
 * 보정 색공간(CalRGB·Lab)·별색 등 JPG 파일로 옮길 수 없는 것은 undefined
 */
function jpegSpace(
  dict: PDFDict,
  resources: PDFDict | undefined,
): { icc?: Uint8Array } | undefined {
  let space = dict.lookup(name('ColorSpace'));
  const named = resources?.lookup(name('ColorSpace'));
  for (let depth = 0; space instanceof PDFName && depth < 4; depth++) {
    // 자원 목록의 이름, 또는 장치 색공간 대신 쓰라고 정한 기본 색공간(/DefaultRGB 등)
    const next =
      named instanceof PDFDict && named.has(space)
        ? named.get(space)
        : defaultSpace(space.decodeText(), resources);
    if (next === undefined) break;
    space = dict.context.lookup(next);
  }
  if (space === undefined) return {};
  if (space instanceof PDFName) {
    const device = ['DeviceGray', 'DeviceRGB', 'DeviceCMYK', 'G', 'RGB', 'CMYK'];
    return device.includes(space.decodeText()) ? {} : undefined;
  }
  if (space instanceof PDFArray && space.lookup(0) === name('ICCBased')) {
    const profile = space.lookup(1);
    return profile instanceof PDFRawStream
      ? { icc: decodePDFRawStream(profile).decode() }
      : undefined;
  }
  return undefined;
}

/**
 * JPG에 ICC 프로필을 넣는다 (APP2 ICC_PROFILE 조각들). 원래 들어 있던 프로필은 PDF가 정한 것으로 바꾼다.
 * icc가 없으면(PDF가 장치 색공간을 정함) 원래 프로필만 뺀다. PDF는 JPG 안의 프로필을 쓰지 않는다.
 * JPG 구조를 읽을 수 없으면 undefined
 */
function jpegWithIcc(jpeg: Uint8Array, icc: Uint8Array | undefined): Uint8Array | undefined {
  if (jpeg[0] !== 0xff || jpeg[1] !== 0xd8) return undefined;
  const signature = new TextEncoder().encode('ICC_PROFILE\0');
  const isIcc = (at: number) => signature.every((byte, i) => jpeg[at + 4 + i] === byte);
  // 앞쪽 표시 조각들(그림 자료 SOS 전까지)에서 예전 프로필 조각만 뺀다
  const kept: Uint8Array[] = [];
  let at = 2;
  while (at + 4 <= jpeg.length && jpeg[at] === 0xff) {
    const marker = jpeg[at + 1]!;
    if (marker === 0xda) break;
    const length = (jpeg[at + 2]! << 8) | jpeg[at + 3]!;
    if (length < 2) return undefined;
    if (!(marker === 0xe2 && isIcc(at))) kept.push(jpeg.subarray(at, at + 2 + length));
    at += 2 + length;
  }
  if (jpeg[at] !== 0xff || jpeg[at + 1] !== 0xda) return undefined;
  // 뺄 프로필도 넣을 프로필도 없으면 원본 바이트 그대로
  const removed =
    kept.reduce((sum, part) => sum + part.length, 2 + (jpeg.length - at)) !== jpeg.length;
  if (!icc && !removed) return jpeg.slice();
  icc ??= new Uint8Array();
  // 조각 하나에 65535 - 2(길이) - 14(서명·번호) 바이트까지
  const size = 65519;
  const count = Math.ceil(icc.length / size);
  if (count > 255) return undefined;
  const chunks: Uint8Array[] = [];
  for (let i = 0; i < count; i++) {
    const part = icc.subarray(i * size, (i + 1) * size);
    const segment = new Uint8Array(4 + signature.length + 2 + part.length);
    const length = segment.length - 2;
    segment.set([0xff, 0xe2, length >> 8, length & 0xff]);
    segment.set(signature, 4);
    segment.set([i + 1, count], 4 + signature.length);
    segment.set(part, 6 + signature.length);
    chunks.push(segment);
  }
  // SOI 바로 뒤에 JFIF(APP0)가 있으면 그 뒤에 둔다
  const app0 = kept[0]?.[1] === 0xe0 ? [kept.shift()!] : [];
  const parts = [jpeg.subarray(0, 2), ...app0, ...chunks, ...kept, jpeg.subarray(at)];
  const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

/** /Decode가 없거나 모든 성분이 [0 1](바꾸지 않음)이면 true */
function plainDecode(dict: PDFDict): boolean {
  const decode = dict.lookup(name('Decode'));
  if (decode === undefined) return true;
  if (!(decode instanceof PDFArray)) return false;
  return decode.asArray().every((item, i) => {
    const value = dict.context.lookup(item);
    return value instanceof PDFNumber && value.asNumber() === i % 2;
  });
}

/**
 * JPEG 2000 바이트의 형식: JP2 상자 파일이면 형식 상자(ftyp)의 이름에 따라 jp2·jpx,
 * 상자 없는 코드 스트림이면 j2k
 */
function jpxKind(bytes: Uint8Array): 'jp2' | 'jpx' | 'j2k' {
  if (bytes[0] === 0xff && bytes[1] === 0x4f) return 'j2k';
  const brand = String.fromCharCode(...bytes.subarray(20, 24));
  return brand === 'jpx ' ? 'jpx' : 'jp2';
}

/** 사진 하나를 꺼낸다. 다룰 수 없으면 undefined */
async function extract(
  stream: PDFRawStream,
  resources: PDFDict | undefined,
): Promise<Omit<ExtractedImage, 'page' | 'index'> | undefined> {
  const { dict } = stream;
  const width = numberOf(dict, 'Width') ?? 0;
  const height = numberOf(dict, 'Height') ?? 0;
  const list = filters(dict);
  const last = list.at(-1);
  if (list.length === 1 && last === 'DCTDecode') {
    // /Decode로 값을 바꿔 보여 주는 JPG(뒤집기 등)는 원본 그대로 내면 PDF에서 보이는 것과 달라진다
    if (!plainDecode(dict)) return undefined;
    // /ColorTransform으로 JPG 표시와 다르게 색을 바꾸라고 하면 JPG 파일만으로는 그 뜻을 옮길 수 없다
    let parms = dict.lookup(name('DecodeParms'));
    if (parms instanceof PDFArray) parms = parms.lookup(0);
    if (parms instanceof PDFDict && parms.has(name('ColorTransform'))) return undefined;
    const alpha = await alphaOf(dict, width, height);
    if (alpha === UNSUPPORTED) return undefined;
    // 색 키 투명은 회색·RGB JPG만 (CMYK는 브라우저가 읽은 값과 PDF의 값이 달라 맞춰 볼 수 없다)
    const components = colorsOf(dict, resources)?.components;
    const key = colorKeyOf(dict, components ?? 3);
    if (key === UNSUPPORTED || (key && !components)) return undefined;
    // PDF가 정한 색공간(ICC 프로필)이 JPG 밖에 있으면 결과에 넣어야 PDF에서 보던 색이 된다
    const space = jpegSpace(dict, resources);
    if (!space) return undefined;
    if (alpha || key) {
      // CMYK 프로필은 PNG에 넣을 수도, 브라우저로 그 색대로 바꿀 수도 없다
      if (space.icc && components === undefined) return undefined;
      const pixels = await jpegPixels(stream, alpha, key, components ?? 3);
      const bytes = await encodePng(pixels, space.icc, components === 1);
      return { ext: 'png', bytes, width, height };
    }
    // 구조를 읽지 못하는 JPG는 장치 색공간이면 원본 그대로 (넣을 프로필이 있으면 꺼내지 못한 것으로)
    const bytes =
      jpegWithIcc(stream.contents, space.icc) ?? (space.icc ? undefined : stream.contents.slice());
    return bytes ? { ext: 'jpg', bytes, width, height } : undefined;
  }
  if (list.length === 1 && last === 'JPXDecode') {
    // 투명도가 JPEG 2000 바깥(PDF 사전)에 있으면 브라우저가 JPEG 2000을 못 읽어 합칠 수 없다
    if (dict.has(name('SMask')) || dict.has(name('Mask'))) return undefined;
    // PDF가 정한 색공간이 장치 색공간이 아니면 그 색을 JPEG 2000 파일에 옮길 수 없다
    // (보기 프로그램은 파일 안 색공간 대신 PDF 사전의 색공간으로 그린다)
    const space = jpegSpace(dict, resources);
    if (!space || space.icc) return undefined;
    return { ext: jpxKind(stream.contents), bytes: stream.contents.slice(), width, height };
  }
  const decoded = await decodePixels(stream, resources);
  if (!decoded) return undefined;
  return {
    ext: 'png',
    bytes: await encodePng(decoded.pixels, decoded.icc, decoded.gray),
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

const WHITESPACE = /[\0\t\n\f\r ]/;
const DELIMITER = /[()<>[\]{}/%]/;

/**
 * 내용 스트림을 토큰 단위로 훑어 /이름 Do로 그리는 자원 이름과, 바로 써 넣은 그림(BI … ID … EI) 중
 * 짧은 변이 minSide 이상인 것의 수를 센다. 바로 써 넣은 그림은 따로 된 객체가 아니라 꺼내지 않고,
 * 꺼내지 못한 수로 알린다. 글자열 (…)·주석 %…·그림 바이트 안의 BI·Do는 세지 않는다
 */
function scanContent(streams: PDFStream[], minSide: number): { inline: number; drawn: string[] } {
  let count = 0;
  const drawn: string[] = [];
  let lastName = '';
  for (const stream of streams) {
    const text = streamText(stream);
    let i = 0;
    while (i < text.length) {
      const char = text[i]!;
      if (char === '(') {
        // 글자열: 괄호 짝과 \ 이스케이프를 따라 건너뛴다
        let depth = 1;
        for (i++; i < text.length && depth > 0; i++) {
          if (text[i] === '\\') i++;
          else if (text[i] === '(') depth++;
          else if (text[i] === ')') depth--;
        }
        continue;
      }
      if (char === '%') {
        while (i < text.length && text[i] !== '\n' && text[i] !== '\r') i++;
        continue;
      }
      if (char === '<') {
        // << 는 사전의 시작, < 하나는 16진 글자열
        i = text[i + 1] === '<' ? i + 2 : text.indexOf('>', i) + 1 || text.length;
        continue;
      }
      if (char === '/') {
        let end = i + 1;
        while (end < text.length && !WHITESPACE.test(text[end]!) && !DELIMITER.test(text[end]!))
          end++;
        lastName = text
          .slice(i + 1, end)
          .replace(/#([0-9a-fA-F]{2})/g, (_, hex: string) =>
            String.fromCharCode(parseInt(hex, 16)),
          );
        i = end;
        continue;
      }
      if (WHITESPACE.test(char) || DELIMITER.test(char)) {
        i++;
        continue;
      }
      // 일반 토큰
      let end = i;
      while (end < text.length && !WHITESPACE.test(text[end]!) && !DELIMITER.test(text[end]!))
        end++;
      const token = text.slice(i, end);
      i = end;
      if (token === 'Do' && lastName) drawn.push(lastName);
      if (token !== 'BI') continue;
      // BI 뒤 사전에서 크기를 읽고, ID 뒤 그림 바이트는 공백+EI+공백까지 건너뛴다
      const id = /\sID[\0\t\n\f\r ]/.exec(text.slice(i));
      if (!id) break;
      const head = text.slice(i, i + id.index);
      const width = Number(/\/(?:W|Width)\s+(\d+)/.exec(head)?.[1] ?? 0);
      const height = Number(/\/(?:H|Height)\s+(\d+)/.exec(head)?.[1] ?? 0);
      if (Math.min(width, height) >= minSide) count++;
      const dataStart = i + id.index + id[0].length;
      const ei = /[\0\t\n\f\r ]EI(?=[\0\t\n\f\r ]|$)/.exec(text.slice(dataStart));
      i = ei ? dataStart + ei.index + ei[0].length : text.length;
    }
  }
  return { inline: count, drawn };
}

/**
 * 사진의 색공간이 부른 쪽의 자원 목록에 따라 어떻게 풀리는지를 나타내는 글자.
 * 자원 목록과 상관없는 사진은 늘 같은 글자라 여러 쪽에서 불러도 한 번만 꺼낸다
 */
function spaceKey(dict: PDFDict, resources: PDFDict | undefined): string {
  const named = resources?.lookup(name('ColorSpace'));
  const keys: string[] = [];
  const visit = (value: unknown, depth: number) => {
    if (value instanceof PDFName) {
      const text = value.decodeText();
      const entry =
        (named instanceof PDFDict ? named.get(value) : undefined) ?? defaultSpace(text, resources);
      if (entry === undefined) return;
      keys.push(`${text}=${entry.toString()}`);
      if (depth < 4) visit(dict.context.lookup(entry), depth + 1);
    } else if (value instanceof PDFArray && depth < 4) {
      for (const item of value.asArray()) visit(dict.context.lookup(item), depth + 1);
    }
  };
  visit(dict.lookup(name('ColorSpace')), 0);
  return keys.join(';');
}

/** 쪽마다 그 쪽(과 쪽 안의 묶음 그림)이 쓰는 사진. 같은 사진은 처음 나온 쪽에만 */
function collect(doc: PDFDocument, minSide: number) {
  /** 꺼낸 사진: 같은 사진도 부른 쪽의 자원에 따라 색이 달라지면(이름 색공간·기본 색공간) 따로 센다 */
  const seen = new Set<string>();
  /** 훑은 묶음 그림. 자원 목록이 없는 것은 부른 쪽의 자원에 따라 그리는 사진이 달라 자원별로 센다 */
  const visitedForms = new Map<PDFRef, Set<PDFDict | undefined>>();
  /** resources: 그 사진을 부른 자원 목록 (색공간 이름을 풀려고) */
  const found: {
    ref: PDFRef;
    stream: PDFRawStream;
    page: number;
    resources: PDFDict | undefined;
  }[] = [];
  let inline = 0;
  /** 내용이 실제로 그리는(Do) 것만 따라간다. 자원 목록에만 있고 그리지 않는 사진은 꺼내지 않는다 */
  const visit = (
    streams: PDFStream[],
    resources: PDFDict | undefined,
    page: number,
    countInline = true,
  ) => {
    const scanned = scanContent(streams, minSide);
    if (countInline) inline += scanned.inline;
    const xobjects = resources?.lookup(name('XObject'));
    if (!(xobjects instanceof PDFDict)) return;
    for (const drawn of new Set(scanned.drawn)) {
      const value = xobjects.get(name(drawn));
      if (!(value instanceof PDFRef)) continue;
      const object = doc.context.lookup(value);
      if (!(object instanceof PDFStream)) continue;
      const subtype = object.dict.lookup(name('Subtype'));
      if (subtype === name('Image')) {
        // 글자 모양 가림(ImageMask)은 사진이 아니다
        if (object.dict.lookup(name('ImageMask'))?.toString() === 'true') continue;
        if (!(object instanceof PDFRawStream)) continue;
        const key = `${value.toString()} ${spaceKey(object.dict, resources)}`;
        if (seen.has(key)) continue;
        seen.add(key);
        found.push({ ref: value, stream: object, page, resources });
      } else if (subtype === name('Form')) {
        // 자원 목록이 없는 묶음 그림은 부른 쪽의 자원을 물려받는다 (예전 방식)
        const own = object.dict.lookup(name('Resources'));
        const used = own instanceof PDFDict ? own : resources;
        const visits = visitedForms.get(value) ?? new Set();
        if (visits.has(used)) continue;
        // 바로 써 넣은 그림은 묶음 그림 안에 있으므로 처음 한 번만 센다
        const first = visits.size === 0;
        visits.add(used);
        visitedForms.set(value, visits);
        visit([object], used, page, first);
      }
    }
  };
  doc.getPages().forEach((page, index) => {
    const value = doc.context.lookup(page.node.get(name('Contents')));
    const streams =
      value instanceof PDFArray ? value.asArray().map((item) => doc.context.lookup(item)) : [value];
    visit(
      streams.filter((item): item is PDFStream => item instanceof PDFStream),
      page.node.Resources(),
      index,
    );
  });
  return { found, inline };
}

addEventListener('message', async (event: MessageEvent<ExtractRequest>) => {
  const { id, bytes, password, minSide } = event.data;
  const send = (response: ExtractResponse, transfer: Transferable[] = []) =>
    postMessage(response, { transfer });
  try {
    const doc = await PDFDocument.load(bytes, { password: password ?? '' });
    const collected = collect(doc, minSide);
    const found = collected.found.filter(({ stream }) => {
      const width = numberOf(stream.dict, 'Width') ?? 0;
      const height = numberOf(stream.dict, 'Height') ?? 0;
      return Math.min(width, height) >= minSide;
    });
    let failed = collected.inline;
    /** 꺼낸 사진의 번호 (꺼내지 못한 것은 건너뛰어 빈 번호가 없게) */
    let extracted = 0;
    for (const [index, { stream, page, resources }] of found.entries()) {
      let image: Awaited<ReturnType<typeof extract>>;
      try {
        image = await extract(stream, resources);
      } catch {
        image = undefined;
      }
      if (image) {
        send({ id, kind: 'image', image: { ...image, page, index: extracted++ } }, [
          image.bytes.buffer,
        ]);
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
