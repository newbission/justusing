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
  | { kind: 'other' };

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
        tokens.push({ kind: 'other' });
        continue;
      }
      tokens.push({ kind: 'op', value: word });
      if (word === 'ID') {
        // 바로 써 넣은 그림의 바이트는 공백+EI+공백까지 건너뛴다
        const ei = /[\0\t\n\f\r ]EI(?=[\0\t\n\f\r ]|$)/.exec(text.slice(i + 1));
        i = ei ? i + 1 + ei.index + ei[0].length : text.length;
      }
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

/** 내용 스트림에서 부른 자원과, 글꼴별로 찍은 글자 코드를 모은다 */
export function contentUsage(texts: string[]): { resources: ResourceUse; text: TextUse[] } {
  const resources: ResourceUse = new Map();
  const use = (kind: string, name: string) => {
    if (!resources.has(kind)) resources.set(kind, new Set());
    resources.get(kind)!.add(name);
  };
  const shown: TextUse[] = [];
  // 쪽의 내용 스트림 여러 개는 이어서 하나로 실행되므로 상태를 스트림 사이에 이어 간다
  // (앞 스트림 끝의 /T3 12 Tf가 다음 스트림의 (a) Tj에 쓰인다)
  let operands: Token[] = [];
  /** 글꼴은 그래픽 상태라 q/Q로 저장·복원된다 */
  let font = '';
  const saved: string[] = [];
  let inInlineImage = false;
  for (const text of texts) {
    for (const token of tokenize(text)) {
      if (token.kind !== 'op') {
        operands.push(token);
        continue;
      }
      const names = operands.filter(
        (operand): operand is { kind: 'name'; value: string } => operand.kind === 'name',
      );
      const op = token.value;
      if (op === 'BI') {
        inInlineImage = true;
      } else if (op === 'ID' && inInlineImage) {
        // 바로 써 넣은 그림의 색공간(/CS 이름)은 자원을 부를 수 있다
        const at = names.findIndex((name) => name.value === 'CS' || name.value === 'ColorSpace');
        if (at !== -1 && names[at + 1]) use('ColorSpace', names[at + 1]!.value);
        inInlineImage = false;
      } else if (op === 'Tf' && names[0]) {
        font = names[0].value;
        use('Font', font);
      } else if (op === 'q') {
        saved.push(font);
      } else if (op === 'Q') {
        font = saved.pop() ?? font;
      } else if (op === 'Tj' || op === "'" || op === '"' || op === 'TJ') {
        const codes = operands.flatMap((operand) =>
          operand.kind === 'string' ? operand.bytes : [],
        );
        if (font) shown.push({ font, codes });
      } else if (LAST_NAME[op] && names.length > 0) {
        use(LAST_NAME[op], names.at(-1)!.value);
      }
      if (!inInlineImage) operands = [];
    }
  }
  return { resources, text: shown };
}
