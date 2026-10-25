/**
 * HEIC·HEIF 안의 촬영 정보 항목(EXIF·XMP, JPEG 그림 항목 안의 정보 조각)을 찾고, 그 자리에서 같은 길이로 덮어쓴다
 * (위치 정보 지우기).
 *
 * HEIF는 상자(ISOBMFF) 구조이고, 위치표(`iloc`)가 항목마다 파일 안 몇 번째 바이트에 있는지 적어 둔다.
 * 항목 길이를 바꾸면 그 뒤에 있는 모든 그림 조각의 위치를 고쳐야 하므로, 길이는 그대로 두고 내용만 바꾼다.
 * 그림 자료와 상자 구조는 한 바이트도 바꾸지 않는다 (다시 저장하지 않으니 화질이 그대로다).
 *
 * 모든 단계가 허용 목록이다: 맨 바깥 상자, meta 안의 상자, 그림 속성(ipco), 항목 종류(iinf), 항목 참조 종류(iref),
 * 자료 참조(dref), 묶음(grpl), HEVC 그림 자료와 설정(hvcC) 안의 NAL 종류·SEI 종류까지 안전하다고 확인한 것만 둔다.
 * 그 밖의 것이 하나라도 있으면 `unknown`으로 알리고, 지우는 쪽은 그 파일을 고치지 않는다 (거기에도 위치가 적힐 수 있다).
 * 어느 항목도 쓰지 않는 바이트(빈 상자 `free`·`skip`, 그림 자료 상자 안의 쓰지 않는 틈, 파일 끝 뒤 자료)와
 * 자유 글(항목 이름, `hdlr` 이름)은 예전 편집이 남긴 촬영 정보가 있을 수 있어 `wipes`로 알려 함께 비운다.
 * 워커와 화면 어디서나 부른다. 구조를 읽지 못하면 undefined.
 */
import { ascii, boxes, child, u16, u32, type Box } from './heif-container';

export interface HeifMetaItem {
  /** jpeg: JPEG 그림 항목. 안의 정보 조각(EXIF·XMP 등)을 같은 길이로 비운다 */
  kind: 'exif' | 'xmp' | 'jpeg';
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
  /** 허용 목록 밖의 상자·속성·항목·참조가 있다 (무엇이 적혔는지 몰라 고치지 않는다) */
  unknown: boolean;
  wipes: HeifWipe[];
  /** 압축한 그림 자료(HEVC·JPEG 항목)의 구간. 마지막 훑어보기(글자 찾기)에서 뺀다 (임의 바이트라 우연히 글자처럼 보인다) */
  coded: { start: number; end: number }[];
}

/** HEVC로 압축한 그림 항목 (대표 그림·타일·썸네일·보조 그림). 안의 NAL 종류를 확인한다 */
const HEVC_ITEMS = new Set(['hvc1']);
/** 다른 그림을 이어 만드는 항목 (격리·겹침·회전·HDR 밝기 적용). 내용은 숫자뿐이다 */
const DERIVED_ITEMS = new Set(['grid', 'iden', 'iovl', 'tmap']);
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
/**
 * 그림 속성 (ipco). 숫자만 담거나(크기·회전·자르기·화소 깊이·밝기 범위), 그림을 푸는 데 필요한 것(HEVC 설정, 색 프로필)뿐이다.
 * 색 프로필(ICC)은 JPG에서 남기는 것과 같은 기준으로 남긴다. 사용자 설명(udes)·확장(uuid) 같은 것은 없다
 */
const PROPERTIES = new Set([
  'hvcC',
  'ispe',
  'colr',
  'pixi',
  'irot',
  'imir',
  'clap',
  'pasp',
  'auxC',
  'clli',
  'mdcv',
  'cclv',
  'amve',
  'lsel',
  'rloc',
]);
/** 항목 참조 (iref). 항목 번호만 담는다: 썸네일·보조 그림·이어 만들기·정보 설명·바탕·미리 곱한 투명 */
const REFERENCES = new Set(['thmb', 'auxl', 'dimg', 'cdsc', 'base', 'prem']);
/** 묶음 (grpl). 항목 번호만 담는다: 바꿔 볼 수 있는 그림(HDR·SDR), 입체 */
const GROUPS = new Set(['altr', 'ster']);
/** iprp 안의 상자 */
const IPRP_BOXES = new Set(['ipco', 'ipma']);
/**
 * HEVC NAL 종류: 0~31 그림 조각, 32~34 매개변수 묶음, 35 접근 단위 구분, 36~38 끝 표시·채움, 39·40 SEI(종류를 따로 본다).
 * 41 이상(예약·지정되지 않음)은 무엇이든 담을 수 있어 받지 않는다
 */
const isAllowedNal = (type: number) => type <= 40;
const SEI_PREFIX = 39;
const SEI_SUFFIX = 40;
/** SEI 중 아무 글이나 담을 수 있는 것: 등록된 사용자 자료(4), 등록 안 된 사용자 자료(5, 인코더 이름 등) */
const TEXT_SEI = new Set([4, 5]);
/** 보조 그림 종류(auxC)는 'urn:…' 이름 하나다. 숫자·점이 이어진 좌표 같은 글은 받지 않는다 */
const AUX_TYPE = /^urn:[A-Za-z0-9:_-]+$/;

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

/** 상자 안의 자식 상자 종류가 모두 allowed 안에 있는지 */
function onlyChildren(bytes: Uint8Array, box: Box, skip: number, allowed: Set<string>): boolean {
  let covered = box.start + skip;
  for (const inner of boxes(bytes, box.start + skip, box.end)) {
    if (!allowed.has(inner.type)) return false;
    covered = inner.end;
  }
  // 자식 상자 뒤에 남은 바이트가 있으면 상자로 읽히지 않는 자료다
  return covered === box.end;
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
    if (box.type === 'free' || box.type === 'skip') {
      wipes.push({ start: box.start, end: box.end, fill: 0 });
    }
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
  if (!onlyChildren(bytes, meta, 4, META_BOXES)) unknown = true;
  const iinf = child(bytes, meta, 'iinf', 4);
  const iloc = child(bytes, meta, 'iloc', 4);
  const idat = child(bytes, meta, 'idat', 4);
  if (!iinf || !iloc) return undefined;
  // hdlr 이름 (판·깃발 4, pre_defined 4, 종류 4, 예약 12 뒤의 글자)
  const hdlr = child(bytes, meta, 'hdlr', 4);
  if (hdlr && hdlr.start + 24 < hdlr.end) {
    wipes.push({ start: hdlr.start + 24, end: hdlr.end, fill: 0 });
  }
  const dinf = child(bytes, meta, 'dinf', 4);
  if (dinf && !selfContained(bytes, dinf)) unknown = true;
  const iref = child(bytes, meta, 'iref', 4);
  if (iref && !onlyChildren(bytes, iref, 4, REFERENCES)) unknown = true;
  const grpl = child(bytes, meta, 'grpl', 4);
  if (grpl && !onlyChildren(bytes, grpl, 0, GROUPS)) unknown = true;

  const iprp = child(bytes, meta, 'iprp', 4);
  const ipco = iprp && child(bytes, iprp, 'ipco');
  /** HEVC 그림 자료의 NAL 길이 바이트 수 (hvcC). 그림마다 다르면 모른다고 본다 */
  let nalLength: number | undefined;
  if (iprp && !onlyChildren(bytes, iprp, 0, IPRP_BOXES)) unknown = true;
  if (ipco) {
    if (!onlyChildren(bytes, ipco, 0, PROPERTIES)) unknown = true;
    for (const property of boxes(bytes, ipco.start, ipco.end)) {
      if (property.type === 'auxC' && !safeAuxType(bytes, property)) unknown = true;
      if (property.type === 'hvcC') {
        const config = readHevcConfig(bytes, property);
        if (!config) unknown = true;
        else if (nalLength !== undefined && nalLength !== config.nalLength) unknown = true;
        else nalLength = config.nalLength;
      }
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
  const coded: HeifMeta['coded'] = [];
  for (const [id, info] of infos) {
    const location = locations.get(id);
    const ranges = location && rangesOf(bytes, location, idat);
    // 보호(암호화)된 항목은 안을 볼 수 없다
    if (info.protection !== 0 || info.trailing) unknown = true;
    if (DERIVED_ITEMS.has(info.type)) continue;
    if (HEVC_ITEMS.has(info.type)) {
      if (!ranges) continue; // 자료가 없는 항목
      coded.push(...ranges);
      if (nalLength === undefined || !safeHevcData(join(bytes, ranges), nalLength)) unknown = true;
      continue;
    }
    const kind =
      info.type === 'Exif'
        ? 'exif'
        : info.type === 'jpeg'
          ? 'jpeg'
          : info.type === 'mime' && info.contentType === XMP_TYPE && !info.encoding
            ? 'xmp'
            : undefined;
    if (!kind || !ranges) {
      unknown = true;
      continue;
    }
    if (kind === 'jpeg') coded.push(...ranges);
    items.push({ kind, ranges });
  }
  return { items, unknown, wipes, coded };
}

/** 자료 참조(dinf > dref)가 모두 '이 파일 안'(url 상자의 깃발 1, 주소 글 없음)인지 */
function selfContained(bytes: Uint8Array, dinf: Box): boolean {
  if (!onlyChildren(bytes, dinf, 0, new Set(['dref']))) return false;
  const dref = child(bytes, dinf, 'dref');
  if (!dref) return true;
  for (const entry of boxes(bytes, dref.start + 8, dref.end)) {
    if (entry.type !== 'url ' || entry.end - entry.start !== 4) return false;
    if ((bytes[entry.start + 3]! & 1) !== 1) return false;
  }
  return onlyChildren(bytes, dref, 8, new Set(['url ']));
}

/** auxC(판·깃발 4 + 0으로 끝나는 종류 이름 + 덧붙임)의 종류 이름이 'urn:…'이고 덧붙임에 글이 없는지 */
function safeAuxType(bytes: Uint8Array, box: Box): boolean {
  const name = cString(bytes, box.start + 4, box.end);
  return AUX_TYPE.test(name.value) && !hasText(bytes.subarray(name.next, box.end));
}

/** 읽을 수 있는 글자가 8개 넘게 이어진 곳이 있는지 (숫자로만 된 자료 안의 글 찾기) */
function hasText(bytes: Uint8Array): boolean {
  let run = 0;
  for (const value of bytes) {
    run = value >= 0x20 && value < 0x7f ? run + 1 : 0;
    if (run >= 8) return true;
  }
  return false;
}

/** hvcC: NAL 길이 바이트 수와, 안에 든 NAL(매개변수 묶음·SEI)이 허용 목록 안인지 */
function readHevcConfig(bytes: Uint8Array, box: Box): { nalLength: number } | undefined {
  if (box.start + 23 > box.end) return undefined;
  const nalLength = (bytes[box.start + 21]! & 3) + 1;
  if (nalLength === 3) return undefined;
  const arrays = bytes[box.start + 22]!;
  let at = box.start + 23;
  for (let i = 0; i < arrays; i++) {
    if (at + 3 > box.end) return undefined;
    const type = bytes[at]! & 0x3f;
    const count = u16(bytes, at + 1);
    at += 3;
    for (let j = 0; j < count; j++) {
      if (at + 2 > box.end) return undefined;
      const length = u16(bytes, at);
      at += 2;
      if (at + length > box.end || length < 2) return undefined;
      const nal = bytes.subarray(at, at + length);
      if (((nal[0]! >> 1) & 0x3f) !== type || !safeNal(nal)) return undefined;
      at += length;
    }
  }
  return at === box.end ? { nalLength } : undefined;
}

/** 길이를 앞에 붙인 NAL들로 된 HEVC 그림 자료가 허용 목록 안의 NAL·SEI만 담는지 */
function safeHevcData(data: Uint8Array, nalLength: number): boolean {
  let at = 0;
  while (at < data.length) {
    if (at + nalLength > data.length) return false;
    let length = 0;
    for (let i = 0; i < nalLength; i++) length = length * 256 + data[at + i]!;
    at += nalLength;
    if (length < 2 || at + length > data.length) return false;
    if (!safeNal(data.subarray(at, at + length))) return false;
    at += length;
  }
  return true;
}

/** NAL 하나: 종류가 허용 목록 안이고, SEI라면 글을 담는 SEI가 없는지 */
function safeNal(nal: Uint8Array): boolean {
  const type = (nal[0]! >> 1) & 0x3f;
  if (!isAllowedNal(type)) return false;
  if (type !== SEI_PREFIX && type !== SEI_SUFFIX) return true;
  // 막음 바이트(00 00 03의 03)를 빼고 SEI 메시지를 하나씩 읽는다
  const raw: number[] = [];
  for (let i = 2, zeros = 0; i < nal.length; i++) {
    const value = nal[i]!;
    if (zeros >= 2 && value === 3) {
      zeros = 0;
      continue;
    }
    zeros = value === 0 ? zeros + 1 : 0;
    raw.push(value);
  }
  let at = 0;
  // 끝의 rbsp 끝 표시(0x80)만 남을 때까지
  while (at < raw.length && !(at === raw.length - 1 && raw[at] === 0x80)) {
    let payloadType = 0;
    while (raw[at] === 0xff) {
      payloadType += 255;
      at++;
    }
    if (at >= raw.length) return false;
    payloadType += raw[at++]!;
    let size = 0;
    while (raw[at] === 0xff) {
      size += 255;
      at++;
    }
    if (at >= raw.length) return false;
    size += raw[at++]!;
    if (TEXT_SEI.has(payloadType)) return false;
    at += size;
    if (at > raw.length) return false;
  }
  return true;
}

/** 구간들을 이어 붙인 사본 */
function join(bytes: Uint8Array, ranges: HeifMetaItem['ranges']): Uint8Array {
  return itemBytes(bytes, { kind: 'exif', ranges });
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
  /** 보호(암호화) 번호. 0이면 보호하지 않음 */
  protection: number;
  /** 정해진 칸 뒤에 바이트가 더 있다 */
  trailing?: boolean;
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
    if (infe.type !== 'infe') throw new Unreadable();
    const infeVersion = bytes[infe.start]!;
    // 판 0·1은 항목 종류를 적지 않는 옛 형식이다
    if (infeVersion < 2) throw new Unreadable();
    let at = infe.start + 4;
    const id = infeVersion === 2 ? u16(bytes, at) : u32(bytes, at);
    at += infeVersion === 2 ? 2 : 4;
    if (at + 6 > infe.end) throw new Unreadable();
    const protection = u16(bytes, at);
    at += 2;
    const type = ascii(bytes, at);
    at += 4;
    const name = cString(bytes, at, infe.end);
    const info: ItemInfo = {
      type,
      protection,
      name: { start: at, end: at + name.value.length },
    };
    let next = name.next;
    if (type === 'mime') {
      const content = cString(bytes, name.next, infe.end);
      // 덧붙임('; …')은 그대로 남는 글이라 받지 않는다: 정확히 같은 종류 이름만 XMP로 본다
      info.contentType = content.value;
      next = content.next;
      if (next < infe.end) {
        const encoding = cString(bytes, next, infe.end);
        info.encoding = encoding.value;
        next = encoding.next;
      }
    }
    // 정해진 칸 뒤에 남은 바이트는 무엇이 적혔는지 모른다
    if (next < infe.end) info.trailing = true;
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
