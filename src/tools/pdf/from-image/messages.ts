/** 이미지를 PDF로 도구 화면의 문구 (공통 문구는 src/frame/messages.ts) */
import type { Locale } from '../../../i18n/locales';

const ko = {
  choose: '이미지 파일 선택',
  hint: 'JPG·PNG·WebP 이미지를 여러 장 한 번에 고를 수 있습니다 · 파일은 이 기기를 떠나지 않습니다',
  summary: (count: number) => `이미지 ${count}장`,
  addFiles: '이미지 추가',
  sizeGroup: '쪽 크기',
  sizes: {
    a4: { label: 'A4', short: 'A4' },
    letter: { label: 'Letter', short: 'Letter' },
    fit: { label: '이미지에 맞춤', short: '맞춤' },
  },
  marginGroup: '여백',
  margins: {
    none: { label: '여백 없음', short: '여백 없음' },
    small: { label: '여백 있음', short: '여백 있음' },
  },
  bar: 'PDF 만들기',
  reading: '이미지를 읽는 중입니다…',
  needOne: 'PDF로 만들 이미지를 넣어 주세요.',
  ready: (count: number) =>
    `위에서부터 목록 순서대로 이미지 한 장이 한 쪽이 됩니다. (총 ${count}쪽)`,
  working: (done: number, total: number) => `만드는 중… ${done}/${total}`,
  workingShort: '만드는 중…',
  run: 'PDF 만들기',
  failed: 'PDF를 만들지 못했습니다. 열 수 없는 이미지가 있다면 빼고 다시 해 보세요.',
  list: 'PDF에 넣을 이미지 목록 (위에서부터 순서대로 넣습니다)',
  itemReading: '읽는 중…',
  broken: '열 수 없는 이미지입니다. 빼고 만듭니다.',
  up: (name: string) => `${name} 위로`,
  down: (name: string) => `${name} 아래로`,
  remove: (name: string) => `${name} 빼기`,
};

const en: typeof ko = {
  choose: 'Choose image files',
  hint: 'You can pick several JPG, PNG or WebP images at once · Your files never leave this device',
  summary: (count: number) => `${count} ${count === 1 ? 'image' : 'images'}`,
  addFiles: 'Add images',
  sizeGroup: 'Page size',
  sizes: {
    a4: { label: 'A4', short: 'A4' },
    letter: { label: 'Letter', short: 'Letter' },
    fit: { label: 'Fit to image', short: 'Fit' },
  },
  marginGroup: 'Margin',
  margins: {
    none: { label: 'No margin', short: 'No margin' },
    small: { label: 'Small margin', short: 'Small margin' },
  },
  bar: 'Create PDF',
  reading: 'Reading images…',
  needOne: 'Add the images you want to turn into a PDF.',
  ready: (count: number) =>
    `Each image becomes one page, in list order from the top. (${count} ${count === 1 ? 'page' : 'pages'} in total)`,
  working: (done: number, total: number) => `Creating… ${done}/${total}`,
  workingShort: 'Creating…',
  run: 'Create PDF',
  failed: 'Could not create the PDF. If an image could not be opened, remove it and try again.',
  list: 'Images to put in the PDF (added in order from the top)',
  itemReading: 'Reading…',
  broken: 'This image cannot be opened. It will be left out.',
  up: (name: string) => `Move ${name} up`,
  down: (name: string) => `Move ${name} down`,
  remove: (name: string) => `Remove ${name}`,
};

export const MESSAGES: Record<Locale, typeof ko> = { ko, en };
