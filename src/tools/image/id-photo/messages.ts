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
  download: (format: string) => `${format} 다운로드`,
  saved: (pixels: string, format: string, size: string) =>
    `${pixels} ${format} ${size}를 만들었습니다.`,
  jpegOver: (limit: string) => `가장 낮은 화질로도 ${limit}를 넘었습니다.`,
  pngOver: (limit: string) => `${limit}를 넘었습니다. 용량 제한이 있는 곳에는 JPG를 고르세요.`,

  outputTitle: '저장 방식',
  sizeGroup: '크기',
  sizes: { online: '온라인 제출용', print: '인화용' },
  formatGroup: '형식',
  limitGroup: '용량 상한',
  noLimit: '제한 없음',
  onlineHelp: '온라인 제출용은 413×531 픽셀(여권 규격)입니다.',
  printHelp:
    '인화용은 827×1063 픽셀(600 DPI)이라 더 선명하게 뽑힙니다. 여권 온라인 신청에는 온라인 제출용을 쓰세요.',
  jpegHelp: 'JPG는 용량 상한을 넘으면 화질을 낮춰 맞춥니다.',
  pngHelp: 'PNG는 화질을 그대로 두는 대신 용량이 크고, 상한을 넘어도 줄이지 않고 알려 드립니다.',
  saveFailed:
    'JPG를 만들지 못했습니다. 기기의 메모리가 부족할 수 있습니다. 다른 앱을 닫고 다시 해 보세요.',

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
  flip: '좌우 반전',

  backgroundTitle: '배경',
  backgrounds: {
    original: '원래대로',
    white: '흰색',
    gray: '연한 회색',
    blue: '하늘색',
    custom: '다른 색',
  },
  customColor: '배경색',
  backgroundNeedsData: '배경을 바꾸려면 얼굴 찾기 데이터를 받아 주세요.',
  backgroundNote:
    '사람과 배경을 이 기기 안에서 나눠 배경만 바꿉니다. 머리카락 가장자리가 어색하면 흰 벽 앞에서 다시 찍는 것이 가장 확실합니다.',
  separating: '사람과 배경을 나누는 중…',
  separateFailed: '배경을 나누지 못했습니다. 기기의 메모리가 부족할 수 있습니다.',
  retry: '다시 해 보기',
  reset: '자동으로 다시 맞추기',
  resetManual: '처음으로',

  checksTitle: '확인할 것 (참고용)',
  checkTwoFaces: '얼굴이 둘 이상 보입니다. 한 사람만 나온 사진을 쓰세요.',
  checkTurned: '얼굴이 정면을 보지 않는 것 같습니다.',
  checkBackground: '배경이 흰색이 아닌 것 같습니다. 여권 사진은 흰 배경이어야 합니다.',
  checkCrown: '정수리를 사진에서 찾지 못해 얼굴 비율로 어림했습니다. 머리 끝 선을 직접 확인하세요.',
  checkHead: '머리 길이가 기준(3.2~3.6cm)을 벗어났습니다.',
  checkSmall: '원본 사진이 작아 늘려서 만듭니다. 흐릿할 수 있습니다.',
  checkOutside: '칸이 사진 밖으로 나가 그 부분을 배경색으로 채웠습니다.',
  checkReplaced:
    '배경을 바꿨습니다. 여권은 배경을 지우거나 합성한 사진을 받지 않으므로, 여권에는 흰 벽 앞에서 찍은 원래 사진을 쓰세요.',
  checkNotWhite: '흰색이 아닌 배경입니다. 여권 사진은 흰 배경이어야 합니다.',
  checksNote:
    '이 도구는 얼굴을 고치지 않습니다. 배경은 직접 고를 때만 바꿉니다. 받아 주는지는 접수하는 곳이 정합니다.',
  suffix: '증명사진',
  suffixPrint: '증명사진_인화용',
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
  download: (format: string) => `Download ${format}`,
  saved: (pixels: string, format: string, size: string) => `Made a ${pixels} ${format} of ${size}.`,
  jpegOver: (limit: string) => `It is over ${limit} even at the lowest quality.`,
  pngOver: (limit: string) => `It is over ${limit}. Choose JPG for places with a file size limit.`,

  outputTitle: 'Save as',
  sizeGroup: 'Size',
  sizes: { online: 'For upload', print: 'For printing' },
  formatGroup: 'Format',
  limitGroup: 'File size limit',
  noLimit: 'No limit',
  onlineHelp: 'For upload is 413×531 pixels (the passport size).',
  printHelp:
    'For printing is 827×1063 pixels (600 DPI), so prints come out sharper. Use For upload for online passport applications.',
  jpegHelp: 'JPG lowers the quality to stay under the size limit.',
  pngHelp:
    'PNG keeps full quality but is larger; if it goes over the limit, it is not shrunk and you are told.',
  saveFailed:
    'Could not make the JPG. Your device may be low on memory. Close other apps and try again.',

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
  flip: 'Flip horizontally',

  backgroundTitle: 'Background',
  backgrounds: {
    original: 'Original',
    white: 'White',
    gray: 'Light gray',
    blue: 'Sky blue',
    custom: 'Other color',
  },
  customColor: 'Background color',
  backgroundNeedsData: 'To change the background, download the face finding data.',
  backgroundNote:
    'You and the background are separated on this device and only the background is changed. If the hair edges look odd, retaking the photo in front of a white wall is the surest way.',
  separating: 'Separating you from the background…',
  separateFailed: 'Could not separate the background. Your device may be low on memory.',
  retry: 'Try again',
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
  checkOutside: 'The frame goes past the photo, so that part is filled with the background color.',
  checkReplaced:
    'The background is replaced. Korean passports do not accept photos with a removed or composited background, so use an original photo taken in front of a white wall for a passport.',
  checkNotWhite: 'The background is not white. Korean passport photos need a white background.',
  checksNote:
    'This tool never retouches your face. It changes the background only when you choose a color. The office you submit to decides whether it is accepted.',
  suffix: 'id-photo',
  suffixPrint: 'id-photo_print',
};

export const MESSAGES: Record<Locale, typeof ko> = { ko, en };
