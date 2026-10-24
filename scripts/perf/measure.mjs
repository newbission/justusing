/**
 * 페이지가 처음 받는 것을 잰다 (성능 예산의 기준 수치, docs/foundations/site-structure 참고).
 *
 *   npm run build && npx wrangler dev --port 8852   (다른 터미널에서)
 *   node scripts/perf/measure.mjs [--port 8852] [--files] [경로 ...]
 *
 * 크롬으로 열고, 페이지가 가만해질 때까지 받은 응답을 종류(HTML·JS·CSS·글꼴·그림)별로 모은다.
 * 바깥 페이지와 도구 frame(iframe)은 따로 센다. 크기는 gzip(원본). --files를 주면 받은 파일을 하나씩 보인다.
 */
import { chromium } from '@playwright/test';
import { measurePage, PAGES } from '../../tests/e2e/perf-measure.ts';

const args = process.argv.slice(2);
const take = (flag) => {
  const at = args.indexOf(flag);
  return at >= 0 ? args.splice(at, 2)[1] : undefined;
};
const port = take('--port') ?? '8852';
const filesAt = args.indexOf('--files');
const showFiles = filesAt >= 0;
if (showFiles) args.splice(filesAt, 1);
const paths = args.length ? args : PAGES.map((p) => p.path);

const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL });
const kb = (n) => (n / 1024).toFixed(1);
const cell = (s) => (s ? `${kb(s.gzip)} (${kb(s.raw)})` : '-').padStart(15);
console.log(
  '경로'.padEnd(26),
  '구분'.padEnd(6),
  'HTML gz(원본)'.padStart(15),
  'JS'.padStart(15),
  'CSS'.padStart(15),
  '글꼴'.padStart(15),
  '그림'.padStart(15),
  '요청',
);
for (const path of paths) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const result = await measurePage(page, `http://localhost:${port}${path}`);
  for (const [who, m] of [
    ['바깥', result.outer],
    ['frame', result.frame],
  ]) {
    if (!m) continue;
    const t = m.byType;
    console.log(
      path.padEnd(26),
      who.padEnd(6),
      cell(t.html),
      cell(t.js),
      cell(t.css),
      cell(t.font),
      cell(t.image),
      m.count,
    );
    if (showFiles) {
      for (const f of [...m.files].sort((a, b) => b.gzip - a.gzip)) {
        console.log(
          `    ${kb(f.gzip).padStart(7)} (${kb(f.raw).padStart(7)})  ${f.kind.padEnd(5)} ${f.path}`,
        );
      }
    }
  }
  await page.close();
}
await browser.close();
