/** PDF 쪽 번호 넣기 도구 화면의 문구 (공통 문구는 src/frame/messages.ts) */
import type { Locale } from '../../../i18n/locales';

const ko = {
  positionGroup: '위치',
  positions: {
    'bottom-center': '아래 가운데',
    'bottom-right': '아래 오른쪽',
    'top-right': '위 오른쪽',
  },
  formatGroup: '모양',
  start: '시작 번호',
  badStart: '시작 번호는 1 이상의 숫자로 입력하세요.',
  bar: '쪽 번호 넣기',
  ready: (first: number, last: number) => `모든 쪽에 ${first}부터 ${last}까지 번호를 넣습니다.`,
  working: '넣는 중…',
  run: '쪽 번호 넣기',
  failed: '쪽 번호를 넣지 못했습니다. 파일이 손상되었을 수 있습니다.',
  /** 결과 파일 이름 뒤에 붙는 말 */
  suffix: '쪽번호',
  preview: '쪽 아래의 숫자가 그 쪽에 들어갈 번호입니다.',
};

const en: typeof ko = {
  positionGroup: 'Position',
  positions: {
    'bottom-center': 'Bottom center',
    'bottom-right': 'Bottom right',
    'top-right': 'Top right',
  },
  formatGroup: 'Style',
  start: 'Start at',
  badStart: 'Enter a starting number of 1 or more.',
  bar: 'Add page numbers',
  ready: (first: number, last: number) => `Numbers every page from ${first} to ${last}.`,
  working: 'Adding…',
  run: 'Add page numbers',
  failed: 'Could not add page numbers. The file may be damaged.',
  suffix: 'numbered',
  preview: 'The label under each page is the number it will get.',
};

export const MESSAGES: Record<Locale, typeof ko> = { ko, en };
