/**
 * PDF 모든 쪽에 글자 워터마크를 넣는다 (글자 워터마크 도구). 처리는 글자 넣기 워커가 한다 (text-pdf.ts).
 * 자리 계산(placements)은 화면 미리보기와 워커가 같이 쓴다. 이 모듈을 import한 도구 frame에서만 로드된다.
 */
import { runTextJob } from './text-pdf';

export { MissingGlyphsError } from './text-pdf';
export { placements } from './watermark-layout';

export type WatermarkLayout = 'center' | 'tile';

export interface WatermarkOptions {
  text: string;
  /** 글꼴 파일 바이트 (TTF·OTF·WOFF·WOFF2) */
  font: Uint8Array;
  /** 글자 크기. 쪽의 짧은 변에 대한 비율 */
  size: number;
  /** 기울기 (도, 반시계 방향. 45면 왼쪽 아래에서 오른쪽 위로) */
  angle: number;
  /** 0~1 */
  opacity: number;
  /** RGB 0~1 */
  color: [number, number, number];
  layout: WatermarkLayout;
}

/** 모든 쪽에 글자 워터마크를 넣는다 */
export function addWatermark(
  source: { bytes: Uint8Array; password?: string },
  options: WatermarkOptions,
): Promise<Uint8Array> {
  return runTextJob(source, { kind: 'watermark', ...options });
}
