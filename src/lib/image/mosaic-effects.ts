/**
 * 이미지 모자이크의 가리기 계산 (화면 미리보기와 저장 워커가 같이 쓴다).
 *
 * 가릴 곳은 사진 위의 사각형·타원이고, 그 안의 화소만 바꾼다. 바꾼 화소는 가린 곳 안의 화소로만 계산하고,
 * 검게 칠하기는 원래 화소를 전혀 쓰지 않는다. 화소 묶음(RGBA)을 그 자리에서 고친다.
 */
import type { Rect } from './crop-geometry';

/** mosaic: 칸마다 평균 색, blur: 흐리게, fill: 검게 칠하기 */
export type Effect = 'mosaic' | 'blur' | 'fill';
export type Shape = 'rect' | 'ellipse';

/** 가릴 곳 하나. 자리는 바로 세운 원본 사진의 정수 화소 */
export interface Region extends Rect {
  id: number;
  shape: Shape;
  effect: Effect;
  /** 세기 1~10. 모자이크는 칸 크기, 흐림은 흐리는 거리 */
  strength: number;
}

export const MIN_STRENGTH = 1;
export const MAX_STRENGTH = 10;

/** 화소 묶음 (ImageData와 같은 모양) */
export interface Pixels {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

/**
 * 세기에 따른 모자이크 칸 크기·흐리는 거리 (원본 화소). 가릴 곳의 짧은 변에 비례한다:
 * 세기 1은 짧은 변의 1/40, 10은 1/4. 가릴 곳을 키우면 칸도 커져 칸 수가 그대로다
 */
export function amountOf(region: Pick<Region, 'width' | 'height' | 'strength' | 'effect'>): number {
  const short = Math.min(region.width, region.height);
  const amount = Math.round((short * region.strength) / 40);
  return Math.max(region.effect === 'blur' ? 1 : 2, amount);
}

/** (x, y) 화소의 가운데가 가릴 곳 안인지. area는 화소 묶음 기준 자리 (실수) */
export function inside(area: Rect, shape: Shape, x: number, y: number): boolean {
  const px = x + 0.5;
  const py = y + 0.5;
  if (shape === 'rect') {
    return px >= area.x && px < area.x + area.width && py >= area.y && py < area.y + area.height;
  }
  const rx = area.width / 2;
  const ry = area.height / 2;
  const dx = (px - area.x - rx) / rx;
  const dy = (py - area.y - ry) / ry;
  return dx * dx + dy * dy <= 1;
}

/** 가릴 곳이 덮는 정수 화소 범위 (화소 묶음 안으로 자른다) */
export function boundsOf(area: Rect, width: number, height: number): Rect {
  const x0 = Math.max(0, Math.floor(area.x));
  const y0 = Math.max(0, Math.floor(area.y));
  const x1 = Math.min(width, Math.ceil(area.x + area.width));
  const y1 = Math.min(height, Math.ceil(area.y + area.height));
  return { x: x0, y: y0, width: Math.max(0, x1 - x0), height: Math.max(0, y1 - y0) };
}

/**
 * 화소 묶음 안의 가릴 곳(area, 실수 자리)에 효과를 건다. amount는 이 화소 묶음 단위의 칸 크기·흐리는 거리
 * (미리보기는 줄인 만큼 작게 넘긴다)
 */
export function paint(
  pixels: Pixels,
  area: Rect,
  shape: Shape,
  effect: Effect,
  amount: number,
): void {
  const box = boundsOf(area, pixels.width, pixels.height);
  if (box.width === 0 || box.height === 0) return;
  if (effect === 'fill') fill(pixels, area, shape, box);
  else if (effect === 'mosaic') mosaic(pixels, area, shape, box, Math.max(1, amount));
  else blur(pixels, area, shape, box, Math.max(0.5, amount));
}

function fill(pixels: Pixels, area: Rect, shape: Shape, box: Rect) {
  const { data, width } = pixels;
  for (let y = box.y; y < box.y + box.height; y++) {
    for (let x = box.x; x < box.x + box.width; x++) {
      if (!inside(area, shape, x, y)) continue;
      const i = (y * width + x) * 4;
      data[i] = 0;
      data[i + 1] = 0;
      data[i + 2] = 0;
      data[i + 3] = 255;
    }
  }
}

/** 가릴 곳의 왼쪽 위부터 size 크기 칸으로 나눠, 칸 안(가릴 곳 안 화소만)의 평균 색으로 칠한다 */
function mosaic(pixels: Pixels, area: Rect, shape: Shape, box: Rect, size: number) {
  const { data, width } = pixels;
  const cellX = (x: number) => Math.floor((x + 0.5 - area.x) / size);
  const cellY = (y: number) => Math.floor((y + 0.5 - area.y) / size);
  const columns = cellX(box.x + box.width - 1) - cellX(box.x) + 1;
  const firstX = cellX(box.x);
  const firstY = cellY(box.y);
  const rows = cellY(box.y + box.height - 1) - firstY + 1;
  // 칸마다 [투명도로 곱한 R·G·B, 투명도, 화소 수]
  const sums = new Float64Array(columns * rows * 5);
  for (let y = box.y; y < box.y + box.height; y++) {
    const row = (cellY(y) - firstY) * columns;
    for (let x = box.x; x < box.x + box.width; x++) {
      if (!inside(area, shape, x, y)) continue;
      const i = (y * width + x) * 4;
      const s = (row + cellX(x) - firstX) * 5;
      const a = data[i + 3]!;
      sums[s] += data[i]! * a;
      sums[s + 1] += data[i + 1]! * a;
      sums[s + 2] += data[i + 2]! * a;
      sums[s + 3] += a;
      sums[s + 4] += 1;
    }
  }
  for (let y = box.y; y < box.y + box.height; y++) {
    const row = (cellY(y) - firstY) * columns;
    for (let x = box.x; x < box.x + box.width; x++) {
      if (!inside(area, shape, x, y)) continue;
      const i = (y * width + x) * 4;
      const s = (row + cellX(x) - firstX) * 5;
      const alpha = sums[s + 3]!;
      const count = sums[s + 4]!;
      data[i] = alpha > 0 ? sums[s]! / alpha : 0;
      data[i + 1] = alpha > 0 ? sums[s + 1]! / alpha : 0;
      data[i + 2] = alpha > 0 ? sums[s + 2]! / alpha : 0;
      data[i + 3] = alpha / count;
    }
  }
}

/**
 * 상자 흐림을 가로·세로로 세 번씩 (가우스 흐림에 가깝다). 가릴 곳을 감싼 사각형 안의 화소만 쓰고
 * (끝은 끝 화소를 늘인다), 가릴 곳 안 화소만 바꾼다
 */
function blur(pixels: Pixels, area: Rect, shape: Shape, box: Rect, amount: number) {
  const { data, width } = pixels;
  const w = box.width;
  const h = box.height;
  // 세 번 거친 상자 흐림의 퍼짐이 amount쯤 되는 반지름
  const radius = Math.max(1, Math.round(amount / 1.7));
  // 투명도를 곱한 색으로 흐린다 (투명한 곳의 색이 번지지 않게)
  const buffer = new Float32Array(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = ((box.y + y) * width + box.x + x) * 4;
      const o = (y * w + x) * 4;
      const a = data[i + 3]! / 255;
      buffer[o] = data[i]! * a;
      buffer[o + 1] = data[i + 1]! * a;
      buffer[o + 2] = data[i + 2]! * a;
      buffer[o + 3] = data[i + 3]!;
    }
  }
  const spare = new Float32Array(w * h * 4);
  for (let pass = 0; pass < 3; pass++) {
    boxBlur(buffer, spare, w, h, radius, true);
    boxBlur(spare, buffer, w, h, radius, false);
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!inside(area, shape, box.x + x, box.y + y)) continue;
      const i = ((box.y + y) * width + box.x + x) * 4;
      const o = (y * w + x) * 4;
      const a = buffer[o + 3]!;
      const k = a > 0 ? 255 / a : 0;
      data[i] = buffer[o]! * k;
      data[i + 1] = buffer[o + 1]! * k;
      data[i + 2] = buffer[o + 2]! * k;
      data[i + 3] = a;
    }
  }
}

/** 한 방향 상자 흐림 (움직이는 합). 끝 바깥은 끝 화소로 친다 */
function boxBlur(
  from: Float32Array,
  to: Float32Array,
  w: number,
  h: number,
  radius: number,
  horizontal: boolean,
) {
  const length = horizontal ? w : h;
  const lines = horizontal ? h : w;
  const stride = horizontal ? 4 : w * 4;
  const span = radius * 2 + 1;
  for (let line = 0; line < lines; line++) {
    const start = horizontal ? line * w * 4 : line * 4;
    const at = (index: number) => start + Math.min(length - 1, Math.max(0, index)) * stride;
    for (let c = 0; c < 4; c++) {
      let sum = 0;
      for (let k = -radius; k <= radius; k++) sum += from[at(k) + c]!;
      for (let index = 0; index < length; index++) {
        to[start + index * stride + c] = sum / span;
        sum += from[at(index + radius + 1) + c]! - from[at(index - radius) + c]!;
      }
    }
  }
}
