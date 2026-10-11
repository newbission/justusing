/**
 * 사이트 전체 설정의 유일한 출처.
 * 사이트명·도메인·설명 문구는 이 파일에만 둔다. 다른 곳에 하드코딩하지 않는다.
 */
export const siteConfig = {
  name: 'justusing',
  domain: 'justus.ing',
  description: '파일을 업로드하지 않고 브라우저 안에서 바로 처리하는 무료 도구 모음',
  defaultLocale: 'ko',
} as const;

export const siteUrl = `https://${siteConfig.domain}`;
