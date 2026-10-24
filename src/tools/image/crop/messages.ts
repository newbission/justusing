/** 자르기·회전 도구 화면의 문구 (공통 문구는 src/frame/messages.ts) */
import type { Locale } from '../../../i18n/locales';
import type { CropFailure } from '../../../lib/image/crop';
import type { OutputType } from '../../../lib/image/process';

/** 자를 비율: 자유, 원래 사진 비율, 또는 '가로:세로' */
export const RATIOS = [
  'free',
  'original',
  '1:1',
  '4:5',
  '5:4',
  '3:4',
  '4:3',
  '2:3',
  '3:2',
  '9:16',
  '16:9',
] as const;
export type Ratio = (typeof RATIOS)[number];

const ko = {
  bar: '자르기·회전',
  choose: '이미지 파일 선택',
  hint: '자르거나 돌릴 사진 한 장을 고르세요 · JPG·PNG·WebP 등 브라우저가 여는 이미지 · 이미지는 이 기기를 떠나지 않습니다',
  opening: '이미지를 여는 중입니다…',
  cannotOpen: '이 이미지를 열 수 없습니다. 다른 파일을 골라 주세요.',
  otherFile: '다른 이미지',
  preview: '자를 영역',
  previewHelp:
    '밝은 칸이 남길 영역입니다. 가운데를 끌어 옮기고 모서리·변의 점을 끌어 크기를 바꿉니다. 방향키로도 됩니다 (Shift와 함께 크게).',
  area: '남길 영역 (방향키로 옮기기)',
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
  turnTitle: '돌리기·뒤집기',
  rotateLeft: '왼쪽으로 90°',
  rotateRight: '오른쪽으로 90°',
  flipX: '좌우 뒤집기',
  flipY: '상하 뒤집기',
  angle: '기울기 바로잡기',
  angleValue: (degrees: string) => `${degrees}°`,
  angleZero: '0°로',
  angleHelp:
    '수평선이나 건물이 기울어 보이면 조금씩 돌려 맞춥니다. 귀퉁이가 비지 않게 사진을 그만큼 키우므로 가장자리가 조금 잘립니다.',
  cropTitle: '자르기',
  ratioGroup: '비율',
  ratios: {
    free: '자유',
    original: '원래 비율',
  } satisfies Partial<Record<Ratio, string>>,
  ratioHelp:
    '1:1은 프로필·정사각형 게시물, 4:5는 인스타그램 세로 게시물, 16:9는 유튜브 썸네일·와이드 화면, 3:4와 2:3은 사진 인화에 맞습니다.',
  fields: { x: '왼쪽 (px)', y: '위 (px)', width: '폭 (px)', height: '높이 (px)' },
  whole: '자르지 않기',
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
    '다시 그려 저장하므로 촬영 위치·날짜·기기 같은 정보(EXIF)는 결과에 남지 않고, 보이는 방향 그대로 저장됩니다.',
  reset: '처음으로',
  ready: (width: number, height: number, format: string) =>
    `결과 ${width.toLocaleString()} × ${height.toLocaleString()} px · ${format}`,
  saving: '저장하는 중…',
  saved: (width: number, height: number, size: string) =>
    `받았습니다: ${width.toLocaleString()} × ${height.toLocaleString()} px · ${size}`,
  download: '자른 이미지 받기',
  failed: {
    decode: '원본을 다시 읽지 못했습니다. 이미지를 다시 열어 주세요.',
    tooLarge:
      '이 브라우저가 이렇게 큰 이미지를 만들지 못했습니다. PNG나 JPG로 저장하거나 더 작게 잘라 보세요.',
    encode: '이 브라우저는 이 형식으로 저장하지 못합니다. 다른 형식을 골라 주세요.',
  } satisfies Record<CropFailure, string>,
  /** 결과 파일 이름 뒤에 붙는 말 */
  suffix: '편집',
};

const en: typeof ko = {
  bar: 'Crop & Rotate',
  choose: 'Choose an image file',
  hint: 'Pick one photo to crop or rotate · JPG, PNG, WebP or any image your browser can open · Your image never leaves this device',
  opening: 'Opening the image…',
  cannotOpen: 'This image cannot be opened. Please choose another file.',
  otherFile: 'Other image',
  preview: 'Area to keep',
  previewHelp:
    'The bright box is the area to keep. Drag the middle to move it and drag the dots on the corners and sides to resize it. Arrow keys work too (hold Shift for bigger steps).',
  area: 'Area to keep (move with arrow keys)',
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
  turnTitle: 'Rotate and flip',
  rotateLeft: 'Rotate left 90°',
  rotateRight: 'Rotate right 90°',
  flipX: 'Flip horizontally',
  flipY: 'Flip vertically',
  angle: 'Straighten',
  angleValue: (degrees: string) => `${degrees}°`,
  angleZero: 'Back to 0°',
  angleHelp:
    'If the horizon or a building looks tilted, turn the photo a little to level it. The photo is enlarged so no empty corners appear, so the edges are trimmed slightly.',
  cropTitle: 'Crop',
  ratioGroup: 'Aspect ratio',
  ratios: {
    free: 'Free',
    original: 'Original',
  },
  ratioHelp:
    '1:1 suits profile pictures and square posts, 4:5 Instagram portrait posts, 16:9 YouTube thumbnails and wide screens, and 3:4 or 2:3 photo prints.',
  fields: { x: 'Left (px)', y: 'Top (px)', width: 'Width (px)', height: 'Height (px)' },
  whole: 'No crop',
  formatTitle: 'Format',
  formatGroup: 'Format',
  formats: { 'image/jpeg': 'JPG', 'image/png': 'PNG', 'image/webp': 'WebP' },
  formatHelp: {
    'image/jpeg': 'Best for photos, with small files. Transparent areas become white.',
    'image/png': 'No quality loss and keeps transparency. Photos become large files.',
    'image/webp': 'Smaller than JPG, but some programs cannot open it.',
  },
  exifNote:
    'The image is redrawn, so details such as location, date and device (EXIF) are not kept, and it is saved the way it looks.',
  reset: 'Start over',
  ready: (width: number, height: number, format: string) =>
    `Result ${width.toLocaleString()} × ${height.toLocaleString()} px · ${format}`,
  saving: 'Saving…',
  saved: (width: number, height: number, size: string) =>
    `Downloaded: ${width.toLocaleString()} × ${height.toLocaleString()} px · ${size}`,
  download: 'Download edited image',
  failed: {
    decode: 'The original could not be read again. Please open the image again.',
    tooLarge:
      'This browser could not make an image this large. Try saving as PNG or JPG, or cropping a smaller area.',
    encode: 'This browser cannot save in this format. Choose another format.',
  },
  suffix: 'edited',
};

export const MESSAGES: Record<Locale, typeof ko> = { ko, en };
