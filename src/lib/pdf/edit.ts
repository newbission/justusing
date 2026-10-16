/**
 * PDF 편집: 쪽 위에 글자 상자, 흰색 가리기, 형광펜을 더한다 (PDF 편집 도구).
 * 처리는 글자 넣기 워커가 한다 (text-pdf.ts). 글자 상자가 없으면 글꼴 없이도 된다.
 *
 * 자리는 화면에 보이는 쪽 기준 비율(0~1, 왼쪽 위가 0,0)로 넘긴다. 쪽 회전과 보이는 영역은 워커가 계산한다.
 * 흰색 가리기는 위에 흰 사각형을 덮을 뿐이라 아래 내용은 파일에 남는다 (화면·FAQ에 밝힌다).
 */
import { runTextJob } from './text-pdf';

export { MissingGlyphsError } from './text-pdf';
export { BASELINE, HIGHLIGHT, LINE_HEIGHT } from './edit-constants';

export type EditItem =
  | {
      kind: 'text';
      /** 0부터 */
      page: number;
      /** 글자 상자의 왼쪽 위 (쪽 비율) */
      x: number;
      y: number;
      /** 줄바꿈(\n)으로 여러 줄 */
      text: string;
      /** 글자 크기 (pt) */
      size: number;
      /** RGB 0~1 */
      color: [number, number, number];
    }
  | {
      kind: 'whiteout' | 'highlight';
      page: number;
      /** 사각형 (쪽 비율) */
      x: number;
      y: number;
      width: number;
      height: number;
    };

export interface EditOptions {
  items: EditItem[];
  /** 글자 상자가 있을 때만 필요 */
  font?: Uint8Array;
}

export function editPdf(
  source: { bytes: Uint8Array; password?: string },
  options: EditOptions,
): Promise<Uint8Array> {
  return runTextJob(source, { kind: 'edit', ...options });
}
