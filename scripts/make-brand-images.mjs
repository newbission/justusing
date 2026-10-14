/**
 * 로고 PNG·ICO를 src/brand/logo.ts에서 다시 만든다. 로고를 바꿨을 때만 직접 돌리고 결과를 커밋한다.
 *   PLAYWRIGHT_CHANNEL=chrome node scripts/make-brand-images.mjs
 * SVG를 브라우저(Playwright)로 그려서 PNG로 찍는다. 빌드·CI에서는 돌리지 않는다.
 */
import { writeFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';
import { lockupSvg, LOCKUP, markShapes, markSvg, MARK_COLORS } from '../src/brand/logo.ts';

/** 앱 아이콘용: 둥근 모서리 없이 네모 전체를 채운다 (iOS가 모서리를 직접 깎는다) */
const fullBleedMark = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="6 6 88 88"><rect x="0" y="0" width="100" height="100" fill="${MARK_COLORS.tile}"/>${markShapes()}</svg>`;

/** 링크 미리보기 (og:image, 1200×630): 다크 바탕 가운데에 심볼 + 글자. 글자 없는 그림이라 언어마다 따로 두지 않는다 */
const OG_HEIGHT = 150;
const ogImage = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630"><rect width="1200" height="630" fill="#151515"/><svg x="${(1200 - (LOCKUP.width * OG_HEIGHT) / 100) / 2}" y="${(630 - OG_HEIGHT) / 2}" height="${OG_HEIGHT}" width="${(LOCKUP.width * OG_HEIGHT) / 100}" viewBox="0 0 ${LOCKUP.width} 100">${lockupSvg('dark').replace(/^<svg[^>]*>|<\/svg>\n$/g, '')}</svg></svg>`;

/** [파일, SVG, 너비, 높이] */
const targets = [
  ['public/favicon-32.png', markSvg(), 32, 32],
  ['public/apple-touch-icon.png', fullBleedMark, 180, 180],
  ['public/og.png', ogImage, 1200, 630],
  // 내려받기용 (/brand/). 글자 로고는 투명 바탕, 높이 200px
  ['public/brand/mark-512.png', markSvg(), 512, 512],
  ['public/brand/lockup-light.png', lockupSvg('light'), Math.round(LOCKUP.width * 2), 200],
  ['public/brand/lockup-dark.png', lockupSvg('dark'), Math.round(LOCKUP.width * 2), 200],
];

// 로컬 크롬으로 돌리려면 PLAYWRIGHT_CHANNEL=chrome (E2E와 같다)
const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL });
const shots = new Map();
for (const [file, svg, width, height] of targets) {
  const page = await browser.newPage({ viewport: { width, height } });
  await page.setContent(
    `<style>html,body{margin:0;background:transparent}svg{display:block;width:${width}px;height:${height}px}</style>${svg}`,
  );
  shots.set(file, await page.screenshot({ omitBackground: true }));
  await page.close();
}
await browser.close();

// favicon.ico: 32px PNG 하나를 ICO 상자에 담는다 (오래된 브라우저·검색 결과용)
const ico32 = shots.get('public/favicon-32.png');
shots.delete('public/favicon-32.png');
const header = Buffer.alloc(22);
header.writeUInt16LE(0, 0); // 예약
header.writeUInt16LE(1, 2); // 아이콘
header.writeUInt16LE(1, 4); // 이미지 1개
header.writeUInt8(32, 6); // 너비
header.writeUInt8(32, 7); // 높이
header.writeUInt16LE(1, 10); // 색 평면
header.writeUInt16LE(32, 12); // 픽셀당 비트
header.writeUInt32LE(ico32.length, 14); // 이미지 크기
header.writeUInt32LE(22, 18); // 이미지 위치
shots.set('public/favicon.ico', Buffer.concat([header, ico32]));

for (const [file, data] of shots) {
  await writeFile(file, data);
  console.log(`${file} (${data.length} bytes)`);
}
