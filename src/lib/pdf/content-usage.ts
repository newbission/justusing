/**
 * 쪽 내용 스트림을 토큰으로 훑어, 연산자마다 어떤 자원을 부르는지 모은다 (가리기에서 쓴다).
 * 이름만 모으면 /F1 Tf(글꼴)와 /F1 Do(그림)를 가리지 못해 쓰지 않는 자원이 남는다.
 */

import { tokenize, type Token } from './content-tokens';

/** 자원 종류별로 부른 이름 */
export type ResourceUse = Map<string, Set<string>>;

/** 글꼴로 찍은 글자 코드 (Type3 글꼴에서 실제로 쓴 글자 모양만 남기려고) */
export interface TextUse {
  font: string;
  codes: number[];
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

/** 장치 색공간 이름 → 그것을 대신하는 기본 색공간 자원 이름 (자원 목록의 /DefaultRGB 등이 있으면 그것으로 그린다) */
const DEVICE_SPACES: Record<string, string> = {
  DeviceGray: 'DefaultGray',
  DeviceRGB: 'DefaultRGB',
  DeviceCMYK: 'DefaultCMYK',
};
/** 바로 써 넣은 그림(BI … ID)에서만 쓰는 장치 색공간 줄임 이름 */
const INLINE_SPACES: Record<string, string> = {
  G: 'DefaultGray',
  RGB: 'DefaultRGB',
  CMYK: 'DefaultCMYK',
};
/** 장치 색을 바로 고르는 연산자 → 기본 색공간 */
const DEVICE_COLOR_OPS: Record<string, string> = {
  g: 'DefaultGray',
  G: 'DefaultGray',
  rg: 'DefaultRGB',
  RG: 'DefaultRGB',
  k: 'DefaultCMYK',
  K: 'DefaultCMYK',
};
/**
 * 지금 색으로 칠하는 연산자. 처음 색은 장치 회색이라 색을 고르지 않고 칠하면 /DefaultGray로 그린다
 * (색을 골랐는지 따라가지 않고, 칠하면 쓴 것으로 센다). 그림(Do·BI)은 자기 색공간으로 그려 넣지 않는다.
 * 지금 색으로 칠하는 마스크 그림은 따로 센다 (바로 써 넣은 것은 여기서, 묶음 그림은 사전을 보는 쪽에서)
 */
const PAINTS = new Set(['f', 'F', 'f*', 'B', 'B*', 'b', 'b*', 'S', 's', 'Tj', 'TJ', "'", '"']);

/**
 * 색공간 이름이 부르는 자원 목록(/ColorSpace)의 이름 (inline: 바로 써 넣은 그림 안의 이름).
 * 장치 색공간은 같은 이름의 항목이 있어도 그것을 부르지 않고 기본 색공간(/DefaultRGB 등)을 부른다.
 * /Pattern은 아무것도 부르지 않는다
 */
export function spaceResource(name: string, inline = false): string | undefined {
  if (name === 'Pattern') return undefined;
  return DEVICE_SPACES[name] ?? (inline ? INLINE_SPACES[name] : undefined) ?? name;
}

/**
 * 이름 → 묶음 그림. key: 그 묶음 그림 객체(서로 부르는지 알아보려고), text: 내용,
 * own: 자기 자원 목록이 있음, forms: 그 안에서 부르는 이름을 찾는 곳 (자기 자원 목록이 있을 때)
 */
/** 그래픽 상태(/GS1 gs)의 /Font로 고른 글꼴을 글꼴 이름 대신 적는 표시 (GS_FONT + 상태 이름) */
export const GS_FONT = '\0gs:';

export type FormLookup = (name: string) =>
  | {
      key: object;
      text: string;
      own: boolean;
      forms?: FormLookup;
      /** 자기 자원 목록이 있을 때: 그 목록의 그래픽 상태가 /Font로 글꼴을 고르는지 */
      gsFont?: (name: string) => boolean;
    }
  | undefined;

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
  const scan = (
    tokens: Token[],
    foreign: boolean,
    forms: FormLookup | undefined,
    gsFonts: ((name: string) => boolean) | undefined,
  ) => {
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
      if (!foreign) {
        const device = DEVICE_COLOR_OPS[op];
        if (device) use('ColorSpace', device);
        if (PAINTS.has(op)) use('ColorSpace', 'DefaultGray');
      }
      if (op === 'BI') {
        inInlineImage = true;
      } else if (op === 'ID' && inInlineImage) {
        // 바로 써 넣은 그림의 색공간은 자원을 부를 수 있다: /CS /CS0, 또는 색 목록 [/I /CS1 255 <…>]의 기본
        const at = operands.findIndex(
          (operand) =>
            operand.kind === 'name' && (operand.value === 'CS' || operand.value === 'ColorSpace'),
        );
        const value = operands[at + 1];
        const mask = operands.some(
          (operand, index) =>
            operand.kind === 'name' &&
            (operand.value === 'IM' || operand.value === 'ImageMask') &&
            operands[index + 1]?.kind === 'other' &&
            (operands[index + 1] as { text?: string }).text === 'true',
        );
        if (mask && !foreign) use('ColorSpace', 'DefaultGray');
        if (at !== -1 && !foreign) {
          const space = (name: string) => {
            const resource = spaceResource(name, true);
            if (resource) use('ColorSpace', resource);
          };
          if (value?.kind === 'name') space(value.value);
          else if (value?.kind === 'other' && value.text === undefined) {
            // 배열: 첫 이름은 종류(/I·/Indexed), 둘째 이름이 기본 색공간
            const base = operands[at + 3];
            if (base?.kind === 'name') space(base.value);
          }
        }
        inInlineImage = false;
      } else if (op === 'Tf' && names[0]) {
        // 다른 목록의 글꼴로 바꾸면 이 목록에서는 알 수 없는 글꼴이다
        font = foreign ? '' : names[0].value;
        if (!foreign) use('Font', font);
      } else if (op === 'gs' && last?.kind === 'name' && gsFonts?.(last.value)) {
        // 다른 목록의 그래픽 상태가 고른 글꼴은 이 목록에서 알 수 없는 글꼴이다 (물려받은 글꼴은 끝난다)
        if (foreign) font = '';
        else {
          use('ExtGState', last.value);
          font = GS_FONT + last.value;
        }
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
        const kind = LAST_NAME[op];
        const resource = kind === 'ColorSpace' ? spaceResource(last.value) : last.value;
        if (!foreign && resource) use(kind, resource);
        // 묶음 그림 안에서 다시 부르는 묶음 그림도 그 자리의 글꼴 상태로 이어서 훑는다
        const inner = op === 'Do' ? forms?.(last.value) : undefined;
        // 지금 훑는 중인 묶음 그림을 다시 부르면(잘못된 파일) 그만둔다. 깊이 자체는 제한하지 않는다
        if (inner && !path.has(inner.key)) {
          path.add(inner.key);
          // 묶음 그림은 앞뒤로 q/Q를 한 것처럼 실행된다 (안에서 Q를 더 해도 바깥 상태는 그대로)
          const outer = { font, saved: [...saved] };
          scan(
            tokenize(inner.text),
            foreign || inner.own,
            inner.own ? inner.forms : forms,
            inner.own ? inner.gsFont : gsFonts,
          );
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
    gsFont,
  );
  return { resources, text: shown };
}
