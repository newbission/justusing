/**
 * PDF 쪽마다 머리말(위)·꼬리말(아래) 글자를 넣는다 (머리말·꼬리말 도구). 처리는 글자 넣기 워커가 한다 (text-pdf.ts).
 * 글자 안에 쪽 번호·전체 쪽 수·날짜 자리표시를 쓸 수 있다 (header-footer-layout.ts).
 */
import { runTextJob } from './text-pdf';

export { MissingGlyphsError } from './text-pdf';
export { EDGE_MARGIN, fillTemplate, fitSize, linePosition } from './header-footer-layout';

export type Align = 'left' | 'center' | 'right';

export interface HeaderFooterLine {
  /** 비어 있으면 넣지 않는다 */
  text: string;
  align: Align;
}

export interface HeaderFooterOptions {
  header: HeaderFooterLine;
  footer: HeaderFooterLine;
  /** 글꼴 파일 바이트 (TTF·OTF·WOFF·WOFF2) */
  font: Uint8Array;
  /** 글자 크기 (pt) */
  size: number;
  /** RGB 0~1 */
  color: [number, number, number];
  /** 첫 쪽(표지)에는 넣지 않는다. 쪽 번호는 그래도 첫 쪽부터 센다 */
  skipFirst: boolean;
  /** {날짜}에 넣을 글자 (화면에서 정해 넘긴다) */
  date: string;
}

export function addHeaderFooter(
  source: { bytes: Uint8Array; password?: string },
  options: HeaderFooterOptions,
): Promise<Uint8Array> {
  return runTextJob(source, { kind: 'header-footer', ...options });
}
