/**
 * 이용 권한 확인의 단일 지점.
 *
 * 나중에 "광고를 보면 일정 시간 고급 기능 해제" 같은 정책을 붙일 때 이 파일만 바꾼다.
 * 도구 코드는 권한이 필요할 때 반드시 canUse()를 거친다.
 * 지금은 모든 기능을 항상 허용한다.
 */

export interface Entitlement {
  allowed: boolean;
  /** 허용되지 않을 때 사용자에게 보여줄 이유 */
  reason?: string;
}

/**
 * @param toolId 레지스트리의 도구 ID (예: 'pdf/merge')
 * @param feature 도구 안의 세부 기능 이름 (예: 'batch'). 없으면 도구 기본 기능.
 */
export async function canUse(_toolId: string, _feature?: string): Promise<Entitlement> {
  return { allowed: true };
}
