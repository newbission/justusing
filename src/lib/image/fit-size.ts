/**
 * 정한 용량 이하로 맞추는 계산 (이미지 용량 맞추기). 그리기·저장은 process.worker.ts가 하고,
 * 여기는 어느 화질·색 수·크기를 해 볼지만 정한다.
 *
 * 1. 지금 크기에서 화질(PNG는 색 수)을 높은 쪽부터 낮춰 가며 상한에 드는 가장 높은 값을 이분 탐색으로 찾는다
 * 2. 가장 낮은 값으로도 넘으면, 크기를 줄여도 되는 경우에만 가로·세로를 줄여 1부터 다시 한다
 */

/** JPG·WebP 화질의 가장 높은 값. 이 위로는 용량만 늘고 눈에 띄는 차이가 없다 */
export const TOP_QUALITY = 0.92;
/** 크기를 줄여도 될 때 화질을 여기까지만 낮춘다. 더 낮추기보다 크기를 줄이는 편이 깨끗하다 */
export const RESIZE_FLOOR = 0.6;
/** 크기를 그대로 둘 때는 화질을 여기까지 낮춘다 (많이 거칠어진다) */
export const KEEP_SIZE_FLOOR = 0.1;
/** 크기를 줄일 때 어림에 쓰는 화질. 줄인 크기에서 이 정도 화질로 맞게 한다 */
export const REFERENCE_QUALITY = 0.75;

/** PNG 색 수 (0 = 줄이지 않음). 크기를 줄여도 될 때는 64색까지만 */
export const PNG_COLORS_RESIZE = [0, 256, 128, 64] as const;
export const PNG_COLORS_KEEP_SIZE = [0, 256, 128, 64, 32, 16] as const;
/** 크기를 줄일 때 어림에 쓰는 색 수 */
export const REFERENCE_COLORS = 256;

/** 긴 변을 이보다 작게 줄여야 맞는다면 목표가 너무 작은 것으로 본다 */
export const MIN_LONG_SIDE = 100;
/** 크기를 줄여 다시 해 보는 횟수 (어림이 빗나가도 이 안에 끝난다) */
export const MAX_ROUNDS = 8;

/** 높은 화질 → 낮은 화질 순서의 JPG·WebP 화질 (0.01 간격) */
export function qualitySteps(floor: number): number[] {
  const steps: number[] = [];
  for (let q = Math.round(TOP_QUALITY * 100); q >= Math.round(floor * 100); q--) {
    steps.push(q / 100);
  }
  return steps;
}

export type Fitting<S> =
  /** 상한에 드는 가장 높은 화질과 그 결과 */
  | { fits: true; step: S; bytes: Uint8Array }
  /** 가장 낮은 화질로도 넘는다. smallest는 그때의 용량 */
  | { fits: false; smallest: number };

/**
 * steps(높은 화질 → 낮은 화질) 가운데 limit 바이트 이하가 되는 가장 높은 화질을 찾는다.
 * 화질을 낮추면 용량이 준다고 보고 이분 탐색한다 (가장 높은 값으로 맞으면 한 번에 끝난다).
 */
export async function highestFitting<S>(
  steps: readonly S[],
  limit: number,
  encode: (step: S) => Promise<Uint8Array>,
): Promise<Fitting<S>> {
  const first = await encode(steps[0]!);
  if (first.length <= limit) return { fits: true, step: steps[0]!, bytes: first };
  const lastIndex = steps.length - 1;
  if (lastIndex === 0) return { fits: false, smallest: first.length };
  const last = await encode(steps[lastIndex]!);
  if (last.length > limit) return { fits: false, smallest: last.length };

  // lo는 넘는 것, hi는 드는 것
  let lo = 0;
  let hi = lastIndex;
  let best = last;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    const bytes = await encode(steps[mid]!);
    if (bytes.length <= limit) {
      hi = mid;
      best = bytes;
    } else {
      lo = mid;
    }
  }
  return { fits: true, step: steps[hi]!, bytes: best };
}

/**
 * 다음에 해 볼 배율. 용량은 화소 수에 거의 비례하므로 넓이 비율의 제곱근만큼 줄이고,
 * 어림이 조금 빗나가도 맞게 5% 더 줄인다. 한 번에 너무 많이·적게 줄이지 않게 막는다.
 */
export function nextScale(scale: number, referenceBytes: number, limit: number): number {
  const factor = Math.sqrt(limit / referenceBytes) * 0.95;
  return scale * Math.min(0.9, Math.max(0.25, factor));
}
