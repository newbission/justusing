/**
 * 사진 파일(JPG·PNG·WebP·HEIC) 안의 촬영 정보(EXIF·GPS, XMP, IPTC, 설명 글)를 읽고 지운다 (위치정보 지우기 도구).
 * 그림은 다시 압축하지 않고 정보 조각만 빼거나 고쳐 다시 이어 붙인다. 화질과 그림 바이트가 그대로다.
 * HEIC는 조각을 빼면 그림 위치표를 고쳐야 해서, EXIF·XMP 항목을 같은 길이로 그 자리에서 덮어쓴다 (heif-metadata.ts).
 *
 * - location: EXIF는 위치가 적힐 수 없는 칸(날짜·기기·촬영 설정)만 골라 새로 만들고, 그림을 그리는 데 필요한 조각 말고는 모두 뺀다
 *   (XMP·IPTC·설명 글·알 수 없는 조각과 그림 끝 뒤에 덧붙은 자료. 어디에든 위치가 적힐 수 있어 남길 것만 정한다).
 *   찍은 날짜·기기 같은 나머지 EXIF는 남긴다
 * - all: 그림을 그리는 데 필요한 것(색 프로필 등)만 남기고 모두 뺀다. 사진이 눕지 않게 방향(Orientation) 한 칸만 새로 적는다
 *
 * 구조를 읽지 못하면 undefined (원본을 고치지 않는다). 워커(metadata.worker.ts)에서 돈다.
 */
import { crc32 } from '../crc32';
import { isHeifHead } from './heif-container';
import { itemBytes, readHeifMeta, writeItem } from './heif-metadata';
import { rewriteJpeg, stripJpegMetadata, type SegmentAction } from './jpeg-metadata';

export type CleanMode = 'location' | 'all';
export type PhotoFormat = 'jpeg' | 'png' | 'webp' | 'heif';

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
  /**
   * 그림 뒤에 다른 그림이나 영상이 붙어 있다: 안드로이드 Ultra HDR의 밝기 정보(게인 맵), 움직이는 사진의 영상 등.
   * 두 방식 모두 빼므로 HDR 사진은 일반 사진으로, 움직이는 사진은 멈춘 사진으로 남는다 (화면이 미리 알린다)
   */
  appended: boolean;
}

export function detectFormat(bytes: Uint8Array): PhotoFormat | undefined {
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return 'jpeg';
  if (startsWith(bytes, 0, '\x89PNG\r\n\x1a\n')) return 'png';
  if (startsWith(bytes, 0, 'RIFF') && startsWith(bytes, 8, 'WEBP')) return 'webp';
  if (isHeifHead(bytes.subarray(0, 64))) return 'heif';
  return undefined;
}

export function readPhotoInfo(bytes: Uint8Array): PhotoInfo | undefined {
  const format = detectFormat(bytes);
  const info: PhotoInfo = {
    format: format ?? 'jpeg',
    location: false,
    orientation: 1,
    extra: false,
    appended: false,
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
    const result = rewriteJpeg(
      bytes,
      (marker, segment) => {
        const kind = jpegSegmentKind(marker, segment);
        if (kind === 'exif') exif(segment.subarray(10));
        else if (kind === 'xmp') xmp(segment);
        if (kind !== 'image') info.extra = true;
        return 'keep';
      },
      (rest) => {
        if (contains(rest, '\xff\xd8\xff') || contains(rest, 'ftyp')) info.appended = true;
      },
    );
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
      if (!pngKeeps(chunk.type)) info.extra = true;
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
      if (!WEBP_IMAGE.has(chunk.type)) info.extra = true;
    }
    if (chunks.trailing) info.extra = true;
    return info;
  }
  if (format === 'heif') {
    const meta = readHeifMeta(bytes);
    if (!meta) return undefined;
    for (const item of meta.items) {
      const data = itemBytes(bytes, item);
      if (item.kind === 'exif') {
        const start = heifExifStart(data);
        if (start !== undefined) exif(data.subarray(start));
      } else {
        xmp(data);
      }
    }
    info.extra = meta.items.length > 0 || meta.unknown;
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
  if (format === 'heif') return cleanHeif(bytes, mode);
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
  // 남길 것만 정한다 (허용 목록): 그림을 그리는 데 쓰는 조각과, GPS를 비운 EXIF.
  // XMP·IPTC·설명(COM)·여러 장 묶음 목록(MPF)·제조사 조각 등 나머지는 모두 뺀다
  return rewriteJpeg(bytes, (marker, segment): SegmentAction => {
    const kind = jpegSegmentKind(marker, segment);
    if (kind === 'image') return 'keep';
    if (kind !== 'exif') return 'drop';
    const tiff = segment.subarray(10);
    const safe = safeExif(tiff);
    if (!safe) return 'drop';
    return sameBytes(safe, tiff) ? 'keep' : jpegExifSegment(safe);
  });
}

/** TIFF를 담은 APP1 Exif 조각 */
function jpegExifSegment(tiff: Uint8Array): Uint8Array {
  const length = 2 + 6 + tiff.length;
  const segment = new Uint8Array(2 + length);
  segment.set([0xff, 0xe1, length >> 8, length & 0xff]);
  segment.set(ascii('Exif\0\0'), 4);
  segment.set(tiff, 10);
  return segment;
}

/** 정보를 모두 뺀 JPEG에 방향만 적은 EXIF 조각을 JFIF 뒤(없으면 맨 앞)에 넣는다 */
function withJpegExif(bytes: Uint8Array, tiff: Uint8Array): Uint8Array {
  const segment = jpegExifSegment(tiff);
  let at = 2;
  if (bytes[2] === 0xff && bytes[3] === 0xe0) at = 4 + ((bytes[4]! << 8) | bytes[5]!);
  return concat([bytes.subarray(0, at), segment, bytes.subarray(at)]);
}

// ── PNG ──

/**
 * 그림을 그리는 데 쓰는 PNG 보조 조각 (허용 목록): 투명·색·감마·밀도·HDR, 움직이는 PNG(APNG).
 * 이름 첫 글자가 대문자인 필수 조각(IHDR·PLTE·IDAT·IEND 등)도 남긴다. 그 밖의 보조 조각은 뺀다
 */
const PNG_IMAGE = new Set([
  'tRNS',
  'cHRM',
  'gAMA',
  'iCCP',
  'sBIT',
  'sRGB',
  'cICP',
  'mDCV',
  'cLLI',
  'bKGD',
  'hIST',
  'pHYs',
  'sPLT',
  'acTL',
  'fcTL',
  'fdAT',
]);
const PNG_TEXT = new Set(['tEXt', 'zTXt', 'iTXt']);
const pngKeeps = (type: string) => PNG_IMAGE.has(type) || (type[0]! >= 'A' && type[0]! <= 'Z');

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

function cleanPng(bytes: Uint8Array, mode: CleanMode): Uint8Array | undefined {
  const chunks = pngChunks(bytes);
  if (!chunks) return undefined;
  const orientation = mode === 'all' ? (readPhotoInfo(bytes)?.orientation ?? 1) : 1;
  let changed = chunks.trailing;
  let wroteOrientation = false;
  const parts: Uint8Array[] = [bytes.subarray(0, 8)];
  for (const chunk of chunks.list) {
    // 위치만 지울 때는 EXIF(GPS를 비움)와 고친 시각을 남긴다. 글 조각은 XMP·IPTC·EXIF 프로필을 담을 수 있어 뺀다
    if (mode === 'location' && chunk.type === 'eXIf') {
      const safe = safeExif(chunk.data);
      if (safe && sameBytes(safe, chunk.data)) {
        parts.push(chunk.whole);
      } else {
        if (safe) parts.push(pngChunk('eXIf', safe));
        changed = true;
      }
      continue;
    }
    if (mode === 'location' && chunk.type === 'tIME') {
      parts.push(chunk.whole);
      continue;
    }
    if (pngKeeps(chunk.type)) {
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
/** 그림을 그리는 데 쓰는 WebP 조각 (허용 목록). 그 밖의 조각은 뺀다 */
const WEBP_IMAGE = new Set(['VP8 ', 'VP8L', 'VP8X', 'ALPH', 'ANIM', 'ANMF', 'ICCP']);

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
    if (WEBP_IMAGE.has(chunk.type)) {
      parts.push(chunk.whole);
      continue;
    }
    if (mode === 'location' && chunk.type === 'EXIF') {
      const tiff = exifTiff(chunk.data);
      const safe = safeExif(tiff);
      if (safe && sameBytes(safe, tiff)) {
        parts.push(chunk.whole);
      } else {
        if (safe) parts.push(webpChunk('EXIF', safe));
        else clearFlags |= WEBP_FLAGS.EXIF!;
        changed = true;
      }
      continue;
    }
    changed = true;
    if (mode === 'all' && chunk.type === 'EXIF' && orientation !== 1) {
      parts.push(webpChunk('EXIF', orientationTiff(orientation)));
      setFlags |= WEBP_FLAGS.EXIF!;
      continue;
    }
    clearFlags |= WEBP_FLAGS[chunk.type] ?? 0;
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

// ── HEIC·HEIF ──

/**
 * EXIF 항목 안에서 TIFF가 시작하는 곳. 항목은 'TIFF까지 건너뛸 바이트 수'(4바이트) 뒤에
 * ('Exif\0\0' 같은 머리를 건너) TIFF가 온다. 읽지 못하면 undefined
 */
function heifExifStart(data: Uint8Array): number | undefined {
  if (data.length < 4) return undefined;
  const start = 4 + u32be(data, 0);
  return Tiff.open(data.subarray(start)) ? start : undefined;
}

/** 칸이 하나도 없는 EXIF (빅 엔디언) */
const EMPTY_TIFF = Uint8Array.from([0x4d, 0x4d, 0, 0x2a, 0, 0, 0, 8, 0, 0, 0, 0, 0, 0]);
/** 내용이 없는 XMP. 남는 자리는 공백으로 채운다 (XMP는 뒤에 공백을 둘 수 있다) */
const EMPTY_XMP = '<x:xmpmeta xmlns:x="adobe:ns:meta/"/>';

/**
 * EXIF 항목을 같은 길이로 다시 쓴다. 남길 칸만 있는 TIFF를 원래 자리에 쓰고 나머지는 0으로 지운다
 * (예전 GPS 바이트가 파일에 남지 않게). 새 TIFF가 원래 자리보다 크면 undefined
 */
function cleanHeifExif(data: Uint8Array, mode: CleanMode, orientation: number) {
  const start = heifExifStart(data);
  // 읽지 못하는 EXIF는 통째로 지운다 (건너뛸 수 0, 내용 0 → 읽는 프로그램은 EXIF가 없는 것으로 본다)
  if (start === undefined) return new Uint8Array(data.length);
  const tiff = data.subarray(start);
  const replacement =
    mode === 'all'
      ? orientation !== 1
        ? orientationTiff(orientation)
        : EMPTY_TIFF
      : (safeExif(tiff) ?? EMPTY_TIFF);
  if (replacement.length > tiff.length) return undefined;
  const next = data.slice();
  next.fill(0, start);
  next.set(replacement, start);
  return next;
}

function emptyXmp(length: number): Uint8Array {
  const out = new Uint8Array(length).fill(0x20);
  if (length >= EMPTY_XMP.length) out.set(ascii(EMPTY_XMP));
  return out;
}

/**
 * 위치만 지울 때도 모두 지울 때도 XMP는 비운다 (JPG에서 XMP 조각을 빼는 것과 같다).
 * 무엇이 적혔는지 모르는 항목·상자가 있으면 고치지 않는다 (undefined)
 */
function cleanHeif(bytes: Uint8Array, mode: CleanMode): Uint8Array | undefined {
  const meta = readHeifMeta(bytes);
  if (!meta || meta.unknown) return undefined;
  const orientation = mode === 'all' ? (readPhotoInfo(bytes)?.orientation ?? 1) : 1;
  let out: Uint8Array | undefined;
  for (const item of meta.items) {
    const data = itemBytes(bytes, item);
    const next =
      item.kind === 'exif' ? cleanHeifExif(data, mode, orientation) : emptyXmp(data.length);
    if (!next) return undefined;
    if (sameBytes(next, data)) continue;
    out ??= bytes.slice();
    writeItem(out, item, next);
  }
  return out ?? bytes;
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
    // 머리(바이트 순서 4바이트 + 첫 칸 위치 4바이트)가 다 있어야 한다
    if (bytes.length < 8) return undefined;
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

/** 깨진 EXIF가 범위 밖을 가리키면 DataView가 RangeError를 던진다. 그 EXIF만 읽지 못한 것으로 둔다 */
function guard<T>(read: () => T): T | undefined {
  try {
    return read();
  } catch (error) {
    if (error instanceof RangeError) return undefined;
    throw error;
  }
}

function readExif(bytes: Uint8Array) {
  return guard(() => readExifFields(bytes));
}

function readExifFields(bytes: Uint8Array) {
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

/** 위치만 지울 때 남기는 EXIF 칸 (허용 목록). 자유 글(설명·메모), 제조사 메모, GPS, 썸네일은 옮기지 않는다 */
const KEEP_IFD0 = new Set([
  0x010f, // 제조사
  0x0110, // 모델
  0x0112, // 방향
  0x011a, // 가로 해상도
  0x011b, // 세로 해상도
  0x0128, // 해상도 단위
  0x0132, // 고친 날짜
]);
const KEEP_EXIF = new Set([
  0x829a, // 노출 시간
  0x829d, // 조리개 값
  0x8822, // 노출 프로그램
  0x8827, // ISO
  0x9000, // EXIF 판
  0x9003, // 찍은 날짜
  0x9004, // 디지털로 만든 날짜
  0x9010, // 시간대
  0x9011,
  0x9012,
  0x9201, // 셔터 속도
  0x9202, // 조리개
  0x9204, // 노출 보정
  0x9207, // 측광 방식
  0x9209, // 플래시
  0x920a, // 초점 거리
  0x9290, // 1초 아래 시각
  0x9291,
  0x9292,
  0xa001, // 색 공간
  0xa002, // 가로 화소
  0xa003, // 세로 화소
  0xa402, // 노출 방식
  0xa403, // 화이트 밸런스
  0xa405, // 35mm 환산 초점 거리
  0xa406, // 장면 종류
  0xa433, // 렌즈 제조사
  0xa434, // 렌즈 모델
]);

interface Field {
  tag: number;
  type: number;
  count: number;
  value: Uint8Array;
}

/**
 * 위치가 적힐 수 없는 칸만 골라 EXIF를 새로 만든다 (바이트 순서는 원본 그대로).
 * 위치는 GPS 칸뿐 아니라 설명·메모 같은 자유 글에도 적힐 수 있어, 지울 칸이 아니라 남길 칸을 정한다.
 * 읽지 못하면 undefined (그 EXIF는 통째로 뺀다)
 */
function safeExif(bytes: Uint8Array): Uint8Array | undefined {
  return guard(() => safeExifFields(bytes));
}

function safeExifFields(bytes: Uint8Array): Uint8Array | undefined {
  const tiff = Tiff.open(bytes);
  const ifd0 = tiff?.ifd(tiff.u32(4));
  if (!tiff || !ifd0) return undefined;
  const pick = (entries: Entry[] | undefined, keep: Set<number>): Field[] =>
    (entries ?? [])
      .filter((entry) => keep.has(entry.tag) && tiff.fits(entry))
      .map((entry) => ({
        tag: entry.tag,
        type: entry.type,
        count: entry.count,
        value: bytes.subarray(entry.value, entry.value + entry.size),
      }));
  const exifOffset = tiff.pointer(find(ifd0, TAG.exif));
  const main = pick(ifd0, KEEP_IFD0);
  const exif = pick(exifOffset ? tiff.ifd(exifOffset) : undefined, KEEP_EXIF);
  return writeTiff(tiff.little, main, exif);
}

/** IFD0(+EXIF 칸)만 있는 TIFF. 값이 4바이트보다 크면 칸 뒤에 짝수 자리로 둔다 */
function writeTiff(little: boolean, main: Field[], exif: Field[]): Uint8Array {
  const pointer = exif.length > 0 ? { tag: TAG.exif, type: 4, count: 1 } : undefined;
  const ifdSize = (count: number) => 2 + count * 12 + 4;
  const dataSize = (fields: Field[]) =>
    fields.reduce(
      (sum, field) => sum + (field.value.length > 4 ? (field.value.length + 1) & ~1 : 0),
      0,
    );
  const mainCount = main.length + (pointer ? 1 : 0);
  const exifStart = 8 + ifdSize(mainCount) + dataSize(main);
  const total = exifStart + (exif.length > 0 ? ifdSize(exif.length) + dataSize(exif) : 0);
  const out = new Uint8Array(total);
  const view = new DataView(out.buffer);
  out.set(ascii(little ? 'II*\0' : 'MM\0*'));
  view.setUint32(4, 8, little);

  const writeIfd = (
    at: number,
    fields: (Field | { tag: number; type: number; count: number; pointTo: number })[],
  ) => {
    fields.sort((a, b) => a.tag - b.tag);
    view.setUint16(at, fields.length, little);
    let data = at + ifdSize(fields.length);
    fields.forEach((field, index) => {
      const entry = at + 2 + index * 12;
      view.setUint16(entry, field.tag, little);
      view.setUint16(entry + 2, field.type, little);
      view.setUint32(entry + 4, field.count, little);
      if ('pointTo' in field) {
        view.setUint32(entry + 8, field.pointTo, little);
      } else if (field.value.length <= 4) {
        out.set(field.value, entry + 8);
      } else {
        view.setUint32(entry + 8, data, little);
        out.set(field.value, data);
        data += (field.value.length + 1) & ~1;
      }
    });
    view.setUint32(at + 2 + fields.length * 12, 0, little);
  };
  writeIfd(8, pointer ? [...main, { ...pointer, pointTo: exifStart }] : [...main]);
  if (exif.length > 0) writeIfd(exifStart, [...exif]);
  return out;
}

const sameBytes = (a: Uint8Array, b: Uint8Array) =>
  a.length === b.length && a.every((value, index) => value === b[index]);

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
