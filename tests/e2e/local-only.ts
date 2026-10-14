/**
 * "파일이 기기를 떠나지 않는다"는 약속을 확인하는 검사. 도구마다 같은 기준으로 본다.
 *
 * - 도구 frame(파일을 다루는 곳)의 요청: 우리 사이트로 가는 GET뿐이고 본문이 없어야 한다.
 * - 바깥 페이지의 요청: 위와 같거나, 방문 통계 주소로만 갈 수 있다.
 *   통계 요청의 주소와 본문에는 파일 이름도 PDF 내용도 없어야 한다.
 */
import { expect, type Page, type Request } from '@playwright/test';
import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/** 바깥 페이지가 연결해도 되는 방문 통계 주소 (src/components/Analytics.astro) */
const STATS_ORIGINS = ['https://static.cloudflareinsights.com', 'https://cloudflareinsights.com'];

/** PDF 파일의 첫머리. 그대로 실리거나(%PDF) base64로 실리면(JVBERi) 본문에 나타난다. */
const PDF_MARKS = ['%PDF', 'JVBERi'];

/** 테스트 파일 이름 (확장자 제외). 통계 요청에 나오면 안 된다. */
const fileNames = readdirSync(fileURLToPath(new URL('../fixtures/', import.meta.url)))
  .filter((name) => name.endsWith('.pdf'))
  .map((name) => name.replace(/\.pdf$/, ''));

/** 기록한 요청에 파일이 기기 밖으로 나갈 만한 것이 없는지 확인한다 */
export function expectLocalOnly(page: Page, requests: Request[], baseURL: string) {
  const origin = new URL(baseURL).origin;
  for (const request of requests) {
    const url = new URL(request.url());
    if (url.protocol === 'blob:' || url.protocol === 'data:') continue;

    const fromOuterPage = request.frame() === page.mainFrame();
    if (fromOuterPage && STATS_ORIGINS.includes(url.origin)) {
      // 본문뿐 아니라 주소(경로·쿼리)에 실어 보내는 것도 막는다
      const sent = `${decodeURIComponent(url.href)}\n${request.postData() ?? ''}`;
      for (const text of [...fileNames, ...PDF_MARKS]) {
        expect(sent, request.url()).not.toContain(text);
      }
      continue;
    }

    expect(url.origin, request.url()).toBe(origin);
    expect(request.method(), request.url()).toBe('GET');
    expect(request.postData(), request.url()).toBeNull();
  }
}
