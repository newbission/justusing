/** 머리말·꼬리말 도구 화면의 문구 (공통 문구는 src/frame/messages.ts) */
import type { Locale } from '../../../i18n/locales';
import type { Align } from '../../../lib/pdf/header-footer';

export type Size = 'small' | 'medium' | 'large';
export type Tint = 'gray' | 'black';

const ko = {
  bar: '머리말·꼬리말',
  header: '머리말 (쪽 위)',
  footer: '꼬리말 (쪽 아래)',
  headerPlaceholder: '예: 회사 이름 · 문서 제목',
  footerPlaceholder: '예: {쪽} / {전체}',
  alignGroup: (line: string) => `${line} 정렬`,
  aligns: { left: '왼쪽', center: '가운데', right: '오른쪽' } satisfies Record<Align, string>,
  tokens: '자리표시: {쪽} 쪽 번호, {전체} 전체 쪽 수, {날짜} 오늘 날짜',
  sizeGroup: '크기',
  sizes: { small: '작게', medium: '보통', large: '크게' } satisfies Record<Size, string>,
  tintGroup: '색',
  tints: { gray: '회색', black: '검정' } satisfies Record<Tint, string>,
  skipFirst: '첫 쪽(표지)에는 넣지 않기',
  preview: '미리보기입니다. 쪽을 넘기면 쪽 번호가 바뀌는 것을 볼 수 있습니다.',
  needText: '머리말이나 꼬리말을 적어 주세요.',
  needFont: '아래에서 글꼴을 받아 고르세요.',
  ready: (pages: number) => `모든 쪽(${pages}쪽)에 넣습니다.`,
  working: '넣는 중…',
  run: '머리말·꼬리말 넣기',
  missing: (chars: string) => `이 글꼴에 없는 글자가 있습니다: ${chars}. 다른 글꼴을 고르세요.`,
  failed: '넣지 못했습니다. 파일이 손상되었거나 기기의 메모리가 부족할 수 있습니다.',
  suffix: '머리말',
};

const en: typeof ko = {
  bar: 'Header and footer',
  header: 'Header (top of page)',
  footer: 'Footer (bottom of page)',
  headerPlaceholder: 'e.g. Company name · Document title',
  footerPlaceholder: 'e.g. {page} / {total}',
  alignGroup: (line: string) => `${line} alignment`,
  aligns: { left: 'Left', center: 'Center', right: 'Right' },
  tokens: 'Placeholders: {page} page number, {total} total pages, {date} today',
  sizeGroup: 'Size',
  sizes: { small: 'Small', medium: 'Medium', large: 'Large' },
  tintGroup: 'Color',
  tints: { gray: 'Gray', black: 'Black' },
  skipFirst: 'Skip the first page (cover)',
  preview: 'Preview. Flip through pages to see the page numbers change.',
  needText: 'Enter a header or a footer.',
  needFont: 'Download and choose a font below.',
  ready: (pages: number) => `Add to every page (${pages} ${pages === 1 ? 'page' : 'pages'}).`,
  working: 'Adding…',
  run: 'Add header and footer',
  missing: (chars: string) =>
    `This font does not have some characters: ${chars}. Choose another font.`,
  failed: 'Could not add them. The file may be damaged, or your device may be low on memory.',
  suffix: 'header',
};

export const MESSAGES: Record<Locale, typeof ko> = { ko, en };
