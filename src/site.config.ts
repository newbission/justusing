/**
 * 사이트 전체 설정의 유일한 출처.
 * 사이트명·도메인·설명 문구는 이 파일에만 둔다. 다른 곳에 하드코딩하지 않는다.
 */
import type { AdSlotId } from './ads/slots';

/** 광고 업체. 새 업체를 붙일 때 여기에 추가한다. */
export type AdProvider = 'adsense' | 'adfit';

interface AdsConfig {
  /** 전체 광고 스위치. false면 배포 화면에 광고 칸이 아예 없다. */
  enabled: boolean;
  /** Google AdSense 게시자 ID (ca-pub-...). 소유 확인 태그와 ads.txt에 쓴다. 공개되는 값이다. */
  adsenseClient: string;
  /** 슬롯마다 어느 업체의 어느 광고 단위를 넣을지. 비워 둔 슬롯은 표시하지 않는다. */
  slots: Partial<Record<AdSlotId, { provider: AdProvider; unit: string }>>;
}

const ads: AdsConfig = {
  enabled: false,
  adsenseClient: 'ca-pub-9856578903331156',
  slots: {},
};

export const siteConfig = {
  name: 'justusing',
  domain: 'justus.ing',
  description: '파일을 업로드하지 않고 브라우저 안에서 바로 처리하는 무료 도구 모음',
  /** 홈 화면 큰 제목 */
  tagline: '업로드 없이, 브라우저에서 바로 쓰는 파일 도구',
  defaultLocale: 'ko',
  /** 검색엔진 소유 확인 값. 각 검색엔진의 관리 도구가 준 값을 넣는다 (공개되어도 되는 값). */
  verification: {
    naver: '37f0ce40d90c9d229800904890a112583730cd65',
  },
  /** 방문 통계. 바깥 페이지에만 넣는다 (도구 frame에는 넣지 않는다). */
  analytics: {
    /** Cloudflare Web Analytics 토큰 (쿠키 없음). 페이지에 그대로 드러나는 공개 값이다. */
    cloudflareToken: '00d62d9abb124669a3c087f2843064ad',
  },
  ads,
} as const;

export const siteUrl = `https://${siteConfig.domain}`;

/** 문의 메일 주소. Cloudflare Email Routing이 운영자 메일함으로 넘겨 준다. */
export const contactEmail = `contact@${siteConfig.domain}`;
