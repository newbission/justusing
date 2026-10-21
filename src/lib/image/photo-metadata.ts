/**
 * 사진 파일(JPG·PNG·WebP) 안의 촬영 정보(EXIF·GPS, XMP, IPTC, 설명 글)를 읽고 지운다 (위치정보 지우기 도구).
 * 그림은 다시 압축하지 않고 정보 조각만 빼거나 고쳐 다시 이어 붙인다. 화질과 그림 바이트가 그대로다.
 *
 * - location: GPS 칸을 0으로 덮어 비우고, 위치가 들어갈 수 있는 XMP·IPTC와 그림 끝 뒤에 덧붙은 자료를 뺀다.
 *   찍은 날짜·기기 같은 나머지 EXIF는 남긴다
 * - all: 그림을 그리는 데 필요한 것(색 프로필 등)만 남기고 모두 뺀다. 사진이 눕지 않게 방향(Orientation) 한 칸만 새로 적는다
 *
 * 구조를 읽지 못하면 undefined (원본을 고치지 않는다). 워커(metadata.worker.ts)에서 돈다.
 */
import { rewriteJpeg, stripJpegMetadata, type SegmentAction } from './jpeg-metadata';

export type CleanMode = 'location' | 'all';
export type PhotoFormat = 'jpeg' | 'png' | 'webp';

export interface PhotoInfo {
  format: PhotoFormat;
  /** 위치가 들어 있다 (EXIF GPS 칸이나 XMP의 GPS) */
  location: boolean;
  /** EXIF GPS에서 읽은 위도·경도 (남위·서경은 음수) */
  gps?: { latitude: number; longitude: number };
  /** 찍은 날짜 'YYYY-MM-DD HH:MM' */
  date?: string;
  /** 찍은 기기 (제조사·모델) */
  device?: string;
  /** EXIF 방향 1~8 (없으면 1) */
  orientation: number;
  /** 그림 말고 지울 수 있는 정보가 있다 */
  extra: boolean;
}

export function detectFormat(bytes: Uint8Array): PhotoFormat | undefined {
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return 'jpeg';
  if (startsWith(bytes, 0, '\x89PNG\r\n\x1a\n')) return 'png';
  if (startsWith(bytes, 0, 'RIFF') && startsWith(bytes, 8, 'WEBP')) return 'webp';
  return undefined;
}

export function readPhotoInfo(bytes: Uint8Array): PhotoInfo | undefined {
  const format = detectFormat(bytes);
  const info: PhotoInfo = {
    format: format ?? 'jpeg',
    location: false,
    orientation: 1,
    extra: false,
  };
  const exif = (tiff: Uint8Array) => {
    const read = readExif(tiff);
    if (!read) return;
    info.location ||= read.location;
    info.gps ??= read.gps;
    info.date ??= read.date;
    info.device ??= read.device;
    if (read.orientation) info.orientation = read.orientation;
  };
  const xmp = (data: Uint8Array) => {
    if (contains(data, 'GPSLatitude') || contains(data, 'GPSLongitude')) info.location = true;
  };

  if (format === 'jpeg') {
    const result = rewriteJpeg(bytes, (marker, segment) => {
      const kind = jpegSegmentKind(marker, segment);
      if (kind === 'exif') exif(segment.subarray(10));
      else if (kind === 'xmp') xmp(segment);
      if (kind !== 'image') info.extra = true;
      return 'keep';
    });
    if (!result) return undefined;
    // 그림 끝 뒤에 덧붙은 자료가 있으면 rewriteJpeg가 그것을 빼고 새 배열을 준다
    if (result !== bytes) info.extra = true;
    return info;
  }
  if (format === 'png') {
    const chunks = pngChunks(bytes);
    if (!chunks) return undefined;
    for (const chunk of chunks.list) {
      if (chunk.type === 'eXIf') exif(chunk.data);
      else if (PNG_TEXT.has(chunk.type)) xmp(chunk.data);
      if (PNG_META.has(chunk.type)) info.extra = true;
    }
    if (chunks.trailing) info.extra = true;
    return info;
  }
  if (format === 'webp') {
    const chunks = webpChunks(bytes);
    if (!chunks) return undefined;
    for (const chunk of chunks.list) {
      if (chunk.type === 'EXIF') exif(exifTiff(chunk.data));
      else if (chunk.type === 'XMP ') xmp(chunk.data);
      if (WEBP_META.has(chunk.type)) info.extra = true;
    }
    if (chunks.trailing) info.extra = true;
    return info;
  }
  return undefined;
}

/** 정보를 지운 새 파일. 지울 것이 없으면 받은 bytes를 그대로 돌려준다 */
export function cleanPhoto(bytes: Uint8Array, mode: CleanMode): Uint8Array | undefined {
  const format = detectFormat(bytes);
  if (format === 'jpeg') return cleanJpeg(bytes, mode);
  if (format === 'png') return cleanPng(bytes, mode);
  if (format === 'webp') return cleanWebp(bytes, mode);
  return undefined;
}

// ── JPEG ──

type JpegKind = 'exif' | 'xmp' | 'iptc' | 'image' | 'other';

/** 조각 머리 4바이트(FF 표시·길이) 뒤의 이름으로 정보 조각의 종류를 가린다 */
function jpegSegmentKind(marker: number, segment: Uint8Array): JpegKind {
  if (marker === 0xe1 && startsWith(segment, 4, 'Exif\0')) return 'exif';
  if (marker === 0xe1 && startsWith(segment, 4, 'http://ns.adobe.com/')) return 'xmp';
  if (marker === 0xed) return 'iptc';
  // 그림을 그리는 데 쓰는 것: 밀도(JFIF), 색 프로필(ICC), 색 변환(Adobe)
  if (marker === 0xe0 && startsWith(segment, 4, 'JFIF\0')) return 'image';
  if (marker === 0xe2 && startsWith(segment, 4, 'ICC_PROFILE\0')) return 'image';
  if (marker === 0xee && startsWith(segment, 4, 'Adobe')) return 'image';
  return 'other';
}

function cleanJpeg(bytes: Uint8Array, mode: CleanMode): Uint8Array | undefined {
  if (mode === 'all') {
    const orientation = readPhotoInfo(bytes)?.orientation ?? 1;
    const stripped = stripJpegMetadata(bytes);
    if (!stripped || orientation === 1) return stripped;
    return withJpegExif(stripped, orientationTiff(orientation));
  }
  return rewriteJpeg(bytes, (marker, segment): SegmentAction => {
    const kind = jpegSegmentKind(marker, segment);
    if (kind === 'xmp' || kind === 'iptc') return 'drop';
    // 여러 장 묶음 사진(MPF)의 목록. 그림 끝 뒤에 붙은 다른 그림을 빼므로 목록도 뺀다
    if (marker === 0xe2 && startsWith(segment, 4, 'MPF\0')) return 'drop';
    if (kind !== 'exif') return 'keep';
    const copy = segment.slice();
    return clearGps(copy.subarray(10)) ? copy : 'keep';
  });
}

/** 정보를 모두 뺀 JPEG에 방향만 적은 EXIF 조각을 JFIF 뒤(없으면 맨 앞)에 넣는다 */
function withJpegExif(bytes: Uint8Array, tiff: Uint8Array): Uint8Array {
  const length = 2 + 6 + tiff.length;
  const segment = new Uint8Array(2 + length);
  segment.set([0xff, 0xe1, length >> 8, length & 0xff]);
  segment.set(ascii('Exif\0\0'), 4);
  segment.set(tiff, 10);
  let at = 2;
  if (bytes[2] === 0xff && bytes[3] === 0xe0) at = 4 + ((bytes[4]! << 8) | bytes[5]!);
  return concat([bytes.subarray(0, at), segment, bytes.subarray(at)]);
}

// ── PNG ──

/** 촬영 정보가 들어 있는 PNG 조각: EXIF, 글(XMP도 여기 들어 있다), 고친 시각 */
const PNG_META = new Set(['eXIf', 'tEXt', 'zTXt', 'iTXt', 'tIME']);
const PNG_TEXT = new Set(['tEXt', 'zTXt', 'iTXt']);

interface Chunk {
  type: string;
  /** 조각 전체 (머리·끝 포함) */
  whole: Uint8Array;
  data: Uint8Array;
}

function pngChunks(bytes: Uint8Array): { list: Chunk[]; trailing: boolean } | undefined {
  const list: Chunk[] = [];
  let offset = 8;
  while (offset + 12 <= bytes.length) {
    const length = u32be(bytes, offset);
    const end = offset + 12 + length;
    if (end > bytes.length) return undefined;
    const type = text(bytes.subarray(offset + 4, offset + 8));
    list.push({
      type,
      whole: bytes.subarray(offset, end),
      data: bytes.subarray(offset + 8, offset + 8 + length),
    });
    offset = end;
    if (type === 'IEND') return { list, trailing: offset < bytes.length };
  }
  return undefined;
}

function pngChunk(type: string, data: Uint8Array): Uint8Array {
  const chunk = new Uint8Array(12 + data.length);
  const view = new DataView(chunk.buffer);
  view.setUint32(0, data.length);
  chunk.set(ascii(type), 4);
  chunk.set(data, 8);
  view.setUint32(8 + data.length, crc32(chunk.subarray(4, 8 + data.length)));
  return chunk;
}

/** XMP를 담은 글 조각 (iTXt·zTXt·tEXt 모두 키워드로 시작한다) */
const isPngXmp = (chunk: Chunk) =>
  PNG_TEXT.has(chunk.type) && startsWith(chunk.data, 0, 'XML:com.adobe.xmp\0');

function cleanPng(bytes: Uint8Array, mode: CleanMode): Uint8Array | undefined {
  const chunks = pngChunks(bytes);
  if (!chunks) return undefined;
  const orientation = mode === 'all' ? (readPhotoInfo(bytes)?.orientation ?? 1) : 1;
  let changed = chunks.trailing;
  let wroteOrientation = false;
  const parts: Uint8Array[] = [bytes.subarray(0, 8)];
  for (const chunk of chunks.list) {
    if (mode === 'location') {
      if (isPngXmp(chunk)) {
        changed = true;
        continue;
      }
      if (chunk.type === 'eXIf') {
        const data = chunk.data.slice();
        if (clearGps(data)) {
          parts.push(pngChunk('eXIf', data));
          changed = true;
          continue;
        }
      }
      parts.push(chunk.whole);
      continue;
    }
    if (!PNG_META.has(chunk.type)) {
      // 방향은 그림 자료(IDAT) 앞에 둔다
      if (chunk.type === 'IDAT' && orientation !== 1 && !wroteOrientation) {
        parts.push(pngChunk('eXIf', orientationTiff(orientation)));
        wroteOrientation = true;
      }
      parts.push(chunk.whole);
      continue;
    }
    changed = true;
  }
  return changed ? concat(parts) : bytes;
}

// ── WebP ──

/** 촬영 정보 조각과 VP8X 머리의 표시 비트 */
const WEBP_FLAGS: Record<string, number> = { EXIF: 0x08, 'XMP ': 0x04 };
const WEBP_META = new Set(Object.keys(WEBP_FLAGS));

function webpChunks(bytes: Uint8Array): { list: Chunk[]; trailing: boolean } | undefined {
  const size = u32le(bytes, 4) + 8;
  if (size > bytes.length || size < 12) return undefined;
  const list: Chunk[] = [];
  let offset = 12;
  while (offset + 8 <= size) {
    const length = u32le(bytes, offset + 4);
    const end = offset + 8 + length + (length & 1);
    if (offset + 8 + length > size) return undefined;
    list.push({
      type: text(bytes.subarray(offset, offset + 4)),
      whole: bytes.subarray(offset, Math.min(end, size)),
      data: bytes.subarray(offset + 8, offset + 8 + length),
    });
    offset = end;
  }
  return { list, trailing: size < bytes.length };
}

function webpChunk(type: string, data: Uint8Array): Uint8Array {
  const chunk = new Uint8Array(8 + data.length + (data.length & 1));
  chunk.set(ascii(type));
  new DataView(chunk.buffer).setUint32(4, data.length, true);
  chunk.set(data, 8);
  return chunk;
}

/** WebP EXIF 조각은 TIFF로 바로 시작하지만 'Exif\0\0'을 앞에 붙인 프로그램도 있다 */
const exifTiff = (data: Uint8Array) => (startsWith(data, 0, 'Exif\0\0') ? data.subarray(6) : data);

function cleanWebp(bytes: Uint8Array, mode: CleanMode): Uint8Array | undefined {
  const chunks = webpChunks(bytes);
  if (!chunks) return undefined;
  const orientation = mode === 'all' ? (readPhotoInfo(bytes)?.orientation ?? 1) : 1;
  let changed = chunks.trailing;
  const parts: Uint8Array[] = [];
  /** VP8X 머리에서 지울 표시 비트와 켤 표시 비트 */
  let clearFlags = 0;
  let setFlags = 0;
  for (const chunk of chunks.list) {
    if (!WEBP_META.has(chunk.type)) {
      parts.push(chunk.whole);
      continue;
    }
    if (mode === 'location' && chunk.type === 'EXIF') {
      const data = chunk.data.slice();
      if (clearGps(exifTiff(data))) {
        parts.push(webpChunk('EXIF', data));
        changed = true;
      } else {
        parts.push(chunk.whole);
      }
      continue;
    }
    changed = true;
    if (mode === 'all' && chunk.type === 'EXIF' && orientation !== 1) {
      parts.push(webpChunk('EXIF', orientationTiff(orientation)));
      setFlags |= WEBP_FLAGS.EXIF!;
      continue;
    }
    clearFlags |= WEBP_FLAGS[chunk.type]!;
  }
  if (!changed) return bytes;
  // VP8X가 없는 단순한 WebP에는 정보 조각이 붙을 수 없다. 표시 비트는 VP8X에만 있다
  const vp8x = parts.find((part) => startsWith(part, 0, 'VP8X'));
  if (vp8x) {
    const copy = vp8x.slice();
    copy[8] = (copy[8]! & ~clearFlags) | setFlags;
    parts[parts.indexOf(vp8x)] = copy;
  }
  const body = concat(parts);
  const out = new Uint8Array(12 + body.length);
  out.set(ascii('RIFF'));
  new DataView(out.buffer).setUint32(4, 4 + body.length, true);
  out.set(ascii('WEBP'), 8);
  out.set(body, 12);
  return out;
}

// ── EXIF (TIFF) ──

const TYPE_SIZE: Record<number, number> = {
  1: 1,
  2: 1,
  3: 2,
  4: 4,
  5: 8,
  6: 1,
  7: 1,
  8: 2,
  9: 4,
  10: 8,
  11: 4,
  12: 8,
  13: 4,
};

interface Entry {
  tag: number;
  type: number;
  count: number;
  /** 항목(12바이트)이 시작하는 곳 */
  at: number;
  /** 값이 있는 곳 (4바이트 이하면 항목 안) */
  value: number;
  size: number;
}

class Tiff {
  readonly little: boolean;
  readonly view: DataView;

  constructor(readonly bytes: Uint8Array) {
    this.little = bytes[0] === 0x49;
    this.view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  }

  static open(bytes: Uint8Array): Tiff | undefined {
    if (!startsWith(bytes, 0, 'II*\0') && !startsWith(bytes, 0, 'MM\0*')) return undefined;
    return new Tiff(bytes);
  }

  u16(at: number) {
    return this.view.getUint16(at, this.little);
  }
  u32(at: number) {
    return this.view.getUint32(at, this.little);
  }

  /** 항목 목록. 범위를 벗어나면 undefined */
  ifd(offset: number): Entry[] | undefined {
    if (offset < 8 || offset + 2 > this.bytes.length) return undefined;
    const count = this.u16(offset);
    if (offset + 2 + count * 12 > this.bytes.length) return undefined;
    const entries: Entry[] = [];
    for (let i = 0; i < count; i++) {
      const at = offset + 2 + i * 12;
      const type = this.u16(at + 2);
      const count = this.u32(at + 4);
      const size = (TYPE_SIZE[type] ?? 1) * count;
      entries.push({
        tag: this.u16(at),
        type,
        count,
        at,
        value: size <= 4 ? at + 8 : this.u32(at + 8),
        size,
      });
    }
    return entries;
  }

  /** 값이 파일 안에 다 있는지 */
  fits(entry: Entry) {
    return entry.value + entry.size <= this.bytes.length;
  }

  string(entry: Entry | undefined): string | undefined {
    if (!entry || entry.type !== 2 || !this.fits(entry)) return undefined;
    const raw = text(this.bytes.subarray(entry.value, entry.value + entry.size));
    const value = raw.replace(/\0[\s\S]*$/, '').trim();
    return value || undefined;
  }

  short(entry: Entry | undefined): number | undefined {
    if (!entry || entry.type !== 3) return undefined;
    return this.u16(entry.value);
  }

  pointer(entry: Entry | undefined): number | undefined {
    if (!entry || (entry.type !== 4 && entry.type !== 13) || entry.count !== 1) return undefined;
    return this.u32(entry.value);
  }

  /** 도·분·초 유리수 세 개를 도로 */
  degrees(entry: Entry | undefined): number | undefined {
    if (!entry || entry.type !== 5 || entry.count !== 3 || !this.fits(entry)) return undefined;
    let total = 0;
    for (let i = 0; i < 3; i++) {
      const top = this.u32(entry.value + i * 8);
      const bottom = this.u32(entry.value + i * 8 + 4);
      if (bottom === 0) return undefined;
      total += top / bottom / 60 ** i;
    }
    return total;
  }
}

const find = (entries: Entry[] | undefined, tag: number) =>
  entries?.find((entry) => entry.tag === tag);

const TAG = {
  make: 0x010f,
  model: 0x0110,
  orientation: 0x0112,
  dateTime: 0x0132,
  exif: 0x8769,
  gps: 0x8825,
  dateTimeOriginal: 0x9003,
};

function readExif(bytes: Uint8Array) {
  const tiff = Tiff.open(bytes);
  if (!tiff) return undefined;
  const ifd0 = tiff.ifd(tiff.u32(4));
  if (!ifd0) return undefined;

  const orientation = tiff.short(find(ifd0, TAG.orientation));
  const make = tiff.string(find(ifd0, TAG.make));
  const model = tiff.string(find(ifd0, TAG.model));
  const device =
    make && model && !model.toLowerCase().startsWith(make.toLowerCase().split(' ')[0]!)
      ? `${make} ${model}`
      : (model ?? make);

  const exifOffset = tiff.pointer(find(ifd0, TAG.exif));
  const exif = exifOffset ? tiff.ifd(exifOffset) : undefined;
  const rawDate =
    tiff.string(find(exif, TAG.dateTimeOriginal)) ?? tiff.string(find(ifd0, TAG.dateTime));
  const date = rawDate?.match(/^(\d{4}):(\d\d):(\d\d) (\d\d):(\d\d)/);

  const gpsOffset = tiff.pointer(find(ifd0, TAG.gps));
  const gpsIfd = gpsOffset ? tiff.ifd(gpsOffset) : undefined;
  let gps: { latitude: number; longitude: number } | undefined;
  const latitude = tiff.degrees(find(gpsIfd, 2));
  const longitude = tiff.degrees(find(gpsIfd, 4));
  if (latitude !== undefined && longitude !== undefined && (latitude !== 0 || longitude !== 0)) {
    const south = tiff.string(find(gpsIfd, 1)) === 'S';
    const west = tiff.string(find(gpsIfd, 3)) === 'W';
    gps = { latitude: south ? -latitude : latitude, longitude: west ? -longitude : longitude };
  }

  return {
    orientation: orientation && orientation >= 1 && orientation <= 8 ? orientation : undefined,
    device,
    date: date ? `${date[1]}-${date[2]}-${date[3]} ${date[4]}:${date[5]}` : undefined,
    location: (gpsIfd?.length ?? 0) > 0,
    gps,
  };
}

/**
 * GPS 칸의 값과 항목을 모두 0으로 덮고 항목 수를 0으로 만든다 (bytes를 바로 고친다).
 * 칸 자리는 그대로 두므로 다른 값의 위치가 바뀌지 않는다. 지운 것이 있으면 true
 */
function clearGps(bytes: Uint8Array): boolean {
  const tiff = Tiff.open(bytes);
  const ifd0 = tiff?.ifd(tiff.u32(4));
  if (!tiff || !ifd0) return false;
  const offset = tiff.pointer(find(ifd0, TAG.gps));
  const entries = offset ? tiff.ifd(offset) : undefined;
  if (!offset || !entries || entries.length === 0) return false;
  for (const entry of entries) {
    if (entry.size > 4 && tiff.fits(entry)) bytes.fill(0, entry.value, entry.value + entry.size);
  }
  // 항목 수, 항목들, 다음 목록 위치(4바이트)까지 0으로
  bytes.fill(0, offset, Math.min(bytes.length, offset + 2 + entries.length * 12 + 4));
  return true;
}

/** 방향(Orientation) 한 칸만 있는 EXIF (빅 엔디언) */
function orientationTiff(orientation: number): Uint8Array {
  const bytes = new Uint8Array(26);
  const view = new DataView(bytes.buffer);
  bytes.set(ascii('MM\0*'));
  view.setUint32(4, 8);
  view.setUint16(8, 1);
  view.setUint16(10, TAG.orientation);
  view.setUint16(12, 3);
  view.setUint32(14, 1);
  view.setUint16(18, orientation);
  return bytes;
}

// ── 바이트 도우미 ──

function startsWith(bytes: Uint8Array, offset: number, value: string): boolean {
  if (offset + value.length > bytes.length) return false;
  for (let i = 0; i < value.length; i++) {
    if (bytes[offset + i] !== value.charCodeAt(i)) return false;
  }
  return true;
}

function contains(bytes: Uint8Array, value: string): boolean {
  const first = value.charCodeAt(0);
  for (let i = bytes.indexOf(first); i !== -1; i = bytes.indexOf(first, i + 1)) {
    if (startsWith(bytes, i, value)) return true;
  }
  return false;
}

const ascii = (value: string) => Uint8Array.from(value, (char) => char.charCodeAt(0));
const text = (bytes: Uint8Array) => String.fromCharCode(...bytes);
const u32be = (bytes: Uint8Array, at: number) =>
  ((bytes[at]! << 24) | (bytes[at + 1]! << 16) | (bytes[at + 2]! << 8) | bytes[at + 3]!) >>> 0;
const u32le = (bytes: Uint8Array, at: number) =>
  (bytes[at]! | (bytes[at + 1]! << 8) | (bytes[at + 2]! << 16) | (bytes[at + 3]! << 24)) >>> 0;

function concat(parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let at = 0;
  for (const part of parts) {
    out.set(part, at);
    at += part.length;
  }
  return out;
}

let crcTable: Uint32Array | undefined;

function crc32(bytes: Uint8Array): number {
  if (!crcTable) {
    crcTable = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      crcTable[n] = c >>> 0;
    }
  }
  let crc = 0xffffffff;
  for (const byte of bytes) crc = crcTable[(crc ^ byte) & 0xff]! ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}
