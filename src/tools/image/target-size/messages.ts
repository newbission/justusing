/** 이미지 용량 맞추기 도구 화면의 문구 (공통 문구는 src/frame/messages.ts) */
import type { Locale } from '../../../i18n/locales';

/** resize: 필요하면 가로·세로도 줄인다, keep: 크기는 그대로 두고 화질만 낮춘다 */
export type Method = 'resize' | 'keep';
/** jpg: 모두 JPG로, same: 원래 형식 그대로 (PNG는 색 수를 줄인다) */
export type Format = 'jpg' | 'same';
export type Unit = 'KB' | 'MB';

const ko = {
  bar: '용량 맞추기',
  targetGroup: '목표 용량',
  custom: '직접 입력',
  customValue: '목표 용량 숫자',
  customUnit: '단위',
  methodGroup: '줄이는 방법',
  methods: {
    resize: { label: '필요하면 크기도 줄이기 (추천)', short: '크기도 줄임' },
    keep: { label: '크기는 그대로, 화질만', short: '화질만' },
  } satisfies Record<Method, { label: string; short: string }>,
  methodHelp: {
    resize: '화질을 먼저 낮추고(60%까지), 그래도 크면 가로·세로를 줄입니다.',
    keep: '가로·세로는 그대로 두고 화질만 낮춥니다. 목표가 작으면 많이 거칠어지거나 맞추지 못할 수 있습니다.',
  } satisfies Record<Method, string>,
  formatGroup: '저장 형식',
  formats: {
    jpg: { label: 'JPG로 저장 (추천)', short: 'JPG' },
    same: { label: '원래 형식 그대로', short: '그대로' },
  } satisfies Record<Format, { label: string; short: string }>,
  formatHelp: {
    jpg: 'JPG는 거의 모든 곳에서 받습니다. 투명한 곳은 흰색이 됩니다.',
    same: 'PNG는 색 수를 줄여 맞추고 투명을 지킵니다. 사진은 JPG가 훨씬 작습니다.',
  } satisfies Record<Format, string>,
  heicNote:
    'HEIC 사진은 받는 곳이 드물고 브라우저가 HEIC로 저장하지 못해, 이미 목표 이하여도 JPG로 바꿔 맞춥니다.',
  invalidTarget: '목표 용량을 10KB에서 50MB 사이로 적어 주세요.',
  reading: '이미지를 읽는 중입니다…',
  needOne: '용량을 맞출 이미지를 넣어 주세요.',
  ready: (count: number, target: string) => `이미지 ${count}장을 ${target} 이하로 맞춥니다.`,
  working: (done: number, total: number) => `맞추는 중… ${done}/${total}`,
  workingShort: '맞추는 중…',
  run: '용량 맞추기',
  done: (count: number, target: string) => `완료: ${count}장 모두 ${target} 이하입니다.`,
  allKept: (target: string) => `모두 이미 ${target} 이하라 원본 그대로 둡니다.`,
  overKeepSize:
    '화질만 낮춰서는 맞추지 못한 이미지가 있습니다. "필요하면 크기도 줄이기"를 골라 보세요.',
  overTooSmall: '목표가 너무 작아 맞추지 못한 이미지가 있습니다. 목표를 늘려 보세요.',
  failed: '처리하지 못한 이미지가 있습니다. 목록에서 확인하세요.',
  downloadAll: (count: number) => `모두 받기 (ZIP, ${count}장)`,
  zipName: (target: string) => `이미지_${target}.zip`,
  itemWorking: '맞추는 중…',
  quality: (percent: number) => `화질 ${percent}%`,
  colors: (count: number) => (count === 0 ? '색 그대로' : `${count}색`),
  sameSize: (size: string) => size,
  resized: (size: string) => `${size}(줄임)`,
  flattened: '투명한 곳은 흰색',
  itemKept: (size: string) => `${size} · 이미 목표 이하라 원본 그대로`,
  itemKeepSize: (smallest: string) => `맞추지 못함: 화질만으로는 ${smallest}까지`,
  itemTooSmall: (smallest: string) => `맞추지 못함: 목표가 너무 작음 (가장 작게 ${smallest})`,
  broken: '열 수 없는 이미지입니다. 빼고 맞춥니다.',
  noWebp: '이 브라우저는 WebP로 저장하지 못합니다. "JPG로 저장"을 골라 보세요.',
  saveFailed: '저장하지 못했습니다. 이미지가 너무 크면 메모리가 모자랄 수 있습니다.',
};

const en: typeof ko = {
  bar: 'Fit to size',
  targetGroup: 'Target size',
  custom: 'Custom',
  customValue: 'Target size number',
  customUnit: 'Unit',
  methodGroup: 'How to shrink',
  methods: {
    resize: { label: 'Also resize if needed (recommended)', short: 'Also resize' },
    keep: { label: 'Keep dimensions, lower quality only', short: 'Quality only' },
  },
  methodHelp: {
    resize: 'Quality is lowered first (down to 60%), then width and height if still too large.',
    keep: 'Width and height stay the same and only quality is lowered. Small targets may look rough or not fit.',
  },
  formatGroup: 'Save as',
  formats: {
    jpg: { label: 'Save as JPG (recommended)', short: 'JPG' },
    same: { label: 'Same format', short: 'Same' },
  },
  formatHelp: {
    jpg: 'JPG is accepted almost everywhere. Transparent areas become white.',
    same: 'PNGs fit by using fewer colors and keep transparency. Photos are much smaller as JPG.',
  },
  heicNote:
    'Few places accept HEIC and browsers cannot save it, so HEIC photos are converted to JPG even if they are already under the target.',
  invalidTarget: 'Enter a target between 10 KB and 50 MB.',
  reading: 'Reading images…',
  needOne: 'Add the images you want to fit.',
  ready: (count: number, target: string) =>
    `Fit ${count} ${count === 1 ? 'image' : 'images'} under ${target}.`,
  working: (done: number, total: number) => `Fitting… ${done}/${total}`,
  workingShort: 'Fitting…',
  run: 'Fit to size',
  done: (count: number, target: string) =>
    count === 1 ? `Done: the image is under ${target}.` : `Done: all ${count} are under ${target}.`,
  allKept: (target: string) => `Already under ${target}, so the originals are kept.`,
  overKeepSize: 'Some images could not fit by lowering quality alone. Try "Also resize if needed".',
  overTooSmall: 'Some images could not fit because the target is too small. Try a larger target.',
  failed: 'Some images could not be processed. Check the list.',
  downloadAll: (count: number) => `Download all (ZIP, ${count})`,
  zipName: (target: string) => `images-${target}.zip`,
  itemWorking: 'Fitting…',
  quality: (percent: number) => `quality ${percent}%`,
  colors: (count: number) => (count === 0 ? 'all colors' : `${count} colors`),
  sameSize: (size: string) => size,
  resized: (size: string) => `${size} (resized)`,
  flattened: 'transparent areas white',
  itemKept: (size: string) => `${size} · already under the target, kept as is`,
  itemKeepSize: (smallest: string) => `Did not fit: ${smallest} at lowest quality`,
  itemTooSmall: (smallest: string) => `Did not fit: target too small (smallest ${smallest})`,
  broken: 'This image cannot be opened. It will be left out.',
  noWebp: 'This browser cannot save WebP. Try "Save as JPG".',
  saveFailed: 'Could not save. Very large images may run out of memory.',
};

export const MESSAGES: Record<Locale, typeof ko> = { ko, en };
