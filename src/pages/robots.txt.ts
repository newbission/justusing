/**
 * 검색엔진 수집 규칙. 사이트맵 주소는 설정 파일의 도메인에서 만든다.
 */
import type { APIRoute } from 'astro';

export const GET: APIRoute = ({ site }) => {
  const body = `User-agent: *
Allow: /

Sitemap: ${new URL('/sitemap.xml', site)}
`;
  return new Response(body, { headers: { 'Content-Type': 'text/plain' } });
};
