/** 이어 붙이기 도구 화면의 문구 (공통 문구는 src/frame/messages.ts) */
import type { Locale } from '../../../i18n/locales';
import type { Background, StitchFailure } from '../../../lib/image/stitch';
import type { Direction } from '../../../lib/image/stitch-layout';

export type Format = 'jpg' | 'png' | 'webp' | 'pdf';
export type SizeMode = 'narrow' | 'wide' | 'custom';

const ko = {
  bar: '이어 붙이기',
  hint: '화면 캡처나 사진을 여러 장 고르세요. 고른 순서대로 잇고, 목록에서 순서를 바꿀 수 있습니다 · 이미지는 이 기기를 떠나지 않습니다',
  directionGroup: '잇는 방향',
  directions: {
    vertical: '세로로 (위아래)',
    horizontal: '가로로 (옆으로)',
  } satisfies Record<Direction, string>,
  auto: '겹친 부분과 되풀이되는 위·아래 막대 자동으로 지우기',
  autoHelp:
    '화면을 내려 가며 찍은 캡처에서 찾습니다. 폭이 같은 사진끼리만 찾고, 찾은 값은 목록의 이음마다 고칠 수 있습니다.',
  sizeGroup: { vertical: '맞출 폭', horizontal: '맞출 높이' } satisfies Record<Direction, string>,
  sizes: {
    vertical: { narrow: '가장 좁은 사진', wide: '가장 넓은 사진', custom: '직접 입력' },
    horizontal: { narrow: '가장 낮은 사진', wide: '가장 높은 사진', custom: '직접 입력' },
  } satisfies Record<Direction, Record<SizeMode, string>>,
  customSize: { vertical: '폭 (px)', horizontal: '높이 (px)' } satisfies Record<Direction, string>,
  invalidSize: '크기를 1~20,000 px로 적어 주세요.',
  upscale: (count: number) => `사진 ${count}장을 늘려서 붙입니다. 늘린 사진은 흐려질 수 있습니다.`,
  gap: '사진 사이 간격 (px)',
  invalidGap: '간격을 0~500 px로 적어 주세요.',
  backgroundGroup: '바탕색',
  backgrounds: { white: '흰색', black: '검은색', transparent: '투명' } satisfies Record<
    Background,
    string
  >,
  formatGroup: '저장 형식',
  formats: { jpg: 'JPG', png: 'PNG', webp: 'WebP', pdf: 'PDF' } satisfies Record<Format, string>,
  formatHelp: {
    jpg: '용량이 작아 올리거나 보내기 좋습니다.',
    png: '글자가 또렷하고 화질 손실이 없습니다. 아주 긴 결과도 만들 수 있습니다.',
    webp: 'JPG보다 작지만 열지 못하는 프로그램이 있습니다.',
    pdf: 'A4 비율 쪽으로 나눠 PDF 하나로 만듭니다. 글 줄이 잘리지 않게 빈 줄에서 나눕니다.',
  } satisfies Record<Format, string>,
  split: '긴 결과를 나누어 저장',
  splitHeight: '한 장 높이 (px)',
  splitHelp: '글 줄이 잘리지 않게 정한 높이 안에서 빈 줄을 찾아 자릅니다.',
  invalidSplit: '한 장 높이를 100~30,000 px로 적어 주세요.',
  reading: '이미지를 읽는 중입니다…',
  detecting: '겹친 부분을 찾는 중입니다…',
  needTwo: '이을 이미지를 2장 이상 넣어 주세요.',
  badCut: '잘라 낼 높이가 사진보다 큽니다. 이음의 숫자를 줄여 주세요.',
  tooLong: (format: string, max: number) =>
    `결과가 ${format} 한 장에 담기에 너무 깁니다 (${max.toLocaleString()} px까지). PNG로 저장하거나 나누어 저장하세요.`,
  tooBig: '결과가 너무 큽니다. 폭을 줄이거나 나누어 저장하세요.',
  tooWide: (max: number, vertical: boolean) =>
    `결과 폭이 너무 넓습니다 (${max.toLocaleString()} px까지). ${vertical ? '맞출 폭' : '맞출 높이나 이미지 수'}를 줄여 주세요.`,
  ready: (width: number, height: number) =>
    `결과 ${width.toLocaleString()} × ${height.toLocaleString()} px`,
  working: '잇는 중…',
  run: '이어 붙이기',
  doneParts: (count: number, size: string) => `완료: ${count}장으로 나눴습니다 · 모두 ${size}`,
  downloadAll: (count: number) => `모두 받기 (ZIP, ${count}장)`,
  failed: {
    decode: '읽지 못한 이미지가 있습니다. 그 이미지를 빼고 다시 해 주세요.',
    tooLarge:
      '이 브라우저가 이렇게 큰 이미지를 만들지 못했습니다. PNG나 JPG로 저장하거나 나누어 저장해 보세요.',
    encode: '이 브라우저는 이 형식으로 저장하지 못합니다. 다른 형식을 골라 주세요.',
  } satisfies Record<StitchFailure, string>,
  pdfFailed: 'PDF를 만들지 못했습니다.',
  list: '이을 이미지 (위에서부터 잇는 순서)',
  itemSize: (width: number, height: number) => `${width} × ${height} px`,
  broken: '열 수 없는 이미지입니다. 빼고 잇습니다.',
  up: (name: string) => `${name} 위로`,
  down: (name: string) => `${name} 아래로`,
  remove: (name: string) => `${name} 빼기`,
  seam: (n: number) => `${n}번째와 ${n + 1}번째 사이`,
  seamBottom: '위 사진 아래',
  seamTop: '아래 사진 위',
  seamUnit: 'px 잘라 냄',
  seamFound: '겹친 부분을 찾았습니다',
  seamNone: '겹친 부분이 없습니다',
  seamWidth: '폭이 달라 찾지 않았습니다',
  seamManual: '직접 고쳤습니다',
  seamFinding: '찾는 중…',
  seamReset: '자동 값으로',
  preview: '미리보기',
  previewLabel: (width: number, height: number) =>
    `이은 결과 미리보기, ${width.toLocaleString()} × ${height.toLocaleString()} px`,
  /** 결과 파일 이름 뒤에 붙는 말 */
  suffix: '이어붙임',
};

const en: typeof ko = {
  bar: 'Stitch',
  hint: 'Pick several screenshots or photos. They are joined in the order you pick them, and you can change the order in the list · Your images never leave this device',
  directionGroup: 'Direction',
  directions: {
    vertical: 'Vertical (top to bottom)',
    horizontal: 'Horizontal (side by side)',
  },
  auto: 'Remove overlapping parts and repeated top and bottom bars automatically',
  autoHelp:
    'Works on screenshots taken while scrolling. Only images of the same width are checked, and you can change the values at each seam in the list.',
  sizeGroup: { vertical: 'Width', horizontal: 'Height' },
  sizes: {
    vertical: { narrow: 'Narrowest image', wide: 'Widest image', custom: 'Custom' },
    horizontal: { narrow: 'Shortest image', wide: 'Tallest image', custom: 'Custom' },
  },
  customSize: { vertical: 'Width (px)', horizontal: 'Height (px)' },
  invalidSize: 'Enter a size from 1 to 20,000 px.',
  upscale: (count: number) =>
    `${count} ${count === 1 ? 'image is' : 'images are'} enlarged to fit. Enlarged images may look blurry.`,
  gap: 'Gap between images (px)',
  invalidGap: 'Enter a gap from 0 to 500 px.',
  backgroundGroup: 'Background',
  backgrounds: { white: 'White', black: 'Black', transparent: 'Transparent' },
  formatGroup: 'Format',
  formats: { jpg: 'JPG', png: 'PNG', webp: 'WebP', pdf: 'PDF' },
  formatHelp: {
    jpg: 'Small files that are easy to upload or send.',
    png: 'Sharp text with no quality loss. Works even for very long results.',
    webp: 'Smaller than JPG, but some programs cannot open it.',
    pdf: 'Split into A4-shaped pages in one PDF, cut at blank lines so text is not cut in half.',
  },
  split: 'Split a long result into several images',
  splitHeight: 'Height of each image (px)',
  splitHelp: 'Cut at a blank line within this height so lines of text are not cut in half.',
  invalidSplit: 'Enter a height from 100 to 30,000 px.',
  reading: 'Reading images…',
  detecting: 'Looking for overlapping parts…',
  needTwo: 'Add at least 2 images to stitch.',
  badCut: 'More is cut off than an image has. Lower the numbers at the seams.',
  tooLong: (format: string, max: number) =>
    `The result is too long for one ${format} (up to ${max.toLocaleString()} px). Save as PNG or split it.`,
  tooBig: 'The result is too large. Use a smaller width or split it.',
  tooWide: (max: number, vertical: boolean) =>
    `The result is too wide (up to ${max.toLocaleString()} px). Use a smaller ${vertical ? 'width' : 'height or fewer images'}.`,
  ready: (width: number, height: number) =>
    `Result ${width.toLocaleString()} × ${height.toLocaleString()} px`,
  working: 'Stitching…',
  run: 'Stitch',
  doneParts: (count: number, size: string) => `Done: split into ${count} images · ${size} in total`,
  downloadAll: (count: number) => `Download all (ZIP, ${count})`,
  failed: {
    decode: 'An image could not be read. Remove it and try again.',
    tooLarge:
      'This browser could not make an image this large. Try saving as PNG or JPG, or splitting it.',
    encode: 'This browser cannot save in this format. Choose another format.',
  },
  pdfFailed: 'Could not make the PDF.',
  list: 'Images to stitch (in order from the top)',
  itemSize: (width: number, height: number) => `${width} × ${height} px`,
  broken: 'This image cannot be opened. It will be left out.',
  up: (name: string) => `Move ${name} up`,
  down: (name: string) => `Move ${name} down`,
  remove: (name: string) => `Remove ${name}`,
  seam: (n: number) => `Between image ${n} and ${n + 1}`,
  seamBottom: 'Bottom of upper image',
  seamTop: 'Top of lower image',
  seamUnit: 'px cut off',
  seamFound: 'Overlap found',
  seamNone: 'No overlap',
  seamWidth: 'Not checked: different widths',
  seamManual: 'Changed by you',
  seamFinding: 'Checking…',
  seamReset: 'Use automatic values',
  preview: 'Preview',
  previewLabel: (width: number, height: number) =>
    `Preview of the stitched result, ${width.toLocaleString()} × ${height.toLocaleString()} px`,
  suffix: 'stitched',
};

export const MESSAGES: Record<Locale, typeof ko> = { ko, en };
