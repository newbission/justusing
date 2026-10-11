/**
 * 광고 슬롯의 위치(ID)와 크기.
 * 크기를 미리 잡아 두어 광고가 늦게 떠도 레이아웃이 밀리지 않게 한다 (CLS 0).
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

interface Size {
  width: number;
  height: number;
}

/** desktop: 768px 이상, mobile: 768px 미만 */
export const AD_SLOT_SIZES: Record<AdSlotId, { desktop: Size; mobile: Size }> = {
  'rail-left': { desktop: { width: 160, height: 600 }, mobile: { width: 160, height: 600 } },
  'rail-right': { desktop: { width: 160, height: 600 }, mobile: { width: 160, height: 600 } },
  'below-tool': { desktop: { width: 728, height: 90 }, mobile: { width: 320, height: 100 } },
  'in-content': { desktop: { width: 336, height: 280 }, mobile: { width: 300, height: 250 } },
  'mobile-anchor': { desktop: { width: 320, height: 50 }, mobile: { width: 320, height: 50 } },
};
