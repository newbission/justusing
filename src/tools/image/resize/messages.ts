/** 이미지 크기 조절 도구 화면의 문구 (공통 문구는 src/frame/messages.ts) */
import type { Locale } from '../../../i18n/locales';

export type Mode = 'percent' | 'pixels';

const ko = {
  bar: '크기 조절',
  modeGroup: '크기를 정하는 방법',
  modes: {
    percent: { label: '비율로', short: '비율' },
    pixels: { label: '가로·세로 크기로', short: '크기' },
  } satisfies Record<Mode, { label: string; short: string }>,
  percent: '비율 (%)',
  width: '가로 (px)',
  height: '세로 (px)',
  keepRatio: '원래 비율 유지',
  help: {
    percent: '원래 크기에 대한 비율입니다. 50%면 가로·세로가 절반이 됩니다.',
    keep: '비율을 지키며 이 칸 안에 들어가게 맞춥니다. 한쪽만 적으면 그쪽에 맞춥니다.',
    exact: '적은 크기로 정확히 맞춥니다. 원래 비율과 다르면 이미지가 늘어나거나 눌립니다.',
  },
  heicNote: 'HEIC 사진은 브라우저가 HEIC로 저장하지 못해 JPG로 저장합니다.',
  invalidPercent: '비율은 1에서 400 사이로 적어 주세요.',
  needSize: '가로나 세로 크기를 적어 주세요.',
  needBoth: '비율을 유지하지 않으면 가로와 세로를 모두 적어야 합니다.',
  tooLarge: '결과가 너무 큽니다. 한 변 16384px, 전체 6400만 화소까지 만들 수 있습니다.',
  reading: '이미지를 읽는 중입니다…',
  needOne: '크기를 바꿀 이미지를 넣어 주세요.',
  ready: (count: number) => `이미지 ${count}장의 크기를 바꿉니다.`,
  working: (done: number, total: number) => `바꾸는 중… ${done}/${total}`,
  workingShort: '바꾸는 중…',
  run: '크기 바꾸기',
  done: (count: number) => `완료: 이미지 ${count}장`,
  failed: '바꾸지 못한 이미지가 있습니다. 목록에서 확인하세요.',
  downloadAll: (count: number) => `모두 받기 (ZIP, ${count}장)`,
  zipName: '이미지_크기조절.zip',
  itemPlan: (from: string, to: string, size: string) => `${from} → ${to} · ${size}`,
  itemWorking: '바꾸는 중…',
  itemDone: (to: string, size: string) => `완료: ${to} · ${size}`,
  itemFailed: '바꾸지 못했습니다. 기기의 메모리가 부족할 수 있습니다.',
};

const en: typeof ko = {
  bar: 'Resize',
  modeGroup: 'How to set the size',
  modes: {
    percent: { label: 'By percentage', short: 'Percent' },
    pixels: { label: 'By width and height', short: 'Pixels' },
  },
  percent: 'Percentage (%)',
  width: 'Width (px)',
  height: 'Height (px)',
  keepRatio: 'Keep aspect ratio',
  help: {
    percent: 'A percentage of the original size. 50% halves the width and height.',
    keep: 'Fits the image inside this box without stretching it. Fill in just one side to fit that side.',
    exact:
      'Makes the image exactly this size. If the shape differs from the original, the image is stretched or squeezed.',
  },
  heicNote: 'Browsers cannot save HEIC, so HEIC photos are saved as JPG.',
  invalidPercent: 'Enter a percentage from 1 to 400.',
  needSize: 'Enter a width or a height.',
  needBoth: 'Without keeping the aspect ratio, enter both the width and the height.',
  tooLarge:
    'The result is too large. Each side can be up to 16384 px, and up to 64 million pixels in total.',
  reading: 'Reading images…',
  needOne: 'Add the images you want to resize.',
  ready: (count: number) => `Resize ${count} ${count === 1 ? 'image' : 'images'}.`,
  working: (done: number, total: number) => `Resizing… ${done}/${total}`,
  workingShort: 'Resizing…',
  run: 'Resize images',
  done: (count: number) => `Done: ${count} ${count === 1 ? 'image' : 'images'}`,
  failed: 'Some images could not be resized. Check the list.',
  downloadAll: (count: number) => `Download all (ZIP, ${count})`,
  zipName: 'resized-images.zip',
  itemPlan: (from: string, to: string, size: string) => `${from} → ${to} · ${size}`,
  itemWorking: 'Resizing…',
  itemDone: (to: string, size: string) => `Done: ${to} · ${size}`,
  itemFailed: 'Could not resize. Your device may be low on memory.',
};

export const MESSAGES: Record<Locale, typeof ko> = { ko, en };
