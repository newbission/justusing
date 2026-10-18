/**
 * "파일이 기기를 떠나지 않는다"는 약속을 확인하는 검사. 도구마다 같은 기준으로 본다.
 * 모든 E2E가 끝날 때 `test.ts`가 저절로 부른다.
 *
 * - 도구 frame(파일을 다루는 곳)의 요청: 우리 사이트로 가는 GET뿐이고 본문이 없어야 한다.
 * - 바깥 페이지의 요청: 위와 같거나, 방문 통계·광고 주소로만 갈 수 있다.
 *   그 요청의 주소와 본문에는 테스트 파일의 이름도, 파일 형식의 첫머리(PDF·이미지·글꼴)도,
 *   테스트 파일 내용의 일부(base64)도 없어야 한다.
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

/** 테스트 파일 이름 (확장자 포함, PDF는 확장자를 뗀 이름도). 통계 요청에 나오면 안 된다. */
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

/** 기록한 요청에 파일이 기기 밖으로 나갈 만한 것이 없는지 확인한다 */
export function expectLocalOnly(page: Page, requests: Request[], baseURL: string) {
  const origin = new URL(baseURL).origin;
  for (const request of requests) {
    const url = new URL(request.url());
    if (url.protocol === 'blob:' || url.protocol === 'data:') continue;

    const fromOuterPage = request.frame() === page.mainFrame();
    if (fromOuterPage && OUTER_ORIGINS.includes(url.origin)) {
      // 본문뿐 아니라 주소(경로·쿼리)에 실어 보내는 것도 막는다
      const sent = `${decodeURIComponent(url.href)}\n${request.postData() ?? ''}`;
      for (const text of [...fileNames, ...FILE_MARKS, ...contentMarks]) {
        expect(sent, request.url()).not.toContain(text);
      }
      continue;
    }

    expect(url.origin, request.url()).toBe(origin);
    expect(request.method(), request.url()).toBe('GET');
    expect(request.postData(), request.url()).toBeNull();
  }
}
