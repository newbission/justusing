/**
 * 로고의 유일한 출처. 머리글(Logo.astro), favicon·내려받기 파일(src/pages/brand/), PNG(scripts/make-brand-images.mjs)이
 * 모두 이 값으로 그린다.
 *
 * - 심볼: 둥근 검정 네모 안에 30° 기울인 흰 j. 꼬리를 말아 올려 u처럼도 보인다. j의 점은 초록.
 * - 글자: Pretendard Bold로 쓴 "justusing"을 도형으로 바꾼 것. j의 점만 따로 떼어 초록으로 칠한다.
 */

/** 심볼 색. 화면 테마와 상관없이 늘 같다 (앱 아이콘처럼). 점은 사이트 다크 테마의 초록 */
export const MARK_COLORS = { tile: '#1e1e1e', letter: '#ffffff', dot: '#6fb394' } as const;

/** 글자 색. 라이트·다크 화면에 맞춘 사이트 색 (tokens.css의 --color-text, --color-accent) */
export const WORDMARK_COLORS = {
  light: { ink: '#1e1e1e', dot: '#2f6f55' },
  dark: { ink: '#e4e4e1', dot: '#6fb394' },
} as const;

/** 다크 화면에서 검정 네모가 바탕에 묻히지 않게 두르는 선 */
export const MARK_DARK_LINE = '#3a3a3a';

/** 심볼 (viewBox 0 0 100 100) */
export const MARK = {
  tile: { x: 6, y: 6, size: 88, radius: 24 },
  /** j 글자를 그리는 좌표계: 가운데로 옮겨 30° 기울인다 */
  transform: 'translate(50 50) rotate(30) scale(0.95) translate(-2 5)',
  letter: 'M12 -15 V11 A12 12 0 0 1 -12 11 V-5',
  letterWidth: 9,
  dot: { cx: 12, cy: -29, r: 6.5 },
} as const;

/** 글자 로고 (Pretendard Bold, 2048 단위). 기준선이 y=0 */
export const WORDMARK = {
  box: { x: 0, y: -1530, width: 8604.32, height: 1938 },
  ink: 'M116 -1086V50C116 132 80 176 -16 176C-30 176 -40 174 -56 174V406L4 408C258 408 412 304 412 54V-1086Z M1297.04 -462C1297.04 -314 1195.04 -236 1087.04 -236C971.04 -236 897.04 -318 897.04 -446V-1086H601.04V-394C601.04 -140 749.04 14 967.04 14C1131.04 14 1247.04 -70 1297.04 -196H1309.04V0H1593.04V-1086H1297.04Z M2402.08 -764H2680.08C2664.08 -970 2494.08 -1100 2220.08 -1100C1940.08 -1100 1760.08 -970 1762.08 -762C1760.08 -602 1868.08 -494 2074.08 -454L2254.08 -418C2356.08 -396 2402.08 -362 2402.08 -306C2402.08 -236 2330.08 -192 2222.08 -192C2114.08 -192 2044.08 -236 2030.08 -322H1732.08C1756.08 -110 1928.08 22 2222.08 22C2510.08 22 2702.08 -122 2704.08 -336C2702.08 -492 2600.08 -586 2390.08 -630L2196.08 -670C2094.08 -692 2054.08 -730 2056.08 -778C2054.08 -844 2128.08 -890 2224.08 -890C2322.08 -890 2390.08 -840 2402.08 -764Z M3417.12 -1086H3213.12V-1346H2917.12V-1086H2767.12V-864H2917.12V-292C2915.12 -82 3061.12 14 3275.12 14C3349.12 14 3401.12 10 3433.12 4V-230C3397.12 -226 3345.12 -224 3315.12 -224C3255.12 -226 3213.12 -248 3213.12 -334V-864H3417.12Z M4258.16 -462C4258.16 -314 4156.16 -236 4048.16 -236C3932.16 -236 3858.16 -318 3858.16 -446V-1086H3562.16V-394C3562.16 -140 3710.16 14 3928.16 14C4092.16 14 4208.16 -70 4258.16 -196H4270.16V0H4554.16V-1086H4258.16Z M5363.2 -764H5641.2C5625.2 -970 5455.2 -1100 5181.2 -1100C4901.2 -1100 4721.2 -970 4723.2 -762C4721.2 -602 4829.2 -494 5035.2 -454L5215.2 -418C5317.2 -396 5363.2 -362 5363.2 -306C5363.2 -236 5291.2 -192 5183.2 -192C5075.2 -192 5005.2 -236 4991.2 -322H4693.2C4717.2 -110 4889.2 22 5183.2 22C5471.2 22 5663.2 -122 5665.2 -336C5663.2 -492 5561.2 -586 5351.2 -630L5157.2 -670C5055.2 -692 5015.2 -730 5017.2 -778C5015.2 -844 5089.2 -890 5185.2 -890C5283.2 -890 5351.2 -840 5363.2 -764Z M5806.24 0H6102.24V-1086H5806.24Z M5954.24 -1228C6042.24 -1228 6114.24 -1296 6114.24 -1378C6114.24 -1462 6042.24 -1530 5954.24 -1530C5864.24 -1530 5792.24 -1462 5792.24 -1378C5792.24 -1296 5864.24 -1228 5954.24 -1228Z M6587.28 -628C6587.28 -772 6671.28 -854 6795.28 -854C6917.28 -854 6991.28 -774 6991.28 -640V0H7285.28V-692C7287.28 -946 7137.28 -1100 6911.28 -1100C6751.28 -1100 6635.28 -1022 6585.28 -896H6573.28V-1086H6291.28V0H6587.28Z M7962.32 430C8270.32 430 8490.32 288 8490.32 12V-1086H8196.32V-904H8184.32C8144.32 -992 8056.32 -1100 7874.32 -1100C7634.32 -1100 7432.32 -918 7432.32 -550C7432.32 -188 7628.32 -16 7874.32 -16C8048.32 -16 8144.32 -104 8184.32 -192H8198.32V6C8198.32 158 8106.32 216 7968.32 216C7850.32 216 7768.32 176 7752.32 90H7460.32C7478.32 296 7662.32 430 7962.32 430Z M7966.32 -238C7816.32 -238 7736.32 -358 7736.32 -546C7736.32 -734 7816.32 -864 7966.32 -864C8114.32 -864 8198.32 -740 8198.32 -546C8198.32 -354 8114.32 -238 7966.32 -238Z',
  dot: { cx: 261.0, cy: -1379.0, r: 161.0 },
} as const;

/** 심볼 + 글자 가로 배치 (viewBox 0 0 LOCKUP.width 100). 글자 높이는 심볼의 60% */
const WORDMARK_SCALE = 60 / WORDMARK.box.height;
const GAP = 22;
export const LOCKUP = {
  width: 100 + GAP + WORDMARK.box.width * WORDMARK_SCALE,
  wordmarkTransform: `translate(${100 + GAP} ${50 - (WORDMARK.box.y + WORDMARK.box.height / 2) * WORDMARK_SCALE}) scale(${WORDMARK_SCALE})`,
};

interface MarkColors {
  tile: string;
  letter: string;
  dot: string;
  line?: string;
}

/** 심볼 SVG 내용 (svg 태그 안쪽) */
export function markShapes(c: MarkColors = MARK_COLORS): string {
  const { tile, transform, letter, letterWidth, dot } = MARK;
  const line = c.line ? ` stroke="${c.line}" stroke-width="1.5"` : '';
  return (
    `<rect x="${tile.x}" y="${tile.y}" width="${tile.size}" height="${tile.size}" rx="${tile.radius}" fill="${c.tile}"${line}/>` +
    `<g transform="${transform}">` +
    `<path d="${letter}" fill="none" stroke="${c.letter}" stroke-width="${letterWidth}" stroke-linecap="round"/>` +
    `<circle cx="${dot.cx}" cy="${dot.cy}" r="${dot.r}" fill="${c.dot}"/></g>`
  );
}

/** 글자 로고 SVG 내용 (2048 단위 좌표) */
export function wordmarkShapes(ink: string, dot: string): string {
  const d = WORDMARK.dot;
  return `<path d="${WORDMARK.ink}" fill="${ink}"/><circle cx="${d.cx}" cy="${d.cy}" r="${d.r}" fill="${dot}"/>`;
}

const svg = (viewBox: string, body: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}">${body}</svg>\n`;

/** 심볼만 (favicon, 앱 아이콘) */
export function markSvg(): string {
  return svg('0 0 100 100', markShapes());
}

/** 심볼 + 글자. theme는 놓일 바탕 색 */
export function lockupSvg(theme: 'light' | 'dark'): string {
  const c = WORDMARK_COLORS[theme];
  const mark = theme === 'dark' ? { ...MARK_COLORS, line: MARK_DARK_LINE } : MARK_COLORS;
  return svg(
    `0 0 ${LOCKUP.width} 100`,
    markShapes(mark) +
      `<g transform="${LOCKUP.wordmarkTransform}">${wordmarkShapes(c.ink, c.dot)}</g>`,
  );
}
