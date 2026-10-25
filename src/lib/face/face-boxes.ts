/**
 * 여러 얼굴 찾기의 계산 (find-faces.worker.ts가 쓴다). 화면·워커 어디서나 돌 수 있는 순수 함수만 둔다.
 *
 * 얼굴 찾기 모델(BlazeFace full range)은 사진을 192×192로 줄여 본다. 단체 사진 전체를 한 번에 넣으면 작은 얼굴은
 * 몇 화소로 줄어 놓치므로, 사진을 겹치게 나눈 조각(타일)을 몇 단계 크기로 따로 보고 같은 얼굴을 하나로 합친다.
 */

/** 사진 위의 사각형 (화소) */
export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** 찾은 얼굴 하나 (모델이 낸 얼굴 사각형: 눈썹~턱, 양쪽 귀 안쪽) */
export interface FoundFace extends Box {
  /** 얼굴일 가능성 0~1 */
  score: number;
}

/**
 * 조각 단계: 사진 긴 변을 이만큼으로 나눈 크기의 조각으로 본다 (1은 사진 전체).
 * 모델은 줄인 그림에서 폭 10화소쯤까지 찾으므로, 긴 변 1,600px 사진에서 10등분이면 폭 12화소쯤(긴 변의 0.7%)인 얼굴까지 찾는다
 */
const LEVELS = [1, 3, 6, 10];
/** 이웃 조각과 겹치는 비율. 조각 경계에 걸친 얼굴을 한 조각 안에서 통째로 보게 한다 */
const OVERLAP = 0.3;
/** 가장 작은 조각 (화소). 이보다 작게 나누면 모델 입력(192)보다 작아 키워 보게 될 뿐이다 */
const MIN_TILE = 160;

/** 사진을 볼 조각들 (큰 것부터). 같은 크기 단계는 한 번만 */
export function tilesFor(width: number, height: number): Box[] {
  const long = Math.max(width, height);
  const tiles: Box[] = [{ x: 0, y: 0, width, height }];
  const sizes = new Set<number>();
  for (const level of LEVELS.slice(1)) {
    const size = Math.round(Math.max(MIN_TILE, (long / level) * (1 + OVERLAP)));
    // 사진 전체와 같은 조각이 되면 볼 필요가 없다
    if (size >= long || sizes.has(size)) continue;
    sizes.add(size);
    const step = size / (1 + OVERLAP);
    const across = (side: number) => (side <= size ? 1 : Math.ceil((side - size) / step) + 1);
    const nx = across(width);
    const ny = across(height);
    for (let j = 0; j < ny; j++) {
      for (let i = 0; i < nx; i++) {
        const w = Math.min(size, width);
        const h = Math.min(size, height);
        tiles.push({
          x: nx === 1 ? 0 : Math.round(((width - w) * i) / (nx - 1)),
          y: ny === 1 ? 0 : Math.round(((height - h) * j) / (ny - 1)),
          width: w,
          height: h,
        });
      }
    }
  }
  return tiles;
}

/**
 * 조각 경계(사진 끝이 아닌 곳)에 닿은 얼굴인지. 경계에 잘린 얼굴은 사각형이 한쪽으로 치우치므로 버린다.
 * 조각이 겹쳐 있어 그 얼굴은 이웃 조각이나 더 큰 조각에서 통째로 보인다
 */
export function cutByTile(face: Box, tile: Box, width: number, height: number): boolean {
  const margin = Math.max(1, Math.min(tile.width, tile.height) * 0.01);
  return (
    (tile.x > 0 && face.x <= tile.x + margin) ||
    (tile.y > 0 && face.y <= tile.y + margin) ||
    (tile.x + tile.width < width && face.x + face.width >= tile.x + tile.width - margin) ||
    (tile.y + tile.height < height && face.y + face.height >= tile.y + tile.height - margin)
  );
}

const area = (box: Box) => box.width * box.height;

function intersection(a: Box, b: Box): number {
  const w = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
  return w > 0 && h > 0 ? w * h : 0;
}

/** 같은 얼굴인지: 많이 겹치거나, 작은 사각형이 거의 큰 사각형 안에 있다 */
function sameFace(a: Box, b: Box): boolean {
  const both = intersection(a, b);
  if (both === 0) return false;
  const union = area(a) + area(b) - both;
  return both / union > 0.3 || both / Math.min(area(a), area(b)) > 0.6;
}

/**
 * 여러 조각에서 찾은 얼굴을 합친다. 같은 얼굴은 가능성이 높은 것부터 묶고, 묶은 사각형들을 가능성으로
 * 가중 평균한다 (조각마다 조금씩 다른 사각형을 고르게)
 */
export function mergeFaces(faces: FoundFace[]): FoundFace[] {
  const sorted = [...faces].sort((a, b) => b.score - a.score);
  const groups: { lead: FoundFace; members: FoundFace[] }[] = [];
  for (const face of sorted) {
    const group = groups.find((g) => sameFace(g.lead, face));
    if (group) group.members.push(face);
    else groups.push({ lead: face, members: [face] });
  }
  return groups.map(({ lead, members }) => {
    const total = members.reduce((sum, m) => sum + m.score, 0);
    const mean = (key: keyof Box) => members.reduce((sum, m) => sum + m[key] * m.score, 0) / total;
    return {
      x: mean('x'),
      y: mean('y'),
      width: mean('width'),
      height: mean('height'),
      score: lead.score,
    };
  });
}

/**
 * 얼굴을 가릴 곳: 모델의 얼굴 사각형(눈썹~턱)보다 넉넉하게 머리카락·귀·턱 아래까지 덮는 타원의 바깥 사각형.
 * 가운데를 위로 올리고(머리카락) 위아래로 키운다. 견본 단체 사진에서 머리 꼭대기·양쪽 귀·턱이 모두 타원 안에 든다
 */
export function coverOf(face: Box): Box {
  const cx = face.x + face.width / 2;
  const cy = face.y + face.height * 0.25;
  const rx = face.width * 0.75;
  const ry = face.height;
  return { x: cx - rx, y: cy - ry, width: rx * 2, height: ry * 2 };
}
