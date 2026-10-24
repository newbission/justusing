/** 동영상 크기·비트레이트 계산 (화면과 워커가 같이 쓴다) */

/** 고를 수 있는 짧은 변(세로 영상은 가로). 0은 원래 크기 */
export const SHORT_SIDES = [0, 1080, 720, 480] as const;
export type ShortSide = (typeof SHORT_SIDES)[number];

/** 짧은 변을 side로 줄인 크기. 짝수로 맞춘다 (H.264·VP9 인코더가 홀수 크기를 받지 않는 경우가 있다) */
export function scaledSize(width: number, height: number, side: number) {
  const short = Math.min(width, height);
  const even = (value: number) => Math.max(2, Math.round(value / 2) * 2);
  if (side === 0 || side >= short) return { width: even(width), height: even(height) };
  const scale = side / short;
  return { width: even(width * scale), height: even(height * scale) };
}

export type QualityLevel = 'high' | 'medium' | 'low';

/** 화소 하나·장면 하나에 쓰는 비트 (H.264 기준, 흔히 쓰는 값) */
const BITS_PER_PIXEL: Record<QualityLevel, number> = { high: 0.1, medium: 0.06, low: 0.035 };

/**
 * 화질 단계에 맞는 동영상 비트레이트 (bit/s). 장면 수가 늘어도 장면끼리 비슷해 비트는 덜 늘어나므로
 * 30fps 기준에서 0.6제곱으로 늘린다 (60fps면 약 1.5배)
 */
export function guessBitrate(
  width: number,
  height: number,
  frameRate: number,
  level: QualityLevel,
) {
  const fps = Math.min(120, Math.max(1, frameRate));
  const effective = 30 * (fps / 30) ** 0.6;
  return Math.round(width * height * effective * BITS_PER_PIXEL[level]);
}

/** 이보다 낮은 비트레이트로는 보기 어렵다 (목표 용량이 너무 작을 때 알린다) */
export function minimumBitrate(width: number, height: number) {
  return Math.max(150_000, Math.round(width * height * 30 * 0.012));
}
