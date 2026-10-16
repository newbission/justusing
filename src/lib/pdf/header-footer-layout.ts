/**
 * 머리말·꼬리말 글자 만들기와 자리 계산. 화면 미리보기(도구 화면)와 워커(text-pdf.worker.ts)가 같이 쓴다.
 * 워커가 불러도 다른 모듈을 끌고 오지 않게 계산만 둔다.
 */
import type { Align } from './header-footer';

/** 쪽 가장자리와 글자 사이 (pt, 약 10mm). 쪽 번호 도구와 같다 */
export const EDGE_MARGIN = 28;

/** 글자 안의 자리표시를 채운다. {쪽}/{page}: 쪽 번호, {전체}/{total}: 전체 쪽 수, {날짜}/{date}: 날짜 */
export function fillTemplate(text: string, page: number, total: number, date: string): string {
  return text
    .replace(/\{(쪽|page)\}/gi, String(page))
    .replace(/\{(전체|total)\}/gi, String(total))
    .replace(/\{(날짜|date)\}/gi, date);
}

/**
 * 화면에 보이는 쪽(pt, 왼쪽 위가 0,0)에서 글자 왼쪽 바닥선 자리.
 * 머리말은 위 가장자리에서, 꼬리말은 아래 가장자리에서 EDGE_MARGIN만큼 안쪽에 둔다.
 */
export function linePosition(
  page: { width: number; height: number },
  textWidth: number,
  fontSize: number,
  align: Align,
  edge: 'top' | 'bottom',
): { x: number; y: number } {
  const x =
    align === 'left'
      ? EDGE_MARGIN
      : align === 'right'
        ? page.width - EDGE_MARGIN - textWidth
        : (page.width - textWidth) / 2;
  const y = edge === 'top' ? EDGE_MARGIN + fontSize * 0.8 : page.height - EDGE_MARGIN;
  return { x, y };
}
