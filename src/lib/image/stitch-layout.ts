/**
 * 이어 붙일 사진들을 결과 이미지 어디에 그릴지 정한다 (이미지 이어 붙이기). 화면 미리보기와 워커가 같이 쓴다.
 * 세로로 이을 때는 모두 같은 폭으로, 가로로 이을 때는 모두 같은 높이로 맞춘다.
 */

export type Direction = 'vertical' | 'horizontal';

/** 두 사진 사이 이음에서 잘라 낼 줄 수 (각 사진의 원래 화소) */
export interface Seam {
  /** 앞(위) 사진 아래에서 */
  bottom: number;
  /** 뒤(아래) 사진 위에서 */
  top: number;
}

export const NO_SEAM: Seam = { bottom: 0, top: 0 };

export interface StitchOptions {
  direction: Direction;
  /** 맞출 폭(세로) 또는 높이(가로), 결과 화소 */
  size: number;
  /** 사진 사이 간격, 결과 화소 */
  gap: number;
  /** 이음마다 잘라 낼 줄 (세로로 이을 때만, 사진 수 - 1개) */
  seams: Seam[];
}

/** 사진 하나를 그리는 자리: 원본의 (sx, sy, sw, sh)를 결과의 (dx, dy, dw, dh)에 */
export interface Piece {
  index: number;
  sx: number;
  sy: number;
  sw: number;
  sh: number;
  dx: number;
  dy: number;
  dw: number;
  dh: number;
}

export interface StitchLayout {
  width: number;
  height: number;
  pieces: Piece[];
}

/** 결과의 배치. 잘라 낸 뒤 남는 줄이 없는 사진이 있으면 undefined */
export function layoutStitch(
  sources: readonly { width: number; height: number }[],
  { direction, size, gap, seams }: StitchOptions,
): StitchLayout | undefined {
  const pieces: Piece[] = [];
  // 소수 자리까지 이어서 더하고 칸마다 반올림한다. 사진 사이에 빈 줄이나 겹친 줄이 생기지 않는다
  let along = 0;
  for (const [index, source] of sources.entries()) {
    if (index > 0) along += gap;
    if (direction === 'vertical') {
      const top = index > 0 ? (seams[index - 1]?.top ?? 0) : 0;
      const bottom = index < sources.length - 1 ? (seams[index]?.bottom ?? 0) : 0;
      const sh = source.height - top - bottom;
      if (top < 0 || bottom < 0 || sh < 1) return undefined;
      const dy = Math.round(along);
      // 아주 작게 줄어도 1줄은 그린다. 그 1줄을 다음 자리에도 반영해 뒤 사진이 덮지 않게 한다
      along = Math.max(along + (sh * size) / source.width, dy + 1);
      pieces.push({
        index,
        sx: 0,
        sy: top,
        sw: source.width,
        sh,
        dx: 0,
        dy,
        dw: size,
        dh: Math.round(along) - dy,
      });
    } else {
      const dx = Math.round(along);
      along = Math.max(along + (source.width * size) / source.height, dx + 1);
      pieces.push({
        index,
        sx: 0,
        sy: 0,
        sw: source.width,
        sh: source.height,
        dx,
        dy: 0,
        dw: Math.round(along) - dx,
        dh: size,
      });
    }
  }
  const last = pieces.at(-1);
  if (!last) return undefined;
  return direction === 'vertical'
    ? { width: size, height: last.dy + last.dh, pieces }
    : { width: last.dx + last.dw, height: size, pieces };
}
