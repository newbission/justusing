/**
 * 사이트 전체 설정의 유일한 출처.
 * 사이트명·도메인·설명 문구는 이 파일에만 둔다. 다른 곳에 하드코딩하지 않는다.
 */
import type { AdSlotId } from './ads/slots';

/** 광고 업체. 새 업체를 붙일 때 여기에 추가한다. */
export type AdProvider = 'adsense' | 'adfit';

interface AdsConfig {
  /** 전체 광고 스위치. false면 광고 스크립트도, 광고 칸도, 광고 차단 안내도 없다. */
  enabled: boolean;
  /** Google AdSense 게시자 ID (ca-pub-...). 소유 확인 태그와 ads.txt에 쓴다. 공개되는 값이다. */
  adsenseClient: string;
  /** 광고 차단 프로그램을 쓰는 방문자에게 꺼 달라는 안내 창을 띄울지 (enabled가 켜져 있을 때만) */
  adblockNotice: boolean;
  /** 슬롯마다 어느 업체의 어느 광고 단위를 넣을지. 비워 둔 슬롯은 표시하지 않는다. */
  slots: Partial<Record<AdSlotId, { provider: AdProvider; unit: string }>>;
}

const ads: AdsConfig = {
  // 심사 중이라 광고 칸(slots)은 아직 비어 있다. 스크립트만 동작한다.
  // 광고 차단 안내는 심사 중에 끈다: 페이지를 열자마자 뜨는 창이 '과도한 팝업'으로 보일 수 있다 (2026-10-18)
  enabled: true,
  adsenseClient: 'ca-pub-9856578903331156',
  adblockNotice: false,
  slots: {},
};

export const siteConfig = {
  name: 'justusing',
  domain: 'justus.ing',
  /** 공개 소스 코드 저장소. 방문자가 파일을 어떻게 다루는지 직접 확인할 수 있게 알린다 */
  sourceUrl: 'https://github.com/newbission/justusing',
  /** 언어별 사이트 설명(검색 결과·홈)과 홈 화면 큰 제목. 언어 목록은 src/i18n/locales.ts */
  text: {
    ko: {
      description: '파일을 업로드하지 않고 브라우저 안에서 바로 처리하는 무료 도구 모음',
      tagline: '업로드 없이, 브라우저에서 바로 쓰는 파일 도구',
    },
    en: {
      description: 'Free file tools that work right in your browser, without uploading your files',
      tagline: 'File tools that run in your browser, no uploads',
    },
  },
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
