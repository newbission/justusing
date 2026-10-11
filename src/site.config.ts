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
  /** 슬롯마다 어느 업체의 어느 광고 단위를 넣을지. 비워 둔 슬롯은 표시하지 않는다. */
  slots: Partial<Record<AdSlotId, { provider: AdProvider; unit: string }>>;
}

const ads: AdsConfig = {
  enabled: false,
  slots: {},
};

export const siteConfig = {
  name: 'justusing',
  domain: 'justus.ing',
  description: '파일을 업로드하지 않고 브라우저 안에서 바로 처리하는 무료 도구 모음',
  defaultLocale: 'ko',
  ads,
} as const;

export const siteUrl = `https://${siteConfig.domain}`;
