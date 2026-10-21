/**
 * 증명사진 맞추기. 찾은 얼굴 점으로 사진을 여권 규격(3.5×4.5cm, 머리 길이 3.2~3.6cm)에 맞게
 * 자르고·키우고·기울기를 바로잡는다. 얼굴은 고치지 않는다 (여권 규정이 금지한다).
 * 배경은 사용자가 고르면 바꾼다. 여권은 배경을 합성한 사진을 받지 않으므로 화면에 알린다.
 *
 * 좌표는 원본 사진의 픽셀. 잘라 낼 칸은 가운데(cx, cy)·기울기(angle)·높이(height)로 적는다.
 * 맞춘 결과와 검사는 참고용이다. 받아 주는지는 접수하는 기관이 정한다.
 */
import type { Mask, Point } from './face';

/** 여권 사진 규격 (외교부 여권안내). 주민등록증도 여권 규격 사진을 받는다 */
export const SPEC = {
  widthMm: 35,
  heightMm: 45,
  /** 머리(정수리~턱) 길이 허용 범위 */
  headMinMm: 32,
  headMaxMm: 36,
  /** 자동으로 맞출 머리 길이 (범위의 가운데) */
  headMm: 34,
  /** 사진 위 끝에서 정수리까지 */
  topMm: 4,
  /** 온라인 제출 크기 (픽셀, 300 DPI에서 3.5×4.5cm) */
  outWidth: 413,
  outHeight: 531,
  /** 온라인 제출 용량 한도 */
  maxBytes: 500 * 1024,
} as const;

/** 잘라 낼 칸 (원본 픽셀) */
export interface Placement {
  cx: number;
  cy: number;
  /** 라디안. 사진을 이만큼 거꾸로 돌려 바로 세운다 */
  angle: number;
  /** 칸 높이. 너비는 높이 × 35/45 */
  height: number;
  /** 좌우를 뒤집는다 (휴대폰 앞 카메라 사진) */
  flip: boolean;
}

export const cropWidth = (placement: Placement) =>
  (placement.height * SPEC.widthMm) / SPEC.heightMm;

/** Face Landmarker 점 번호 */
const LM = {
  foreheadTop: 10,
  chin: 152,
  noseTip: 1,
  cheekLeft: 234,
  cheekRight: 454,
  irisA: 468,
  irisB: 473,
} as const;

/** 찾은 얼굴을 바로 세운 좌표로 본 값 (u: 눈을 잇는 방향, v: 그에 수직인 아래 방향) */
export interface Face {
  /** 눈을 잇는 선의 기울기 (라디안) */
  angle: number;
  /** 두 눈 가운데 */
  eyes: { x: number; y: number };
  /** 정수리. 배경에서 찾지 못하면 얼굴 비율로 어림한다 */
  crown: { x: number; y: number };
  chin: { x: number; y: number };
  /** 정수리를 배경과 비교해 찾았는지 (아니면 어림값) */
  crownFound: boolean;
  /** 얼굴이 옆으로 돌아간 정도 (코끝이 두 눈 가운데서 벗어난 거리 / 눈 사이 거리) */
  turn: number;
}

/** 원본 사진 픽셀을 작게 줄여 둔 것 (정수리·배경 살피기용) */
export interface Thumb {
  data: Uint8ClampedArray;
  width: number;
  height: number;
  /** 원본 픽셀 → 이 그림 픽셀 */
  scale: number;
}

const dot = (p: { x: number; y: number }, u: { x: number; y: number }) => p.x * u.x + p.y * u.y;

/** 사진 네 귀퉁이 위쪽에서 본 배경이 흰색인지 (여권 사진은 흰 배경) */
export function whiteBackground(thumb: Thumb): boolean {
  const samples: number[][] = [];
  const rows = Math.max(2, Math.round(thumb.height * 0.04));
  const cols = Math.max(2, Math.round(thumb.width * 0.1));
  for (let y = 0; y < rows; y++) {
    for (const x0 of [0, thumb.width - cols]) {
      for (let x = x0; x < x0 + cols; x++) {
        const i = (y * thumb.width + x) * 4;
        samples.push([thumb.data[i], thumb.data[i + 1], thumb.data[i + 2]]);
      }
    }
  }
  const median = [0, 1, 2].map((c) => {
    const values = samples.map((s) => s[c]).sort((a, b) => a - b);
    return values[values.length >> 1];
  });
  const brightness = (median[0] + median[1] + median[2]) / 3;
  const tint = Math.max(...median) - Math.min(...median);
  return brightness > 205 && tint < 30;
}

function distance(a: ArrayLike<number>, b: ArrayLike<number>) {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

/**
 * 얼굴 점(0~1 비율)과 줄인 사진으로 얼굴을 읽는다.
 * 정수리는 이마 위로 올라가며 배경과 다른 점(머리카락)이 사라지는 곳을 찾는다.
 */
export function readFace(points: Point[], width: number, height: number, thumb: Thumb): Face {
  const px = (index: number) => ({ x: points[index].x * width, y: points[index].y * height });
  const [left, right] = [px(LM.irisA), px(LM.irisB)].sort((a, b) => a.x - b.x);
  const angle = Math.atan2(right.y - left.y, right.x - left.x);
  const u = { x: Math.cos(angle), y: Math.sin(angle) };
  const v = { x: -Math.sin(angle), y: Math.cos(angle) };
  const eyes = { x: (left.x + right.x) / 2, y: (left.y + right.y) / 2 };
  const forehead = px(LM.foreheadTop);
  const chin = px(LM.chin);
  const faceHeight = dot(chin, v) - dot(forehead, v);
  const faceWidth = Math.abs(dot(px(LM.cheekRight), u) - dot(px(LM.cheekLeft), u));
  const eyeGap = Math.hypot(right.x - left.x, right.y - left.y);
  const turn = (dot(px(LM.noseTip), u) - dot(eyes, u)) / eyeGap;

  // 이마 꼭대기(10번 점)에서 정수리까지는 이마~턱 길이의 0.3~0.45배였다 (흰 배경 사진 4장에서 잰 값).
  // 사진으로 찾지 못하면 그 가운데인 0.35배로 어림한다
  let rise = faceHeight * 0.35;
  let crownFound = false;
  const found = scanCrown(thumb, forehead, u, v, faceHeight, faceWidth);
  if (found !== undefined && found > faceHeight * 0.12 && found < faceHeight * 0.7) {
    rise = found;
    crownFound = true;
  }
  const crown = { x: forehead.x - v.x * rise, y: forehead.y - v.y * rise };
  return { angle, eyes, crown, chin, crownFound, turn };
}

/**
 * 이마 꼭대기에서 위로 올라가며 정수리를 찾는다. 얼굴 너비 절반 띠의 색을 걸음마다 재고,
 * 맨 위 걸음들(머리 위 배경)과 다른 점이 많아지기 시작하는 높이를 정수리로 본다.
 * 사진 귀퉁이가 아니라 머리 바로 위의 배경과 비교해 그러데이션·가장자리 그늘에 흔들리지 않는다.
 * 맨 위까지 배경이 고르지 않으면(머리카락이 사진 위 끝에 닿거나 무늬 배경) 찾지 못한 것으로 본다
 */
function scanCrown(
  thumb: Thumb,
  forehead: { x: number; y: number },
  u: { x: number; y: number },
  v: { x: number; y: number },
  faceHeight: number,
  faceWidth: number,
): number | undefined {
  const steps = 120;
  const reach = faceHeight * 0.9;
  const half = faceWidth * 0.25;
  /** 걸음마다 띠 위의 색들 (사진 밖은 뺀다) */
  const rows: number[][][] = [];
  for (let step = 0; step <= steps; step++) {
    const rise = (reach * step) / steps;
    const row: number[][] = [];
    for (let k = -8; k <= 8; k++) {
      const ix = Math.round((forehead.x - v.x * rise + (u.x * half * k) / 8) * thumb.scale);
      const iy = Math.round((forehead.y - v.y * rise + (u.y * half * k) / 8) * thumb.scale);
      if (ix < 0 || iy < 0 || ix >= thumb.width || iy >= thumb.height) continue;
      const i = (iy * thumb.width + ix) * 4;
      row.push([thumb.data[i], thumb.data[i + 1], thumb.data[i + 2]]);
    }
    if (row.length < 9) break;
    rows.push(row);
  }
  // 머리 위 배경: 맨 위 10걸음. 고르지 않으면 배경이 아니다
  const top = rows.slice(-10).flat();
  if (rows.length < 40 || top.length === 0) return undefined;
  const color = [0, 1, 2].map((c) => {
    const values = top.map((p) => p[c]).sort((a, b) => a - b);
    return values[values.length >> 1];
  });
  if (top.filter((p) => distance(p, color) > 32).length / top.length > 0.1) return undefined;
  // 위에서 내려오며 배경과 다른 점이 띠의 3할을 넘는 첫 걸음이 정수리
  const hair = rows.map(
    (row) => row.filter((p) => distance(p, color) > 40).length / row.length > 0.3,
  );
  const crown = hair.lastIndexOf(true);
  if (crown < 0) return undefined;
  // 이마에서 정수리까지는 머리카락(배경과 다른 색)이 이어져야 한다. 중간에 배경 같은 곳이 끼어 있으면
  // 무늬 배경의 다른 부분을 정수리로 잘못 본 것이다
  const gaps = hair.slice(0, crown).filter((value) => !value).length;
  if (gaps > crown * 0.1) return undefined;
  return (reach * crown) / steps;
}

/** 얼굴에 맞춘 칸: 머리 길이 3.4cm, 정수리가 위에서 0.4cm, 두 눈 가운데가 좌우 가운데 */
export function autoPlace(face: Face): Placement {
  const { angle } = face;
  const u = { x: Math.cos(angle), y: Math.sin(angle) };
  const v = { x: -Math.sin(angle), y: Math.cos(angle) };
  const crownV = dot(face.crown, v);
  const head = dot(face.chin, v) - crownV;
  const height = (head * SPEC.heightMm) / SPEC.headMm;
  const centerV = crownV - (height * SPEC.topMm) / SPEC.heightMm + height / 2;
  const centerU = dot(face.eyes, u);
  return {
    cx: centerU * u.x + centerV * v.x,
    cy: centerU * u.y + centerV * v.y,
    angle,
    height,
    flip: false,
  };
}

/** 얼굴을 찾지 못했을 때 처음 칸: 사진 가운데, 기울기 없음 */
export function centerPlace(width: number, height: number): Placement {
  const fit = Math.min(height, (width * SPEC.heightMm) / SPEC.widthMm) * 0.9;
  return { cx: width / 2, cy: height / 2, angle: 0, height: fit, flip: false };
}

/** 칸 안에서 정수리~턱 길이 (mm) */
export function headLength(face: Face, placement: Placement): number {
  const v = { x: -Math.sin(placement.angle), y: Math.cos(placement.angle) };
  return ((dot(face.chin, v) - dot(face.crown, v)) / placement.height) * SPEC.heightMm;
}

/** 칸 안에서 점의 위치 (0~1, 왼쪽 위가 0) */
export function inCrop(point: { x: number; y: number }, placement: Placement) {
  const u = { x: Math.cos(placement.angle), y: Math.sin(placement.angle) };
  const v = { x: -Math.sin(placement.angle), y: Math.cos(placement.angle) };
  const dx = point.x - placement.cx;
  const dy = point.y - placement.cy;
  return {
    x: 0.5 + dot({ x: dx, y: dy }, u) / cropWidth(placement),
    y: 0.5 + dot({ x: dx, y: dy }, v) / placement.height,
  };
}

/** 칸의 네 귀퉁이 (원본 픽셀) */
function corners(placement: Placement) {
  const u = { x: Math.cos(placement.angle), y: Math.sin(placement.angle) };
  const v = { x: -Math.sin(placement.angle), y: Math.cos(placement.angle) };
  const w = cropWidth(placement) / 2;
  const h = placement.height / 2;
  return [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ].map(([a, b]) => ({
    x: placement.cx + u.x * w * a + v.x * h * b,
    y: placement.cy + u.y * w * a + v.y * h * b,
  }));
}

/** 칸이 사진 밖으로 나가는지 (나간 곳은 배경색으로 채운다) */
export function outside(placement: Placement, width: number, height: number): boolean {
  // 반 픽셀은 봐준다 (돌린 칸의 귀퉁이 반올림)
  return corners(placement).some(
    ({ x, y }) => x < -0.5 || y < -0.5 || x > width + 0.5 || y > height + 0.5,
  );
}

/** 사람과 배경을 나눈 결과. 원본 사진의 한 영역(x, y, width, height)을 나눴다 */
export interface Matte {
  x: number;
  y: number;
  width: number;
  height: number;
  mask: Mask;
}

/** 배경을 나눌 영역: 칸을 넉넉히 둘러싼 네모 (원본 픽셀, 사진 안으로 자름) */
export function matteRegion(placement: Placement, width: number, height: number) {
  const points = corners(placement);
  const margin = placement.height * 0.15;
  const x0 = Math.max(0, Math.floor(Math.min(...points.map((p) => p.x)) - margin));
  const y0 = Math.max(0, Math.floor(Math.min(...points.map((p) => p.y)) - margin));
  const x1 = Math.min(width, Math.ceil(Math.max(...points.map((p) => p.x)) + margin));
  const y1 = Math.min(height, Math.ceil(Math.max(...points.map((p) => p.y)) + margin));
  return { x: x0, y: y0, width: Math.max(1, x1 - x0), height: Math.max(1, y1 - y0) };
}

/** 칸이 나눈 영역 안에 있는지 (사진 밖은 어차피 배경색이라 따지지 않는다). 벗어나면 다시 나눈다 */
export function matteCovers(matte: Matte, placement: Placement, width: number, height: number) {
  return corners(placement).every(({ x, y }) => {
    const cx = Math.min(width, Math.max(0, x));
    const cy = Math.min(height, Math.max(0, y));
    return (
      cx >= matte.x - 0.5 &&
      cy >= matte.y - 0.5 &&
      cx <= matte.x + matte.width + 0.5 &&
      cy <= matte.y + matte.height + 0.5
    );
  });
}

/**
 * 사진에서 사람만 남긴 그림. image는 원본을 scale배 한 사진 (미리보기는 줄인 사진, 결과 파일은 원본).
 * 모델이 낸 가장자리는 넓게 번져 배경이 비치므로, 확신이 낮은 쪽을 조금 깎아 경계를 좁힌다
 */
export function cutout(image: CanvasImageSource, scale: number, matte: Matte) {
  const { mask } = matte;
  const alpha = new OffscreenCanvas(mask.width, mask.height);
  const pixels = new ImageData(mask.width, mask.height);
  for (let i = 0; i < mask.data.length; i++) {
    pixels.data[i * 4 + 3] = Math.min(255, Math.max(0, ((mask.data[i] - 38) * 255) / 179));
  }
  alpha.getContext('2d')!.putImageData(pixels, 0, 0);
  const x = Math.floor(matte.x * scale);
  const y = Math.floor(matte.y * scale);
  const canvas = new OffscreenCanvas(
    Math.max(1, Math.round(matte.width * scale)),
    Math.max(1, Math.round(matte.height * scale)),
  );
  const context = canvas.getContext('2d')!;
  context.drawImage(image, -x, -y);
  context.globalCompositeOperation = 'destination-in';
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  context.drawImage(alpha, 0, 0, canvas.width, canvas.height);
  return { image: canvas, x, y };
}

/** 바꿀 배경: 색과 사람만 남긴 그림 (그림의 좌표는 그리는 사진의 픽셀) */
export interface Backdrop {
  color: string;
  cutout: { image: CanvasImageSource; x: number; y: number };
}

/** 칸을 그린다 (흰 바탕, 배경을 바꾸면 그 색 위에). 화면 미리보기와 결과 파일이 같은 함수를 쓴다 */
export function drawCrop(
  context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  image: CanvasImageSource,
  placement: Placement,
  width: number,
  height: number,
  backdrop?: Backdrop,
) {
  context.save();
  context.fillStyle = backdrop?.color ?? '#ffffff';
  context.fillRect(0, 0, width, height);
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  context.translate(width / 2, height / 2);
  if (placement.flip) context.scale(-1, 1);
  context.scale(height / placement.height, height / placement.height);
  context.rotate(-placement.angle);
  context.translate(-placement.cx, -placement.cy);
  if (backdrop) context.drawImage(backdrop.cutout.image, backdrop.cutout.x, backdrop.cutout.y);
  else context.drawImage(image, 0, 0);
  context.restore();
}

/** 결과 JPG (413×531). 온라인 제출 한도(500KB)를 넘으면 화질을 낮춘다 */
export async function exportJpeg(
  image: CanvasImageSource,
  placement: Placement,
  background?: { color: string; matte: Matte },
): Promise<Blob> {
  const canvas = new OffscreenCanvas(SPEC.outWidth, SPEC.outHeight);
  const backdrop = background && {
    color: background.color,
    cutout: cutout(image, 1, background.matte),
  };
  drawCrop(canvas.getContext('2d')!, image, placement, SPEC.outWidth, SPEC.outHeight, backdrop);
  let blob: Blob | undefined;
  for (const quality of [0.95, 0.9, 0.85, 0.8, 0.7]) {
    blob = await canvas.convertToBlob({ type: 'image/jpeg', quality });
    if (blob.size <= SPEC.maxBytes) break;
  }
  return blob!;
}
