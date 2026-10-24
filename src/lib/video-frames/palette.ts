/**
 * GIF 색 표 만들기와 화소 → 색 번호 바꾸기 (워커 안에서 쓴다).
 *
 * 색 표는 장면마다 따로 만들지 않고 구간 곳곳의 장면을 모아 하나만 만든다(전체 색 표). 장면마다 색이 바뀌면
 * 움직이지 않는 곳도 깜박이고, 앞 장면과 같은 곳을 비워 두는(투명) 줄이기가 덜 먹는다.
 * 디더링은 순서 디더링(Bayer 4×4)이다. 오차 확산(Floyd–Steinberg)은 한 화소가 바뀌면 오른쪽·아래 무늬가 다 바뀌어
 * 움직이는 그림에서 자글거리고 파일도 커진다.
 */
import { quantize, type Palette } from 'gifenc';

/** Bayer 4×4 (0~15) */
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

/** 여러 장면의 RGBA 화소를 모아 색 수 colors 이하의 색 표를 만든다 */
export function buildPalette(samples: Uint8ClampedArray[], colors: number): Palette {
  const total = samples.reduce((sum, sample) => sum + sample.length, 0);
  // gifenc는 버퍼 전체를 4바이트씩 읽으므로 처음부터 시작하는 새 버퍼에 모은다
  const joined = new Uint8ClampedArray(total);
  let offset = 0;
  for (const sample of samples) {
    joined.set(sample, offset);
    offset += sample.length;
  }
  const palette = quantize(joined, colors, { format: 'rgb565' });
  return palette.length > 0 ? palette : [[0, 0, 0]];
}

/** 화소를 색 표의 가장 가까운 색 번호로 바꾼다. 비슷한 색은 한 번만 찾는다 (RGB 각 5비트로 묶어 기억) */
export class Indexer {
  readonly #palette: Palette;
  readonly #cache = new Int16Array(32768).fill(-1);
  /** 디더링 무늬의 세기 (색이 적을수록 색 사이가 멀어 세게) */
  readonly #spread: number;

  constructor(palette: Palette, dither: boolean) {
    this.#palette = palette;
    this.#spread = dither ? 256 / Math.cbrt(Math.max(2, palette.length)) : 0;
  }

  #nearest(r: number, g: number, b: number): number {
    const key = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);
    const cached = this.#cache[key]!;
    if (cached >= 0) return cached;
    let best = 0;
    let bestDistance = Infinity;
    const palette = this.#palette;
    for (let i = 0; i < palette.length; i++) {
      const color = palette[i]!;
      const dr = r - color[0]!;
      const dg = g - color[1]!;
      const db = b - color[2]!;
      // 사람 눈이 초록에 민감한 만큼 무게를 준다
      const distance = 2 * dr * dr + 4 * dg * dg + 3 * db * db;
      if (distance < bestDistance) {
        bestDistance = distance;
        best = i;
      }
    }
    this.#cache[key] = best;
    return best;
  }

  /** RGBA 화소 → 색 번호 (투명도는 보지 않는다. 동영상 장면은 늘 불투명하다) */
  map(rgba: Uint8ClampedArray, width: number, height: number): Uint8Array {
    const out = new Uint8Array(width * height);
    const spread = this.#spread;
    for (let y = 0, i = 0; y < height; y++) {
      for (let x = 0; x < width; x++, i++) {
        const p = i * 4;
        if (spread === 0) {
          out[i] = this.#nearest(rgba[p]!, rgba[p + 1]!, rgba[p + 2]!);
          continue;
        }
        const offset = ((BAYER[(y & 3) * 4 + (x & 3)]! + 0.5) / 16 - 0.5) * spread;
        out[i] = this.#nearest(
          clamp(rgba[p]! + offset),
          clamp(rgba[p + 1]! + offset),
          clamp(rgba[p + 2]! + offset),
        );
      }
    }
    return out;
  }
}

function clamp(value: number): number {
  return value < 0 ? 0 : value > 255 ? 255 : value | 0;
}
