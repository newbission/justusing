/**
 * 광고 판매자 목록 (ads.txt). 이 사이트의 광고를 팔 수 있는 업체를 광고주에게 알린다.
 * 게시자 ID는 설정 파일에서 가져온다.
 */
import type { APIRoute } from 'astro';
import { siteConfig } from '../site.config';

export const GET: APIRoute = () => {
  // AdSense는 'ca-pub-' 없이 'pub-...'로 적는다. 마지막 값은 Google의 고정 인증 ID.
  const publisher = siteConfig.ads.adsenseClient.replace(/^ca-/, '');
  const body = `google.com, ${publisher}, DIRECT, f08c47fec0942fa0\n`;
  return new Response(body, { headers: { 'Content-Type': 'text/plain' } });
};
