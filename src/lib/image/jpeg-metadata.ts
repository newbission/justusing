/**
 * JPEG에서 그림과 상관없는 정보 조각(촬영 정보 EXIF·GPS, XMP, IPTC, 설명 글 등)을 떼어 낸다. 다시 압축하지 않는다.
 *
 * 남기는 것만 정해 둔다 (허용 목록): 그림을 푸는 데 필요한 조각 전부(양자화·허프만 표, 프레임·스캔 머리, 다시 시작 간격 등)와
 * 색을 정하는 APP0 'JFIF'(밀도), APP2 'ICC_PROFILE'(색 프로필), APP14 'Adobe'(색 변환). 그 밖의 APP 조각과 설명(COM)은 뺀다.
 * 구조를 읽지 못하면 undefined (원본을 고치지 않는다)
 */

const SOI = 0xd8;
const EOI = 0xd9;
const SOS = 0xda;
const COM = 0xfe;

/** 길이 없이 표시만 있는 조각: 다시 시작(RST0~7), TEM */
const standalone = (marker: number) => (marker >= 0xd0 && marker <= 0xd7) || marker === 0x01;

function startsWith(bytes: Uint8Array, offset: number, text: string): boolean {
  for (let i = 0; i < text.length; i++) {
    if (bytes[offset + i] !== text.charCodeAt(i)) return false;
  }
  return true;
}

/** 조각 머리(FF 표시 길이 두 바이트) 뒤 내용이 시작하는 곳에서, 남길 APP 조각인지 */
function keepsApp(marker: number, bytes: Uint8Array, body: number): boolean {
  if (marker === 0xe0) return startsWith(bytes, body, 'JFIF\0');
  if (marker === 0xe2) return startsWith(bytes, body, 'ICC_PROFILE\0');
  if (marker === 0xee) return startsWith(bytes, body, 'Adobe');
  return false;
}

export function stripJpegMetadata(bytes: Uint8Array): Uint8Array | undefined {
  return rewriteJpeg(bytes, (marker, segment) =>
    marker !== COM && keepsApp(marker, segment, 4) ? 'keep' : 'drop',
  );
}

/** 정보 조각 하나를 어떻게 할지: 그대로 두기, 빼기, 또는 바꾼 조각(머리 FF 표시·길이까지 포함) */
export type SegmentAction = 'keep' | 'drop' | Uint8Array;

/**
 * JPEG의 정보 조각(APP0~APP15, 설명 COM)마다 decide를 불러 두거나 빼거나 바꾼다. 그 밖의 조각과 압축 자료는 그대로 옮긴다.
 * decide는 조각 전체(FF 표시부터 끝까지)를 받는다. 아무것도 바뀌지 않으면 받은 bytes를 그대로 돌려준다.
 * 구조를 읽지 못하면 undefined
 */
export function rewriteJpeg(
  bytes: Uint8Array,
  decide: (marker: number, segment: Uint8Array) => SegmentAction,
): Uint8Array | undefined {
  if (bytes[0] !== 0xff || bytes[1] !== SOI) return undefined;
  const parts: Uint8Array[] = [bytes.subarray(0, 2)];
  let removed = false;
  let offset = 2;
  while (offset < bytes.length) {
    // 조각 사이의 군더더기 바이트(0 채움 등)는 디코더도 건너뛴다. 결과에서는 뺀다
    if (bytes[offset] !== 0xff) {
      while (offset < bytes.length && bytes[offset] !== 0xff) offset++;
      removed = true;
      continue;
    }
    // 표시 앞의 채움 바이트(FF FF …)는 건너뛴다
    let at = offset;
    while (bytes[at + 1] === 0xff) at++;
    const marker = bytes[at + 1];
    if (marker === undefined) return undefined;
    if (marker === EOI) {
      parts.push(bytes.subarray(at, at + 2));
      // 그림 끝 뒤에 덧붙은 자료(움직이는 사진의 영상, 다른 그림 등)는 뺀다. 거기에도 촬영 정보가 들어 있을 수 있다
      if (at + 2 < bytes.length) removed = true;
      offset = bytes.length;
      break;
    }
    if (standalone(marker)) {
      parts.push(bytes.subarray(at, at + 2));
      offset = at + 2;
      continue;
    }
    if (at + 4 > bytes.length) return undefined;
    const length = (bytes[at + 2]! << 8) | bytes[at + 3]!;
    const end = at + 2 + length;
    if (length < 2 || end > bytes.length) return undefined;
    if ((marker >= 0xe0 && marker <= 0xef) || marker === COM) {
      const action = decide(marker, bytes.subarray(at, end));
      if (action === 'keep') parts.push(bytes.subarray(at, end));
      else {
        if (action !== 'drop') parts.push(action);
        removed = true;
      }
      offset = end;
      continue;
    }
    if (marker !== SOS) {
      parts.push(bytes.subarray(at, end));
      offset = end;
      continue;
    }
    // 스캔: 머리 뒤 압축 자료는 다음 표시(FF 다음 00·다시 시작이 아닌 바이트)까지 그대로 옮긴다
    let data = end;
    while (data < bytes.length) {
      if (bytes[data] === 0xff) {
        const next = bytes[data + 1];
        if (next !== 0x00 && !(next !== undefined && next >= 0xd0 && next <= 0xd7)) break;
        data += 2;
      } else {
        data++;
      }
    }
    parts.push(bytes.subarray(at, data));
    offset = data;
  }
  if (!removed) return bytes;
  const size = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(size);
  let write = 0;
  for (const part of parts) {
    out.set(part, write);
    write += part.length;
  }
  return out;
}
