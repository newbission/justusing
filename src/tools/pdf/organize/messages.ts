/** PDF 페이지 정리 도구 화면의 문구 (공통 문구는 src/frame/messages.ts) */
import type { Locale } from '../../../i18n/locales';

const ko = {
  bar: '페이지 정리',
  /** 결과 파일 이름 뒤에 붙는 말 */
  suffix: '정리',
  noneKept: '남길 쪽이 하나도 없습니다.',
  unchanged: '바꾼 내용이 없습니다.',
  failed: '정리하지 못했습니다. 파일이 손상되었을 수 있습니다.',
  working: '정리하는 중…',
  willMake: (count: number) => `${count}쪽짜리 PDF를 만듭니다.`,
  run: 'PDF 정리',
  summary: (total: number, kept: number, reordered: boolean) =>
    `${total}쪽 중 ${kept}쪽 남김${reordered ? ' · 순서 바뀜' : ''}`,
  hint: '쪽을 끌거나 ◀ ▶로 순서를 바꾸고, 필요 없는 쪽은 "제외"하세요.',
};

const en: typeof ko = {
  bar: 'Organize pages',
  suffix: 'organized',
  noneKept: 'All pages are excluded. Keep at least one page.',
  unchanged: 'Nothing has been changed.',
  failed: 'Could not organize. The file may be damaged.',
  working: 'Organizing…',
  willMake: (count: number) => `Creates a ${count}-page PDF.`,
  run: 'Organize PDF',
  summary: (total: number, kept: number, reordered: boolean) =>
    `Keeping ${kept} of ${total} ${total === 1 ? 'page' : 'pages'}${reordered ? ' · reordered' : ''}`,
  hint: 'Drag pages or use ◀ ▶ to reorder them, and "Exclude" the pages you do not need.',
};

export const MESSAGES: Record<Locale, typeof ko> = { ko, en };
