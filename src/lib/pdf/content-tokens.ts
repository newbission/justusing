/**
 * 쪽 내용 스트림을 토큰으로 나누기 (가리기·사진 꺼내기에서 쓴다).
 * 글자열·주석·사전·바로 써 넣은 그림 바이트 안의 글자를 연산자나 이름으로 읽지 않는다.
 */
import { inflateSync } from 'fflate';

export type Token =
  | { kind: 'name'; value: string }
  | { kind: 'string'; bytes: number[] }
  | { kind: 'op'; value: string }
  /** text: 숫자·true·false는 그 글자 (바로 써 넣은 그림의 크기를 읽으려고) */
  | { kind: 'other'; text?: string };

const WHITESPACE = /[\0\t\n\f\r ]/;
const DELIMITER = /[()<>[\]{}/%]/;

function decodeName(raw: string): string {
  return raw.replace(/#([0-9a-fA-F]{2})/g, (_, hex: string) =>
    String.fromCharCode(parseInt(hex, 16)),
  );
}

/** (…) 글자열을 바이트로. 괄호 짝과 \ 이스케이프(\n, \ddd 등)를 푼다 */
function readLiteral(text: string, start: number): { bytes: number[]; end: number } {
  const bytes: number[] = [];
  let depth = 1;
  let i = start + 1;
  const escapes: Record<string, number> = { n: 10, r: 13, t: 9, b: 8, f: 12 };
  while (i < text.length) {
    const char = text[i]!;
    if (char === '\\') {
      const next = text[i + 1] ?? '';
      if (next in escapes) {
        bytes.push(escapes[next]!);
        i += 2;
      } else if (/[0-7]/.test(next)) {
        const octal = /^[0-7]{1,3}/.exec(text.slice(i + 1, i + 4))![0];
        bytes.push(parseInt(octal, 8) & 0xff);
        i += 1 + octal.length;
      } else if (next === '\r' || next === '\n') {
        // 줄 이음
        i += next === '\r' && text[i + 2] === '\n' ? 3 : 2;
      } else {
        bytes.push(next.charCodeAt(0) & 0xff);
        i += 2;
      }
      continue;
    }
    if (char === '(') depth++;
    else if (char === ')' && --depth === 0) return { bytes, end: i + 1 };
    bytes.push(char.charCodeAt(0) & 0xff);
    i++;
  }
  return { bytes, end: text.length };
}

/** 마지막 BI부터 ID 앞까지의 사전 (/W 10 /H 10 /CS /RGB …): 이름 → 값(이름이나 숫자 글자, 배열이면 '[' 다음 이름) */
export function inlineImageDict(tokens: Token[]): Map<string, string> {
  let start = tokens.length - 2;
  while (
    start >= 0 &&
    !(tokens[start]!.kind === 'op' && (tokens[start] as { value: string }).value === 'BI')
  ) {
    start--;
  }
  const dict = new Map<string, string>();
  for (let k = start + 1; k < tokens.length - 1; k++) {
    const key = tokens[k]!;
    if (key.kind !== 'name') continue;
    let value = tokens[k + 1];
    // 배열 값([/I /RGB 255 …])은 첫 이름으로 본다
    if (value?.kind === 'other' && value.text === undefined) value = tokens[k + 2];
    if (value?.kind === 'name') dict.set(key.value, value.value);
    else if (value?.kind === 'other' && value.text !== undefined) dict.set(key.value, value.text);
    k++;
  }
  return dict;
}

/** 성분 수: 장치 색공간과 색 목록은 알고, 자원 이름 색공간은 알 수 없다 */
const INLINE_COMPONENTS: Record<string, number> = {
  G: 1,
  DeviceGray: 1,
  RGB: 3,
  DeviceRGB: 3,
  CMYK: 4,
  DeviceCMYK: 4,
  I: 1,
  Indexed: 1,
};

/** 압축 방식 이름(줄임 포함) → 끝을 읽을 수 있는 방식 */
const FILTER_NAMES: Record<string, 'Fl' | 'DCT' | 'LZW' | 'RL'> = {
  Fl: 'Fl',
  FlateDecode: 'Fl',
  DCT: 'DCT',
  DCTDecode: 'DCT',
  LZW: 'LZW',
  LZWDecode: 'LZW',
  RL: 'RL',
  RunLengthDecode: 'RL',
};

/** 공백·글자가 아닌 바이트 (그림 바이트 안이라는 표시) */
const BINARY = /[^\t\n\f\r\x20-\x7e]/;

const byteAt = (text: string, at: number) => text.charCodeAt(at) & 0xff;

/** JPEG(DCT) 자료의 끝(EOI 뒤) 자리. 조각과 압축 자료를 읽어 따라간다. 못 읽으면 undefined */
function jpegEnd(text: string, start: number): number | undefined {
  if (byteAt(text, start) !== 0xff || byteAt(text, start + 1) !== 0xd8) return undefined;
  let at = start + 2;
  while (at + 1 < text.length) {
    if (byteAt(text, at) !== 0xff) return undefined;
    while (byteAt(text, at + 1) === 0xff) at++;
    const marker = byteAt(text, at + 1);
    if (marker === 0xd9) return at + 2;
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      at += 2;
      continue;
    }
    const length = (byteAt(text, at + 2) << 8) | byteAt(text, at + 3);
    if (length < 2) return undefined;
    at += 2 + length;
    if (marker !== 0xda) continue;
    // 스캔의 압축 자료: FF 다음 00(값)·다시 시작 표시가 아닌 곳까지
    while (at + 1 < text.length) {
      if (byteAt(text, at) === 0xff) {
        const next = byteAt(text, at + 1);
        if (next !== 0x00 && !(next >= 0xd0 && next <= 0xd7)) break;
        at += 2;
      } else at++;
    }
  }
  return undefined;
}

/** RunLength 자료의 끝(EOD 128 뒤) 자리 */
function runLengthEnd(text: string, start: number): number | undefined {
  let at = start;
  while (at < text.length) {
    const length = byteAt(text, at);
    if (length === 128) return at + 1;
    at += length < 128 ? length + 2 : 2;
  }
  return undefined;
}

/** LZW 자료의 끝(EOD 부호 257이 든 바이트 뒤) 자리. 부호 길이는 9~12비트로 늘어난다 (/EarlyChange 기본값 1) */
function lzwEnd(text: string, start: number): number | undefined {
  let bit = 0;
  let width = 9;
  let next = 258;
  let previous = false;
  while (start + ((bit + width - 1) >> 3) < text.length) {
    let code = 0;
    for (let i = 0; i < width; i++) {
      const position = bit + i;
      code = (code << 1) | ((byteAt(text, start + (position >> 3)) >> (7 - (position & 7))) & 1);
    }
    bit += width;
    if (code === 257) return start + ((bit + 7) >> 3);
    if (code === 256) {
      width = 9;
      next = 258;
      previous = false;
      continue;
    }
    if (code > next) return undefined;
    // 첫 부호 뒤로는 부호마다 표에 하나가 더해지고, 표가 차면 부호가 길어진다
    if (previous) next++;
    previous = true;
    if (next + 1 >= 1 << width && width < 12) width++;
  }
  return undefined;
}

/** Flate 자료가 start부터 end 앞까지로 끝나는지 (그 자리까지 풀어 마지막 덩어리까지 있는지) */
function flateEndsBefore(text: string, start: number, end: number): boolean {
  const bytes = new Uint8Array(end - start);
  for (let i = 0; i < bytes.length; i++) bytes[i] = byteAt(text, start + i);
  try {
    // zlib 머리 2바이트 뒤가 deflate 자료다. 덜 끝난 자료면 오류를 던진다
    inflateSync(bytes.subarray(2));
    return true;
  } catch {
    return false;
  }
}

/**
 * 바로 써 넣은 그림 바이트(start부터)의 끝 다음 자리 (EI 뒤).
 * 길이(/L)를 적었거나 압축하지 않아 크기로 길이를 알 수 있으면 그 길이로 건너뛴다.
 * 압축 방식이 끝을 알려 주면(DCT의 EOI, LZW·RunLength의 EOD, Flate의 마지막 덩어리) 그 자료를 읽어 끝을 정한다.
 * 그래도 모르면(CCITT 등) 공백으로 둘러싼 EI를 찾되, 그 뒤가 그림 바이트처럼 보이면(압축 자료 안의 우연한 EI)
 * 다음 것을 찾는다
 */
function inlineImageEnd(text: string, start: number, dict: Map<string, string>): number {
  const number = (...keys: string[]) => {
    for (const key of keys) {
      const value = Number(dict.get(key));
      if (dict.has(key) && Number.isFinite(value)) return value;
    }
    return undefined;
  };
  const endsAt = (at: number) => {
    let k = at;
    while (k < text.length && WHITESPACE.test(text[k]!)) k++;
    return text.startsWith('EI', k) && (k + 2 === text.length || WHITESPACE.test(text[k + 2]!))
      ? k + 2
      : undefined;
  };
  // 글자로 적은 그림(ASCII85·ASCIIHex)은 끝 표시(~>·>)가 있어 그 뒤의 EI가 끝이다.
  // 이 바이트는 글자라 안의 EI를 그림 바이트처럼 가려낼 수 없다
  const filter = dict.get('F') ?? dict.get('Filter');
  const marker =
    filter === 'A85' || filter === 'ASCII85Decode'
      ? '~>'
      : filter === 'AHx' || filter === 'ASCIIHexDecode'
        ? '>'
        : undefined;
  if (marker) {
    const at = text.indexOf(marker, start);
    const end = at === -1 ? undefined : endsAt(at + marker.length);
    if (end !== undefined) return end;
  }
  let length = number('L', 'Length');
  if (length === undefined && !dict.has('F') && !dict.has('Filter')) {
    const mask = dict.get('IM') === 'true' || dict.get('ImageMask') === 'true';
    const width = number('W', 'Width');
    const height = number('H', 'Height');
    const bits = mask ? 1 : number('BPC', 'BitsPerComponent');
    const components = mask ? 1 : INLINE_COMPONENTS[dict.get('CS') ?? dict.get('ColorSpace') ?? ''];
    if (width && height && bits && components) {
      length = Math.ceil((width * components * bits) / 8) * height;
    }
  }
  if (length !== undefined) {
    const end = endsAt(start + length);
    if (end !== undefined) return end;
  }
  const only = filter === undefined ? undefined : FILTER_NAMES[filter];
  if (only === 'DCT' || only === 'RL' || only === 'LZW') {
    const end =
      only === 'DCT'
        ? jpegEnd(text, start)
        : only === 'RL'
          ? runLengthEnd(text, start)
          : lzwEnd(text, start);
    const after = end === undefined ? undefined : endsAt(end);
    if (after !== undefined) return after;
  }
  const pattern = /[\0\t\n\f\r ]EI(?=[\0\t\n\f\r ]|$)/g;
  pattern.lastIndex = Math.max(0, start - 1);
  if (only === 'Fl') {
    // 압축 자료 안의 우연한 EI 앞에서는 자료가 덜 끝나 풀리지 않는다
    for (let match = pattern.exec(text); match; match = pattern.exec(text)) {
      if (flateEndsBefore(text, start, match.index)) return match.index + match[0].length;
    }
    pattern.lastIndex = Math.max(0, start - 1);
  }
  let first: number | undefined;
  for (let match = pattern.exec(text); match; match = pattern.exec(text)) {
    const end = match.index + match[0].length;
    first ??= end;
    // 글자열 (…) 안은 원래 아무 바이트나 올 수 있어 그 앞까지만 본다
    const after = text.slice(end, end + 64).split('(')[0]!;
    if (!BINARY.test(after)) return end;
  }
  return first ?? text.length;
}

export function tokenize(text: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < text.length) {
    const char = text[i]!;
    if (WHITESPACE.test(char)) {
      i++;
    } else if (char === '%') {
      while (i < text.length && text[i] !== '\n' && text[i] !== '\r') i++;
    } else if (char === '(') {
      const { bytes, end } = readLiteral(text, i);
      tokens.push({ kind: 'string', bytes });
      i = end;
    } else if (char === '<' && text[i + 1] === '<') {
      tokens.push({ kind: 'other' });
      i += 2;
    } else if (char === '<') {
      const end = text.indexOf('>', i);
      const hex = text.slice(i + 1, end === -1 ? text.length : end).replace(/[^0-9a-fA-F]/g, '');
      const padded = hex.length % 2 ? `${hex}0` : hex;
      const bytes: number[] = [];
      for (let j = 0; j < padded.length; j += 2) bytes.push(parseInt(padded.slice(j, j + 2), 16));
      tokens.push({ kind: 'string', bytes });
      i = end === -1 ? text.length : end + 1;
    } else if (char === '/') {
      let end = i + 1;
      while (end < text.length && !WHITESPACE.test(text[end]!) && !DELIMITER.test(text[end]!)) {
        end++;
      }
      tokens.push({ kind: 'name', value: decodeName(text.slice(i + 1, end)) });
      i = end;
    } else if (DELIMITER.test(char)) {
      tokens.push({ kind: 'other' });
      i++;
    } else {
      let end = i;
      while (end < text.length && !WHITESPACE.test(text[end]!) && !DELIMITER.test(text[end]!)) {
        end++;
      }
      const word = text.slice(i, end);
      i = end;
      if (/^[+-]?(\d+\.?\d*|\.\d+)$/.test(word) || word === 'true' || word === 'false') {
        tokens.push({ kind: 'other', text: word });
        continue;
      }
      tokens.push({ kind: 'op', value: word });
      // 바로 써 넣은 그림의 바이트는 ID 뒤 공백 하나부터 EI 앞까지. 그 안을 연산자로 읽지 않게 건너뛴다
      if (word === 'ID') i = inlineImageEnd(text, i + 1, inlineImageDict(tokens));
    }
  }
  return tokens;
}
