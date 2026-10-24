/**
 * 배경 지우기의 마스크 다루기 (화면·워커 공통, DOM 없이 계산만).
 *
 * 모델이 낸 마스크(물체일 가능성 0~255)는 살피기용 작은 사진 크기다. 가장자리를 좁히거나 넓히고(최소·최대 거름),
 * 부드럽게(상자 흐림 두 번) 다듬은 뒤 투명도로 바꾼다. 저장할 때는 이 투명도를 원본 크기로 늘려 쓴다
 * (늘릴 때 브라우저가 선형 보간을 해 계단이 생기지 않는다). 붓질은 비율 좌표로 두어 어느 크기에서나 그린다.
 */

/** 사진 안의 위치. 0~1 비율 (왼쪽 위가 0) */
export interface Point {
  x: number;
  y: number;
}

/** 물체일 가능성 (0~255, 한 줄씩) */
export interface Mask {
  data: Uint8Array;
  width: number;
  height: number;
}

/** 붓질 한 번. size는 사진 긴 변에 대한 붓 지름 비율 */
export interface Stroke {
  mode: 'erase' | 'restore';
  size: number;
  points: Point[];
}

/** 가장자리 다듬기. shift: 넓히기(+)·좁히기(−) 단계, soft: 부드럽게 단계 */
export interface Edge {
  shift: number;
  soft: number;
}

export const SHIFT_LIMIT = 5;
export const SOFT_LIMIT = 5;

/** 결과 모양: 다듬기·붓질·배경색(없으면 투명)·물체에 맞춰 자르기 */
export interface Look {
  edge: Edge;
  strokes: Stroke[];
  background?: string;
  trim: boolean;
}

/** 여러 마스크를 겹친다 (누른 곳마다 나눈 물체를 모두 남긴다). 모두 같은 크기여야 한다 */
export function union(masks: Mask[], width: number, height: number): Mask {
  const data = new Uint8Array(width * height);
  for (const mask of masks) {
    const source = mask.data;
    for (let i = 0; i < data.length; i++) if (source[i]! > data[i]!) data[i] = source[i]!;
  }
  return { data, width, height };
}

/** 마스크에서 물체로 볼 만한 곳(절반 넘게 확신)이 전체의 몇 분의 일인지 */
export function coverage(mask: Mask): number {
  let count = 0;
  for (let i = 0; i < mask.data.length; i++) if (mask.data[i]! >= 128) count++;
  return count / Math.max(1, mask.data.length);
}

/** 한 방향으로 반지름 radius 안의 가장 큰(grow) 또는 가장 작은 값 (단조 덱으로 줄마다 O(n)) */
function extremeLine(
  source: Uint8Array,
  target: Uint8Array,
  start: number,
  step: number,
  count: number,
  radius: number,
  grow: boolean,
) {
  const better = grow ? (a: number, b: number) => a >= b : (a: number, b: number) => a <= b;
  const deque = new Int32Array(count);
  let head = 0;
  let tail = 0;
  let next = 0;
  for (let i = 0; i < count; i++) {
    // i + radius까지 넣는다
    const end = Math.min(count - 1, i + radius);
    while (next <= end) {
      const value = source[start + next * step]!;
      while (tail > head && better(value, source[start + deque[tail - 1]! * step]!)) tail--;
      deque[tail++] = next++;
    }
    while (deque[head]! < i - radius) head++;
    target[start + i * step] = source[start + deque[head]! * step]!;
  }
}

/** 가장자리를 radius 화소만큼 넓힌다(grow) 또는 좁힌다 (네모 모양 최대·최소 거름) */
export function morph(mask: Mask, radius: number, grow: boolean): Mask {
  const { width, height } = mask;
  if (radius <= 0) return mask;
  const middle = new Uint8Array(mask.data.length);
  const data = new Uint8Array(mask.data.length);
  for (let y = 0; y < height; y++)
    extremeLine(mask.data, middle, y * width, 1, width, radius, grow);
  for (let x = 0; x < width; x++) extremeLine(middle, data, x, width, height, radius, grow);
  return { data, width, height };
}

/** 한 방향 상자 흐림 (가장자리 밖은 끝 값이 이어진다고 본다) */
function boxLine(
  source: Uint8Array,
  target: Uint8Array,
  start: number,
  step: number,
  count: number,
  radius: number,
) {
  const at = (i: number) => source[start + Math.min(count - 1, Math.max(0, i)) * step]!;
  let sum = 0;
  for (let i = -radius; i <= radius; i++) sum += at(i);
  const size = radius * 2 + 1;
  for (let i = 0; i < count; i++) {
    target[start + i * step] = Math.round(sum / size);
    sum += at(i + radius + 1) - at(i - radius);
  }
}

/** 상자 흐림을 두 번 건다 (삼각형 모양으로 번진다) */
export function blur(mask: Mask, radius: number): Mask {
  const { width, height } = mask;
  if (radius <= 0) return mask;
  let current = mask.data;
  for (let pass = 0; pass < 2; pass++) {
    const middle = new Uint8Array(current.length);
    const next = new Uint8Array(current.length);
    for (let y = 0; y < height; y++) boxLine(current, middle, y * width, 1, width, radius);
    for (let x = 0; x < width; x++) boxLine(middle, next, x, width, height, radius);
    current = next;
  }
  return { data: current, width, height };
}

/**
 * 다듬은 투명도 (0~255). 단계 하나는 살피기용 사진 긴 변의 0.4% 남짓이다.
 * 부드럽게가 0이면 확신 35~65% 사이만 비례로 두고 나머지는 다 지우거나 다 남겨, 배경이 흐리게 비치지 않게 한다
 */
export function refine(mask: Mask, edge: Edge): Uint8Array {
  const unit = Math.max(1, Math.round(Math.max(mask.width, mask.height) / 256));
  const shift = Math.max(-SHIFT_LIMIT, Math.min(SHIFT_LIMIT, Math.round(edge.shift)));
  const soft = Math.max(0, Math.min(SOFT_LIMIT, Math.round(edge.soft)));
  let current = morph(mask, Math.abs(shift) * unit, shift > 0);
  current = blur(current, soft * unit);
  const width = soft === 0 ? 0.3 : 1;
  const alpha = new Uint8Array(current.data.length);
  for (let i = 0; i < alpha.length; i++) {
    const value = (current.data[i]! / 255 - 0.5) / width + 0.5;
    alpha[i] = Math.round(Math.min(1, Math.max(0, value)) * 255);
  }
  return alpha;
}

/**
 * 투명도에서 남은 곳을 둘러싼 네모 (투명도 크기의 화소). 남은 곳이 없으면 undefined.
 * threshold보다 진한 곳만 센다 (가장자리의 아주 옅은 번짐으로 칸이 커지지 않게)
 */
export function bounds(
  alpha: Uint8ClampedArray | Uint8Array,
  width: number,
  height: number,
  stride = 1,
  threshold = 16,
): { x: number; y: number; width: number; height: number } | undefined {
  let x0 = width;
  let y0 = height;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (alpha[(y * width + x) * stride + (stride - 1)]! <= threshold) continue;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  }
  if (x1 < 0) return undefined;
  return { x: x0, y: y0, width: x1 - x0 + 1, height: y1 - y0 + 1 };
}
