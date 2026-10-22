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
import { inlineImageDict, tokenize, type Token } from './content-tokens';
import { inflate, unpredict } from './image-pixels';
import { crc32 } from '../crc32';

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

/** ICC 프로필의 값 범위(/Range)가 0~1이면 true. 아니면 화소 값을 그 범위로 바꿔 읽어야 해서 다룰 수 없다 */
function plainRange(profile: PDFRawStream): boolean {
  const range = profile.dict.lookup(name('Range'));
  if (!(range instanceof PDFArray)) return true;
  return range.asArray().every((item, i) => {
    const value = profile.dict.context.lookup(item);
    return value instanceof PDFNumber && value.asNumber() === i % 2;
  });
}

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
    if (!plainRange(profile)) return undefined;
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
  if (!width || !height) return undefined;
  const colors = colorsOf(dict, resources);
  if (!colors) return undefined;
  const indexed = 'palette' in colors;
  // 색 목록은 1·2·4·8비트, 회색·RGB는 8비트만
  if (indexed ? ![1, 2, 4, 8].includes(bits) : bits !== 8) return undefined;
  // 화소 값을 바꾸는 /Decode는 다루지 않는다 (기본값과 같은 배열은 바꾸는 것이 없어 그대로 꺼낸다)
  if (!plainDecode(dict, colors.components, indexed ? 2 ** bits - 1 : 1)) return undefined;
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

/**
 * PNG를 직접 만든다 (회색·RGB, 투명도가 있으면 알파 채널). canvas를 거치지 않는다: canvas는 반투명 화소를
 * 알파를 곱해 저장해 색이 깎이고(무손실이 아님), 늘 RGB로 저장해 회색 ICC 프로필을 넣을 수 없다
 */
async function directPng(pixels: ImageData, gray: boolean): Promise<Uint8Array> {
  const { width, height, data } = pixels;
  let opaque = true;
  for (let i = 3; i < data.length; i += 4) if (data[i] !== 255) opaque = false;
  const colors = gray ? 1 : 3;
  const channels = colors + (opaque ? 0 : 1);
  const raw = new Uint8Array((width * channels + 1) * height);
  for (let y = 0, at = 0; y < height; y++) {
    raw[at++] = 0; // 줄마다 필터 없음
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      for (let c = 0; c < colors; c++) raw[at++] = data[i + c]!;
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
  // 8비트, 색 종류 0(회색)·4(회색+투명도)·2(RGB)·6(RGB+투명도)
  header.set([8, (gray ? 0 : 2) + (opaque ? 0 : 4), 0, 0, 0], 8);
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

/** 화소를 PNG로. ICC 프로필이 있으면 넣는다 */
async function encodePng(pixels: ImageData, icc: Uint8Array | undefined, gray: boolean) {
  const png = await directPng(pixels, gray);
  return icc ? withIcc(png, icc) : png;
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
): { icc?: Uint8Array; device?: 'gray' | 'rgb' | 'cmyk' } | undefined {
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
    const device = (
      {
        DeviceGray: 'gray',
        G: 'gray',
        DeviceRGB: 'rgb',
        RGB: 'rgb',
        DeviceCMYK: 'cmyk',
        CMYK: 'cmyk',
      } as const
    )[space.decodeText()];
    return device ? { device } : undefined;
  }
  if (space instanceof PDFArray && space.lookup(0) === name('ICCBased')) {
    const profile = space.lookup(1);
    return profile instanceof PDFRawStream && plainRange(profile)
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
  while (at + 2 <= jpeg.length) {
    if (jpeg[at] !== 0xff) return undefined;
    // 표시 앞의 채움 바이트(FF FF …)는 건너뛴다 (결과에는 넣지 않는다)
    while (jpeg[at + 1] === 0xff) at++;
    const marker = jpeg[at + 1];
    if (marker === undefined || marker === 0xda) break;
    // 길이 없이 표시만 있는 조각 (TEM, 다시 시작 RST0~7)
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      kept.push(jpeg.subarray(at, at + 2));
      at += 2;
      continue;
    }
    if (at + 4 > jpeg.length) return undefined;
    const length = (jpeg[at + 2]! << 8) | jpeg[at + 3]!;
    if (length < 2 || at + 2 + length > jpeg.length) return undefined;
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

/**
 * JPG 안 EXIF의 방향 값(0x0112)을 1(그대로)로 바꾼 사본. PDF는 이 값을 무시하고 화소 그대로 그리는데, 내려받은
 * 파일을 보는 프로그램은 따라서 돌려 보여 준다 (휴대폰 사진을 그대로 넣은 PDF). 없거나 읽지 못하면 그대로
 */
function uprightJpeg(jpeg: Uint8Array): Uint8Array {
  try {
    const view = new DataView(jpeg.buffer, jpeg.byteOffset, jpeg.byteLength);
    for (let at = 2; at + 4 <= jpeg.length && jpeg[at] === 0xff;) {
      // 표시 앞 채움 바이트(FF FF …)와 길이 없는 표시(TEM, 다시 시작 RST0~7)는 건너뛴다
      if (jpeg[at + 1] === 0xff) {
        at++;
        continue;
      }
      const marker = jpeg[at + 1]!;
      if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
        at += 2;
        continue;
      }
      if (marker === 0xda) break;
      const length = view.getUint16(at + 2);
      if (marker === 0xe1 && view.getUint32(at + 4) === 0x45786966 /* 'Exif' */) {
        const tiff = at + 10;
        const little = view.getUint16(tiff) === 0x4949;
        const ifd = tiff + view.getUint32(tiff + 4, little);
        const count = view.getUint16(ifd, little);
        for (let i = 0; i < count; i++) {
          const entry = ifd + 2 + i * 12;
          if (view.getUint16(entry, little) !== 0x0112) continue;
          if (view.getUint16(entry + 8, little) === 1) return jpeg;
          const copy = jpeg.slice();
          new DataView(copy.buffer).setUint16(entry + 8, 1, little);
          return copy;
        }
        return jpeg;
      }
      at += 2 + length;
    }
  } catch {
    // 망가진 EXIF는 그대로 둔다
  }
  return jpeg;
}

/** 장치 색공간이나 ICC 프로필(머리의 색 종류)로 정한 성분 수. 알 수 없으면 undefined */
function spaceComponents(space: ReturnType<typeof jpegSpace>): number | undefined {
  if (space?.device) return { gray: 1, rgb: 3, cmyk: 4 }[space.device];
  const icc = space?.icc;
  if (!icc || icc.length < 20) return undefined;
  const kind = String.fromCharCode(...icc.subarray(16, 20));
  return ({ GRAY: 1, 'RGB ': 3, CMYK: 4 } as Record<string, number>)[kind];
}

/**
 * /Decode가 없거나 성분마다 기본값(바꾸지 않음)이면 true. 배열 길이는 성분 수의 두 배여야 한다
 * (짧거나 성분 수를 모르면 기본값으로 볼 수 없다). 기본값은 [0 1], 색 목록(Indexed) 사진은 [0 2^비트-1] (high로 넘긴다)
 */
function plainDecode(dict: PDFDict, components: number | undefined, high = 1): boolean {
  const decode = dict.lookup(name('Decode'));
  if (decode === undefined) return true;
  if (!(decode instanceof PDFArray) || components === undefined) return false;
  if (decode.size() !== components * 2) return false;
  return decode.asArray().every((item, i) => {
    const value = dict.context.lookup(item);
    return value instanceof PDFNumber && value.asNumber() === (i % 2) * high;
  });
}

/** JPEG 2000 상자들 [start, end)에서 type 상자의 내용 [시작, 끝) (길이를 8바이트로 적은 큰 상자 포함) */
function findBox(
  bytes: Uint8Array,
  start: number,
  end: number,
  wanted: string,
): { content: number; end: number } | undefined {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  for (let at = start; at + 8 <= end;) {
    let length = view.getUint32(at);
    let header = 8;
    if (length === 1) {
      if (at + 16 > end) return undefined;
      length = Number(view.getBigUint64(at + 8));
      header = 16;
    } else if (length === 0) length = end - at;
    if (length < header) return undefined;
    if (String.fromCharCode(...bytes.subarray(at + 4, at + 8)) === wanted) {
      return { content: at + header, end: Math.min(at + length, end) };
    }
    at += length;
  }
  return undefined;
}

/**
 * JPEG 2000 파일 안의 색 정보(colr 상자)가 PDF가 정한 장치 색공간과 같은지.
 * 상자 없는 코드 스트림은 색 정보가 없어, 보기 프로그램이 성분 수로 정하는 회색·RGB만 같은 것으로 본다
 * (CMYK의 성분 4개는 RGBA로 읽힌다). ICC 프로필이나 다른 색이면 false
 */
function jpxColorMatches(bytes: Uint8Array, device: 'gray' | 'rgb' | 'cmyk'): boolean {
  if (bytes[0] === 0xff && bytes[1] === 0x4f) return device !== 'cmyk';
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const find = (start: number, end: number, wanted: string) => findBox(bytes, start, end, wanted);
  const header = find(0, bytes.length, 'jp2h');
  if (header === undefined) return false;
  const box = find(header.content, header.end, 'colr');
  // 색 정보가 없으면 보기 프로그램도 PDF처럼 장치 색으로 본다
  if (box === undefined) return true;
  const colr = box.content;
  // 방법 1(정해진 색공간 번호)만 비교한다. 2(ICC 등)는 PDF와 다르게 보일 수 있다
  if (bytes[colr] !== 1) return false;
  const space = view.getUint32(colr + 3);
  // 16 sRGB, 17 회색, 12 CMYK. 18 sYCC는 PDF가 표본을 RGB로 바로 읽지만 보기 프로그램은 sYCC에서 바꿔 색이 다르다
  return device === 'rgb' ? space === 16 : device === 'gray' ? space === 17 : space === 12;
}

/**
 * JPEG 2000 파일 안 투명 채널을 PDF(/SMaskInData)와 내려받은 파일을 보는 프로그램이 같게 다루는지.
 * PDF: 0(없음)이면 투명 채널을 버리고, 1이면 그대로, 2면 색이 배경과 미리 합쳐진 것으로 본다.
 * 보기 프로그램은 파일 안 채널 정의(cdef 상자)대로 본다 (1 그대로, 2 미리 합침). 정의가 없는데 채널이
 * 색 수보다 많으면 어떻게 볼지 알 수 없어 false
 */
function jpxAlphaMatches(
  bytes: Uint8Array,
  smaskInData: number,
  device: 'gray' | 'rgb' | 'cmyk' | undefined,
): boolean {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const expected = device && { gray: 1, rgb: 3, cmyk: 4 }[device];
  const plainCount = (count: number) =>
    expected === undefined ? [1, 3, 4].includes(count) : count === expected;
  let alpha: 0 | 1 | 2;
  if (bytes[0] === 0xff && bytes[1] === 0x4f) {
    // 상자 없는 코드 스트림: 채널 정의가 없다. SIZ의 성분 수(Csiz)만 본다.
    // 성분 4개는 PDF가 CMYK로 보지만 파일을 보는 프로그램은 RGBA로 읽어 색·투명이 다르다
    if (bytes[2] !== 0xff || bytes[3] !== 0x51 || bytes.length < 42) return false;
    const count = view.getUint16(40);
    if (count === 4 || !plainCount(count)) return false;
    alpha = 0;
  } else {
    const header = findBox(bytes, 0, bytes.length, 'jp2h');
    const ihdr = header && findBox(bytes, header.content, header.end, 'ihdr');
    if (!header || !ihdr || ihdr.content + 10 > ihdr.end) return false;
    const channels = view.getUint16(ihdr.content + 8);
    const cdef = findBox(bytes, header.content, header.end, 'cdef');
    if (!cdef) {
      if (!plainCount(channels)) return false;
      alpha = 0;
    } else {
      const count = view.getUint16(cdef.content);
      if (cdef.content + 2 + count * 6 > cdef.end) return false;
      const types = Array.from({ length: count }, (_, i) =>
        view.getUint16(cdef.content + 2 + i * 6 + 2),
      );
      // 0 색, 1 투명, 2 미리 합친 투명. 그 밖(정하지 않음 등)은 보기 프로그램마다 다르다
      if (types.some((type) => type > 2)) return false;
      const opacity = types.filter((type) => type !== 0);
      if (opacity.length > 1) return false;
      const colors = types.filter((type) => type === 0).length;
      if (expected !== undefined && colors !== expected) return false;
      alpha = (opacity[0] ?? 0) as 0 | 1 | 2;
    }
  }
  return alpha === smaskInData;
}

/**
 * JPEG 2000 바이트의 형식: JP2 상자 파일이면 형식 상자(ftyp)의 이름에 따라 jp2·jpx,
 * 상자 없는 코드 스트림이면 j2k
 */
function jpxKind(bytes: Uint8Array): 'jp2' | 'jpx' | 'j2k' {
  if (bytes[0] === 0xff && bytes[1] === 0x4f) return 'j2k';
  // 형식 상자의 머리는 길이를 8바이트로 적으면 16바이트라 상자를 읽어 자리를 찾는다
  const type = findBox(bytes, 0, bytes.length, 'ftyp');
  const brand = type ? String.fromCharCode(...bytes.subarray(type.content, type.content + 4)) : '';
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
    if (!plainDecode(dict, spaceComponents(jpegSpace(dict, resources)))) return undefined;
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
      // CMYK(장치 색·프로필 모두)는 PNG에 넣을 수도, 브라우저로 PDF와 같은 색으로 바꿀 수도 없다
      // (색 키 투명과 같은 판단)
      if (components === undefined) return undefined;
      const pixels = await jpegPixels(stream, alpha, key, components);
      const bytes = await encodePng(pixels, space.icc, components === 1);
      return { ext: 'png', bytes, width, height };
    }
    // 구조를 읽지 못하는 JPG는 꺼내지 못한 것으로 본다. 원본 그대로 내면 PDF가 쓰지 않는 파일 안 프로필을
    // 보기 프로그램이 다시 써서 색이 달라질 수 있다
    const withProfile = jpegWithIcc(stream.contents, space.icc);
    const bytes = withProfile && uprightJpeg(withProfile);
    return bytes ? { ext: 'jpg', bytes, width, height } : undefined;
  }
  if (list.length === 1 && last === 'JPXDecode') {
    // 투명도가 JPEG 2000 바깥(PDF 사전)에 있으면 브라우저가 JPEG 2000을 못 읽어 합칠 수 없다
    if (dict.has(name('SMask')) || dict.has(name('Mask'))) return undefined;
    // PDF가 정한 색공간이 장치 색공간이 아니면 그 색을 JPEG 2000 파일에 옮길 수 없다
    // (보기 프로그램은 파일 안 색공간 대신 PDF 사전의 색공간으로 그린다)
    const space = jpegSpace(dict, resources);
    if (!space || space.icc) return undefined;
    // PDF가 장치 색공간을 정했으면 파일 안 색 정보가 그것과 같을 때만 원본을 낸다
    if (space.device && !jpxColorMatches(stream.contents, space.device)) return undefined;
    // 파일 안 투명 채널도 PDF에서와 같게 보일 때만 원본을 낸다
    const smaskInData = numberOf(dict, 'SMaskInData') ?? 0;
    if (!jpxAlphaMatches(stream.contents, smaskInData, space.device)) return undefined;
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

/** 내용에서 찾은 것들 */
interface Scanned {
  /** 바로 써 넣은 그림(BI … ID … EI) 중 짧은 변이 minSide 이상인 것의 수 (따로 된 객체가 아니라 꺼내지 않는다) */
  inline: number;
  /** /이름 Do로 그린 것 */
  drawn: string[];
  /** /이름 scn으로 칠한 무늬 */
  patterns: string[];
  /** 글꼴 이름 → 그 글꼴로 찍은 글자 코드 (Type3 글꼴에서 실제로 그린 글자 모양만 따라가려고) */
  glyphs: Map<string, Set<number>>;
}

/**
 * 내용 스트림을 토큰으로 훑어 화면에 그리는 것을 모은다 (글자열·그림 바이트 안의 글자는 읽지 않는다).
 * hidden(이름): 표시 내용 /OC /이름 BDC의 보이기 층이 꺼져 있으면 true. 꺼진 층 안에서 그리는 것은 세지 않는다
 */
function scanContent(
  streams: PDFStream[],
  minSide: number,
  hidden: (name: string) => boolean,
  /** 그래픽 상태(/GS1 gs)가 /Font로 고른 글꼴이 있는지 */
  stateFont: (name: string) => boolean = () => false,
): Scanned {
  const scanned: Scanned = { inline: 0, drawn: [], patterns: [], glyphs: new Map() };
  let operands: Token[] = [];
  let inInlineImage = false;
  /**
   * 그래픽 상태 (q/Q로 저장·복원): 글꼴(gs로 고른 것은 GS_FONT + 상태 이름), 글자 그리기 방식(Tr),
   * 지금 칠하기·선 무늬 이름 (무늬 색공간이 아니면 '')
   */
  let state = { font: '', render: 0, fill: '', stroke: '' };
  const saved: (typeof state)[] = [];
  /** 표시 내용(BDC·BMC … EMC)마다 꺼진 층인지 */
  const marks: boolean[] = [];
  const paint = (fill: boolean, stroke: boolean) => {
    if (fill && state.fill) scanned.patterns.push(state.fill);
    if (stroke && state.stroke) scanned.patterns.push(state.stroke);
  };
  // 쪽의 내용 스트림 여러 개는 이어서 하나로 실행된다
  for (const token of streams.flatMap((stream) => tokenize(streamText(stream)))) {
    if (token.kind !== 'op') {
      operands.push(token);
      continue;
    }
    const op = token.value;
    const last = operands.at(-1);
    const lastName = last?.kind === 'name' ? last.value : '';
    const visible = !marks.includes(true);
    if (op === 'BI') {
      inInlineImage = true;
    } else if (op === 'ID' && inInlineImage) {
      const dict = inlineImageDict([...operands, token]);
      const width = Number(dict.get('W') ?? dict.get('Width') ?? 0);
      const height = Number(dict.get('H') ?? dict.get('Height') ?? 0);
      // 마스크(/IM true)는 사진이 아니라 칠할 모양이라 묶음 그림 사진처럼 세지 않는다
      const mask = (dict.get('IM') ?? dict.get('ImageMask')) === 'true';
      if (visible && !mask && Math.min(width, height) >= minSide) scanned.inline++;
      inInlineImage = false;
    } else if (op === 'q') {
      saved.push({ ...state });
    } else if (op === 'Q') {
      state = saved.pop() ?? state;
    } else if (op === 'Tf') {
      const first = operands.find((operand) => operand.kind === 'name');
      if (first?.kind === 'name') state.font = first.value;
    } else if (op === 'gs') {
      if (lastName && stateFont(lastName)) state.font = GS_FONT + lastName;
    } else if (op === 'Tr') {
      state.render = last?.kind === 'other' ? Number(last.text) : 0;
    } else if (op === 'Tj' || op === "'" || op === '"' || op === 'TJ') {
      // 3: 보이지 않는 글자, 7: 잘라 낼 모양으로만 쓴다 (둘 다 그리지 않는다)
      const drawn = state.render !== 3 && state.render !== 7;
      if (visible && drawn && state.font) {
        const codes = scanned.glyphs.get(state.font) ?? new Set<number>();
        for (const operand of operands) {
          if (operand.kind === 'string') for (const code of operand.bytes) codes.add(code);
        }
        scanned.glyphs.set(state.font, codes);
        const mode = state.render % 4;
        paint(mode === 0 || mode === 2, mode === 1 || mode === 2);
      }
    } else if (op === 'Do') {
      if (visible && lastName) scanned.drawn.push(lastName);
    } else if (op === 'scn' || op === 'SCN') {
      // 무늬 색공간에서 이름을 주면 무늬를 고른 것이다. 실제로 칠할 때 센다
      if (op === 'scn') state.fill = lastName;
      else state.stroke = lastName;
    } else if (FILL_COLOR.has(op)) {
      state.fill = '';
    } else if (STROKE_COLOR.has(op)) {
      state.stroke = '';
    } else if (FILL_OPS.has(op) || STROKE_OPS.has(op)) {
      if (visible) paint(FILL_OPS.has(op), STROKE_OPS.has(op));
    } else if (op === 'BDC') {
      const tag = operands.find((operand) => operand.kind === 'name');
      marks.push(tag?.kind === 'name' && tag.value === 'OC' && !!lastName && hidden(lastName));
    } else if (op === 'BMC') {
      marks.push(false);
    } else if (op === 'EMC') {
      marks.pop();
    }
    if (!inInlineImage) operands = [];
  }
  return scanned;
}

/** 그래픽 상태로 고른 글꼴을 글꼴 이름 대신 적는 표시 (GS_FONT + 상태 이름) */
const GS_FONT = '\0gs:';
/** 칠하기·선 색을 무늬가 아닌 것으로 바꾸는 연산자 (cs·CS는 무늬 색공간이어도 아직 무늬를 고르지 않은 것) */
const FILL_COLOR = new Set(['cs', 'sc', 'g', 'rg', 'k']);
const STROKE_COLOR = new Set(['CS', 'SC', 'G', 'RG', 'K']);
/** 칠하는·선을 긋는 연산자 */
const FILL_OPS = new Set(['f', 'F', 'f*', 'B', 'B*', 'b', 'b*']);
const STROKE_OPS = new Set(['S', 's', 'B', 'B*', 'b', 'b*']);

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
/** Type3 글꼴의 글자 코드 → 글자 모양 이름 (/Encoding /Differences) */
function glyphNames(font: PDFDict): Map<number, string> {
  const names = new Map<number, string>();
  const encoding = font.lookup(name('Encoding'));
  const differences =
    encoding instanceof PDFDict ? encoding.lookup(name('Differences')) : undefined;
  if (!(differences instanceof PDFArray)) return names;
  let code = 0;
  for (const item of differences.asArray()) {
    const value = font.context.lookup(item);
    if (value instanceof PDFNumber) code = value.asNumber();
    else if (value instanceof PDFName) names.set(code++, value.decodeText());
  }
  return names;
}

/**
 * 볼 때 저절로 적용되는 규칙(/AS, 사건 /View)이 정하는 층의 켜짐(true)·꺼짐(false). 규칙은 차례로 적용되어
 * 뒤의 것이 앞을 덮는다. 규칙이 보는 항목 중 하나라도 끄면 꺼지고 모두 켜면 켜진다 (가리기 도구와 같은 판단):
 * - 보기(/View /ViewState)
 * - 확대 배율(/Zoom /min·/max): 100%에서 범위 안이면 켜짐
 * - 언어(/Language)·사람(/User): 보는 사람의 환경에 따라 정해져 알 수 없으므로 꺼짐으로 본다
 *   (숨겨 둔 사진을 꺼내 주지 않는 쪽을 고른다)
 * 규칙이 없는 층은 들어 있지 않다 (기본 설정을 따른다)
 */
function autoLayerStates(config: unknown): Map<PDFDict, boolean> {
  const states = new Map<PDFDict, boolean>();
  if (!(config instanceof PDFDict)) return states;
  const context = config.context;
  const listOf = (value: unknown) => {
    const resolved = context.lookup(value as PDFObject);
    return resolved instanceof PDFArray
      ? resolved.asArray().map((item) => context.lookup(item))
      : [];
  };
  for (const rule of listOf(config.get(name('AS')))) {
    if (!(rule instanceof PDFDict) || rule.get(name('Event')) !== name('View')) continue;
    const categories = listOf(rule.get(name('Category')));
    for (const layer of listOf(rule.get(name('OCGs')))) {
      if (!(layer instanceof PDFDict)) continue;
      const usage = layer.lookup(name('Usage'));
      if (!(usage instanceof PDFDict)) continue;
      const entry = (category: string) => {
        if (!categories.includes(name(category))) return undefined;
        const value = usage.lookup(name(category));
        return value instanceof PDFDict ? value : undefined;
      };
      const verdicts: boolean[] = [];
      const view = entry('View');
      if (view) verdicts.push(view.get(name('ViewState')) !== name('OFF'));
      const zoom = entry('Zoom');
      if (zoom)
        verdicts.push((numberOf(zoom, 'min') ?? 0) <= 1 && 1 < (numberOf(zoom, 'max') ?? Infinity));
      if (entry('Language') || entry('User')) verdicts.push(false);
      if (verdicts.length > 0) states.set(layer, verdicts.every(Boolean));
    }
  }
  return states;
}

/**
 * 원본 기본 보이기 설정(/OCProperties /D)으로 꺼진 층인지 알려 주는 함수.
 * 층(OCG)과 층 조합(OCMD, /P AnyOn·AllOn·AnyOff·AllOff)을 받는다. 층이 없으면 늘 보인다
 */
function hiddenLayers(doc: PDFDocument): (oc: unknown) => boolean {
  const context = doc.context;
  const properties = doc.catalog.lookup(name('OCProperties'));
  const config = properties instanceof PDFDict ? properties.lookup(name('D')) : undefined;
  const list = (key: string) => {
    const value = config instanceof PDFDict ? config.lookup(name(key)) : undefined;
    return value instanceof PDFArray ? value.asArray().map((item) => context.lookup(item)) : [];
  };
  const baseOff = config instanceof PDFDict && config.get(name('BaseState')) === name('OFF');
  const on = list('ON');
  const off = list('OFF');
  const auto = autoLayerStates(config);
  /** 이름 하나나 이름 배열로 적은 쓰임(/Intent). 없으면 /View */
  const intents = (value: unknown) => {
    const resolved = context.lookup(value as PDFObject);
    const list = resolved instanceof PDFArray ? resolved.asArray() : resolved ? [resolved] : [];
    const names = list.filter((item): item is PDFName => item instanceof PDFName);
    return names.length > 0 ? names : [name('View')];
  };
  const configIntents = intents(config instanceof PDFDict ? config.get(name('Intent')) : undefined);
  const groupHidden = (group: unknown) => {
    if (!(group instanceof PDFDict)) return false;
    // 층의 쓰임이 설정의 쓰임과 겹치지 않으면 그 층은 보이기에 상관없다 (/All은 모두와 겹친다)
    const layerIntents = intents(group.get(name('Intent')));
    const all = name('All');
    const relevant =
      configIntents.includes(all) ||
      layerIntents.includes(all) ||
      layerIntents.some((intent) => configIntents.includes(intent));
    if (!relevant) return false;
    const shown = baseOff ? on.includes(group) : !off.includes(group);
    // 규칙(/AS)이 없어도 보기 프로그램(pdf.js 등)은 층의 사용 정보로 볼 때 끈다
    const usage = group.lookup(name('Usage'));
    const view = usage instanceof PDFDict ? usage.lookup(name('View')) : undefined;
    if (view instanceof PDFDict && view.get(name('ViewState')) === name('OFF')) return true;
    return !(auto.get(group) ?? shown);
  };
  return (oc) => {
    const dict = context.lookup(oc as PDFObject);
    if (!(dict instanceof PDFDict)) return false;
    const type = dict.get(name('Type'));
    if (type === name('OCG')) return groupHidden(dict);
    if (type !== name('OCMD')) return false;
    // 보이기 식(/VE)이 있으면 /OCGs·/P보다 먼저 쓴다: [/And …], [/Or …], [/Not 하나], 안은 층이나 다시 식
    const expression = dict.lookup(name('VE'));
    if (expression instanceof PDFArray) {
      const shown = (value: unknown, depth: number): boolean => {
        const item = context.lookup(value as PDFObject);
        if (item instanceof PDFDict) return !groupHidden(item);
        if (!(item instanceof PDFArray) || depth > 32) return true;
        const operator = item.lookup(0);
        const operands = item.asArray().slice(1);
        if (operator === name('Not')) return !shown(operands[0], depth + 1);
        if (operator === name('Or')) return operands.some((operand) => shown(operand, depth + 1));
        return operands.every((operand) => shown(operand, depth + 1));
      };
      return !shown(expression, 0);
    }
    const members = dict.lookup(name('OCGs'));
    const groups =
      members instanceof PDFArray
        ? members.asArray().map((item) => context.lookup(item))
        : members instanceof PDFDict
          ? [members]
          : [];
    if (groups.length === 0) return false;
    const visible = groups.map((group) => !groupHidden(group));
    const policy = dict.get(name('P'));
    if (policy === name('AllOn')) return !visible.every(Boolean);
    if (policy === name('AnyOff')) return visible.every(Boolean);
    if (policy === name('AllOff')) return visible.some(Boolean);
    return !visible.some(Boolean);
  };
}

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
  const layerHidden = hiddenLayers(doc);
  /**
   * 화면에 실제로 그리는 것만 따라간다: 자원 목록에만 있고 그리지 않는 사진, 꺼진 보이기 층 안의 것,
   * 숨긴 주석, 찍지 않은 Type3 글자 모양 안의 사진은 꺼내지 않는다
   */
  const visit = (
    streams: PDFStream[],
    resources: PDFDict | undefined,
    page: number,
    countInline = true,
  ) => {
    const properties = resources?.lookup(name('Properties'));
    const states = resources?.lookup(name('ExtGState'));
    /** 그래픽 상태가 /Font [글꼴 크기]로 고른 글꼴 */
    const fontOfState = (state: string) => {
      const entry = states instanceof PDFDict ? states.lookup(name(state)) : undefined;
      const font = entry instanceof PDFDict ? entry.lookup(name('Font')) : undefined;
      return font instanceof PDFArray ? font.lookup(0) : undefined;
    };
    const scanned = scanContent(
      streams,
      minSide,
      (prop) => (properties instanceof PDFDict ? layerHidden(properties.get(name(prop))) : false),
      (state) => fontOfState(state) instanceof PDFDict,
    );
    if (countInline) inline += scanned.inline;
    // 칠한 바둑무늬 무늬(PatternType 1)의 내용도 훑는다 (무늬는 자기 자원 목록을 쓴다)
    const patterns = resources?.lookup(name('Pattern'));
    for (const used of new Set(scanned.patterns)) {
      const value = patterns instanceof PDFDict ? patterns.get(name(used)) : undefined;
      const pattern = value instanceof PDFRef ? doc.context.lookup(value) : value;
      if (!(pattern instanceof PDFStream) || numberOf(pattern.dict, 'PatternType') !== 1) continue;
      const own = pattern.dict.lookup(name('Resources'));
      const key = value instanceof PDFRef ? value : undefined;
      const visits = key ? (visitedForms.get(key) ?? new Set()) : new Set<PDFDict | undefined>();
      const usedResources = own instanceof PDFDict ? own : resources;
      if (visits.has(usedResources)) continue;
      const first = visits.size === 0;
      visits.add(usedResources);
      if (key) visitedForms.set(key, visits);
      visit([pattern], usedResources, page, first);
    }
    // Type3 글꼴로 찍은 글자의 모양(CharProcs) 안도 훑는다 (글꼴의 자원 목록, 없으면 부른 쪽 것)
    const fontDict = resources?.lookup(name('Font'));
    for (const [used, codes] of scanned.glyphs) {
      const font = used.startsWith(GS_FONT)
        ? fontOfState(used.slice(GS_FONT.length))
        : fontDict instanceof PDFDict
          ? fontDict.lookup(name(used))
          : undefined;
      if (!(font instanceof PDFDict) || font.lookup(name('Subtype')) !== name('Type3')) continue;
      const procs = font.lookup(name('CharProcs'));
      if (!(procs instanceof PDFDict)) continue;
      const own = font.lookup(name('Resources'));
      const names = glyphNames(font);
      // 찍은 글자 중 /Differences에 없는 것이 있으면(기본 인코딩 /BaseEncoding·이름 인코딩을 따르거나 규격 위반)
      // 어떤 모양을 쓰는지 알 수 없어 모든 모양을 훑는다 (그린 사진을 빠뜨리지 않게)
      const glyphs = [...codes].some((code) => !names.has(code))
        ? procs.keys().map((key) => key.decodeText())
        : [...codes].map((code) => names.get(code));
      for (const glyph of new Set(glyphs)) {
        const value = glyph ? procs.get(name(glyph)) : undefined;
        const stream = doc.context.lookup(value);
        if (!(value instanceof PDFRef) || !(stream instanceof PDFStream)) continue;
        enter(value, [stream], own instanceof PDFDict ? own : resources, page);
      }
    }
    const xobjects = resources?.lookup(name('XObject'));
    if (!(xobjects instanceof PDFDict)) return;
    for (const drawn of new Set(scanned.drawn)) {
      const value = xobjects.get(name(drawn));
      if (!(value instanceof PDFRef)) continue;
      const object = doc.context.lookup(value);
      if (!(object instanceof PDFStream)) continue;
      // 꺼진 보이기 층에 딸린 사진·묶음 그림
      if (layerHidden(object.dict.get(name('OC')))) continue;
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
        enter(value, [object], own instanceof PDFDict ? own : resources, page);
      }
    }
  };
  /** 묶음 그림·글자 모양·주석 모양처럼 안에 내용이 있는 것을 그 자원 목록으로 훑는다 (같은 짝은 한 번만) */
  const enter = (
    key: PDFRef,
    streams: PDFStream[],
    resources: PDFDict | undefined,
    page: number,
  ) => {
    const visits = visitedForms.get(key) ?? new Set();
    if (visits.has(resources)) return;
    // 바로 써 넣은 그림은 그 안에 있으므로 처음 한 번만 센다
    const first = visits.size === 0;
    visits.add(resources);
    visitedForms.set(key, visits);
    visit(streams, resources, page, first);
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
    // 주석(도장·서명·입력 칸 등)의 보이는 모양 안에서 그리는 사진 (숨긴 주석·말풍선은 빼고)
    const annots = page.node.lookup(name('Annots'));
    if (!(annots instanceof PDFArray)) return;
    for (const item of annots.asArray()) {
      const annot = doc.context.lookup(item);
      if (!(annot instanceof PDFDict) || annot.lookup(name('Subtype')) === name('Popup')) continue;
      // 숨김(2)·화면에 보이지 않음(32) 주석, 꺼진 보이기 층의 주석
      const flags = numberOf(annot, 'F') ?? 0;
      if (flags & (2 | 32) || layerHidden(annot.get(name('OC')))) continue;
      const appearances = annot.lookup(name('AP'));
      if (!(appearances instanceof PDFDict)) continue;
      let normal = appearances.get(name('N'));
      // 상태가 여럿이면(체크 상자 등) 지금 상태(/AS)의 모양
      const states = doc.context.lookup(normal);
      if (states instanceof PDFDict && !(states instanceof PDFStream)) {
        const state = annot.lookup(name('AS'));
        normal = state instanceof PDFName ? states.get(state) : undefined;
      }
      const stream = doc.context.lookup(normal);
      if (!(normal instanceof PDFRef) || !(stream instanceof PDFStream)) continue;
      // 모양도 묶음 그림이라 자기 /OC로 꺼질 수 있다
      if (layerHidden(stream.dict.get(name('OC')))) continue;
      const own = stream.dict.lookup(name('Resources'));
      enter(normal, [stream], own instanceof PDFDict ? own : undefined, index);
    }
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
