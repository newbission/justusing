/**
 * 동영상에서 장면을 뽑을 시각과 GIF 장면 길이 계산 (동영상을 GIF로, 장면 캡처).
 * 화면·워커가 같이 쓰는 순수 계산이다.
 */

/** 동영상 끝에서 이만큼 앞까지만 찾아간다. 끝 시각 그대로는 그릴 장면이 없는 브라우저가 있다 */
export const END_MARGIN = 0.001;

/** [start, end) 구간을 fps로 나눈 장면 시각들. 적어도 한 장 */
export function frameTimes(start: number, end: number, fps: number): number[] {
  const count = Math.max(1, Math.round((end - start) * fps));
  return Array.from({ length: count }, (_, i) => start + i / fps);
}

/**
 * GIF 장면마다의 길이(ms, 10ms 단위). GIF는 1/100초 단위라 15fps(6.67)처럼 나눠지지 않으면
 * 누적 시각을 반올림해 길이를 6·7로 섞는다 (전체 길이가 원래 구간과 같게)
 */
export function frameDelays(count: number, fps: number): number[] {
  const at = (i: number) => Math.round((i * 100) / fps);
  return Array.from({ length: count }, (_, i) => (at(i + 1) - at(i)) * 10);
}

/** [start, end] 구간에서 step초마다의 시각. 끝 시각도 장면이 있으면 넣는다 */
export function intervalTimes(start: number, end: number, step: number): number[] {
  const times: number[] = [];
  // 0.1초 단위 입력이 2.9999처럼 모자라도 끝 장면을 빠뜨리지 않게 조금 넉넉히 센다
  for (let i = 0; start + i * step <= end + 1e-6; i++) times.push(start + i * step);
  return times;
}

/** 파일 이름에 넣는 시각 (예: 01m02.50s). 이름순으로 늘어놓으면 시간순이 된다 */
export function timeLabel(seconds: number): string {
  const centis = Math.round(seconds * 100);
  const minutes = Math.floor(centis / 6000);
  const rest = (centis % 6000) / 100;
  return `${String(minutes).padStart(2, '0')}m${rest.toFixed(2).padStart(5, '0')}s`;
}

/** 화면에 보이는 시각 (예: 1:02.50) */
export function formatTime(seconds: number): string {
  const centis = Math.max(0, Math.round(seconds * 100));
  const minutes = Math.floor(centis / 6000);
  const rest = (centis % 6000) / 100;
  return `${minutes}:${rest.toFixed(2).padStart(5, '0')}`;
}

/** 원본 비율을 지킨 높이 (적어도 1px) */
export function scaledHeight(width: number, source: { width: number; height: number }): number {
  return Math.max(1, Math.round((width * source.height) / source.width));
}
