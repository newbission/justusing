/** 이미지 압축 도구 화면의 문구 (공통 문구는 src/frame/messages.ts) */
import type { Locale } from '../../../i18n/locales';

export type Level = 'light' | 'balanced' | 'strong';
export type Format = 'same' | 'webp';

const ko = {
  bar: '압축',
  levelGroup: '줄이는 정도',
  levels: {
    light: { label: '조금 (화질 우선)', short: '조금' },
    balanced: { label: '보통 (추천)', short: '보통' },
    strong: { label: '많이 (용량 우선)', short: '많이' },
  } satisfies Record<Level, { label: string; short: string }>,
  levelHelp: {
    light: '눈으로 거의 차이가 없게 조금만 줄입니다.',
    balanced: '웹에 올리거나 메신저·메일로 보내기에 알맞게 줄입니다.',
    strong: '화질을 낮춰 가장 작게 만듭니다. 확대하면 거칠어 보일 수 있습니다.',
  } satisfies Record<Level, string>,
  formatGroup: '저장 형식',
  formats: {
    same: { label: '원래 형식 그대로', short: '그대로' },
    webp: { label: 'WebP로 바꾸기 (더 작음)', short: 'WebP' },
  } satisfies Record<Format, { label: string; short: string }>,
  note: '가로·세로 크기는 그대로 둡니다. 크기까지 줄이려면 "이미지 크기 조절"을 쓰세요.',
  reading: '이미지를 읽는 중입니다…',
  needOne: '줄일 이미지를 넣어 주세요.',
  ready: (count: number) => `이미지 ${count}장을 줄입니다.`,
  working: (done: number, total: number) => `줄이는 중… ${done}/${total}`,
  workingShort: '줄이는 중…',
  run: '압축하기',
  done: (before: string, after: string, percent: number) =>
    `완료: ${before} → ${after} (${percent}% 줄어듦)`,
  noGain: '더 줄일 수 없었습니다. 이미 작게 저장된 이미지입니다.',
  failed: '줄이지 못한 이미지가 있습니다. 목록에서 확인하세요.',
  downloadAll: (count: number) => `모두 받기 (ZIP, ${count}장)`,
  zipName: '이미지_압축.zip',
  itemWorking: '줄이는 중…',
  itemDone: (before: string, after: string, percent: number) =>
    `${before} → ${after} (${percent}% 줄어듦)`,
  itemKept: (size: string) => `${size} · 이미 작아서 원본 그대로`,
  broken: '열 수 없는 이미지입니다. 빼고 줄입니다.',
  noWebp: '이 브라우저는 WebP로 저장하지 못합니다. "원래 형식 그대로"로 해 보세요.',
  /** 결과 파일 이름 뒤에 붙는 말 */
  suffix: '압축',
};

const en: typeof ko = {
  bar: 'Compress',
  levelGroup: 'How much to shrink',
  levels: {
    light: { label: 'Less (better quality)', short: 'Less' },
    balanced: { label: 'Balanced (recommended)', short: 'Balanced' },
    strong: { label: 'More (smaller file)', short: 'More' },
  },
  levelHelp: {
    light: 'Shrinks a little, with almost no visible difference.',
    balanced: 'Good for posting on the web or sending by chat or email.',
    strong: 'Lowers quality for the smallest file. It may look rough when zoomed in.',
  },
  formatGroup: 'Save as',
  formats: {
    same: { label: 'Same format', short: 'Same' },
    webp: { label: 'Convert to WebP (smaller)', short: 'WebP' },
  },
  note: 'Width and height stay the same. To make the image smaller in pixels too, use "Resize image".',
  reading: 'Reading images…',
  needOne: 'Add the images you want to compress.',
  ready: (count: number) => `Compress ${count} ${count === 1 ? 'image' : 'images'}.`,
  working: (done: number, total: number) => `Compressing… ${done}/${total}`,
  workingShort: 'Compressing…',
  run: 'Compress images',
  done: (before: string, after: string, percent: number) =>
    `Done: ${before} → ${after} (${percent}% smaller)`,
  noGain: 'Could not make them smaller. The images are already compact.',
  failed: 'Some images could not be compressed. Check the list.',
  downloadAll: (count: number) => `Download all (ZIP, ${count})`,
  zipName: 'compressed-images.zip',
  itemWorking: 'Compressing…',
  itemDone: (before: string, after: string, percent: number) =>
    `${before} → ${after} (${percent}% smaller)`,
  itemKept: (size: string) => `${size} · already compact, kept as is`,
  broken: 'This image cannot be opened. It will be left out.',
  noWebp: 'This browser cannot save WebP. Try "Same format".',
  suffix: 'compressed',
};

export const MESSAGES: Record<Locale, typeof ko> = { ko, en };
