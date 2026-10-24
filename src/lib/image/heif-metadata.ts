/**
 * HEIC·HEIF 안의 촬영 정보 항목(EXIF·XMP)을 찾고, 그 자리에서 같은 길이로 덮어쓴다 (위치 정보 지우기).
 *
 * HEIF는 상자(ISOBMFF) 구조이고, 위치표(`iloc`)가 항목마다 파일 안 몇 번째 바이트에 있는지 적어 둔다.
 * 항목 길이를 바꾸면 그 뒤에 있는 모든 그림 조각의 위치를 고쳐야 하므로, 길이는 그대로 두고 내용만 바꾼다.
 * 그림 자료와 상자 구조는 한 바이트도 바꾸지 않는다 (다시 저장하지 않으니 화질이 그대로다).
 *
 * 무엇이 적혔는지 모르는 항목·상자(그림도 EXIF·XMP도 아닌 것, 압축한 XMP, 동영상 트랙 등)가 있으면
 * `unknown`으로 알린다. 거기에도 위치가 적힐 수 있어, 지우는 쪽은 그런 파일을 고치지 않는다 (허용 목록).
 * 어느 항목도 쓰지 않는 바이트(빈 상자 `free`·`skip`, 그림 자료 상자 안의 쓰지 않는 틈, 파일 끝 뒤 자료)와
 * 자유 글(항목 이름, `hdlr` 이름)은 예전 편집이 남긴 촬영 정보가 있을 수 있어 `wipes`로 알려 함께 비운다.
 * 워커와 화면 어디서나 부른다. 구조를 읽지 못하면 undefined.
 */
import { ascii, boxes, child, u16, u32, type Box } from './heif-container';

export interface HeifMetaItem {
  kind: 'exif' | 'xmp';
  /** 항목 바이트가 있는 파일 안 구간들. 차례로 이어 붙이면 항목 내용이다 */
  ranges: { start: number; end: number }[];
}

/** 읽는 프로그램이 쓰지 않는 바이트 구간. fill로 채워 비운다 (길이는 그대로) */
export interface HeifWipe {
  start: number;
  end: number;
  /** 0: 쓰지 않는 자리, 0x20(공백): 0으로 끝나는 글자라 0을 넣으면 뒤 글자의 시작이 바뀌는 이름 */
  fill: number;
}

export interface HeifMeta {
  items: HeifMetaItem[];
  /** 무엇이 적혔는지 모르는 항목이나 상자가 있다 (고치지 않는다) */
  unknown: boolean;
  wipes: HeifWipe[];
}

/** 그림을 담는 항목 (그대로 둔다). 대표 그림·타일·격자·겹침·회전 그림·HDR 밝기·보조 그림(깊이 등) */
const IMAGE_ITEMS = new Set([
  'hvc1',
  'hvt1',
  'lhv1',
  'av01',
  'avc1',
  'vvc1',
  'jpeg',
  'j2k1',
  'unci',
  'mski',
  'grid',
  'iden',
  'iovl',
  'tmap',
]);
/** 맨 바깥에 있어도 되는 상자. 동영상(moov) 같은 다른 상자에는 위치가 적힐 수 있다 */
const TOP_BOXES = new Set(['ftyp', 'meta', 'mdat', 'free', 'skip']);
/** meta 안에 있어도 되는 상자 */
const META_BOXES = new Set([
  'hdlr',
  'dinf',
  'pitm',
  'iinf',
  'iloc',
  'iref',
  'iprp',
  'idat',
  'grpl',
]);
/** 글을 담는 그림 속성 (사용자 설명·태그). 무엇이든 적힐 수 있다 */
const TEXT_PROPERTIES = new Set(['udes']);

const XMP_TYPE = 'application/rdf+xml';

class Unreadable extends Error {}

export function readHeifMeta(bytes: Uint8Array): HeifMeta | undefined {
  try {
    return parse(bytes);
  } catch (error) {
    if (error instanceof Unreadable || error instanceof RangeError) return undefined;
    throw error;
  }
}

function parse(bytes: Uint8Array): HeifMeta | undefined {
  let meta: Box | undefined;
  let unknown = false;
  let first = true;
  const wipes: HeifWipe[] = [];
  const mdats: Box[] = [];
  let end = 0;
  for (const box of boxes(bytes, 0, bytes.length)) {
    if (first && box.type !== 'ftyp') return undefined;
    first = false;
    end = box.end;
    if (!TOP_BOXES.has(box.type)) unknown = true;
    if (box.type === 'free' || box.type === 'skip')
      wipes.push({ start: box.start, end: box.end, fill: 0 });
    if (box.type === 'mdat') mdats.push(box);
    if (box.type === 'meta') {
      if (meta) unknown = true;
      meta ??= box;
    }
  }
  if (!meta) return undefined;
  // 마지막 상자 뒤에 덧붙은 자료 (읽는 프로그램은 쓰지 않는다)
  if (end < bytes.length) wipes.push({ start: end, end: bytes.length, fill: 0 });
  // meta는 FullBox라 내용 앞에 판·깃발 4바이트가 있다
  for (const box of boxes(bytes, meta.start + 4, meta.end)) {
    if (!META_BOXES.has(box.type)) unknown = true;
  }
  const iinf = child(bytes, meta, 'iinf', 4);
  const iloc = child(bytes, meta, 'iloc', 4);
  const idat = child(bytes, meta, 'idat', 4);
  if (!iinf || !iloc) return undefined;
  // hdlr 이름 (판·깃발 4, pre_defined 4, 종류 4, 예약 12 뒤의 글자)
  const hdlr = child(bytes, meta, 'hdlr', 4);
  if (hdlr && hdlr.start + 24 < hdlr.end) {
    wipes.push({ start: hdlr.start + 24, end: hdlr.end, fill: 0 });
  }

  const iprp = child(bytes, meta, 'iprp', 4);
  const ipco = iprp && child(bytes, iprp, 'ipco');
  if (ipco) {
    for (const property of boxes(bytes, ipco.start, ipco.end)) {
      if (TEXT_PROPERTIES.has(property.type)) unknown = true;
    }
  }

  const infos = readItemInfos(bytes, iinf);
  const locations = readLocations(bytes, iloc);
  for (const info of infos.values()) {
    if (info.name.end > info.name.start) wipes.push({ ...info.name, fill: 0x20 });
  }
  // 어느 항목이든 쓰는 구간. 그림 자료 상자(mdat·idat) 안에서 이 밖은 쓰지 않는 틈이다
  const used: HeifMetaItem['ranges'] = [];
  for (const location of locations.values()) {
    const ranges = rangesOf(bytes, location, idat);
    if (ranges) used.push(...ranges);
    else unknown = true; // 다른 파일·다른 항목 안의 자료: 무엇을 쓰는지 몰라 틈을 가릴 수 없다
  }
  for (const box of idat ? [...mdats, idat] : mdats) {
    for (const gap of gaps(box, used)) wipes.push({ ...gap, fill: 0 });
  }

  const items: HeifMetaItem[] = [];
  for (const [id, info] of infos) {
    if (IMAGE_ITEMS.has(info.type)) continue;
    const kind =
      info.type === 'Exif'
        ? 'exif'
        : info.type === 'mime' && info.contentType === XMP_TYPE && !info.encoding
          ? 'xmp'
          : undefined;
    const location = locations.get(id);
    const ranges = kind && location && rangesOf(bytes, location, idat);
    if (!kind || !ranges) {
      unknown = true;
      continue;
    }
    items.push({ kind, ranges });
  }
  return { items, unknown, wipes };
}

/** box 내용 가운데 used 구간들이 덮지 않는 곳 */
function gaps(box: Box, used: HeifMetaItem['ranges']): HeifMetaItem['ranges'] {
  const inside = used
    .filter((range) => range.end > box.start && range.start < box.end)
    .sort((a, b) => a.start - b.start);
  const out: HeifMetaItem['ranges'] = [];
  let at = box.start;
  for (const range of inside) {
    if (range.start > at) out.push({ start: at, end: range.start });
    at = Math.max(at, range.end);
  }
  if (at < box.end) out.push({ start: at, end: box.end });
  return out;
}

interface ItemInfo {
  type: string;
  /** 항목 이름 글자가 있는 구간 (끝의 0은 빼고) */
  name: { start: number; end: number };
  contentType?: string;
  encoding?: string;
}

/** 0으로 끝나는 글자. 끝이 없으면 상자 끝까지 */
function cString(bytes: Uint8Array, at: number, end: number): { value: string; next: number } {
  let stop = at;
  while (stop < end && bytes[stop] !== 0) stop++;
  return { value: String.fromCharCode(...bytes.subarray(at, stop)), next: Math.min(stop + 1, end) };
}

function readItemInfos(bytes: Uint8Array, iinf: Box): Map<number, ItemInfo> {
  const infos = new Map<number, ItemInfo>();
  const version = bytes[iinf.start]!;
  const from = iinf.start + 4 + (version === 0 ? 2 : 4);
  for (const infe of boxes(bytes, from, iinf.end)) {
    if (infe.type !== 'infe') continue;
    const infeVersion = bytes[infe.start]!;
    // 판 0·1은 항목 종류를 적지 않는 옛 형식이다
    if (infeVersion < 2) throw new Unreadable();
    let at = infe.start + 4;
    const id = infeVersion === 2 ? u16(bytes, at) : u32(bytes, at);
    at += (infeVersion === 2 ? 2 : 4) + 2; // 보호 번호 2바이트
    if (at + 4 > infe.end) throw new Unreadable();
    const type = ascii(bytes, at);
    at += 4;
    const name = cString(bytes, at, infe.end);
    const info: ItemInfo = { type, name: { start: at, end: at + name.value.length } };
    if (type === 'mime') {
      const content = cString(bytes, name.next, infe.end);
      // 'application/rdf+xml; charset=…' 같은 덧붙임은 빼고 본다
      info.contentType = content.value.split(';')[0]!.trim().toLowerCase();
      if (content.next < infe.end) info.encoding = cString(bytes, content.next, infe.end).value;
    }
    infos.set(id, info);
  }
  return infos;
}

interface ItemLocation {
  /** 0: 파일 안, 1: idat 안 (2: 다른 항목 안은 다루지 않는다) */
  method: number;
  dataReference: number;
  base: number;
  extents: { offset: number; length: number }[];
}

function readLocations(bytes: Uint8Array, iloc: Box): Map<number, ItemLocation> {
  const version = bytes[iloc.start]!;
  if (version > 2) throw new Unreadable();
  let at = iloc.start + 4;
  const read = (size: number): number => {
    if (at + size > iloc.end) throw new Unreadable();
    let value = 0;
    if (size === 4) value = u32(bytes, at);
    else if (size === 8) {
      // 4GB가 넘는 위치는 이 파일에서 읽을 수 있는 크기가 아니다
      if (u32(bytes, at) !== 0) throw new Unreadable();
      value = u32(bytes, at + 4);
    } else if (size !== 0) throw new Unreadable();
    at += size;
    return value;
  };
  const read16 = () => {
    if (at + 2 > iloc.end) throw new Unreadable();
    const value = u16(bytes, at);
    at += 2;
    return value;
  };
  if (at + 2 > iloc.end) throw new Unreadable();
  const offsetSize = bytes[at]! >> 4;
  const lengthSize = bytes[at]! & 15;
  const baseSize = bytes[at + 1]! >> 4;
  const indexSize = version === 0 ? 0 : bytes[at + 1]! & 15;
  at += 2;
  const count = version < 2 ? read16() : read(4);
  const locations = new Map<number, ItemLocation>();
  for (let i = 0; i < count; i++) {
    const id = version < 2 ? read16() : read(4);
    const method = version === 0 ? 0 : read16() & 15;
    const dataReference = read16();
    const base = read(baseSize);
    const extentCount = read16();
    const extents: ItemLocation['extents'] = [];
    for (let j = 0; j < extentCount; j++) {
      read(indexSize);
      const offset = read(offsetSize);
      extents.push({ offset, length: read(lengthSize) });
    }
    locations.set(id, { method, dataReference, base, extents });
  }
  return locations;
}

/** 항목이 있는 파일 안 구간. 다룰 수 없는 위치(다른 파일·다른 항목 안)면 undefined */
function rangesOf(
  bytes: Uint8Array,
  location: ItemLocation,
  idat: Box | undefined,
): HeifMetaItem['ranges'] | undefined {
  if (location.dataReference !== 0 || location.extents.length === 0) return undefined;
  let from: number;
  let to: number;
  if (location.method === 0) {
    from = 0;
    to = bytes.length;
  } else if (location.method === 1 && idat) {
    from = idat.start;
    to = idat.end;
  } else {
    return undefined;
  }
  const ranges: HeifMetaItem['ranges'] = [];
  for (const extent of location.extents) {
    const start = from + location.base + extent.offset;
    // 길이 0은 '끝까지'
    const end = extent.length === 0 ? to : start + extent.length;
    if (start < from || end > to || end < start) return undefined;
    ranges.push({ start, end });
  }
  return ranges;
}

/** 항목 내용 (구간들을 이어 붙인 사본) */
export function itemBytes(bytes: Uint8Array, item: HeifMetaItem): Uint8Array {
  const length = item.ranges.reduce((sum, range) => sum + range.end - range.start, 0);
  const out = new Uint8Array(length);
  let at = 0;
  for (const range of item.ranges) {
    out.set(bytes.subarray(range.start, range.end), at);
    at += range.end - range.start;
  }
  return out;
}

/** 항목 내용을 같은 길이의 payload로 덮어쓴다 */
export function writeItem(out: Uint8Array, item: HeifMetaItem, payload: Uint8Array) {
  let at = 0;
  for (const range of item.ranges) {
    const length = range.end - range.start;
    out.set(payload.subarray(at, at + length), range.start);
    at += length;
  }
}
