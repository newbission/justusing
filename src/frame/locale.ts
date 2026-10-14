/**
 * 도구 화면(격리 frame) 안의 언어. frame 문서의 <html lang>을 읽는다 (FrameLayout이 주소에서 정해 넣는다).
 * frame은 바깥 페이지와 출처가 달라 바깥의 주소나 저장값을 볼 수 없으므로 자기 문서에서 읽는다.
 */
import { DEFAULT_LOCALE, isLocale, type Locale } from '../i18n/locales';

export const frameLocale: Locale = (() => {
  const lang = typeof document === 'undefined' ? undefined : document.documentElement.lang;
  return isLocale(lang) ? lang : DEFAULT_LOCALE;
})();

/** 언어별 문구 모음에서 지금 frame 언어의 것을 고른다 */
export function pick<T>(messages: Record<Locale, T>): T {
  return messages[frameLocale];
}
