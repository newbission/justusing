/** 동영상을 GIF로 도구 화면의 문구 (공통 문구는 src/frame/messages.ts) */
import type { Locale } from '../../../i18n/locales';
import type { AnimationFailure, AnimationFormat } from '../../../lib/video-frames/animation';

const ko = {
  bar: '동영상을 GIF로',
  choose: '동영상 파일 선택',
  hint: '움직이는 그림으로 만들 동영상 하나를 고르세요 · MP4·WebM·MOV 등 이 브라우저가 재생하는 동영상 · 동영상은 이 기기를 떠나지 않습니다',
  opening: '동영상을 여는 중입니다…',
  cannotOpen:
    '이 동영상을 열 수 없습니다. 이 브라우저가 재생하지 못하는 형식일 수 있습니다 (MP4(H.264)·WebM은 대부분 열립니다).',
  otherFile: '다른 동영상',
  player: '동영상 미리보기',
  rangeTitle: '구간',
  start: '시작 (초)',
  end: '끝 (초)',
  setStart: '지금 위치를 시작으로',
  setEnd: '지금 위치를 끝으로',
  playRange: '구간 재생',
  rangeInfo: (length: string, max: number) => `구간 ${length}초 · 최대 ${max}초`,
  rangeHelp:
    '동영상을 재생하거나 막대를 끌어 원하는 곳에서 멈춘 뒤 버튼으로 시작·끝을 정합니다. 숫자를 직접 적어도 됩니다.',
  formatTitle: '형식',
  formatGroup: '형식',
  formats: { gif: 'GIF', webp: '움직이는 WebP' } satisfies Record<AnimationFormat, string>,
  /** 버튼·결과 안내에 쓰는 짧은 이름 */
  short: { gif: 'GIF', webp: 'WebP' } satisfies Record<AnimationFormat, string>,
  formatHelp: {
    gif: '어디서나 열리지만 256색까지라 용량이 큽니다.',
    webp: '같은 화질에 GIF보다 훨씬 작습니다. 브라우저·대부분의 메신저에서 움직이지만 GIF만 받는 곳도 있습니다.',
  } satisfies Record<AnimationFormat, string>,
  noWebp: '이 브라우저는 WebP로 저장하지 못해 GIF만 만들 수 있습니다 (Safari).',
  widthTitle: '크기 (폭)',
  widthGroup: '폭',
  widthOption: (width: number) => `${width}px`,
  widthHelp: (width: number, height: number) =>
    `결과 ${width} × ${height} px. 폭을 반으로 줄이면 화소가 4분의 1이 되어 용량이 가장 많이 줄어듭니다.`,
  fpsTitle: '초당 장면 수',
  fps: '초당 장면 수',
  fpsValue: (fps: number) => `${fps}장`,
  fpsHelp:
    '움직임이 빠르면 15~20장, 설명·화면 녹화는 8~10장이면 충분합니다. 장면 수에 비례해 커집니다.',
  qualityTitle: '화질',
  colorsGroup: '색 수',
  colorsOption: (colors: number) => `${colors}색`,
  dither: '디더링 (점 무늬로 색 사이를 부드럽게)',
  colorsHelp:
    '색을 줄일수록 작아지지만 하늘·피부 같은 부드러운 색이 계단처럼 보입니다. 디더링은 계단을 줄이지만 용량이 늘어납니다.',
  qualityGroup: 'WebP 화질',
  qualities: { high: '높음', medium: '보통', low: '낮음' },
  loopTitle: '반복',
  loopGroup: '반복',
  loops: { forever: '계속 반복', once: '한 번만' },
  estimating: '용량을 어림하는 중…',
  ready: (width: number, height: number, frames: number, size: string) =>
    `${width} × ${height} px · ${frames}장 · 예상 약 ${size}`,
  big: '용량이 큽니다. 메신저·게시판에 따라 올라가지 않을 수 있습니다. 폭·초당 장면 수·구간을 줄이거나 WebP를 고르세요.',
  making: (done: number, total: number) => `장면 ${done} / ${total} 만드는 중…`,
  made: (format: string, size: string, width: number, height: number, frames: number) =>
    `${format} ${size} · ${width} × ${height} px · ${frames}장`,
  saved: (format: string, size: string) => `받았습니다: ${format} ${size}`,
  make: (format: string) => `${format} 만들기`,
  download: (format: string) => `${format} 받기`,
  stop: '그만두기',
  resultTitle: '결과 미리보기',
  resultAlt: '만든 움직이는 그림',
  failed: {
    encode:
      '만들다가 멈췄습니다. 메모리가 모자랐을 수 있습니다. 폭이나 구간을 줄여 다시 해 보세요.',
    webp: '이 브라우저는 WebP로 저장하지 못합니다. GIF를 골라 주세요.',
    seek: '동영상의 장면을 읽지 못했습니다. 동영상을 다시 열어 보세요.',
  } satisfies Record<AnimationFailure, string>,
};

const en: typeof ko = {
  bar: 'Video to GIF',
  choose: 'Choose a video file',
  hint: 'Pick one video to turn into an animation · MP4, WebM, MOV or any video your browser can play · Your video never leaves this device',
  opening: 'Opening the video…',
  cannotOpen:
    'This video cannot be opened. Your browser may not play this format (MP4 (H.264) and WebM usually work).',
  otherFile: 'Other video',
  player: 'Video preview',
  rangeTitle: 'Clip',
  start: 'Start (s)',
  end: 'End (s)',
  setStart: 'Set start here',
  setEnd: 'Set end here',
  playRange: 'Play clip',
  rangeInfo: (length: string, max: number) => `Clip ${length}s · Up to ${max}s`,
  rangeHelp:
    'Play the video or drag its bar, pause where you want, then set the start and end with the buttons. You can also type the numbers.',
  formatTitle: 'Format',
  formatGroup: 'Format',
  formats: { gif: 'GIF', webp: 'Animated WebP' },
  short: { gif: 'GIF', webp: 'WebP' },
  formatHelp: {
    gif: 'Opens everywhere, but only 256 colors and large files.',
    webp: 'Much smaller than GIF at the same quality. It moves in browsers and most messengers, but some places accept only GIF.',
  },
  noWebp: 'This browser cannot save WebP, so only GIF is available (Safari).',
  widthTitle: 'Size (width)',
  widthGroup: 'Width',
  widthOption: (width: number) => `${width}px`,
  widthHelp: (width: number, height: number) =>
    `Result ${width} × ${height} px. Halving the width leaves a quarter of the pixels, which shrinks the file the most.`,
  fpsTitle: 'Frames per second',
  fps: 'Frames per second',
  fpsValue: (fps: number) => `${fps} fps`,
  fpsHelp:
    'Use 15 to 20 for fast motion; 8 to 10 is enough for tutorials and screen recordings. The file grows with the number of frames.',
  qualityTitle: 'Quality',
  colorsGroup: 'Colors',
  colorsOption: (colors: number) => `${colors} colors`,
  dither: 'Dithering (smooth colors with a dot pattern)',
  colorsHelp:
    'Fewer colors make a smaller file, but smooth areas such as sky or skin show steps. Dithering hides the steps but makes the file larger.',
  qualityGroup: 'WebP quality',
  qualities: { high: 'High', medium: 'Medium', low: 'Low' },
  loopTitle: 'Loop',
  loopGroup: 'Loop',
  loops: { forever: 'Loop forever', once: 'Play once' },
  estimating: 'Estimating the size…',
  ready: (width: number, height: number, frames: number, size: string) =>
    `${width} × ${height} px · ${frames} frames · About ${size}`,
  big: 'This is a large file. Some messengers and forums may not accept it. Reduce the width, frame rate or clip, or choose WebP.',
  making: (done: number, total: number) => `Making frame ${done} of ${total}…`,
  made: (format: string, size: string, width: number, height: number, frames: number) =>
    `${format} ${size} · ${width} × ${height} px · ${frames} frames`,
  saved: (format: string, size: string) => `Downloaded: ${format} ${size}`,
  make: (format: string) => `Make ${format}`,
  download: (format: string) => `Download ${format}`,
  stop: 'Stop',
  resultTitle: 'Result preview',
  resultAlt: 'The animation you made',
  failed: {
    encode:
      'Making stopped. The device may have run out of memory. Try a smaller width or a shorter clip.',
    webp: 'This browser cannot save WebP. Please choose GIF.',
    seek: 'The video frames could not be read. Please open the video again.',
  },
};

export const MESSAGES: Record<Locale, typeof ko> = { ko, en };
