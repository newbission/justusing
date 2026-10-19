/**
 * "파일이 기기를 떠나지 않는다"는 약속을 확인하는 검사. 도구마다 같은 기준으로 본다.
 * 모든 E2E가 끝날 때 `test.ts`가 저절로 부른다.
 *
 * - 도구 frame(파일을 다루는 곳)의 요청: 우리 사이트로 가는 GET뿐이고 본문이 없어야 한다.
 * - 바깥 페이지의 요청: 위와 같거나, 방문 통계·광고 주소로만 갈 수 있다.
 * - 모든 요청의 주소와 본문에는 테스트 파일의 이름도, 파일 형식의 첫머리(PDF·이미지·글꼴)도,
 *   테스트 파일 내용의 일부(base64)도 없어야 한다. 우리 사이트로 가는 GET도 주소에 실어 보낼 수 있다.
 *   예외: '예시 파일로 해 보기'가 받는 우리 견본 파일 주소 그대로 (쿼리 없음, public/samples/에 있는 파일만).
 *   견본 이름(sample-photo.jpg 등)에 테스트 파일 이름이 들어 있을 수 있어서다.
 *   우리 페이지 주소도 뺀다. 가이드 주소(/guide/photos-to-pdf/)에 테스트 파일 이름이 들어 있고,
 *   그 주소로 옮겨 가는 요청과 방문 통계가 보내는 페이지 주소에 실린다.
 */
import { expect, type Page, type Request } from '@playwright/test';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/** 바깥 페이지가 연결해도 되는 주소: 방문 통계(Analytics.astro)와 광고 스크립트(AdsScript.astro) */
const OUTER_ORIGINS = [
  'https://static.cloudflareinsights.com',
  'https://cloudflareinsights.com',
  'https://pagead2.googlesyndication.com',
];

/**
 * 도구가 다루는 파일 형식의 첫머리. 그대로 실리거나 base64로 실리면 본문에 나타난다.
 * PDF(%PDF, JVBERi), PNG(IHDR, iVBORw0KGgo), JPG(JFIF·Exif, /9j/), GIF(GIF8, R0lGOD), OTF 글꼴(OTTO, T1RUTw)
 */
const FILE_MARKS = [
  '%PDF',
  'JVBERi',
  'IHDR',
  'iVBORw0KGgo',
  'JFIF',
  'Exif',
  '/9j/',
  'GIF8',
  'R0lGOD',
  'OTTO',
  'T1RUTw',
];

const fixturesDir = fileURLToPath(new URL('../fixtures/', import.meta.url));
const fixtures = readdirSync(fixturesDir).filter((name) => !name.endsWith('.py'));

/** 테스트 파일 이름 (확장자 포함, PDF는 확장자를 뗀 이름도). 어느 요청에도 나오면 안 된다. */
const fileNames = fixtures.flatMap((name) =>
  name.endsWith('.pdf') ? [name, name.replace(/\.pdf$/, '')] : [name],
);

/**
 * 테스트 파일 내용의 일부를 base64로 적은 것. 파일을 base64로 실어 보내면 이 중 하나가 나타난다.
 * base64는 3바이트씩 끊어 적으므로 시작 자리를 세 가지로 잡는다 (형식 표시가 짧은 BMP 등도 잡힌다).
 */
const contentMarks = fixtures.flatMap((name) => {
  const bytes = readFileSync(fixturesDir + name);
  const start = Math.min(64, Math.max(0, bytes.length - 33));
  return [0, 1, 2].map((shift) =>
    bytes.subarray(start + shift, start + shift + 30).toString('base64'),
  );
});

/** 견본 파일 주소 (/samples/<언어>/<이름>) */
const samplesDir = fileURLToPath(new URL('../../public/samples/', import.meta.url));
const SAMPLE_PATHS = new Set(
  readdirSync(samplesDir).flatMap((locale) =>
    readdirSync(samplesDir + locale).map((name) => `/samples/${locale}/${name}`),
  ),
);

/** 어느 요청의 주소·본문에도 나오면 안 되는 것 */
const MARKS = [...fileNames, ...FILE_MARKS, ...contentMarks];

/** 기록한 요청에 파일이 기기 밖으로 나갈 만한 것이 없는지 확인한다 */
export function expectLocalOnly(page: Page, requests: Request[], baseURL: string) {
  const origin = new URL(baseURL).origin;
  // 이번 테스트에서 연 우리 페이지 주소 (쿼리 없는 것만). 요청에 실린 페이지 주소는 파일 이름으로 보지 않는다
  const pages = requests
    .filter((request) => request.isNavigationRequest())
    .map((request) => new URL(request.url()))
    .filter((url) => url.origin === origin && url.search === '')
    .map((url) => decodeURIComponent(url.pathname))
    .filter((path) => path !== '/')
    // 긴 주소부터 지운다 (/guide/를 먼저 지우면 /guide/photos-to-pdf/가 남는다)
    .sort((a, b) => b.length - a.length);
  for (const request of requests) {
    const url = new URL(request.url());
    if (url.protocol === 'blob:' || url.protocol === 'data:') continue;

    // 본문뿐 아니라 주소(경로·쿼리)에 실어 보내는 것도 막는다
    const sent = `${decodeURIComponent(url.href)}\n${request.postData() ?? ''}`;
    const sample =
      url.origin === origin &&
      url.search === '' &&
      request.method() === 'GET' &&
      SAMPLE_PATHS.has(decodeURIComponent(url.pathname));
    // 요청이 많아 하나씩 expect로 대조하면 느리다. 찾은 것만 expect로 실패를 알린다
    const checked = pages.reduce((text, path) => text.replaceAll(path, '/'), sent);
    const found = sample ? undefined : MARKS.find((text) => checked.includes(text));
    if (found) expect(checked, request.url()).not.toContain(found);

    const fromOuterPage = request.frame() === page.mainFrame();
    if (fromOuterPage && OUTER_ORIGINS.includes(url.origin)) continue;

    expect(url.origin, request.url()).toBe(origin);
    expect(request.method(), request.url()).toBe('GET');
    expect(request.postData(), request.url()).toBeNull();
  }
}
