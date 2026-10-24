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
  region: (n: number, effect: string) => `가릴 곳 ${n}: ${effect}`,
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
  region: (n: number, effect: string) => `Area ${n}: ${effect}`,
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
