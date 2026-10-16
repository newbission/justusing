/**
 * 글자 워터마크를 놓을 자리 계산. 화면 미리보기(도구 화면)와 워커(watermark.worker.ts)가 같이 쓴다.
 * 워커가 불러도 다른 모듈을 끌고 오지 않게 계산만 둔다.
 */
import type { WatermarkLayout } from './watermark';

/** 반복 배치에서 한 쪽에 넣는 최대 개수 (글자가 아주 작아도 파일이 커지지 않게) */
const MAX_TILES = 300;

/**
 * 화면에 보이는 쪽(가로 width, 세로 height, pt) 위에 글자를 놓을 자리들.
 * 돌려주는 점은 글자의 가운데. 반복 배치는 기울인 줄을 따라 쪽 전체를 덮는다.
 */
export function placements(
  page: { width: number; height: number },
  textWidth: number,
  fontSize: number,
  layout: WatermarkLayout,
  angle: number,
): { x: number; y: number }[] {
  const center = { x: page.width / 2, y: page.height / 2 };
  if (layout === 'center') return [center];
  const theta = (angle * Math.PI) / 180;
  // 글자 방향(u)과 그에 수직인 줄 방향(v), 화면 좌표(아래가 +y)
  const u = { x: Math.cos(theta), y: -Math.sin(theta) };
  const v = { x: Math.sin(theta), y: Math.cos(theta) };
  const stepU = textWidth + fontSize * 2;
  const stepV = fontSize * 3.5;
  const radius = Math.hypot(page.width, page.height) / 2 + Math.max(stepU, stepV);
  const points: { x: number; y: number }[] = [];
  const rows = Math.ceil(radius / stepV);
  const cols = Math.ceil(radius / stepU) + 1;
  for (let row = -rows; row <= rows; row++) {
    // 줄마다 반 칸씩 엇갈리게
    const shift = (row % 2) * 0.5;
    for (let col = -cols; col <= cols; col++) {
      const a = (col + shift) * stepU;
      const b = row * stepV;
      const x = center.x + u.x * a + v.x * b;
      const y = center.y + u.y * a + v.y * b;
      // 쪽 밖으로 완전히 나간 것은 뺀다 (글자 반폭만큼 여유)
      const margin = textWidth / 2 + fontSize;
      if (x < -margin || x > page.width + margin || y < -margin || y > page.height + margin) {
        continue;
      }
      points.push({ x, y });
      if (points.length >= MAX_TILES) return points;
    }
  }
  return points;
}
