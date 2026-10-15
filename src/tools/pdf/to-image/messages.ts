/** PDF를 이미지로 도구 화면의 문구 (공통 문구는 src/frame/messages.ts) */
import type { Locale } from '../../../i18n/locales';

const ko = {
  modes: {
    all: { label: '전체 추출', short: '전체' },
    select: { label: '선택 추출', short: '선택' },
  },
  modeGroup: '추출할 쪽',
  formatGroup: '이미지 형식',
  formatHelp: 'JPG는 용량이 작고, PNG는 글자가 더 선명하지만 용량이 큽니다.',
  qualityGroup: '화질',
  qualities: {
    standard: { label: '보통 (150 DPI)', short: '보통' },
    high: { label: '고화질 (300 DPI)', short: '고화질' },
  },
  allHelp: (total: number) => `모든 쪽(${total}쪽)을 이미지로 만듭니다.`,
  selectHelp: (count: number) => `이미지로 만들 쪽을 누르세요. (${count}쪽 고름)`,
  pickPages: '이미지로 만들 쪽을 눌러 고르세요.',
  selectAll: '전체 선택',
  selectNone: '선택 해제',
  bar: '변환',
  working: (done: number, total: number) => `변환하는 중… ${done}/${total}`,
  workingShort: '변환하는 중…',
  run: '이미지로 변환',
  oneFile: '이미지 1장을 만듭니다.',
  manyFiles: (count: number) => `이미지 ${count}장을 만듭니다. ZIP 하나로 받습니다.`,
  failed: '변환하지 못했습니다. 파일이 손상되었거나 기기의 메모리가 부족할 수 있습니다.',
  /** 여러 장일 때 ZIP 파일 이름 뒤에 붙는 말 */
  zipSuffix: '이미지',
};

const en: typeof ko = {
  modes: {
    all: { label: 'Extract all', short: 'All' },
    select: { label: 'Extract selected', short: 'Selected' },
  },
  modeGroup: 'Pages to extract',
  formatGroup: 'Image format',
  formatHelp: 'JPG files are smaller. PNG keeps text sharper but the files are larger.',
  qualityGroup: 'Quality',
  qualities: {
    standard: { label: 'Standard (150 DPI)', short: 'Standard' },
    high: { label: 'High (300 DPI)', short: 'High' },
  },
  allHelp: (total: number) =>
    `Turns every page into an image (${total} ${total === 1 ? 'page' : 'pages'}).`,
  selectHelp: (count: number) => `Click the pages you want as images. (${count} selected)`,
  pickPages: 'Click the pages you want as images.',
  selectAll: 'Select all',
  selectNone: 'Clear selection',
  bar: 'Convert',
  working: (done: number, total: number) => `Converting… ${done}/${total}`,
  workingShort: 'Converting…',
  run: 'Convert to images',
  oneFile: 'Creates 1 image.',
  manyFiles: (count: number) => `Creates ${count} images, downloaded as one ZIP.`,
  failed: 'Could not convert. The file may be damaged, or your device may be low on memory.',
  zipSuffix: 'images',
};

export const MESSAGES: Record<Locale, typeof ko> = { ko, en };
