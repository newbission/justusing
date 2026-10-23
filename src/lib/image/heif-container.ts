/**
 * HEIC·HEIF 파일의 겉 구조(ISOBMFF 상자)에서 그림을 풀지 않고 알 수 있는 것을 읽는다.
 * - 이 파일이 HEVC로 압축한 HEIF(아이폰 HEIC 등)인지 (`ftyp` 상자의 브랜드)
 * - 대표 그림의 색 공간 (`colr` 상자). 아이폰 사진은 Display P3로 찍힌다
 * 화면 스레드와 워커 어디서나 부른다. 읽지 못하는 구조면 모른다고(기본값) 답한다.
 */

/** HEVC로 압축한 HEIF 브랜드 (heic: 아이폰 사진, heix: 10비트, heim·heis: 여러 겹, hev*: 연속 사진) */
const HEVC_BRANDS = new Set(['heic', 'heix', 'heim', 'heis', 'hevc', 'hevx', 'hevm', 'hevs']);

const ascii = (bytes: Uint8Array, at: number) =>
  String.fromCharCode(bytes[at]!, bytes[at + 1]!, bytes[at + 2]!, bytes[at + 3]!);

function u32(bytes: Uint8Array, at: number): number {
  return (
    ((bytes[at]! << 24) | (bytes[at + 1]! << 16) | (bytes[at + 2]! << 8) | bytes[at + 3]!) >>> 0
  );
}

const u16 = (bytes: Uint8Array, at: number) => (bytes[at]! << 8) | bytes[at + 1]!;

/** 파일 머리(앞 64바이트면 충분)로 HEVC HEIF인지 본다 */
export function isHeifHead(head: Uint8Array): boolean {
  if (head.length < 16 || ascii(head, 4) !== 'ftyp') return false;
  const end = Math.min(head.length, u32(head, 0));
  const brands = [ascii(head, 8)];
  for (let at = 16; at + 4 <= end; at += 4) brands.push(ascii(head, at));
  if (brands.some((brand) => HEVC_BRANDS.has(brand))) return true;
  // 'mif1'만 적은 HEIF(일부 카메라)도 HEVC로 보고 libheif에 맡긴다. AVIF는 브라우저가 읽으므로 뺀다
  return brands.includes('mif1') && !brands.some((brand) => brand.startsWith('avi'));
}

interface Box {
  type: string;
  /** 머리 뒤 내용의 시작과 끝 */
  start: number;
  end: number;
}

/** [from, to) 안의 상자들 */
function* boxes(bytes: Uint8Array, from: number, to: number): Generator<Box> {
  let at = from;
  while (at + 8 <= to) {
    let size = u32(bytes, at);
    const type = ascii(bytes, at + 4);
    let header = 8;
    if (size === 1) {
      // 64비트 크기. 앞 4바이트가 0이 아니면 이 파일에서 읽을 수 있는 크기가 아니다
      if (at + 16 > to || u32(bytes, at + 8) !== 0) return;
      size = u32(bytes, at + 12);
      header = 16;
    } else if (size === 0) size = to - at;
    if (size < header || at + size > to) return;
    yield { type, start: at + header, end: at + size };
    at += size;
  }
}

const child = (bytes: Uint8Array, parent: Box, type: string, skip = 0) => {
  for (const box of boxes(bytes, parent.start + skip, parent.end))
    if (box.type === type) return box;
  return undefined;
};

export type HeifColorSpace = 'srgb' | 'display-p3';

/**
 * 대표 그림의 색 공간. Display P3가 아니면 모두 'srgb'로 본다 (BT.2020 같은 넓은 색은 다루지 않는다).
 * 대표 그림에 `colr`가 없으면 파일 안의 첫 `colr`를 본다 (아이폰은 타일마다 같은 프로필을 단다)
 */
export function heifColorSpace(bytes: Uint8Array): HeifColorSpace {
  try {
    return readColorSpace(bytes);
  } catch {
    return 'srgb';
  }
}

function readColorSpace(bytes: Uint8Array): HeifColorSpace {
  let meta: Box | undefined;
  for (const box of boxes(bytes, 0, bytes.length)) {
    if (box.type === 'meta') {
      meta = box;
      break;
    }
  }
  if (!meta) return 'srgb';
  // meta·pitm·ipma는 FullBox라 내용 앞에 판·깃발 4바이트가 있다
  const pitm = child(bytes, meta, 'pitm', 4);
  const iprp = child(bytes, meta, 'iprp', 4);
  const ipco = iprp && child(bytes, iprp, 'ipco');
  if (!ipco) return 'srgb';
  const properties = [...boxes(bytes, ipco.start, ipco.end)];
  const colors = properties.filter((box) => box.type === 'colr');
  if (colors.length === 0) return 'srgb';

  let chosen = colors[0]!;
  const primary =
    pitm && (bytes[pitm.start] === 0 ? u16(bytes, pitm.start + 4) : u32(bytes, pitm.start + 4));
  const ipma = iprp && child(bytes, iprp, 'ipma');
  if (primary !== undefined && ipma) {
    const version = bytes[ipma.start]!;
    const wide = (bytes[ipma.start + 3]! & 1) === 1;
    let at = ipma.start + 4;
    const count = u32(bytes, at);
    at += 4;
    for (let i = 0; i < count && at < ipma.end; i++) {
      const item = version < 1 ? u16(bytes, at) : u32(bytes, at);
      at += version < 1 ? 2 : 4;
      const associations = bytes[at]!;
      at += 1;
      for (let j = 0; j < associations; j++) {
        const index = wide ? u16(bytes, at) & 0x7fff : bytes[at]! & 0x7f;
        at += wide ? 2 : 1;
        const property = properties[index - 1];
        if (item === primary && property?.type === 'colr') chosen = property;
      }
    }
  }
  return colorOf(bytes, chosen);
}

function colorOf(bytes: Uint8Array, colr: Box): HeifColorSpace {
  const kind = ascii(bytes, colr.start);
  // nclx: 색 기준점 12번이 Display P3 (SMPTE EG 432-1)
  if (kind === 'nclx') return u16(bytes, colr.start + 4) === 12 ? 'display-p3' : 'srgb';
  if (kind === 'prof' || kind === 'rICC') {
    // ICC 프로필은 설명 이름으로 본다. 아이폰은 'Display P3' (UTF-16 글자라 0을 빼고 찾는다)
    let text = '';
    for (let at = colr.start + 4; at < colr.end; at++) {
      const code = bytes[at]!;
      if (code >= 0x20 && code < 0x7f) text += String.fromCharCode(code);
    }
    return /Display P3/i.test(text) ? 'display-p3' : 'srgb';
  }
  return 'srgb';
}
