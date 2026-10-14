/** PDF 나누기 도구 화면의 문구 (공통 문구는 src/frame/messages.ts) */
import type { Locale } from '../../../i18n/locales';

const ko = {
  modes: {
    range: { label: '범위로 나누기', short: '범위' },
    each: { label: '한 장씩 나누기', short: '한 장씩' },
    select: { label: '고른 페이지만', short: '고른 쪽' },
  },
  pickPages: '뽑을 페이지를 눌러 고르세요.',
  /** 결과 파일 이름 뒤에 붙는 말 */
  selectedSuffix: '발췌',
  zipSuffix: '나눔',
  failed: '나누지 못했습니다. 파일이 손상되었을 수 있습니다.',
  fileNote: (files: string) => `파일 ${files}`,
  bar: '나누기',
  working: (done: number, total: number) => `나누는 중… ${done}/${total}`,
  oneFile: (pages: number) => `파일 1개(${pages}쪽)로 만듭니다.`,
  manyFiles: (count: number) => `파일 ${count}개로 나눕니다. ZIP 하나로 받습니다.`,
  workingShort: '나누는 중…',
  run: 'PDF 나누기',
  modeGroup: '나누는 방법',
  rangeLabel: '나눌 범위',
  rangePlaceholder: '예: 1-3, 4-6, 7',
  rangeHelp: '쉼표로 구분한 범위마다 파일 하나가 됩니다. 1-3은 1~3쪽, 5-는 5쪽부터 끝까지입니다.',
  eachHelp: (count: number) => `모든 쪽을 한 장씩, ${count}개 파일로 나눕니다.`,
  selectHelp: (count: number) =>
    `뽑을 페이지를 누르세요. 고른 페이지가 파일 하나로 나옵니다. (${count}쪽 고름)`,
  selectAll: '전체 선택',
  selectNone: '선택 해제',
};

const en: typeof ko = {
  modes: {
    range: { label: 'Split by range', short: 'Range' },
    each: { label: 'Split every page', short: 'Each page' },
    select: { label: 'Selected pages only', short: 'Selected' },
  },
  pickPages: 'Click the pages you want to extract.',
  selectedSuffix: 'extracted',
  zipSuffix: 'split',
  failed: 'Could not split. The file may be damaged.',
  fileNote: (files: string) => `${files.includes('·') ? 'Files' : 'File'} ${files}`,
  bar: 'Split',
  working: (done: number, total: number) => `Splitting… ${done}/${total}`,
  oneFile: (pages: number) => `Creates 1 file (${pages} ${pages === 1 ? 'page' : 'pages'}).`,
  manyFiles: (count: number) => `Splits into ${count} files, downloaded as one ZIP.`,
  workingShort: 'Splitting…',
  run: 'Split PDF',
  modeGroup: 'How to split',
  rangeLabel: 'Page ranges',
  rangePlaceholder: 'Example: 1-3, 4-6, 7',
  rangeHelp:
    'Each comma-separated range becomes one file. 1-3 means pages 1 to 3, and 5- means page 5 to the end.',
  eachHelp: (count: number) => `Splits every page into its own file, ${count} files in total.`,
  selectHelp: (count: number) =>
    `Click the pages you want. The selected pages become one file. (${count} selected)`,
  selectAll: 'Select all',
  selectNone: 'Clear selection',
};

export const MESSAGES: Record<Locale, typeof ko> = { ko, en };
