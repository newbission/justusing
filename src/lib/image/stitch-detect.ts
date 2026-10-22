/**
 * 화면을 내려 가며 찍은 캡처에서 겹친 부분을 찾는다 (이미지 이어 붙이기). 워커에서 돈다.
 *
 * 줄마다 가로를 칸으로 나눈 밝기 평균(줄 모양)을 만들어 줄끼리 비교한다. JPG 잡음은 칸 평균에서 거의 사라진다.
 * 1. 위 고정 막대: 두 사진의 같은 높이 줄이 같으면 고정된 부분(상태 표시줄·앱 제목 막대)이다.
 *    시계 숫자처럼 바뀌는 줄은 맨 위 6% 안에서만 건너뛴다
 * 2. 아래 고정 막대(탭 막대 등)도 아래에서부터 같은 방법으로 찾는다
 * 3. 겹침: 앞 사진의 고정 막대 위 끝부분과 뒤 사진의 고정 막대 아래 첫 부분이 같은 가장 긴 줄 수.
 *    빈 줄만 같으면 겹침으로 보지 않는다 (내용이 있는 줄이 몇 개는 같아야 한다)
 * 겹침을 찾지 못하면 아무것도 잘라 내지 않는다. 사진이 이어진 캡처가 아니라는 뜻이라 고정 막대도 믿지 않는다.
 */
import type { Seam } from './stitch-layout';

export interface RowSignature {
  width: number;
  height: number;
  /** 줄 하나의 칸 수 */
  bins: number;
  /** 줄마다 칸 밝기 평균 (height × bins) */
  rows: Uint8Array;
  /** 한 색으로 칠한 줄인지 (1) */
  plain: Uint8Array;
}

const MAX_BINS = 128;
/** 같은 줄로 보는 칸 밝기 차이: 칸마다 최대, 줄 평균 */
const BIN_TOLERANCE = 12;
const MEAN_TOLERANCE = 3;
/** 한 색 줄로 보는 칸 밝기 폭 */
const PLAIN_RANGE = 4;
/** 시계처럼 바뀌는 상태 표시줄을 건너뛰는 맨 위·아래 부분 */
const STATUS_ZONE = 0.06;
/** 고정 막대는 사진 높이의 이만큼까지만 */
const MAX_BAR = 0.4;
/** 겹침으로 보려면 같아야 하는 줄 수와 그 가운데 내용이 있는 줄 수 */
const MIN_OVERLAP = 8;
const MIN_CONTENT_ROWS = 4;
/**
 * 겹친 부분에서 달라도 되는 줄의 몫. JPG는 색이 바뀌는 경계(고정 막대 바로 옆 줄 등)가 번져서
 * 같은 내용이어도 몇 줄이 다르게 나온다
 */
const MISS_SHARE = 1 / 16;
/** 고정 막대 안에서 연달아 달라도 되는 줄 수 (JPG 번짐) */
const BAR_MISSES = 2;

/** RGBA 화소(위에서부터 rowsInChunk줄)를 줄 모양으로 더한다. 큰 사진을 줄 묶음씩 읽어 메모리를 아낀다 */
export class SignatureBuilder {
  readonly signature: RowSignature;
  #row = 0;
  readonly #binOf: Uint16Array;
  readonly #counts: Uint16Array;

  constructor(width: number, height: number) {
    const bins = Math.min(MAX_BINS, width);
    this.signature = {
      width,
      height,
      bins,
      rows: new Uint8Array(height * bins),
      plain: new Uint8Array(height),
    };
    this.#binOf = new Uint16Array(width);
    this.#counts = new Uint16Array(bins);
    for (let x = 0; x < width; x++) {
      const bin = Math.floor((x * bins) / width);
      this.#binOf[x] = bin;
      this.#counts[bin]!++;
    }
  }

  add(rgba: Uint8ClampedArray, rowsInChunk: number) {
    const { width, bins, rows, plain } = this.signature;
    const sums = new Uint32Array(bins);
    for (let y = 0; y < rowsInChunk; y++, this.#row++) {
      sums.fill(0);
      for (let x = 0, i = y * width * 4; x < width; x++, i += 4) {
        // 투명한 곳은 흰 바탕 위에 놓인 것으로 본다
        const alpha = rgba[i + 3]!;
        const light = (rgba[i]! * 77 + rgba[i + 1]! * 150 + rgba[i + 2]! * 29) >> 8;
        sums[this.#binOf[x]!]! += (light * alpha + 255 * (255 - alpha)) / 255;
      }
      let low = 255;
      let high = 0;
      const at = this.#row * bins;
      for (let bin = 0; bin < bins; bin++) {
        const value = Math.round(sums[bin]! / this.#counts[bin]!);
        rows[at + bin] = value;
        low = Math.min(low, value);
        high = Math.max(high, value);
      }
      plain[this.#row] = high - low <= PLAIN_RANGE ? 1 : 0;
    }
  }
}

function same(a: RowSignature, ra: number, b: RowSignature, rb: number): boolean {
  const bins = a.bins;
  let total = 0;
  for (let bin = 0, i = ra * bins, j = rb * bins; bin < bins; bin++, i++, j++) {
    const diff = Math.abs(a.rows[i]! - b.rows[j]!);
    if (diff > BIN_TOLERANCE) return false;
    total += diff;
  }
  return total <= MEAN_TOLERANCE * bins;
}

/** 두 사진의 같은 높이 줄이 같은 동안 센 줄 수. fromBottom이면 아래에서부터 */
function fixedBar(a: RowSignature, b: RowSignature, fromBottom: boolean): number {
  const shorter = Math.min(a.height, b.height);
  const zone = Math.round(shorter * STATUS_ZONE);
  const limit = Math.floor(shorter * MAX_BAR);
  let bar = 0;
  let misses = 0;
  for (let r = 0; r < limit; r++) {
    const ra = fromBottom ? a.height - 1 - r : r;
    const rb = fromBottom ? b.height - 1 - r : r;
    if (same(a, ra, b, rb)) {
      bar = r + 1;
      misses = 0;
    } else if (r >= zone && ++misses > BAR_MISSES) {
      break;
    }
  }
  return bar;
}

/**
 * 앞 사진 a의 [aEnd - k, aEnd)와 뒤 사진 b의 [bStart, bStart + k)에서 다른 줄 수.
 * 다른 줄이 너무 많거나 내용이 있는 줄이 모자라면 undefined
 */
function misses(
  a: RowSignature,
  aEnd: number,
  b: RowSignature,
  bStart: number,
  k: number,
): number | undefined {
  const from = aEnd - k;
  // 먼저 안쪽 줄 몇 개만 보고 빨리 걸러 낸다 (가장자리 줄은 JPG 번짐으로 다를 수 있다)
  for (const i of [k >> 2, k >> 1, (k * 3) >> 2]) {
    if (!same(a, from + i, b, bStart + i)) return undefined;
  }
  const allowed = Math.floor(k * MISS_SHARE);
  let missed = 0;
  let content = 0;
  for (let i = 0; i < k; i++) {
    if (!same(a, from + i, b, bStart + i)) {
      if (++missed > allowed) return undefined;
    } else if (!a.plain[from + i]) {
      content++;
    }
  }
  return content >= MIN_CONTENT_ROWS ? missed : undefined;
}

/** 두 사진 사이 이음에서 잘라 낼 줄. 이어진 캡처로 보이지 않으면 undefined */
export function detectSeam(a: RowSignature, b: RowSignature): Seam | undefined {
  if (a.width !== b.width || a.bins !== b.bins) return undefined;
  const header = fixedBar(a, b, false);
  const footer = fixedBar(a, b, true);
  const aEnd = a.height - footer;
  const bEnd = b.height - footer;
  if (aEnd <= header || bEnd <= header) return undefined;
  const longest = Math.min(aEnd - header, bEnd - header);
  // 다른 줄이 가장 적은 겹침, 같으면 긴 쪽. 다른 줄을 허용하므로 가장 긴 것을 고르면 몇 줄 더 잘라 낼 수 있다
  let best: { k: number; missed: number } | undefined;
  for (let k = longest; k >= MIN_OVERLAP; k--) {
    const missed = misses(a, aEnd, b, header, k);
    if (missed === undefined || (best && missed >= best.missed)) continue;
    best = { k, missed };
    if (missed === 0) break;
  }
  return best && { bottom: footer, top: header + best.k };
}
