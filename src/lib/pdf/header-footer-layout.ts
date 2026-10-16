/**
 * 머리말·꼬리말 글자 만들기와 자리 계산. 화면 미리보기(도구 화면)와 워커(text-pdf.worker.ts)가 같이 쓴다.
 * 워커가 불러도 다른 모듈을 끌고 오지 않게 계산만 둔다.
 */
import type { Align } from './header-footer';

/** 쪽 가장자리와 글자 사이 (pt, 약 10mm). 쪽 번호 도구와 같다 */
export const EDGE_MARGIN = 28;

/** 이 쪽에서 쓸 가장자리 여백. 아주 좁거나 낮게 잘린 쪽에서도 쓸 자리가 남도록 그 변 길이의 10%까지만 쓴다 */
export function edgeMargin(pageWidth: number): number {
  return Math.min(EDGE_MARGIN, pageWidth * 0.1);
}

/** 글자 안의 자리표시를 채운다. {쪽}/{page}: 쪽 번호, {전체}/{total}: 전체 쪽 수, {날짜}/{date}: 날짜 */
export function fillTemplate(text: string, page: number, total: number, date: string): string {
  return text
    .replace(/\{(쪽|page)\}/gi, String(page))
    .replace(/\{(전체|total)\}/gi, String(total))
    .replace(/\{(날짜|date)\}/gi, date);
}

/**
 * 화면에 보이는 쪽(pt, 왼쪽 위가 0,0)에서 글자 왼쪽 바닥선 자리.
 * 머리말은 위 가장자리에서, 꼬리말은 아래 가장자리에서 여백(edgeMargin)만큼 안쪽에 둔다.
 */
export function linePosition(
  page: { width: number; height: number },
  textWidth: number,
  fontSize: number,
  align: Align,
  edge: 'top' | 'bottom',
): { x: number; y: number } {
  const margin = edgeMargin(page.width);
  const x =
    align === 'left'
      ? margin
      : align === 'right'
        ? page.width - margin - textWidth
        : (page.width - textWidth) / 2;
  const vertical = edgeMargin(page.height);
  const y = edge === 'top' ? vertical + fontSize * 0.8 : page.height - vertical;
  return { x, y };
}

/**
 * 글자가 쪽의 쓸 수 있는 폭(양쪽 여백을 뺀 폭, 늘 쪽 폭의 80% 이상)보다 넓으면 들어가도록 줄인 글자 크기.
 * 긴 제목이나 폭이 좁은 쪽에서 글자가 쪽 밖으로 잘리지 않게 한다
 */
export function fitSize(textWidth: number, fontSize: number, pageWidth: number): number {
  const available = pageWidth - edgeMargin(pageWidth) * 2;
  return textWidth > available && textWidth > 0 ? (fontSize * available) / textWidth : fontSize;
}
