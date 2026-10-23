/**
 * 이미지 자르기·회전의 계산 (화면 미리보기와 저장 워커가 같이 쓴다).
 *
 * 사진을 90°씩 돌리고 → 좌우·상하로 뒤집고 → 기울기를 조금 바로잡은 그림을 '판'이라 부른다.
 * 판의 가로·세로는 90° 회전만 따른다. 기울기를 바꾸면 사진을 판에 꽉 차게 키워 귀퉁이가 비지 않게 한다.
 * 자를 영역은 판 위의 정수 화소 사각형이다.
 */

export interface Turn {
  /** 시계 방향 90° 회전 횟수 (0~3) */
  quarter: number;
  /** 좌우·상하 뒤집기 (90° 회전한 뒤의 판 기준) */
  flipX: boolean;
  flipY: boolean;
  /** 기울기 바로잡기 (도, 시계 방향이 +) */
  angle: number;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Size {
  width: number;
  height: number;
}

export const NO_TURN: Turn = { quarter: 0, flipX: false, flipY: false, angle: 0 };
/** 기울기 바로잡기의 한계 (도) */
export const MAX_ANGLE = 45;
/** 자를 영역의 가장 작은 변 (화소) */
export const MIN_SIDE = 8;

/** 판의 가로·세로 (원래 사진을 90°씩 돌린 크기) */
export function boardSize(source: Size, turn: Turn): Size {
  return turn.quarter % 2 === 0
    ? { width: source.width, height: source.height }
    : { width: source.height, height: source.width };
}

/** 기울인 사진이 판을 빈틈없이 덮게 키우는 배율 */
export function coverScale(board: Size, angle: number): number {
  const radians = (Math.abs(angle) * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const { width, height } = board;
  const scale = Math.max(
    (width * cos + height * sin) / width,
    (width * sin + height * cos) / height,
  );
  // 가장자리 화소가 반쯤 비쳐 보이지 않게 한 화소만큼 더 키운다
  return angle === 0 ? 1 : scale * (1 + 2 / Math.min(width, height));
}

/**
 * 판의 (offsetX, offsetY)를 원점으로, 판을 zoom배로 그리게 canvas 변환을 건다.
 * 그 뒤 drawImage(source, -sourceWidth / 2, -sourceHeight / 2)로 원래 사진을 그린다
 */
export function applyTurn(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  source: Size,
  turn: Turn,
  zoom: number,
  offsetX = 0,
  offsetY = 0,
): void {
  const board = boardSize(source, turn);
  const scale = coverScale(board, turn.angle);
  ctx.setTransform(zoom, 0, 0, zoom, -offsetX * zoom, -offsetY * zoom);
  ctx.translate(board.width / 2, board.height / 2);
  ctx.rotate((turn.angle * Math.PI) / 180);
  ctx.scale(scale * (turn.flipX ? -1 : 1), scale * (turn.flipY ? -1 : 1));
  ctx.rotate((turn.quarter * Math.PI) / 2);
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), Math.max(min, max));

/** 판 전체 */
export function fullRect(board: Size): Rect {
  return { x: 0, y: 0, width: board.width, height: board.height };
}

/** 판 밖으로 나가지 않게, 가장 작은 변보다 작지 않게 맞춘다 (정수 화소) */
export function clampRect(rect: Rect, board: Size, ratio?: number): Rect {
  let width = rect.width;
  let height = rect.height;
  if (ratio !== undefined) {
    // 비율을 지킬 때는 두 변을 함께 늘리고 줄인다 (한 변씩 맞추면 비율이 풀린다)
    height = width / ratio;
    const min = Math.min(MIN_SIDE, board.width, board.height);
    const grow = Math.max(1, min / Math.min(width, height));
    const shrink = Math.min(1, board.width / (width * grow), board.height / (height * grow));
    width *= grow * shrink;
    height *= grow * shrink;
  }
  width = clamp(Math.round(width), Math.min(MIN_SIDE, board.width), board.width);
  height = clamp(Math.round(height), Math.min(MIN_SIDE, board.height), board.height);
  return {
    x: clamp(Math.round(rect.x), 0, board.width - width),
    y: clamp(Math.round(rect.y), 0, board.height - height),
    width,
    height,
  };
}

/** 사진을 시계 방향(1) 또는 반대(-1)로 90° 돌릴 때 자를 영역도 같이 돌린다 (돌리기 전 판 크기) */
export function turnRect(rect: Rect, board: Size, direction: 1 | -1): Rect {
  return direction === 1
    ? { x: board.height - rect.y - rect.height, y: rect.x, width: rect.height, height: rect.width }
    : { x: rect.y, y: board.width - rect.x - rect.width, width: rect.height, height: rect.width };
}

/** 사진을 좌우(x) 또는 상하(y)로 뒤집을 때 자를 영역도 같이 뒤집는다 */
export function flipRect(rect: Rect, board: Size, axis: 'x' | 'y'): Rect {
  return axis === 'x'
    ? { ...rect, x: board.width - rect.x - rect.width }
    : { ...rect, y: board.height - rect.y - rect.height };
}

/** 판 안에 들어가는 가장 큰 ratio(가로/세로) 사각형. 가운데는 지금 영역의 가운데에 둔다 */
export function fitRatio(rect: Rect, board: Size, ratio: number): Rect {
  let width = board.width;
  let height = width / ratio;
  if (height > board.height) {
    height = board.height;
    width = height * ratio;
  }
  const cx = rect.x + rect.width / 2;
  const cy = rect.y + rect.height / 2;
  return clampRect({ x: cx - width / 2, y: cy - height / 2, width, height }, board, ratio);
}

export type Edge = 'n' | 's' | 'e' | 'w' | 'nw' | 'ne' | 'sw' | 'se';

/**
 * 모서리·변 하나를 (dx, dy)만큼 옮긴다. 맞은편은 그대로 둔다.
 * ratio가 있으면 그 비율을 지키고(모서리만), 판 밖으로 나가면 비율째 줄인다
 */
export function resizeRect(
  start: Rect,
  edge: Edge,
  dx: number,
  dy: number,
  board: Size,
  ratio?: number,
): Rect {
  const west = edge.includes('w');
  const east = edge.includes('e');
  const north = edge.includes('n');
  const south = edge.includes('s');
  const min = Math.min(MIN_SIDE, board.width, board.height);
  let left = start.x;
  let top = start.y;
  let right = start.x + start.width;
  let bottom = start.y + start.height;
  if (west) left = clamp(left + dx, 0, right - min);
  if (east) right = clamp(right + dx, left + min, board.width);
  if (north) top = clamp(top + dy, 0, bottom - min);
  if (south) bottom = clamp(bottom + dy, top + min, board.height);
  if (ratio === undefined || !(west || east) || !(north || south)) {
    return clampRect({ x: left, y: top, width: right - left, height: bottom - top }, board);
  }

  // 비율을 지킬 때: 더 많이 움직인 축을 따르고(줄일 때도), 고정한 모서리에서 판 끝까지 들어가게 줄인다
  const anchorX = west ? start.x + start.width : start.x;
  const anchorY = north ? start.y + start.height : start.y;
  let width = right - left;
  let height = bottom - top;
  if (Math.abs(width - start.width) >= Math.abs(height - start.height) * ratio) {
    height = width / ratio;
  } else {
    width = height * ratio;
  }
  const roomX = west ? anchorX : board.width - anchorX;
  const roomY = north ? anchorY : board.height - anchorY;
  if (width > roomX) {
    width = roomX;
    height = width / ratio;
  }
  if (height > roomY) {
    height = roomY;
    width = height * ratio;
  }
  return clampRect(
    {
      x: west ? anchorX - width : anchorX,
      y: north ? anchorY - height : anchorY,
      width,
      height,
    },
    board,
    ratio,
  );
}
