/** PDF 자르기 도구 화면의 문구 (공통 문구는 src/frame/messages.ts) */
import type { Locale } from '../../../i18n/locales';

const ko = {
  bar: '자르기',
  ready: (pages: number) =>
    pages === 1 ? '이 쪽의 밝은 영역만 남깁니다.' : `${pages}쪽 모두 같은 영역만 남깁니다.`,
  working: '자르는 중…',
  run: 'PDF 자르기',
  failed: '자르지 못했습니다. 파일이 손상되었을 수 있습니다.',
  /** 결과 파일 이름 뒤에 붙는 말 */
  suffix: '자름',
  scopeGroup: '자를 쪽',
  scopes: { page: '이 쪽만', all: '모든 쪽' },
  reset: '처음대로',
  note: '잘라 낸 부분은 보이지 않을 뿐 파일 안에 남아 있습니다. 개인정보를 지우는 용도로는 쓰지 마세요.',
};

const en: typeof ko = {
  bar: 'Crop',
  ready: (pages: number) =>
    pages === 1
      ? 'Keeps only the bright area of this page.'
      : `Keeps the same area on all ${pages} pages.`,
  working: 'Cropping…',
  run: 'Crop PDF',
  failed: 'Could not crop. The file may be damaged.',
  suffix: 'cropped',
  scopeGroup: 'Pages',
  scopes: { page: 'This page', all: 'All pages' },
  reset: 'Reset',
  note: 'The cropped-out parts are only hidden and remain in the file. Do not use this to remove personal information.',
};

export const MESSAGES: Record<Locale, typeof ko> = { ko, en };
