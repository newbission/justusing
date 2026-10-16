/**
 * PDF 편집에서 화면 미리보기와 워커가 같이 쓰는 값. 워커가 불러도 다른 모듈을 끌고 오지 않게 값만 둔다.
 */

/** 줄 간격 (글자 크기 대비) */
export const LINE_HEIGHT = 1.25;
/** 글자 칸 위에서 첫 줄 바닥선까지 (글자 크기 대비) */
export const BASELINE = 0.9;
/** 형광펜 색과 진하기 */
export const HIGHLIGHT: { color: [number, number, number]; opacity: number } = {
  color: [1, 0.86, 0.2],
  opacity: 0.4,
};
