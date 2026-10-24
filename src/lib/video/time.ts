/** 동영상 시간 보이기·읽기 */

/** 초를 '1:05.3'·'1:02:05.3'처럼 (digits는 초의 소수 자리) */
export function formatTime(seconds: number, digits = 1): string {
  const safe = Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
  const unit = 10 ** digits;
  const rounded = Math.round(safe * unit) / unit;
  const hours = Math.floor(rounded / 3600);
  const minutes = Math.floor((rounded % 3600) / 60);
  const rest = rounded - hours * 3600 - minutes * 60;
  const secondsText = rest.toFixed(digits).padStart(digits > 0 ? digits + 3 : 2, '0');
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, '0')}:${secondsText}`
    : `${minutes}:${secondsText}`;
}

/**
 * '1:05.3', '65.3', '1:02:05' 같은 글을 초로. 읽지 못하면 undefined.
 * 쉼표 소수점(유럽식 '5,3')도 받는다
 */
export function parseTime(text: string): number | undefined {
  const parts = text.trim().replace(',', '.').split(':');
  if (parts.length === 0 || parts.length > 3 || parts.some((part) => !/^\d+(\.\d*)?$/.test(part))) {
    return undefined;
  }
  return parts.reduce((total, part) => total * 60 + Number(part), 0);
}

/** 남은 시간 어림 (초). 너무 이르면(진행 3% 미만, 2초 미만) 모른다 */
export function remainingSeconds(progress: number, elapsedMs: number): number | undefined {
  if (progress < 0.03 || elapsedMs < 2000) return undefined;
  return ((elapsedMs / progress) * (1 - progress)) / 1000;
}
