/** 증명사진 도구 화면의 문구 (공통 문구는 src/frame/messages.ts) */
import type { Locale } from '../../../i18n/locales';

const ko = {
  choose: '사진 선택',
  hint: '얼굴이 정면으로 나온 사진 한 장. 사진은 이 기기 밖으로 나가지 않습니다.',
  cannotOpen: '이 사진을 열 수 없습니다. JPG·PNG 사진으로 다시 해 보세요.',
  opening: '사진을 여는 중…',
  otherFile: '다른 사진',
  bar: '증명사진',

  dataTitle: '얼굴 찾기 데이터',
  dataSize: (size: string) =>
    `얼굴 위치와 기울기를 자동으로 찾으려면 처음 한 번 ${size}를 받습니다 (얼굴 인식 엔진과 모델).`,
  dataNote:
    '받은 데이터는 이 브라우저에만 보관되어 다음부터 바로 씁니다. 사진은 받는 데이터와 함께 오가지 않고 이 기기 안에서만 살펴봅니다.',
  dataRemoved: '전에 받은 데이터가 브라우저에서 지워졌습니다. 다시 받아 주세요.',
  lowSpace: '브라우저 저장 공간이 부족해 보관하지 못할 수 있습니다.',
  getData: (size: string) => `데이터 받기 (${size})`,
  downloading: (percent: number) => `데이터 받는 중 ${percent}%`,
  dataFailed: '데이터를 받지 못했습니다. 인터넷 연결을 확인하고 다시 받아 주세요.',
  checking: '데이터를 확인하는 중…',

  finding: '얼굴을 찾는 중…',
  found: '얼굴에 맞춰 잘랐습니다. 아래 칸을 보고 필요하면 조금씩 옮기세요.',
  manualReady: '사진 위 칸을 직접 맞춰 주세요.',
  noFace: '얼굴을 찾지 못했습니다. 칸을 직접 맞춰 주세요.',
  findFailed: '얼굴을 찾지 못했습니다. 기기의 메모리가 부족할 수 있습니다. 칸을 직접 맞춰 주세요.',
  download: 'JPG 다운로드',
  saved: (size: string) => `413×531 JPG ${size}를 만들었습니다.`,

  preview: '증명사진 미리보기',
  previewHelp:
    '끌어서 옮기거나, 누른 뒤 방향키로 옮기고 + − 키로 크기, [ ] 키로 기울기를 바꿉니다.',
  guideTop: '머리 끝',
  guideChin: '턱이 들어갈 자리',
  head: (mm: string) => `머리 길이 약 ${mm}cm`,
  headRange: '(기준 3.2~3.6cm)',
  angle: (degrees: string) => `기울기 ${degrees}°`,

  adjust: '맞추기',
  bigger: '크게',
  smaller: '작게',
  up: '위로',
  down: '아래로',
  left: '왼쪽으로',
  right: '오른쪽으로',
  rotateLeft: '왼쪽으로 기울이기',
  rotateRight: '오른쪽으로 기울이기',
  reset: '자동으로 다시 맞추기',
  resetManual: '처음으로',

  checksTitle: '확인할 것 (참고용)',
  checkTwoFaces: '얼굴이 둘 이상 보입니다. 한 사람만 나온 사진을 쓰세요.',
  checkTurned: '얼굴이 정면을 보지 않는 것 같습니다.',
  checkBackground: '배경이 흰색이 아닌 것 같습니다. 여권 사진은 흰 배경이어야 합니다.',
  checkCrown: '정수리를 사진에서 찾지 못해 얼굴 비율로 어림했습니다. 머리 끝 선을 직접 확인하세요.',
  checkHead: '머리 길이가 기준(3.2~3.6cm)을 벗어났습니다.',
  checkSmall: '원본 사진이 작아 늘려서 만듭니다. 흐릿할 수 있습니다.',
  checkOutside: '칸이 사진 밖으로 나가 그 부분을 흰색으로 채웠습니다.',
  checksNote:
    '이 도구는 자르기·크기·기울기만 맞춥니다. 얼굴을 고치거나 배경을 바꾸지 않습니다 (여권 규정이 금지합니다). 받아 주는지는 접수하는 곳이 정합니다.',
  suffix: '증명사진',
};

const en: typeof ko = {
  choose: 'Choose photo',
  hint: 'One photo with your face looking straight ahead. Your photo never leaves this device.',
  cannotOpen: 'This photo could not be opened. Try a JPG or PNG photo.',
  opening: 'Opening the photo…',
  otherFile: 'Other photo',
  bar: 'ID photo',

  dataTitle: 'Face finding data',
  dataSize: (size: string) =>
    `To find your face and its tilt automatically, ${size} is downloaded once (the face recognition engine and model).`,
  dataNote:
    'The data is kept in this browser, so it is ready next time. Your photo is not sent with it; it is examined only on this device.',
  dataRemoved:
    'The data you downloaded before was removed from this browser. Please download it again.',
  lowSpace: 'Your browser may not have enough storage space to keep it.',
  getData: (size: string) => `Download data (${size})`,
  downloading: (percent: number) => `Downloading data ${percent}%`,
  dataFailed: 'Could not download the data. Check your internet connection and try again.',
  checking: 'Checking data…',

  finding: 'Finding your face…',
  found: 'Cropped to fit your face. Check the frame below and nudge it if needed.',
  manualReady: 'Fit the frame on the photo yourself.',
  noFace: 'No face was found. Fit the frame yourself.',
  findFailed: 'Could not find a face. Your device may be low on memory. Fit the frame yourself.',
  download: 'Download JPG',
  saved: (size: string) => `Made a 413×531 JPG of ${size}.`,

  preview: 'ID photo preview',
  previewHelp:
    'Drag to move it, or select it and use the arrow keys to move, + and − to resize, and [ ] to tilt.',
  guideTop: 'Top of head',
  guideChin: 'Where the chin goes',
  head: (mm: string) => `Head length about ${mm} cm`,
  headRange: '(3.2–3.6 cm required)',
  angle: (degrees: string) => `Tilt ${degrees}°`,

  adjust: 'Adjust',
  bigger: 'Larger',
  smaller: 'Smaller',
  up: 'Up',
  down: 'Down',
  left: 'Left',
  right: 'Right',
  rotateLeft: 'Tilt left',
  rotateRight: 'Tilt right',
  reset: 'Fit automatically again',
  resetManual: 'Start over',

  checksTitle: 'Things to check (for reference)',
  checkTwoFaces: 'More than one face is visible. Use a photo of one person.',
  checkTurned: 'Your face may not be looking straight ahead.',
  checkBackground:
    'The background may not be white. Korean passport photos need a white background.',
  checkCrown:
    'The top of the head could not be found in the photo, so it was estimated from the face. Check the top-of-head line yourself.',
  checkHead: 'The head length is outside 3.2–3.6 cm.',
  checkSmall: 'The original photo is small, so it is enlarged. It may look blurry.',
  checkOutside: 'The frame goes past the photo, so that part is filled with white.',
  checksNote:
    'This tool only crops, resizes and straightens. It does not retouch your face or change the background (passport rules forbid it). The office you submit to decides whether it is accepted.',
  suffix: 'id-photo',
};

export const MESSAGES: Record<Locale, typeof ko> = { ko, en };
