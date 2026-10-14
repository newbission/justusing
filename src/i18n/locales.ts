/**
 * 사이트가 지원하는 언어와 주소 규칙. 언어를 더할 때 여기서 시작한다.
 *
 * 주소: 기본 언어(한국어)는 앞에 아무것도 붙이지 않고(/pdf/merge/), 다른 언어는 언어 코드를 붙인다(/en/pdf/merge/).
 * 페이지의 언어는 주소에서 정해진다 (localeOf).
 */

export const LOCALES = ['ko', 'en'] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = 'ko';

/** 사용자가 언어를 직접 고르면 저장하는 localStorage 키 (LocaleRedirect, LocaleSwitch) */
export const LOCALE_STORAGE_KEY = 'lang';

export const LOCALE_INFO: Record<Locale, { label: string; ogLocale: string }> = {
  ko: { label: '한국어', ogLocale: 'ko_KR' },
  en: { label: 'English', ogLocale: 'en_US' },
};

export function isLocale(value: string | undefined): value is Locale {
  return (LOCALES as readonly string[]).includes(value ?? '');
}

/** 주소에서 언어를 읽는다. '/en/pdf/' → 'en', '/pdf/' → 'ko' */
export function localeOf(pathname: string): Locale {
  const first = pathname.split('/')[1];
  return isLocale(first) && first !== DEFAULT_LOCALE ? first : DEFAULT_LOCALE;
}

/** 주소에서 언어 부분을 뗀다. '/en/pdf/' → '/pdf/', '/en/' → '/' */
export function withoutLocale(pathname: string): string {
  const locale = localeOf(pathname);
  if (locale === DEFAULT_LOCALE) return pathname;
  return pathname.slice(locale.length + 1) || '/';
}

/** 언어가 없는 주소를 그 언어의 주소로 바꾼다. ('/pdf/', 'en') → '/en/pdf/' */
export function localizePath(path: string, locale: Locale): string {
  return locale === DEFAULT_LOCALE ? path : `/${locale}${path}`;
}
