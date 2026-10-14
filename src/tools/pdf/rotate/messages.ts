/** PDF 회전 도구 화면의 문구 (공통 문구는 src/frame/messages.ts) */
import type { Locale } from '../../../i18n/locales';

const ko = {
  bar: '회전',
  /** 결과 파일 이름 뒤에 붙는 말 */
  suffix: '회전',
  failed: '돌리지 못했습니다. 파일이 손상되었을 수 있습니다.',
  working: '돌리는 중…',
  nothing: '돌린 쪽이 없습니다.',
  willMake: (count: number) => `${count}쪽을 돌린 PDF를 만듭니다.`,
  run: 'PDF 회전',
  allGroup: '모든 쪽',
  turned: (count: number) => `${count}쪽을 돌렸습니다.`,
  hint: '돌릴 쪽의 ↺ ↻를 누르세요.',
  allLeft: '전체 ↺',
  allRight: '전체 ↻',
  grid: '쪽',
  left: (page: number) => `${page}쪽 왼쪽으로 돌리기`,
  right: (page: number) => `${page}쪽 오른쪽으로 돌리기`,
};

const en: typeof ko = {
  bar: 'Rotate',
  suffix: 'rotated',
  failed: 'Could not rotate. The file may be damaged.',
  working: 'Rotating…',
  nothing: 'No pages have been rotated.',
  willMake: (count: number) =>
    `Makes a PDF with ${count} rotated ${count === 1 ? 'page' : 'pages'}.`,
  run: 'Rotate PDF',
  allGroup: 'All pages',
  turned: (count: number) => `${count} ${count === 1 ? 'page' : 'pages'} rotated.`,
  hint: 'Click ↺ ↻ on the pages you want to rotate.',
  allLeft: 'All ↺',
  allRight: 'All ↻',
  grid: 'Pages',
  left: (page: number) => `Rotate page ${page} left`,
  right: (page: number) => `Rotate page ${page} right`,
};

export const MESSAGES: Record<Locale, typeof ko> = { ko, en };
