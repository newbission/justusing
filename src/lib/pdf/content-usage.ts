/**
 * 쪽 내용 스트림을 토큰으로 훑어, 연산자마다 어떤 자원을 부르는지 모은다 (가리기에서 쓴다).
 * 이름만 모으면 /F1 Tf(글꼴)와 /F1 Do(그림)를 가리지 못해 쓰지 않는 자원이 남는다.
 */

/** 자원 종류별로 부른 이름 */
export type ResourceUse = Map<string, Set<string>>;

/** 글꼴로 찍은 글자 코드 (Type3 글꼴에서 실제로 쓴 글자 모양만 남기려고) */
export interface TextUse {
  font: string;
  codes: number[];
}

type Token =
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
function inlineImageDict(tokens: Token[]): Map<string, string> {
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

/** 공백·글자가 아닌 바이트 (그림 바이트 안이라는 표시) */
const BINARY = /[^\t\n\f\r\x20-\x7e]/;

/**
 * 바로 써 넣은 그림 바이트(start부터)의 끝 다음 자리 (EI 뒤).
 * 길이(/L)를 적었거나 압축하지 않아 크기로 길이를 알 수 있으면 그 길이로 건너뛴다.
 * 모르면 공백으로 둘러싼 EI를 찾되, 그 뒤가 그림 바이트처럼 보이면(압축 자료 안의 우연한 EI) 다음 것을 찾는다
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
  const pattern = /[\0\t\n\f\r ]EI(?=[\0\t\n\f\r ]|$)/g;
  pattern.lastIndex = Math.max(0, start - 1);
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

function tokenize(text: string): Token[] {
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

/** 연산자 → 마지막 이름 피연산자가 가리키는 자원 종류 */
const LAST_NAME: Record<string, string> = {
  Do: 'XObject',
  gs: 'ExtGState',
  sh: 'Shading',
  cs: 'ColorSpace',
  CS: 'ColorSpace',
  scn: 'Pattern',
  SCN: 'Pattern',
  BDC: 'Properties',
  DP: 'Properties',
};

/**
 * 이름 → 묶음 그림. key: 그 묶음 그림 객체(서로 부르는지 알아보려고), text: 내용,
 * own: 자기 자원 목록이 있음, forms: 그 안에서 부르는 이름을 찾는 곳 (자기 자원 목록이 있을 때)
 */
/** 그래픽 상태(/GS1 gs)의 /Font로 고른 글꼴을 글꼴 이름 대신 적는 표시 (GS_FONT + 상태 이름) */
export const GS_FONT = '\0gs:';

export type FormLookup = (
  name: string,
) => { key: object; text: string; own: boolean; forms?: FormLookup } | undefined;

/**
 * 내용 스트림에서 부른 자원과, 글꼴별로 찍은 글자 코드를 모은다.
 * form(이름): 그 이름이 묶음 그림이면 내용(text)과, 자기 자원 목록이 있는지(own).
 * gsFont(이름): 그 그래픽 상태가 /Font로 글꼴을 고르는지. 고르면 그 뒤 찍은 글자는 GS_FONT + 이름의 것으로 센다.
 * 묶음 그림은 부른 자리의 그래픽 상태(글꼴 포함)를 물려받으므로 부른 자리에서 이어서 훑는다.
 * 자기 자원 목록이 있으면 그 안의 이름은 이 목록의 것이 아니라서, 물려받은 글꼴로 찍은 글자만 센다
 * (그 묶음 그림이 부르는 자원은 따로 정리한다)
 */
export function contentUsage(
  texts: string[],
  form?: FormLookup,
  gsFont?: (name: string) => boolean,
): { resources: ResourceUse; text: TextUse[] } {
  const resources: ResourceUse = new Map();
  const use = (kind: string, name: string) => {
    if (!resources.has(kind)) resources.set(kind, new Set());
    resources.get(kind)!.add(name);
  };
  const shown: TextUse[] = [];
  /** 글꼴은 그래픽 상태라 q/Q로 저장·복원된다 */
  let font = '';
  const saved: string[] = [];
  /** 지금 훑는 중인 묶음 그림들 */
  const path = new Set<object>();
  /**
   * foreign: 자기 자원 목록이 있는 묶음 그림 안 (이름이 다른 목록을 가리켜 이 목록의 자원으로 세지 않는다).
   * forms: 지금 내용에서 부르는 묶음 그림 이름을 찾는 곳
   */
  const scan = (tokens: Token[], foreign: boolean, forms: FormLookup | undefined) => {
    let operands: Token[] = [];
    let inInlineImage = false;
    for (const token of tokens) {
      if (token.kind !== 'op') {
        operands.push(token);
        continue;
      }
      const names = operands.filter(
        (operand): operand is { kind: 'name'; value: string } => operand.kind === 'name',
      );
      // 자원을 부르는 이름은 연산자 바로 앞의 피연산자다 (/OC << /Type … >> BDC의 사전 안 이름은 아니다)
      const last = operands.at(-1);
      const op = token.value;
      if (op === 'BI') {
        inInlineImage = true;
      } else if (op === 'ID' && inInlineImage) {
        // 바로 써 넣은 그림의 색공간(/CS 이름)은 자원을 부를 수 있다
        const at = names.findIndex((name) => name.value === 'CS' || name.value === 'ColorSpace');
        if (at !== -1 && names[at + 1] && !foreign) use('ColorSpace', names[at + 1]!.value);
        inInlineImage = false;
      } else if (op === 'Tf' && names[0]) {
        // 다른 목록의 글꼴로 바꾸면 이 목록에서는 알 수 없는 글꼴이다
        font = foreign ? '' : names[0].value;
        if (!foreign) use('Font', font);
      } else if (op === 'gs' && last?.kind === 'name' && !foreign && gsFont?.(last.value)) {
        use('ExtGState', last.value);
        font = GS_FONT + last.value;
      } else if (op === 'q') {
        saved.push(font);
      } else if (op === 'Q') {
        font = saved.pop() ?? font;
      } else if (op === 'Tj' || op === "'" || op === '"' || op === 'TJ') {
        const codes = operands.flatMap((operand) =>
          operand.kind === 'string' ? operand.bytes : [],
        );
        if (font) shown.push({ font, codes });
      } else if (LAST_NAME[op] && last?.kind === 'name') {
        if (!foreign) use(LAST_NAME[op], last.value);
        // 묶음 그림 안에서 다시 부르는 묶음 그림도 그 자리의 글꼴 상태로 이어서 훑는다
        const inner = op === 'Do' ? forms?.(last.value) : undefined;
        // 지금 훑는 중인 묶음 그림을 다시 부르면(잘못된 파일) 그만둔다. 깊이 자체는 제한하지 않는다
        if (inner && !path.has(inner.key)) {
          path.add(inner.key);
          // 묶음 그림은 앞뒤로 q/Q를 한 것처럼 실행된다 (안에서 Q를 더 해도 바깥 상태는 그대로)
          const outer = { font, saved: [...saved] };
          scan(tokenize(inner.text), foreign || inner.own, inner.own ? inner.forms : forms);
          path.delete(inner.key);
          font = outer.font;
          saved.splice(0, saved.length, ...outer.saved);
        }
      }
      if (!inInlineImage) operands = [];
    }
  };
  // 쪽의 내용 스트림 여러 개는 이어서 하나로 실행되므로 상태를 스트림 사이에 이어 간다
  // (앞 스트림 끝의 /T3 12 Tf가 다음 스트림의 (a) Tj에 쓰인다)
  scan(
    texts.flatMap((text) => tokenize(text)),
    false,
    form,
  );
  return { resources, text: shown };
}
