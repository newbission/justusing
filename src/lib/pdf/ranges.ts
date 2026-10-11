/**
 * 페이지 범위 입력 해석 (나누기 도구). 예: "1-3, 4-6, 7" → [[1,2,3], [4,5,6], [7]]
 *
 * - 구분: 쉼표·세미콜론·줄바꿈
 * - 범위: "1-3" 또는 "1~3", 끝까지 "5-", 처음부터 "-3"
 * - 쪽 번호는 1부터. 범위끼리 겹쳐도 된다 (각각 다른 파일이 된다)
 */
export type RangeResult = { ok: true; ranges: number[][] } | { ok: false; message: string };

export function parseRanges(text: string, pageCount: number): RangeResult {
  const parts = text
    .split(/[,;\n]/)
    .map((part) => part.replace(/\s+/g, ''))
    .filter(Boolean);
  if (parts.length === 0) return { ok: false, message: '나눌 범위를 입력하세요. 예: 1-3, 4-6, 7' };

  const ranges: number[][] = [];
  for (const part of parts) {
    const match = /^(\d*)[-~](\d*)$/.exec(part) ?? /^(\d+)()$/.exec(part);
    if (!match || (match[1] === '' && match[2] === '')) {
      return { ok: false, message: `"${part}"은(는) 알 수 없는 범위입니다. 예: 1-3, 4-6, 7` };
    }
    const isRange = part.includes('-') || part.includes('~');
    const from = match[1] === '' ? 1 : Number(match[1]);
    const to = isRange ? (match[2] === '' ? pageCount : Number(match[2])) : from;

    if (from < 1 || to < 1) return { ok: false, message: '쪽 번호는 1부터 시작합니다.' };
    if (from > pageCount || to > pageCount) {
      return {
        ok: false,
        message: `${Math.max(from, to)}쪽은 없습니다. 이 PDF는 ${pageCount}쪽입니다.`,
      };
    }
    if (from > to) return { ok: false, message: `"${part}": 앞 번호가 뒤 번호보다 큽니다.` };

    ranges.push(Array.from({ length: to - from + 1 }, (_, i) => from + i));
  }
  return { ok: true, ranges };
}

/** 쪽 번호 목록을 짧은 이름으로 (파일 이름·미리보기용). [1,2,3] → "1-3", [7] → "7" */
export function rangeLabel(pages: number[]): string {
  const first = pages[0]!;
  const last = pages.at(-1)!;
  const continuous = pages.every((page, i) => page === first + i);
  if (pages.length === 1) return `${first}`;
  return continuous ? `${first}-${last}` : pages.join(',');
}
