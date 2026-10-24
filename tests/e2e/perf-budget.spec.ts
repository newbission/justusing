/**
 * 성능 예산: 페이지가 처음 받는 크기에 상한을 둔다. 넘으면 실패한다.
 * 사이트 철칙 "사이트가 무거워지거나 느려지면 안 된다"를 도구가 늘어도 자동으로 지키는 장치다.
 *
 * - 크기는 응답 내용을 gzip한 값(KB, 1KB = 1024바이트)이다. 글꼴은 이미 압축된 woff2라 원본 크기를 쓴다.
 * - 상한 = 2026-10-24에 잰 값 + 여유(HTML·CSS·JS는 약 15%, 글자 수에 따라 달라지는 글꼴은 약 25%).
 *   지금 값은 scripts/perf/measure.mjs로 다시 잴 수 있다 (docs/foundations/site-structure 표).
 * - 상한을 올리는 PR은 이유를 이 주석(해당 줄 옆)과 PR 본문에 적는다. 이유 없이 올리지 않는다.
 *   먼저 줄일 수 있는지 본다: 큰 라이브러리는 그 도구가 필요할 때만 받고, 바깥 페이지에는 새 JS·CSS를 넣지 않는다.
 * - 광고·통계 외부 스크립트는 우리가 정할 수 없어 세지 않는다 (같은 사이트에서 받은 파일만 센다).
 * - 바깥 페이지와 도구 frame(iframe)을 따로 센다. frame은 방문마다 다시 받는다(출처 없는 sandbox라 브라우저 캐시를 못 쓴다).
 */
import { test, expect } from './test';
import { measurePage, type Kind, type Measure } from './perf-measure';

// 페이지 하나씩 독립이라 나란히 돌려 시간을 줄인다
test.describe.configure({ mode: 'parallel' });

const KB = 1024;

/** 종류별 상한 (KB). 글꼴은 원본 크기, 나머지는 gzip */
interface Limits {
  html: number;
  js: number;
  css: number;
  font: number;
  image: number;
  /** 요청 수 */
  requests: number;
}

/** 바깥 페이지 종류별 상한 */
const OUTER: { name: string; path: string; limits: Limits }[] = [
  // 홈·안전 페이지는 움직이는 그림(SVG)이 HTML에 들어 있어 HTML이 크다
  {
    name: '홈',
    path: '/',
    limits: { html: 27, js: 4, css: 23, font: 520, image: 5, requests: 30 }, // 2026-10-24: 22.8 / 0 / 19.8 / 417 / 0 / 22
  },
  {
    name: '카테고리(PDF)',
    path: '/pdf/',
    limits: { html: 25, js: 4, css: 20, font: 500, image: 5, requests: 28 }, // 21.1 / 0 / 17.2 / 401 / 0 / 20
  },
  {
    name: '카테고리(이미지)',
    path: '/image/',
    limits: { html: 23, js: 4, css: 20, font: 500, image: 5, requests: 28 }, // 19.5 / 0 / 17.2 / 399 / 0 / 20
  },
  {
    name: '카테고리(텍스트)',
    path: '/text/',
    limits: { html: 21, js: 4, css: 20, font: 450, image: 5, requests: 25 }, // 17.5 / 0 / 17.2 / 352 / 0 / 17
  },
  // 도구 페이지: 도구 frame은 따로 센다. 바깥 JS는 frame 연결·보관 데이터·따라 하기 스크립트뿐이다
  {
    name: '도구(PDF 합치기)',
    path: '/pdf/merge/',
    limits: { html: 25, js: 4, css: 22, font: 520, image: 5, requests: 30 }, // 21.1 / 2.2 / 19.2 / 411 / 0 / 24
  },
  {
    name: '도구(이미지 글자 추출)',
    path: '/image/ocr/',
    limits: { html: 26, js: 4, css: 22, font: 450, image: 5, requests: 28 }, // 21.9 / 2.2 / 19.2 / 331 / 0 / 21
  },
  // 가이드 글은 글이 길어 한글 글꼴 조각을 더 받는다
  {
    name: '가이드 목록',
    path: '/guide/',
    limits: { html: 24, js: 4, css: 20, font: 550, image: 5, requests: 28 }, // 20.7 / 0 / 17.2 / 432 / 0 / 20
  },
  {
    name: '가이드 글',
    path: '/guide/compress-pdf/',
    limits: { html: 24, js: 4, css: 20, font: 600, image: 20, requests: 30 }, // 20.4 / 0 / 17.2 / 460 / 7.2 / 23
  },
  {
    name: '안전 설명',
    path: '/safety/',
    limits: { html: 28, js: 4, css: 24, font: 560, image: 5, requests: 30 }, // 23.8 / 0 / 20.5 / 445 / 0 / 22
  },
];

/** 도구 frame 첫 화면(파일을 고르기 전) 상한. 큰 라이브러리와 데이터는 파일·버튼을 쓸 때 받는다 */
const FRAMES: { name: string; path: string; limits: Limits }[] = [
  {
    name: 'PDF 합치기',
    path: '/pdf/merge/',
    // pdf.js(126KB)는 PDF를 열 때 받는다 (src/lib/pdf/pdfjs.ts). 첫 화면에서 받기 시작하면 js 상한을 넘는다
    limits: { html: 16, js: 46, css: 21, font: 230, image: 5, requests: 32 }, // 13.4 / 39.1 / 18.0 / 178 / 0 / 24
  },
  {
    name: '이미지 글자 추출',
    path: '/image/ocr/',
    // 글자 읽는 엔진·언어 데이터는 받기 전에 묻고, 그때 받는다
    limits: { html: 16, js: 46, css: 21, font: 290, image: 5, requests: 32 }, // 13.4 / 39.6 / 18.0 / 230 / 0 / 25
  },
];

/**
 * 도구 전용 라이브러리·데이터·워커 파일. 바깥 페이지나 다른 도구의 첫 화면에서 받으면 안 된다
 * (파일 이름은 빌드 결과 기준: pdf.js 본체는 `pdf.<해시>.js`, 워커는 `*.worker-<해시>.js`, 큰 데이터는 /data/·/vendor/).
 */
const HEAVY = /\/_astro\/(pdf\.[\w-]+\.js|[\w.-]*\.worker-[\w-]+\.js)$|^\/(data|vendor)\//;

/** 전송 크기(gzip, KB)와 상한을 견주는 확인. 실패 메시지에 지금 값과 상한을 보인다 */
function check(measure: Measure, limits: Limits) {
  const size = (kind: Kind, field: 'gzip' | 'raw') => (measure.byType[kind]?.[field] ?? 0) / KB;
  const actual = {
    html: size('html', 'gzip'),
    js: size('js', 'gzip'),
    css: size('css', 'gzip'),
    font: size('font', 'raw'),
    image: size('image', 'gzip'),
    requests: measure.count,
  };
  // 한 번에 다 보이게 (하나가 실패해도 나머지 값을 알 수 있게) 값 전체를 견준다
  const over = (Object.keys(limits) as (keyof Limits)[]).filter((k) => actual[k] > limits[k]);
  expect(
    over.map((k) => `${k}: ${actual[k].toFixed(1)} > ${limits[k]}`),
    `상한을 넘었습니다 (지금 값: ${JSON.stringify(
      Object.fromEntries(Object.entries(actual).map(([k, v]) => [k, +v.toFixed(1)])),
    )})`,
  ).toEqual([]);
}

for (const { name, path, limits } of OUTER) {
  test(`바깥 페이지 예산: ${name} ${path}`, async ({ page, baseURL }) => {
    const { outer } = await measurePage(page, new URL(path, baseURL).href);
    check(outer, limits);
    // 도구 전용 큰 라이브러리·워커·데이터가 바깥 페이지에 섞이지 않는다
    expect(outer.files.map((f) => f.path).filter((p) => HEAVY.test(p))).toEqual([]);
    // 어떤 JS 파일도 하나가 커지면 안 된다 (바깥 페이지 스크립트는 작은 것만)
    for (const f of outer.files.filter((f) => f.kind === 'js')) {
      expect(f.gzip / KB, `${f.path} gzip KB`).toBeLessThan(8);
    }
  });
}

for (const { name, path, limits } of FRAMES) {
  test(`도구 frame 첫 화면 예산: ${name} ${path}`, async ({ page, baseURL }) => {
    const { frame } = await measurePage(page, new URL(path, baseURL).href);
    expect(frame, 'frame이 열려야 한다').not.toBeNull();
    check(frame!, limits);
  });
}

/** 도구 frame 첫 화면에 큰 라이브러리·워커·데이터가 없어야 하는 도구들 (각자 쓸 때 받는다) */
const LAZY_TOOLS = [
  '/pdf/merge/', // pdf.js
  '/pdf/ocr/', // pdf.js + 글자 읽는 엔진
  '/image/ocr/', // 글자 읽는 엔진·언어 데이터
  '/image/id-photo/', // 얼굴 찾는 모델
  '/image/heic-to-jpg/', // HEIC 해독기
  '/pdf/watermark/', // 글꼴 데이터
];

for (const path of LAZY_TOOLS) {
  test(`도구 frame 첫 화면에 큰 파일이 없다: ${path}`, async ({ page, baseURL }) => {
    const { frame } = await measurePage(page, new URL(path, baseURL).href);
    expect(frame, 'frame이 열려야 한다').not.toBeNull();
    expect(frame!.files.map((f) => f.path).filter((p) => HEAVY.test(p))).toEqual([]);
    // 한 파일이라도 gzip 30KB를 넘으면 안 된다 (공통 Svelte 실행 코드 19KB가 가장 크다)
    for (const f of frame!.files.filter((f) => f.kind === 'js')) {
      expect(f.gzip / KB, `${f.path} gzip KB`).toBeLessThan(30);
    }
  });
}
