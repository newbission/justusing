/** 배경 지우기 도구 화면의 문구 (공통 문구는 src/frame/messages.ts) */
import type { Locale } from '../../../i18n/locales';

const ko = {
  choose: '사진 선택',
  hint: '사람·상품·동물이 나온 사진. 여러 장을 한 번에 고를 수 있습니다. 사진은 이 기기 밖으로 나가지 않습니다.',
  cannotOpen: '이 사진을 열 수 없습니다. JPG·PNG 사진으로 다시 해 보세요.',
  opening: '사진을 여는 중…',
  loadFailed: '도구 화면을 불러오지 못했습니다. 인터넷 연결을 확인하고 사진을 다시 골라 주세요.',
  otherFile: '다른 사진',
  addPhotos: '사진 더하기',
  bar: '배경 지우기',

  summary: (count: number, size: string) => `사진 ${count}장 · ${size}`,
  list: '사진 목록',
  backToList: '목록으로',
  previous: '이전 사진',
  next: '다음 사진',
  position: (index: number, total: number) => `${index}/${total}`,
  edit: '고치기',
  editLabel: (name: string) => `${name} 고치기`,
  remove: (name: string) => `${name} 빼기`,
  itemReading: '읽는 중…',
  itemBroken: '열 수 없는 사진입니다. 빼고 받습니다.',
  itemWaiting: '차례를 기다리는 중…',
  itemWorking: '물체와 배경을 나누는 중…',
  itemFailed: '물체를 나누지 못했습니다.',
  itemEmpty: '남길 물체를 찾지 못했습니다. "고치기"에서 남길 곳을 눌러 주세요.',
  itemOwn: '따로 설정',
  sharedHelp:
    '아래 설정은 모든 사진에 같이 씁니다. 한 사진만 다르게 하려면 "고치기"에서 "이 사진만 따로 정하기"를 고릅니다.',
  memoryNote:
    '사진은 하나씩 원본 크기로 다시 읽어 저장하지만, 받을 결과는 모두 메모리에 모았다가 ZIP으로 묶습니다. 휴대폰에서는 큰 사진을 10장 안팎씩 나눠 받으세요.',
  ownToggle: '이 사진만 따로 정하기',
  ownHelp: {
    own: '아래 가장자리·배경 설정은 이 사진에만 씁니다.',
    shared: '아래 가장자리·배경 설정은 모든 사진에 같이 씁니다.',
  },
  separatingMany: (done: number, total: number) =>
    `사진마다 물체와 배경을 나누는 중… ${done}/${total}`,
  readyMany: (count: number) =>
    `사진 ${count}장의 배경을 지웠습니다. 고칠 사진은 "고치기"를 누르세요.`,
  skipped: (count: number) => `${count}장은 빼고 받습니다.`,
  emptyAll: '받을 사진이 없습니다. "고치기"에서 남길 곳을 눌러 주세요.',
  downloadAll: (count: number) => `모두 받기 (ZIP, ${count}장)`,
  savingMany: (done: number, total: number) => `저장하는 중… ${done}/${total}`,
  savedMany: (count: number, size: string) => `사진 ${count}장을 ZIP(${size})으로 만들었습니다.`,
  stop: '그만두기',
  stopped: '저장을 그만두었습니다.',
  zipName: '이미지_배경제거.zip',

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
  hint: 'Photos of a person, product or animal. You can pick several at once. Your photos never leave this device.',
  cannotOpen: 'This photo could not be opened. Try a JPG or PNG photo.',
  opening: 'Opening the photo…',
  loadFailed: 'The tool could not be loaded. Check your connection and choose the photos again.',
  otherFile: 'Other photo',
  addPhotos: 'Add photos',
  bar: 'Remove background',

  summary: (count: number, size: string) =>
    `${count} ${count === 1 ? 'photo' : 'photos'} · ${size}`,
  list: 'Photo list',
  backToList: 'Back to list',
  previous: 'Previous photo',
  next: 'Next photo',
  position: (index: number, total: number) => `${index}/${total}`,
  edit: 'Fix',
  editLabel: (name: string) => `Fix ${name}`,
  remove: (name: string) => `Remove ${name}`,
  itemReading: 'Reading…',
  itemBroken: 'This photo cannot be opened. It is left out.',
  itemWaiting: 'Waiting…',
  itemWorking: 'Separating the subject from the background…',
  itemFailed: 'The subject could not be separated.',
  itemEmpty: 'No subject was found. Click "Fix" and click what you want to keep.',
  itemOwn: 'Own settings',
  sharedHelp:
    'These settings apply to every photo. To set one photo differently, click "Fix" and choose "Set this photo separately".',
  memoryNote:
    'Each photo is read again at full size one by one, but all results are kept in memory until they are zipped. On a phone, download large photos about 10 at a time.',
  ownToggle: 'Set this photo separately',
  ownHelp: {
    own: 'The edge and background settings below apply to this photo only.',
    shared: 'The edge and background settings below apply to every photo.',
  },
  separatingMany: (done: number, total: number) =>
    `Separating the subject in each photo… ${done}/${total}`,
  readyMany: (count: number) =>
    `Removed the background from ${count} photos. Click "Fix" on any photo to adjust it.`,
  skipped: (count: number) => `${count} left out.`,
  emptyAll: 'Nothing to download. Click "Fix" and click what you want to keep.',
  downloadAll: (count: number) => `Download all (ZIP, ${count})`,
  savingMany: (done: number, total: number) => `Saving… ${done}/${total}`,
  savedMany: (count: number, size: string) => `Made a ZIP of ${count} photos (${size}).`,
  stop: 'Stop',
  stopped: 'Saving was stopped.',
  zipName: 'background-removed-images.zip',

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
