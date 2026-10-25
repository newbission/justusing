/**
 * README의 화면 그림을 빌드한 사이트에서 찍는다. 실제 도구에 '예시 파일로 해 보기' 견본(지어낸 내용)을 넣은 모습이다.
 *
 *   npm run build && npm run preview   (다른 창에서, http://localhost:4322)
 *   PLAYWRIGHT_CHANNEL=chrome node scripts/readme/screenshots.mjs
 *
 * 결과: docs/readme/<언어>-<light|dark>.webp (README가 GitHub 테마에 맞춰 <picture>로 고른다).
 * 바깥 페이지의 광고·통계 주소는 빈 응답으로 바꿔 실제 서버에 연결하지 않는다.
 */
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const BASE = process.env.BASE_URL ?? 'http://localhost:4322';
const OUT = ROOT + 'docs/readme/';

/** 찍을 도구. 견본 PDF를 넣으면 쪽 썸네일이 늘어서 무엇을 하는 사이트인지 한눈에 보인다 */
const TOOL = 'pdf/organize';
const LOCALES = { ko: '', en: '/en' };
const THEMES = ['light', 'dark'];
const SAMPLE_BUTTON = { ko: '예시 파일로 해 보기', en: 'Try it with a sample file' };

/** 데스크톱 화면. 두 배로 찍어 그림 폭으로 줄인다 (글자가 또렷하고 파일은 가볍게) */
const VIEWPORT = { width: 1280, height: 900 };
/** 머리글부터 쪽 썸네일까지, 본문 폭만 (양옆·아래 빈칸은 뺀다) */
const CLIP = { x: 156, y: 0, width: 968, height: 740 };
const WIDTH = 1400;

const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL });
await mkdir(OUT, { recursive: true });

for (const [locale, prefix] of Object.entries(LOCALES)) {
  for (const theme of THEMES) {
    const context = await browser.newContext({
      viewport: VIEWPORT,
      deviceScaleFactor: 2,
      colorScheme: theme,
      locale: locale === 'ko' ? 'ko-KR' : 'en-US',
    });
    // 우리 사이트 밖(광고·통계)으로 나가는 요청은 빈 응답으로 바꾼다
    await context.route(
      (url) => url.origin !== new URL(BASE).origin,
      (route) => route.fulfill({ status: 204, body: '' }),
    );
    const page = await context.newPage();
    await page.goto(`${BASE}${prefix}/${TOOL}/`);
    const frame = page.frameLocator('iframe[sandbox]');
    await frame.getByRole('button', { name: SAMPLE_BUTTON[locale] }).click();
    // 쪽 썸네일이 다 그려질 때까지. 견본을 넣으면 바깥 페이지가 도구 칸으로 내려가므로 맨 위로 되돌린다
    await frame.locator('canvas').first().waitFor();
    await page.waitForTimeout(2000);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(300);

    const shot = await page.screenshot({ clip: CLIP });
    const file = `${OUT}${locale}-${theme}.webp`;
    await sharp(shot).resize({ width: WIDTH }).webp({ quality: 80 }).toFile(file);
    console.log(file);
    await context.close();
  }
}

await browser.close();
