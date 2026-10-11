/**
 * 광고 슬롯의 위치(ID). 크기는 slots.css에 있다.
 *
 * 배치 규칙 (CLAUDE.md에도 있음):
 * - 다운로드·파일 선택·실행 버튼 근처에 두지 않는다.
 * - 모달·오버레이·팝업 안에 두지 않는다.
 */

export const AD_SLOT_IDS = [
  'rail-left', // 넓은 데스크톱 왼쪽 세로 영역 (sticky)
  'rail-right', // 넓은 데스크톱 오른쪽 세로 영역 (sticky)
  'below-tool', // 도구 영역 아래 (버퍼 여백 뒤)
  'in-content', // 사용법·FAQ 본문 사이
  'mobile-anchor', // 모바일 하단 고정
] as const;

export type AdSlotId = (typeof AD_SLOT_IDS)[number];
