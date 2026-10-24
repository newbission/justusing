/** 동영상 장면 캡처 도구 화면의 문구 (공통 문구는 src/frame/messages.ts) */
import type { Locale } from '../../../i18n/locales';
import type { StillType } from '../../../lib/video-frames/still';

export type Mode = 'one' | 'many';

const ko = {
  bar: '장면 캡처',
  choose: '동영상 파일 선택',
  hint: '장면을 뽑을 동영상 하나를 고르세요 · MP4·WebM·MOV 등 이 브라우저가 재생하는 동영상 · 동영상은 이 기기를 떠나지 않습니다',
  opening: '동영상을 여는 중입니다…',
  cannotOpen:
    '이 동영상을 열 수 없습니다. 이 브라우저가 재생하지 못하는 형식일 수 있습니다 (MP4(H.264)·WebM은 대부분 열립니다).',
  otherFile: '다른 동영상',
  player: '동영상',
  back: '1/30초 뒤로',
  forward: '1/30초 앞으로',
  position: '위치 (초)',
  playerHelp:
    '재생하다 멈추거나 막대를 끌어 장면을 찾고, 1/30초 버튼으로 한 장면씩 맞춥니다. 위치를 숫자로 적어도 됩니다.',
  modeTitle: '받는 방식',
  modeGroup: '받는 방식',
  modes: { one: '지금 장면 한 장', many: '일정 간격으로 여러 장' } satisfies Record<Mode, string>,
  intervalGroup: '간격',
  interval: (seconds: number) => `${seconds}초마다`,
  start: '시작 (초)',
  end: '끝 (초)',
  setStart: '지금 위치를 시작으로',
  setEnd: '지금 위치를 끝으로',
  count: (count: number, max: number) => `모두 ${count}장 · 한 번에 ${max}장까지`,
  tooMany: (max: number) =>
    `한 번에 ${max}장까지 받을 수 있습니다. 간격을 늘리거나 구간을 줄여 주세요.`,
  manyHelp:
    '구간의 시작부터 간격마다 한 장씩 뽑아 ZIP 하나로 받습니다. 끝 시각에 장면이 걸리면 그것도 넣습니다.',
  formatTitle: '저장 형식',
  formatGroup: '저장 형식',
  formats: { 'image/jpeg': 'JPG', 'image/png': 'PNG' } satisfies Record<StillType, string>,
  formatHelp: {
    'image/jpeg': '사진처럼 저장해 용량이 작습니다 (화질 92%).',
    'image/png': '장면을 손실 없이 저장합니다. 용량이 몇 배 큽니다.',
  } satisfies Record<StillType, string>,
  sizeNote: (width: number, height: number) =>
    `동영상의 원래 크기(${width} × ${height} px) 그대로 저장합니다. 동영상 자체가 압축되어 있어 사진기로 찍은 사진만큼 선명하지는 않습니다.`,
  readyOne: (time: string, format: string) => `지금 장면 ${time} · ${format}`,
  readyMany: (count: number, format: string) => `${count}장 · ${format} · ZIP`,
  saving: '저장하는 중…',
  making: (done: number, total: number) => `장면 ${done} / ${total} 저장하는 중…`,
  savedOne: (time: string, size: string) => `받았습니다: ${time} 장면 · ${size}`,
  savedMany: (count: number, size: string) => `받았습니다: ${count}장 · ZIP ${size}`,
  downloadOne: '이 장면 받기',
  downloadMany: 'ZIP으로 받기',
  stop: '그만두기',
  failed: '장면을 저장하지 못했습니다. 동영상을 다시 열어 보세요.',
  /** ZIP 파일 이름 뒤에 붙는 말 */
  suffix: '장면',
};

const en: typeof ko = {
  bar: 'Frame capture',
  choose: 'Choose a video file',
  hint: 'Pick one video to grab frames from · MP4, WebM, MOV or any video your browser can play · Your video never leaves this device',
  opening: 'Opening the video…',
  cannotOpen:
    'This video cannot be opened. Your browser may not play this format (MP4 (H.264) and WebM usually work).',
  otherFile: 'Other video',
  player: 'Video',
  back: 'Back 1/30 s',
  forward: 'Forward 1/30 s',
  position: 'Position (s)',
  playerHelp:
    'Play and pause or drag the bar to find a frame, then fine-tune one frame at a time with the 1/30 s buttons. You can also type the position.',
  modeTitle: 'What to save',
  modeGroup: 'What to save',
  modes: { one: 'This frame', many: 'Frames at an interval' },
  intervalGroup: 'Interval',
  interval: (seconds: number) => `Every ${seconds}s`,
  start: 'Start (s)',
  end: 'End (s)',
  setStart: 'Set start here',
  setEnd: 'Set end here',
  count: (count: number, max: number) => `${count} frames in total · Up to ${max} at a time`,
  tooMany: (max: number) =>
    `You can save up to ${max} frames at a time. Use a longer interval or a shorter range.`,
  manyHelp:
    'Grabs one frame per interval from the start of the range and downloads them as one ZIP. A frame exactly at the end is included too.',
  formatTitle: 'Format',
  formatGroup: 'Format',
  formats: { 'image/jpeg': 'JPG', 'image/png': 'PNG' },
  formatHelp: {
    'image/jpeg': 'Saved like a photo with a small file (92% quality).',
    'image/png': 'Saves the frame without loss. Files are several times larger.',
  },
  sizeNote: (width: number, height: number) =>
    `Saved at the video's original size (${width} × ${height} px). The video itself is compressed, so frames are not as sharp as photos from a camera.`,
  readyOne: (time: string, format: string) => `Current frame ${time} · ${format}`,
  readyMany: (count: number, format: string) => `${count} frames · ${format} · ZIP`,
  saving: 'Saving…',
  making: (done: number, total: number) => `Saving frame ${done} of ${total}…`,
  savedOne: (time: string, size: string) => `Downloaded: frame at ${time} · ${size}`,
  savedMany: (count: number, size: string) => `Downloaded: ${count} frames · ZIP ${size}`,
  downloadOne: 'Download this frame',
  downloadMany: 'Download as ZIP',
  stop: 'Stop',
  failed: 'The frames could not be saved. Please open the video again.',
  suffix: 'frames',
};

export const MESSAGES: Record<Locale, typeof ko> = { ko, en };
