/** 모자이크 도구 화면의 문구 (공통 문구는 src/frame/messages.ts) */
import type { Locale } from '../../../i18n/locales';
import type { MosaicFailure } from '../../../lib/image/mosaic';
import type { Effect, Shape } from '../../../lib/image/mosaic-effects';
import type { OutputType } from '../../../lib/image/process';

const ko = {
  bar: '모자이크',
  choose: '이미지 파일 선택',
  hint: '가릴 곳이 있는 사진 한 장을 고르세요 · JPG·PNG·WebP 등 브라우저가 여는 이미지 · 이미지는 이 기기를 떠나지 않습니다',
  opening: '이미지를 여는 중입니다…',
  cannotOpen: '이 이미지를 열 수 없습니다. 다른 파일을 골라 주세요.',
  otherFile: '다른 이미지',
  previewHelp:
    '사진 위를 끌어 가릴 곳을 그립니다. 그린 칸을 끌어 옮기고, 모서리·변의 점을 끌어 크기를 바꿉니다. 칸을 고른 뒤 방향키로 옮기고(Shift와 함께 크게) Delete 키로 지웁니다.',
  edges: {
    nw: '왼쪽 위 모서리',
    ne: '오른쪽 위 모서리',
    sw: '왼쪽 아래 모서리',
    se: '오른쪽 아래 모서리',
    n: '위쪽 변',
    s: '아래쪽 변',
    w: '왼쪽 변',
    e: '오른쪽 변',
  },
  regionsTitle: '가릴 곳',
  count: (n: number) =>
    n === 0 ? '아직 없습니다. 사진 위를 끌어 그리거나 "가릴 곳 추가"를 누르세요.' : `${n}곳`,
  add: '가릴 곳 추가',
  remove: '고른 곳 지우기',
  clear: '모두 지우기',
  region: (n: number, effect: string, face: boolean) =>
    `가릴 곳 ${n}: ${effect}${face ? ' (찾은 얼굴)' : ''}`,
  findFaces: '얼굴 찾기',
  faces: {
    checking: '얼굴 찾기 데이터를 확인하는 중…',
    ask: (size: string) =>
      `얼굴을 찾으려면 얼굴 찾기 데이터 ${size}를 한 번 받아야 합니다. 받은 데이터는 이 브라우저에만 보관해 다음부터는 바로 찾습니다. 사진은 어디로도 보내지 않습니다.`,
    removed: '전에 받은 얼굴 찾기 데이터가 이 브라우저에서 지워졌습니다.',
    lowSpace: '이 기기의 남은 저장 공간이 적어 데이터를 보관하지 못할 수 있습니다.',
    getData: (size: string) => `데이터 받기 (${size})`,
    cancel: '취소',
    downloading: (percent: number) => `얼굴 찾기 데이터를 받는 중… ${percent}%`,
    finding: (percent: number) => `얼굴을 찾는 중… ${percent}%`,
    found: (total: number, added: number) =>
      added === total
        ? `얼굴 ${total}개를 찾아 가릴 곳으로 넣었습니다.`
        : `얼굴 ${total}개를 찾았습니다. 이미 가린 곳과 겹치지 않는 ${added}곳을 넣었습니다.`,
    none: '얼굴을 찾지 못했습니다. 사진 위를 끌어 직접 가리세요.',
    check:
      '자동 찾기는 옆모습·아래를 보는 얼굴·가려지거나 아주 작은 얼굴을 놓칠 수 있습니다. 사진을 끝까지 살펴보고 놓친 얼굴은 직접 그려 더하세요. 얼굴이 아닌 곳은 고른 뒤 지우세요.',
    failedData: '얼굴 찾기 데이터를 받지 못했습니다. 인터넷 연결을 확인하고 다시 눌러 주세요.',
    failedFind: '얼굴을 찾다가 멈췄습니다. 다시 눌러 주세요. 계속 안 되면 직접 그려 가리세요.',
  },
  safety:
    '번호판·전화번호·주민등록번호·이름처럼 꼭 감춰야 하는 정보는 "검게 칠하기"를 고르세요. 흐림과 칸이 작은 모자이크는 원래 내용을 짐작해 되살릴 수 있습니다.',
  settingsNew: '새로 그릴 곳',
  settingsOf: (n: number) => `가릴 곳 ${n}`,
  shapeGroup: '모양',
  shapes: { rect: '사각형', ellipse: '타원' } satisfies Record<Shape, string>,
  effectGroup: '가리는 방법',
  effects: { mosaic: '모자이크', blur: '흐리게', fill: '검게 칠하기' } satisfies Record<
    Effect,
    string
  >,
  effectHelp: {
    mosaic:
      '칸마다 평균 색으로 칠합니다. 칸이 작으면 글자·얼굴을 짐작할 수 있으니 세기를 높여 칸을 키우세요.',
    blur: '부드럽게 흐립니다. 흐린 글자는 프로그램으로 되살려 읽을 수 있어 꼭 감춰야 하는 정보에는 맞지 않습니다.',
    fill: '가린 곳을 검은색으로 바꿉니다. 원래 화소가 결과에 전혀 남지 않아 가장 확실합니다.',
  } satisfies Record<Effect, string>,
  strength: '세기',
  strengthValue: {
    mosaic: (px: number) => `칸 ${px}px`,
    blur: (px: number) => `흐림 ${px}px`,
  },
  fields: { x: '왼쪽 (px)', y: '위 (px)', width: '폭 (px)', height: '높이 (px)' },
  formatTitle: '저장 형식',
  formatGroup: '저장 형식',
  formats: { 'image/jpeg': 'JPG', 'image/png': 'PNG', 'image/webp': 'WebP' } satisfies Record<
    OutputType,
    string
  >,
  formatHelp: {
    'image/jpeg': '사진에 알맞고 용량이 작습니다. 투명한 곳은 흰색이 됩니다.',
    'image/png': '화질 손실이 없고 투명을 지킵니다. 사진은 용량이 커집니다.',
    'image/webp': 'JPG보다 작지만 열지 못하는 프로그램이 있습니다.',
  } satisfies Record<OutputType, string>,
  exifNote:
    '원래 크기로 다시 그려 저장하므로 촬영 위치·날짜·기기 같은 정보(EXIF)는 결과에 남지 않습니다.',
  needRegions: '사진 위를 끌어 가릴 곳을 그리세요.',
  ready: (count: number, width: number, height: number, format: string) =>
    `가릴 곳 ${count}곳 · ${width.toLocaleString()} × ${height.toLocaleString()} px · ${format}`,
  saving: '저장하는 중…',
  saved: (count: number, size: string) => `받았습니다: 가릴 곳 ${count}곳 · ${size}`,
  download: '가린 이미지 받기',
  failed: {
    decode: '원본을 다시 읽지 못했습니다. 이미지를 다시 열어 주세요.',
    tooLarge: '이 브라우저가 이렇게 큰 이미지를 만들지 못했습니다. PNG나 JPG로 저장해 보세요.',
    encode: '이 브라우저는 이 형식으로 저장하지 못합니다. 다른 형식을 골라 주세요.',
  } satisfies Record<MosaicFailure, string>,
  /** 결과 파일 이름 뒤에 붙는 말 */
  suffix: '모자이크',
};

const en: typeof ko = {
  bar: 'Mosaic',
  choose: 'Choose an image file',
  hint: 'Pick one photo with something to hide · JPG, PNG, WebP or any image your browser can open · Your image never leaves this device',
  opening: 'Opening the image…',
  cannotOpen: 'This image cannot be opened. Please choose another file.',
  otherFile: 'Other image',
  previewHelp:
    'Drag on the photo to draw an area to hide. Drag an area to move it and drag the dots on its corners and sides to resize it. Select an area to move it with the arrow keys (hold Shift for bigger steps) or remove it with Delete.',
  edges: {
    nw: 'Top-left corner',
    ne: 'Top-right corner',
    sw: 'Bottom-left corner',
    se: 'Bottom-right corner',
    n: 'Top side',
    s: 'Bottom side',
    w: 'Left side',
    e: 'Right side',
  },
  regionsTitle: 'Areas to hide',
  count: (n: number) =>
    n === 0
      ? 'None yet. Drag on the photo or click "Add area".'
      : `${n} ${n === 1 ? 'area' : 'areas'}`,
  add: 'Add area',
  remove: 'Remove selected',
  clear: 'Remove all',
  region: (n: number, effect: string, face: boolean) =>
    `Area ${n}: ${effect}${face ? ' (found face)' : ''}`,
  findFaces: 'Find faces',
  faces: {
    checking: 'Checking the face data…',
    ask: (size: string) =>
      `To find faces, download the face data (${size}) once. It is kept only in this browser, so next time faces are found right away. Your photo is never sent anywhere.`,
    removed: 'The face data you downloaded before has been removed from this browser.',
    lowSpace: 'This device is low on storage, so the data may not be kept.',
    getData: (size: string) => `Download data (${size})`,
    cancel: 'Cancel',
    downloading: (percent: number) => `Downloading the face data… ${percent}%`,
    finding: (percent: number) => `Finding faces… ${percent}%`,
    found: (total: number, added: number) =>
      added === total
        ? `Found ${total} ${total === 1 ? 'face' : 'faces'} and added ${total === 1 ? 'it' : 'them'} as areas to hide.`
        : `Found ${total} ${total === 1 ? 'face' : 'faces'}. Added ${added} that ${added === 1 ? 'does' : 'do'} not overlap areas you already marked.`,
    none: 'No faces found. Drag on the photo to hide them yourself.',
    check:
      'Automatic finding can miss faces in profile, looking down, partly covered or very small. Check the whole photo and draw any missed faces yourself. Select anything that is not a face and remove it.',
    failedData: 'The face data could not be downloaded. Check your connection and try again.',
    failedFind: 'Finding faces stopped. Please try again, or hide the faces yourself.',
  },
  safety:
    'For information that must stay hidden, such as license plates, phone numbers, ID numbers or names, choose "Black out". Blur and fine mosaic can be guessed back.',
  settingsNew: 'Next area you draw',
  settingsOf: (n: number) => `Area ${n}`,
  shapeGroup: 'Shape',
  shapes: { rect: 'Rectangle', ellipse: 'Ellipse' },
  effectGroup: 'How to hide',
  effects: { mosaic: 'Mosaic', blur: 'Blur', fill: 'Black out' },
  effectHelp: {
    mosaic:
      'Fills each block with its average color. Small blocks can still hint at text or faces, so raise the strength for bigger blocks.',
    blur: 'Softly blurs the area. Blurred text can be recovered by software, so do not use it for information that must stay hidden.',
    fill: 'Turns the area black. None of the original pixels remain in the result, so it is the safest choice.',
  },
  strength: 'Strength',
  strengthValue: {
    mosaic: (px: number) => `${px}px blocks`,
    blur: (px: number) => `${px}px blur`,
  },
  fields: { x: 'Left (px)', y: 'Top (px)', width: 'Width (px)', height: 'Height (px)' },
  formatTitle: 'Format',
  formatGroup: 'Format',
  formats: { 'image/jpeg': 'JPG', 'image/png': 'PNG', 'image/webp': 'WebP' },
  formatHelp: {
    'image/jpeg': 'Best for photos, with small files. Transparent areas become white.',
    'image/png': 'No quality loss and keeps transparency. Photos become large files.',
    'image/webp': 'Smaller than JPG, but some programs cannot open it.',
  },
  exifNote:
    'The image is redrawn at full size, so details such as location, date and device (EXIF) are not kept.',
  needRegions: 'Drag on the photo to draw an area to hide.',
  ready: (count: number, width: number, height: number, format: string) =>
    `${count} ${count === 1 ? 'area' : 'areas'} · ${width.toLocaleString()} × ${height.toLocaleString()} px · ${format}`,
  saving: 'Saving…',
  saved: (count: number, size: string) =>
    `Downloaded: ${count} ${count === 1 ? 'area' : 'areas'} hidden · ${size}`,
  download: 'Download image',
  failed: {
    decode: 'The original could not be read again. Please open the image again.',
    tooLarge: 'This browser could not make an image this large. Try saving as PNG or JPG.',
    encode: 'This browser cannot save in this format. Choose another format.',
  },
  suffix: 'mosaic',
};

export const MESSAGES: Record<Locale, typeof ko> = { ko, en };
