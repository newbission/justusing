/**
 * 사진·화면 캡처를 글자 인식에 알맞게 고치는 계산 (image-read.ts가 쓴다).
 * 회색 화소만 다루고 canvas·화면에 기대지 않는다 (워커에서 돌고, Node에서도 시험할 수 있다).
 */

/** 회색 그림. 한 화소에 1바이트(밝기 0~255) */
export interface Gray {
  data: Uint8Array;
  width: number;
  height: number;
}

/** RGBA 화소를 밝기로 바꾼다 */
export function toGray(rgba: Uint8ClampedArray | Uint8Array, width: number, height: number): Gray {
  const data = new Uint8Array(width * height);
  for (let i = 0, j = 0; i < data.length; i++, j += 4) {
    data[i] = (rgba[j]! * 77 + rgba[j + 1]! * 150 + rgba[j + 2]! * 29) >> 8;
  }
  return { data, width, height };
}

/** 정수 배로 줄인다 (칸마다 평균) */
export function shrink(gray: Gray, factor: number): Gray {
  if (factor <= 1) return gray;
  const width = Math.max(1, Math.floor(gray.width / factor));
  const height = Math.max(1, Math.floor(gray.height / factor));
  const data = new Uint8Array(width * height);
  const area = factor * factor;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let sum = 0;
      for (let dy = 0; dy < factor; dy++) {
        const row = (y * factor + dy) * gray.width + x * factor;
        for (let dx = 0; dx < factor; dx++) sum += gray.data[row + dx]!;
      }
      data[y * width + x] = Math.round(sum / area);
    }
  }
  return { data, width, height };
}

/**
 * 크기를 scale배로 바꾸고 angle도(시계 방향 +) 돌린다. 돌려서 생긴 귀퉁이는 흰색으로 채운다.
 * 많이 줄일 때는 먼저 정수 배로 평균 내어 줄여 글자가 거칠어지지 않게 한다
 */
export function transform(source: Gray, scale: number, angle: number): Gray {
  const pre = scale < 1 ? Math.max(1, Math.floor(1 / scale)) : 1;
  const gray = shrink(source, pre);
  const s = (scale * source.width) / gray.width;
  const radians = (angle * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const scaledWidth = source.width * scale;
  const scaledHeight = source.height * scale;
  const width = Math.max(1, Math.round(Math.abs(scaledWidth * cos) + Math.abs(scaledHeight * sin)));
  const height = Math.max(
    1,
    Math.round(Math.abs(scaledWidth * sin) + Math.abs(scaledHeight * cos)),
  );
  const data = new Uint8Array(width * height);
  const { width: w, height: h, data: src } = gray;
  const cx = width / 2;
  const cy = height / 2;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      // 결과 화소 → 원래 그림 자리 (돌린 것을 거꾸로 돌리고 크기를 되돌린다)
      const dx = x + 0.5 - cx;
      const dy = y + 0.5 - cy;
      const sx = (dx * cos + dy * sin + scaledWidth / 2) / s - 0.5;
      const sy = (-dx * sin + dy * cos + scaledHeight / 2) / s - 0.5;
      const x0 = Math.floor(sx);
      const y0 = Math.floor(sy);
      if (x0 < -1 || y0 < -1 || x0 >= w || y0 >= h) {
        data[y * width + x] = 255;
        continue;
      }
      const fx = sx - x0;
      const fy = sy - y0;
      const at = (px: number, py: number) =>
        src[Math.min(h - 1, Math.max(0, py)) * w + Math.min(w - 1, Math.max(0, px))]!;
      const top = at(x0, y0) * (1 - fx) + at(x0 + 1, y0) * fx;
      const bottom = at(x0, y0 + 1) * (1 - fx) + at(x0 + 1, y0 + 1) * fx;
      data[y * width + x] = Math.round(top * (1 - fy) + bottom * fy);
    }
  }
  return { data, width, height };
}

/**
 * 가로·세로 (2×radius+1) 창의 중간 밝기. 글자는 창 안에서 적은 쪽이라 바탕 밝기가 나온다.
 * 줄마다 밝기 막대그래프를 옆으로 옮기며 센다
 */
export function median(gray: Gray, radius: number): Gray {
  const { width, height, data } = gray;
  const out = new Uint8Array(width * height);
  const histogram = new Int32Array(256);
  const size = 2 * radius + 1;
  const half = (size * size) >> 1;
  const clampX = (x: number) => (x < 0 ? 0 : x >= width ? width - 1 : x);
  const rows = new Int32Array(size);
  for (let y = 0; y < height; y++) {
    for (let dy = -radius; dy <= radius; dy++) {
      rows[dy + radius] = Math.min(height - 1, Math.max(0, y + dy)) * width;
    }
    histogram.fill(0);
    for (const row of rows) {
      for (let dx = -radius; dx <= radius; dx++) histogram[data[row + clampX(dx)]!]!++;
    }
    // value: 지금 중간값, below: value보다 어두운 화소 수
    let value = 0;
    let below = 0;
    while (below + histogram[value]! <= half) below += histogram[value++]!;
    out[y * width] = value;
    for (let x = 1; x < width; x++) {
      const leaving = clampX(x - radius - 1);
      const entering = clampX(x + radius);
      for (const row of rows) {
        const gone = data[row + leaving]!;
        histogram[gone]!--;
        if (gone < value) below--;
        const come = data[row + entering]!;
        histogram[come]!++;
        if (come < value) below++;
      }
      if (below > half) {
        do below -= histogram[--value]!;
        while (below > half);
      } else {
        while (below + histogram[value]! <= half) below += histogram[value++]!;
      }
      out[y * width + x] = value;
    }
  }
  return { data: out, width, height };
}

/**
 * 바탕과 다른 곳만 검게 다시 그린다. 밝은 바탕의 어두운 글자와 어두운 바탕(말풍선·어두운 화면)의
 * 밝은 글자가 모두 흰 바탕의 검은 글자가 된다. 넓은 창의 바탕과 좁은 창의 바탕 중 가까운 쪽과 비교해
 * 색이 다른 두 바탕의 경계(말풍선 테두리)는 글자로 보지 않는다. 굵고 큰 글자는 속이 빌 수 있어
 * 처음 읽기에는 쓰지 않고, 처음에 읽지 못한 줄을 찾을 때만 쓴다
 */
export function contrastMap(gray: Gray): Gray {
  const { width, height, data } = gray;
  const half = shrink(gray, 2);
  const wide = median(half, 8);
  const narrow = median(gray, 3);
  // 좁은 창과의 차이는 가까운 3×3 중 가장 큰 값으로 (글자 획 가장자리가 끊기지 않게)
  const near = new Uint8Array(width * height);
  for (let i = 0; i < near.length; i++) near[i] = Math.abs(data[i]! - narrow.data[i]!);
  const out = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    const wy = Math.min(wide.height - 1, y >> 1) * wide.width;
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      const far = Math.abs(data[i]! - wide.data[wy + Math.min(wide.width - 1, x >> 1)]!);
      let local = 0;
      for (let dy = -1; dy <= 1; dy++) {
        const row = Math.min(height - 1, Math.max(0, y + dy)) * width;
        for (let dx = -1; dx <= 1; dx++) {
          const value = near[row + Math.min(width - 1, Math.max(0, x + dx))]!;
          if (value > local) local = value;
        }
      }
      out[i] = 255 - Math.min(255, Math.round(Math.min(far, local) * 1.6));
    }
  }
  return { data: out, width, height };
}

/** 줄여서 바탕 밝기를 본다 (긴 쪽 약 200화소) */
function backgroundOf(gray: Gray): Gray {
  const factor = Math.max(1, Math.ceil(Math.max(gray.width, gray.height) / 200));
  return median(shrink(gray, factor), 3);
}

/**
 * 어두운 바탕과 밝은 바탕이 섞여 있는지 (어두운 말풍선이 있는 대화 캡처, 어두운 막대가 있는 화면).
 * 인식 엔진은 한쪽 바탕의 글자만 읽고 다른 쪽을 그림으로 보고 건너뛰는 일이 많다
 */
export function mixedBackground(gray: Gray): boolean {
  const background = backgroundOf(gray);
  let dark = 0;
  let light = 0;
  for (const value of background.data) {
    if (value < 100) dark++;
    else if (value > 150) light++;
  }
  const total = background.data.length;
  return dark / total >= 0.03 && light / total >= 0.03;
}

/**
 * 글자 줄이 기운 각도(도, 시계 방향 +). 바탕과 다른 화소를 여러 각도로 옆에서 비춰 보아
 * 줄 사이가 가장 또렷하게 갈리는 각도를 고른다. ±maxAngle 안에서 찾고, 뚜렷하지 않으면 0
 */
export function estimateSkew(gray: Gray, maxAngle = 20): number {
  const factor = Math.max(1, Math.ceil(Math.max(gray.width, gray.height) / 1000));
  const small = shrink(gray, factor);
  const background = median(small, 7);
  const xs: number[] = [];
  const ys: number[] = [];
  const cx = small.width / 2;
  const cy = small.height / 2;
  for (let y = 0; y < small.height; y++) {
    for (let x = 0; x < small.width; x++) {
      const i = y * small.width + x;
      if (Math.abs(small.data[i]! - background.data[i]!) > 40) {
        xs.push(x - cx);
        ys.push(y - cy);
      }
    }
  }
  if (xs.length < 200) return 0;
  const diagonal = Math.ceil(Math.hypot(small.width, small.height)) + 2;
  const bins = new Float64Array(diagonal);
  const score = (angle: number) => {
    const radians = (angle * Math.PI) / 180;
    const cos = Math.cos(radians);
    const sin = Math.sin(radians);
    bins.fill(0);
    for (let i = 0; i < xs.length; i++) {
      bins[Math.round(ys[i]! * cos - xs[i]! * sin + diagonal / 2)]!++;
    }
    let sum = 0;
    for (const count of bins) sum += count * count;
    return sum;
  };
  let best = 0;
  let bestScore = score(0);
  const flat = bestScore;
  for (let angle = -maxAngle; angle <= maxAngle; angle += 0.5) {
    const value = score(angle);
    if (value > bestScore) [best, bestScore] = [angle, value];
  }
  for (let angle = best - 0.4; angle <= best + 0.4; angle += 0.1) {
    const value = score(angle);
    if (value > bestScore) [best, bestScore] = [angle, value];
  }
  // 글자 줄이 아닌 무늬(사진)에서는 각도마다 차이가 작다. 그때는 돌리지 않는다
  return bestScore > flat * 1.1 ? Math.round(best * 10) / 10 : 0;
}
