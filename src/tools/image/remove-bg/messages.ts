/** 배경 지우기 도구 화면의 문구 (공통 문구는 src/frame/messages.ts) */
import type { Locale } from '../../../i18n/locales';

const ko = {
  choose: '사진 선택',
  hint: '사람·상품·동물이 나온 사진 한 장. 사진은 이 기기 밖으로 나가지 않습니다.',
  cannotOpen: '이 사진을 열 수 없습니다. JPG·PNG 사진으로 다시 해 보세요.',
  opening: '사진을 여는 중…',
  otherFile: '다른 사진',
  bar: '배경 지우기',

  dataTitle: '배경 지우기 데이터',
  dataSize: (size: string) =>
    `물체와 배경을 나누려면 처음 한 번 ${size}를 받습니다 (인식 엔진과 물체 나누기 모델).`,
  dataShared: '증명사진 도구에서 받아 둔 인식 엔진을 함께 써서 모델만 받습니다.',
  dataNote:
    '받은 데이터는 이 브라우저에만 보관되어 다음부터 바로 씁니다. 사진은 받는 데이터와 함께 오가지 않고 이 기기 안에서만 나눕니다.',
  dataRemoved: '전에 받은 데이터가 브라우저에서 지워졌습니다. 다시 받아 주세요.',
  lowSpace: '브라우저 저장 공간이 부족해 보관하지 못할 수 있습니다.',
  getData: (size: string) => `데이터 받기 (${size})`,
  downloading: (percent: number) => `데이터 받는 중 ${percent}%`,
  dataFailed: '데이터를 받지 못했습니다. 인터넷 연결을 확인하고 다시 받아 주세요.',
  checking: '데이터를 확인하는 중…',

  needData: '배경을 지우려면 먼저 데이터를 받아 주세요.',
  separating: '물체와 배경을 나누는 중…',
  separatedCenter: '사진 가운데의 물체를 남겼습니다. 다른 물체를 남기려면 그곳을 누르세요.',
  separated: (count: number) => `누른 곳 ${count}곳의 물체를 남겼습니다.`,
  empty: '남길 물체를 찾지 못했습니다. 사진에서 남길 곳을 눌러 주세요.',
  separateFailed: '물체를 나누지 못했습니다. 기기의 메모리가 부족할 수 있습니다.',
  retry: '다시 해 보기',
  saving: '저장하는 중…',
  saved: (pixels: string, format: string, size: string) =>
    `${pixels} ${format} ${size}를 만들었습니다.`,
  failed: {
    decode: '사진을 다시 열어 주세요. 기기의 메모리가 부족했을 수 있습니다.',
    tooLarge: '사진이 너무 커서 이 브라우저에서 저장하지 못했습니다. 크기를 줄여 다시 해 보세요.',
    encode: '이 브라우저는 이 형식으로 저장하지 못합니다.',
    empty: '남은 곳이 없습니다. 남길 곳을 누르거나 "되살리기"로 칠해 주세요.',
  },
  download: (format: string) => `${format} 다운로드`,

  preview: '결과 미리보기',
  previewHelp:
    '체크무늬가 지워진 곳입니다. 사진을 누르거나, 누른 뒤 방향키로 자리를 옮기고 Enter 키로 고릅니다. Ctrl+Z로 되돌립니다.',
  showOriginal: '원본 보기',
  point: (index: number) => `남길 곳 ${index}`,

  toolTitle: '남길 곳 고치기',
  toolGroup: '누르면 할 일',
  tools: { pick: '물체 고르기', erase: '지우개', restore: '되살리기' },
  toolHelp: {
    pick: '누른 곳의 물체를 남깁니다. 여러 물체를 남기려면 하나씩 누르세요.',
    erase: '칠한 곳을 지웁니다. 남은 배경 조각을 지울 때 씁니다.',
    restore: '칠한 곳을 원본대로 되살립니다. 잘려 나간 부분을 채울 때 씁니다.',
  },
  brushSize: '붓 크기',
  undo: '되돌리기',
  restart: '처음부터',
  count: (points: number, strokes: number) =>
    strokes === 0 ? `남길 곳 ${points}곳` : `남길 곳 ${points}곳, 붓질 ${strokes}번`,

  edgeTitle: '가장자리',
  shift: '좁히기 · 넓히기',
  shiftValue: (value: number) => (value === 0 ? '그대로' : value > 0 ? `+${value}` : `${value}`),
  soft: '부드럽게',
  edgeHelp:
    '배경이 테두리에 조금 남으면 좁히고, 물체 끝이 잘리면 넓힙니다. 부드럽게 하면 경계가 흐려져 다른 배경에 자연스럽게 얹힙니다.',

  backgroundTitle: '배경',
  backgrounds: { none: '투명', white: '흰색', custom: '다른 색' },
  customColor: '배경색',
  backgroundHelp: {
    none: '투명한 PNG로 받습니다. 문서·디자인 프로그램에서 다른 배경 위에 얹을 수 있습니다.',
    color: '고른 색을 깐 JPG로 받습니다 (쇼핑몰 상품 사진처럼).',
  },
  trim: '물체에 맞춰 자르기',
  trimHelp: '남은 곳 둘레만 남기고 잘라 냅니다. 미리보기의 점선 칸이 저장될 부분입니다.',
  sizeNote:
    '결과는 원본과 같은 크기(잘라 내면 그 부분)로 저장되고, 촬영 정보(EXIF)는 남지 않습니다.',
  limits:
    '머리카락·털 끝, 유리처럼 비치는 물체, 배경과 색이 비슷한 곳은 깔끔하게 나뉘지 않을 수 있습니다. 결과를 확대해 보고 "지우개"·"되살리기"로 고치세요.',
  suffix: '배경제거',
};

const en: typeof ko = {
  choose: 'Choose photo',
  hint: 'One photo of a person, product or animal. Your photo never leaves this device.',
  cannotOpen: 'This photo could not be opened. Try a JPG or PNG photo.',
  opening: 'Opening the photo…',
  otherFile: 'Other photo',
  bar: 'Remove background',

  dataTitle: 'Background removal data',
  dataSize: (size: string) =>
    `To separate the subject from the background, ${size} is downloaded once (the recognition engine and the object model).`,
  dataShared:
    'The recognition engine you already downloaded in the ID photo tool is reused, so only the model is downloaded.',
  dataNote:
    'The data is kept in this browser, so it is ready next time. Your photo is not sent with it; it is processed only on this device.',
  dataRemoved:
    'The data you downloaded before was removed from this browser. Please download it again.',
  lowSpace: 'Your browser may not have enough storage space to keep it.',
  getData: (size: string) => `Download data (${size})`,
  downloading: (percent: number) => `Downloading data ${percent}%`,
  dataFailed: 'The data could not be downloaded. Check your connection and try again.',
  checking: 'Checking the data…',

  needData: 'Download the data first to remove the background.',
  separating: 'Separating the subject from the background…',
  separatedCenter:
    'Kept the subject in the middle of the photo. Click another subject to keep it too.',
  separated: (count: number) =>
    count === 1
      ? 'Kept the subject you clicked.'
      : `Kept the subjects at the ${count} places you clicked.`,
  empty: 'No subject was found. Click the part of the photo you want to keep.',
  separateFailed: 'The subject could not be separated. Your device may be low on memory.',
  retry: 'Try again',
  saving: 'Saving…',
  saved: (pixels: string, format: string, size: string) => `Made a ${pixels} ${format} (${size}).`,
  failed: {
    decode: 'Please open the photo again. Your device may have run low on memory.',
    tooLarge: 'The photo is too large for this browser to save. Make it smaller and try again.',
    encode: 'This browser cannot save in this format.',
    empty: 'Nothing is left. Click what you want to keep or paint it with "Restore".',
  },
  download: (format: string) => `Download ${format}`,

  preview: 'Result preview',
  previewHelp:
    'The checkerboard shows removed areas. Click the photo, or focus it, move with the arrow keys and press Enter. Ctrl+Z undoes.',
  showOriginal: 'Show original',
  point: (index: number) => `Keep point ${index}`,

  toolTitle: 'Fix what is kept',
  toolGroup: 'Clicking does',
  tools: { pick: 'Pick subject', erase: 'Erase', restore: 'Restore' },
  toolHelp: {
    pick: 'Keeps the subject you click. Click each subject to keep several.',
    erase: 'Removes what you paint. Use it for leftover bits of background.',
    restore: 'Brings back the original where you paint. Use it for parts that were cut off.',
  },
  brushSize: 'Brush size',
  undo: 'Undo',
  restart: 'Start over',
  count: (points: number, strokes: number) =>
    strokes === 0
      ? `${points} keep ${points === 1 ? 'point' : 'points'}`
      : `${points} keep ${points === 1 ? 'point' : 'points'}, ${strokes} brush ${strokes === 1 ? 'stroke' : 'strokes'}`,

  edgeTitle: 'Edges',
  shift: 'Shrink · Grow',
  shiftValue: (value: number) => (value === 0 ? 'None' : value > 0 ? `+${value}` : `${value}`),
  soft: 'Soften',
  edgeHelp:
    'Shrink if a thin line of background remains; grow if the edges of the subject are cut. Softening blurs the edge so it sits naturally on a new background.',

  backgroundTitle: 'Background',
  backgrounds: { none: 'Transparent', white: 'White', custom: 'Other color' },
  customColor: 'Background color',
  backgroundHelp: {
    none: 'Download a transparent PNG to place on any background in documents or design apps.',
    color: 'Download a JPG on the color you pick (like an online store product photo).',
  },
  trim: 'Crop to subject',
  trimHelp:
    'Crops away everything around what is kept. The dashed box in the preview is what you get.',
  sizeNote:
    'The result is saved at the original size (or the cropped part of it), without camera data (EXIF).',
  limits:
    'Hair and fur tips, see-through objects such as glass, and areas the same color as the background may not separate cleanly. Zoom in on the result and fix it with "Erase" and "Restore".',
  suffix: 'no-bg',
};

export const MESSAGES: Record<Locale, typeof ko> = { ko, en };
