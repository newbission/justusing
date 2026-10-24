/**
 * 글자 파일(CSV·TSV·TXT)의 인코딩을 알아내고 다른 인코딩으로 바꾸는 순수 함수들 (CSV 한글 깨짐 고치기).
 * 워커(convert.worker.ts)와 화면(미리보기)이 함께 쓴다. 파일은 어디로도 보내지 않는다.
 *
 * - 읽기는 브라우저의 TextDecoder가 한다. 'euc-kr'은 WHATWG 표준에 따라 CP949(확장 완성형) 전체를 읽는다
 * - 쓰기: UTF-8은 TextEncoder, CP949는 표준 라이브러리에 없어 TextDecoder로 모든 두 바이트 글자를 한 번
 *   읽어 거꾸로 찾는 표(글자 → 바이트)를 만든다. 표를 코드에 넣지 않아 내려받는 크기가 늘지 않는다
 */

/** 원본 인코딩 (TextDecoder 이름) */
export type SourceEncoding =
  'utf-8' | 'euc-kr' | 'utf-16le' | 'utf-16be' | 'windows-1252' | 'shift_jis' | 'gbk' | 'big5';

/** 고를 수 있는 원본 인코딩 (화면 순서) */
export const SOURCE_ENCODINGS: SourceEncoding[] = [
  'utf-8',
  'euc-kr',
  'utf-16le',
  'utf-16be',
  'windows-1252',
  'shift_jis',
  'gbk',
  'big5',
];

/** 저장 형식: 엑셀용 UTF-8(BOM 포함) / UTF-8(BOM 없음) / CP949 */
export type TargetFormat = 'excel' | 'utf8' | 'cp949';

/** 줄바꿈: 그대로 / CRLF(윈도우) / LF */
export type Newline = 'keep' | 'crlf' | 'lf';

export interface Detection {
  /** text: 글자 파일 / empty: 빈 파일 / binary: 글자 파일이 아님 (엑셀 파일·이미지 등) */
  kind: 'text' | 'empty' | 'binary';
  /** 알아낸 인코딩 (empty·binary는 의미 없음) */
  encoding: SourceEncoding;
  /** 파일 앞에 BOM(인코딩 표시)이 있다 */
  bom: boolean;
  /** 파일 전체가 영문·숫자·기호(ASCII)뿐이라 어느 인코딩으로 읽어도 같다 */
  ascii: boolean;
}

export const UTF8_BOM = new Uint8Array([0xef, 0xbb, 0xbf]);

const startsWith = (bytes: Uint8Array, prefix: number[]) =>
  prefix.every((byte, index) => bytes[index] === byte);

/** 깨진 바이트 없이 그 인코딩으로 읽히는지 (끝이 글자 중간에서 잘렸으면 complete=false) */
function decodes(bytes: Uint8Array, encoding: SourceEncoding, complete: boolean): boolean {
  try {
    new TextDecoder(encoding, { fatal: true }).decode(bytes, { stream: !complete });
    return true;
  } catch {
    return false;
  }
}

/**
 * BOM 없는 UTF-16: 0 바이트가 대부분 짝수·홀수 자리 한쪽에 있고(ASCII 글자의 높은 바이트), 그쪽으로 읽으면
 * 깨짐도 조절 문자도 없다. 한글이 많은 파일은 0 바이트가 적어(쉼표·줄바꿈 정도) 비율이 아니라 몰림으로 본다.
 * '가'(U+AC00)처럼 낮은 바이트가 0인 글자도 있어 모두 한쪽이기를 바라지 않는다
 */
function utf16Without(bytes: Uint8Array, complete: boolean): 'utf-16le' | 'utf-16be' | undefined {
  const length = Math.min(bytes.length, 65536) & ~1;
  if (length < 4) return undefined;
  let even = 0;
  let odd = 0;
  for (let i = 0; i < length; i += 2) {
    if (bytes[i] === 0) even++;
    if (bytes[i + 1] === 0) odd++;
  }
  const zeros = even + odd;
  if (zeros < Math.max(2, (length / 2) * 0.02)) return undefined;
  const side = odd >= zeros * 0.8 ? 'utf-16le' : even >= zeros * 0.8 ? 'utf-16be' : undefined;
  if (!side) return undefined;
  try {
    const text = new TextDecoder(side, { fatal: true }).decode(bytes.subarray(0, length), {
      stream: !complete || length < bytes.length,
    });
    // 글자 파일에 없는 조절 문자가 나오면 UTF-16이 아니다 (탭·줄바꿈·폼피드만 허용)
    return /[\u0000-\u0008\u000b\u000e-\u001f]/.test(text) ? undefined : side;
  } catch {
    return undefined;
  }
}

/** 글자 파일에는 거의 없는 조절 문자(NUL 등)가 많으면 글자 파일이 아니다 */
function looksBinary(bytes: Uint8Array): boolean {
  const length = Math.min(bytes.length, 8192);
  let control = 0;
  for (let i = 0; i < length; i++) {
    const byte = bytes[i]!;
    if (byte === 0) return true;
    // 탭·줄바꿈·폼피드·ESC는 글자 파일에도 나온다
    if (byte < 0x20 && byte !== 0x09 && byte !== 0x0a && byte !== 0x0d && byte !== 0x0c) {
      if (byte !== 0x1b) control++;
    }
  }
  return control > length * 0.02;
}

/**
 * 파일 앞부분(sample)으로 인코딩을 알아낸다. complete는 sample이 파일 전체인지.
 * 순서: 빈 파일 → BOM → BOM 없는 UTF-16 → 글자 파일이 아님 → ASCII만 → UTF-8 → CP949 → Windows-1252
 */
export function detectEncoding(sample: Uint8Array, complete: boolean): Detection {
  const text = (encoding: SourceEncoding, bom = false, ascii = false): Detection => ({
    kind: 'text',
    encoding,
    bom,
    ascii,
  });
  if (sample.length === 0) return { kind: 'empty', encoding: 'utf-8', bom: false, ascii: true };
  if (startsWith(sample, [0xef, 0xbb, 0xbf])) {
    // BOM만 있는 파일은 내용이 없다
    if (complete && sample.length === 3) return { ...text('utf-8', true, true), kind: 'empty' };
    return text('utf-8', true, complete && !sample.subarray(3).some((byte) => byte >= 0x80));
  }
  if (startsWith(sample, [0xff, 0xfe])) return text('utf-16le', true);
  if (startsWith(sample, [0xfe, 0xff])) return text('utf-16be', true);
  const utf16 = utf16Without(sample, complete);
  if (utf16) return text(utf16);
  if (looksBinary(sample)) return { kind: 'binary', encoding: 'utf-8', bom: false, ascii: false };
  // 앞부분만 읽었으면 뒤에 한글이 있을 수 있어 ASCII라고 단정하지 않는다 (UTF-8로 본다)
  if (!sample.some((byte) => byte >= 0x80)) return text('utf-8', false, complete);
  if (decodes(sample, 'utf-8', complete)) return text('utf-8');

  // UTF-8이 아니면 CP949인지 본다. CP949로 깨짐 없이 읽히고 한글 완성형이 많으면 CP949
  const korean = new TextDecoder('euc-kr').decode(sample, { stream: !complete });
  let others = 0;
  let hangul = 0;
  let broken = 0;
  for (const char of korean) {
    const code = char.codePointAt(0)!;
    if (code < 0x80) continue;
    if (code === 0xfffd) broken++;
    else if (code >= 0xac00 && code <= 0xd7a3) hangul++;
    else others++;
  }
  if (broken === 0 && hangul >= (hangul + others) * 0.3) return text('euc-kr');
  return text('windows-1252');
}

/** 한 덩어리 줄바꿈을 바꾼다. 덩어리 끝의 CR은 다음 덩어리의 LF와 짝일 수 있어 남겨 둔다 */
export class NewlineConverter {
  #pendingCR = false;
  constructor(readonly mode: Newline) {}

  push(text: string, final: boolean): string {
    if (this.mode === 'keep') return text;
    if (this.#pendingCR) text = '\r' + text;
    this.#pendingCR = !final && text.endsWith('\r');
    if (this.#pendingCR) text = text.slice(0, -1);
    return text.replace(/\r\n|\r|\n/g, this.mode === 'crlf' ? '\r\n' : '\n');
  }
}

/** 글자 → CP949 두 바이트(lead << 8 | trail). 0이면 CP949에 없는 글자 */
let cp949Table: Uint16Array | undefined;

/** CP949로 쓰는 표. 처음 부를 때 TextDecoder('euc-kr')로 만든다 (수 ms) */
export function cp949(): Uint16Array {
  if (cp949Table) return cp949Table;
  // 두 바이트마다 LF(0x0A)를 넣어 한 줄에 한 글자씩 읽는다. 없는 자리는 �나 두 글자로 나와 빠진다
  const bytes: number[] = [];
  for (let lead = 0x81; lead <= 0xfe; lead++) {
    for (let trail = 0x41; trail <= 0xfe; trail++) bytes.push(lead, trail, 0x0a);
  }
  const lines = new TextDecoder('euc-kr').decode(new Uint8Array(bytes)).split('\n');
  const table = new Uint16Array(0x10000);
  let index = 0;
  for (let lead = 0x81; lead <= 0xfe; lead++) {
    for (let trail = 0x41; trail <= 0xfe; trail++) {
      const line = lines[index++]!;
      if (line.length !== 1 || line === '\ufffd') continue;
      const code = line.charCodeAt(0);
      // 같은 글자가 두 자리에 있으면 앞 자리를 쓴다 (WHATWG 인코더와 같게)
      if (table[code] === 0) table[code] = (lead << 8) | trail;
    }
  }
  return (cp949Table = table);
}

/** CP949로 저장하면 보일 글자 (없는 글자는 ?). 미리보기에 쓴다 */
export function asCp949(text: string): string {
  const table = cp949();
  let out = '';
  for (const char of text) {
    const code = char.charCodeAt(0);
    out += char.length === 1 && (code < 0x80 || table[code] !== 0) ? char : '?';
  }
  return out;
}

export interface Unmappable {
  /** CP949에 없어 ?로 바꾼 글자 수 */
  count: number;
  /** 앞에서 몇 개 (글자와 줄 번호) */
  examples: { char: string; line: number }[];
}

/** CP949로 쓴다. 덩어리마다 부르고, 없는 글자는 ?로 바꿔 세어 둔다 */
export class Cp949Encoder {
  readonly unmappable: Unmappable = { count: 0, examples: [] };
  #line = 1;
  readonly #table = cp949();

  encode(text: string): Uint8Array {
    const out = new Uint8Array(text.length * 2);
    let n = 0;
    for (let i = 0; i < text.length; i++) {
      const code = text.charCodeAt(i);
      if (code < 0x80) {
        out[n++] = code;
        if (code === 0x0a) this.#line++;
        continue;
      }
      const pair = this.#table[code]!;
      if (pair !== 0) {
        out[n++] = pair >> 8;
        out[n++] = pair & 0xff;
        continue;
      }
      // 이모지처럼 두 단위(서로게이트 쌍)로 된 글자는 한 글자로 센다
      const wide = code >= 0xd800 && code <= 0xdbff && i + 1 < text.length;
      const char = wide ? text.slice(i, i + 2) : text[i]!;
      if (wide) i++;
      out[n++] = 0x3f;
      this.unmappable.count++;
      if (this.unmappable.examples.length < 5) {
        this.unmappable.examples.push({ char, line: this.#line });
      }
    }
    return out.subarray(0, n);
  }
}

/** 미리보기 표 */
export interface Preview {
  rows: string[][];
  /** 보여 준 줄보다 더 있다 */
  more: boolean;
}

/** 칸 나누는 글자: TSV는 탭, 그 밖에는 첫 줄에서 따옴표 밖에 가장 많은 것 */
function delimiterOf(text: string, name: string): string {
  if (/\.tsv$/i.test(name)) return '\t';
  const counts: Record<string, number> = { ',': 0, '\t': 0, ';': 0 };
  let quoted = false;
  for (const char of text) {
    if (char === '"') quoted = !quoted;
    else if (quoted) continue;
    else if (char === '\r' || char === '\n') break;
    else if (char in counts) counts[char]!++;
  }
  const [best, n] = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]!;
  return n > 0 ? best : ',';
}

/**
 * 파일 앞부분을 그 인코딩으로 읽어 표 몇 줄로 나눈다 (따옴표 안의 쉼표·줄바꿈은 칸 안의 글자).
 * complete가 아니면 마지막 줄은 잘렸을 수 있어 뺀다.
 */
export function previewRows(
  head: Uint8Array,
  encoding: SourceEncoding,
  complete: boolean,
  name: string,
  maxRows = 6,
): Preview {
  const text = new TextDecoder(encoding).decode(head, { stream: !complete });
  const delimiter = delimiterOf(text, name);
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  let i = 0;
  const endRow = () => {
    row.push(cell);
    rows.push(row);
    row = [];
    cell = '';
  };
  for (; i < text.length && rows.length <= maxRows; i++) {
    const char = text[i]!;
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (char === '"') quoted = false;
      else cell += char;
    } else if (char === '"' && cell === '') quoted = true;
    else if (char === delimiter) {
      row.push(cell);
      cell = '';
    } else if (char === '\r' || char === '\n') {
      if (char === '\r' && text[i + 1] === '\n') i++;
      endRow();
    } else cell += char;
  }
  // 파일 끝까지 읽었으면 마지막 줄(줄바꿈 없이 끝난 줄)도 넣는다
  if (i >= text.length && complete && (cell !== '' || row.length > 0)) endRow();
  return { rows: rows.slice(0, maxRows), more: rows.length > maxRows || !complete };
}
