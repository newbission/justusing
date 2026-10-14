/**
 * 로고의 유일한 출처. 머리글(Logo.astro), favicon·내려받기 파일(src/pages/brand/), PNG(scripts/make-brand-images.mjs)이
 * 모두 이 값으로 그린다.
 *
 * - 심볼: 둥근 검정 네모 안에 15° 기울인 흰 j. 꼬리를 말아 올려 u처럼도 보인다 (j인지 u인지 헷갈리는 것이 핵심).
 *   초록 점은 j 머리 위가 아니라 u 그릇 안에 둔다. 머리 위에 두면 점핏(Jumpit) 로고와 같아진다.
 * - 글자: Pretendard Bold로 쓴 "justus.ing"(도메인)을 도형으로 바꾼 것. 마침표만 초록이다.
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
  /** j 글자를 그리는 좌표계: 가운데로 옮겨 15° 기울이고, 네모의 약 70%를 채우게 키운다 */
  transform: 'translate(50 50) rotate(15) scale(1.2) translate(0 -0.5)',
  /** 줄기는 길게(j), 꼬리는 그보다 낮게 말아 올린다(u) */
  letter: 'M12 -22 V11 A12 12 0 0 1 -12 11 V-2',
  letterWidth: 9,
  /** u 그릇 안 */
  dot: { cx: 0, cy: 6, r: 5 },
} as const;

/** 글자 로고 (Pretendard Bold, 2048 단위). 기준선이 y=0. dot은 justus와 ing 사이의 마침표 */
export const WORDMARK = {
  box: { x: 0, y: -1530, width: 9141.36, height: 1960 },
  ink: 'M116 -1086V50C116 132 80 176 -16 176C-30 176 -40 174 -56 174V406L4 408C258 408 412 304 412 54V-1086ZM262 -1228C350 -1228 422 -1296 422 -1378C422 -1462 350 -1530 262 -1530C172 -1530 100 -1462 100 -1378C100 -1296 172 -1228 262 -1228Z M1297.04 -462C1297.04 -314 1195.04 -236 1087.04 -236C971.04 -236 897.04 -318 897.04 -446V-1086H601.04V-394C601.04 -140 749.04 14 967.04 14C1131.04 14 1247.04 -70 1297.04 -196H1309.04V0H1593.04V-1086H1297.04Z M2402.08 -764H2680.08C2664.08 -970 2494.08 -1100 2220.08 -1100C1940.08 -1100 1760.08 -970 1762.08 -762C1760.08 -602 1868.08 -494 2074.08 -454L2254.08 -418C2356.08 -396 2402.08 -362 2402.08 -306C2402.08 -236 2330.08 -192 2222.08 -192C2114.08 -192 2044.08 -236 2030.08 -322H1732.08C1756.08 -110 1928.08 22 2222.08 22C2510.08 22 2702.08 -122 2704.08 -336C2702.08 -492 2600.08 -586 2390.08 -630L2196.08 -670C2094.08 -692 2054.08 -730 2056.08 -778C2054.08 -844 2128.08 -890 2224.08 -890C2322.08 -890 2390.08 -840 2402.08 -764Z M3417.12 -1086H3213.12V-1346H2917.12V-1086H2767.12V-864H2917.12V-292C2915.12 -82 3061.12 14 3275.12 14C3349.12 14 3401.12 10 3433.12 4V-230C3397.12 -226 3345.12 -224 3315.12 -224C3255.12 -226 3213.12 -248 3213.12 -334V-864H3417.12Z M4258.16 -462C4258.16 -314 4156.16 -236 4048.16 -236C3932.16 -236 3858.16 -318 3858.16 -446V-1086H3562.16V-394C3562.16 -140 3710.16 14 3928.16 14C4092.16 14 4208.16 -70 4258.16 -196H4270.16V0H4554.16V-1086H4258.16Z M5363.2 -764H5641.2C5625.2 -970 5455.2 -1100 5181.2 -1100C4901.2 -1100 4721.2 -970 4723.2 -762C4721.2 -602 4829.2 -494 5035.2 -454L5215.2 -418C5317.2 -396 5363.2 -362 5363.2 -306C5363.2 -236 5291.2 -192 5183.2 -192C5075.2 -192 5005.2 -236 4991.2 -322H4693.2C4717.2 -110 4889.2 22 5183.2 22C5471.2 22 5663.2 -122 5665.2 -336C5663.2 -492 5561.2 -586 5351.2 -630L5157.2 -670C5055.2 -692 5015.2 -730 5017.2 -778C5015.2 -844 5089.2 -890 5185.2 -890C5283.2 -890 5351.2 -840 5363.2 -764Z M6343.28 0H6639.28V-1086H6343.28ZM6491.28 -1228C6579.28 -1228 6651.28 -1296 6651.28 -1378C6651.28 -1462 6579.28 -1530 6491.28 -1530C6401.28 -1530 6329.28 -1462 6329.28 -1378C6329.28 -1296 6401.28 -1228 6491.28 -1228Z M7124.32 -628C7124.32 -772 7208.32 -854 7332.32 -854C7454.32 -854 7528.32 -774 7528.32 -640V0H7822.32V-692C7824.32 -946 7674.32 -1100 7448.32 -1100C7288.32 -1100 7172.32 -1022 7122.32 -896H7110.32V-1086H6828.32V0H7124.32Z M8499.36 430C8807.36 430 9027.36 288 9027.36 12V-1086H8733.36V-904H8721.36C8681.36 -992 8593.36 -1100 8411.36 -1100C8171.36 -1100 7969.36 -918 7969.36 -550C7969.36 -188 8165.36 -16 8411.36 -16C8585.36 -16 8681.36 -104 8721.36 -192H8735.36V6C8735.36 158 8643.36 216 8505.36 216C8387.36 216 8305.36 176 8289.36 90H7997.36C8015.36 296 8199.36 430 8499.36 430ZM8503.36 -238C8353.36 -238 8273.36 -358 8273.36 -546C8273.36 -734 8353.36 -864 8503.36 -864C8651.36 -864 8735.36 -740 8735.36 -546C8735.36 -354 8651.36 -238 8503.36 -238Z',
  dot: 'M5980.24 18C6068.24 18 6146.24 -58 6146.24 -150C6146.24 -242 6068.24 -316 5980.24 -316C5886.24 -316 5810.24 -242 5812.24 -150C5810.24 -58 5886.24 18 5980.24 18Z',
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
  return `<path d="${WORDMARK.ink}" fill="${ink}"/><path d="${WORDMARK.dot}" fill="${dot}"/>`;
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
