/** 동영상 도구 공통 화면의 문구 (도구별 문구는 도구 폴더의 messages.ts) */
import type { Locale } from '../../i18n/locales';
import type { VideoFailure } from './types';

/** 코덱 이름 (mediabunny 이름 → 사람이 아는 이름) */
const CODECS: Record<string, string> = {
  avc: 'H.264',
  hevc: 'H.265(HEVC)',
  vp9: 'VP9',
  vp8: 'VP8',
  av1: 'AV1',
  prores: 'ProRes',
  aac: 'AAC',
  opus: 'Opus',
  mp3: 'MP3',
  vorbis: 'Vorbis',
  flac: 'FLAC',
  ac3: 'AC-3',
  eac3: 'E-AC-3',
  dts: 'DTS',
};

export function codecName(codec: string | null | undefined): string {
  if (!codec) return '?';
  if (codec.startsWith('pcm-') || codec === 'ulaw' || codec === 'alaw') return 'PCM';
  return CODECS[codec] ?? codec.toUpperCase();
}

const ko = {
  choose: '동영상 파일 선택',
  opening: '동영상을 여는 중입니다…',
  otherFile: '다른 동영상',
  cannotOpen:
    '이 파일을 동영상으로 열 수 없습니다. MP4·MOV·WebM·MKV 동영상인지 확인하고 다른 파일을 골라 주세요.',
  noVideo: '이 파일에는 화면(동영상 트랙)이 없습니다. 동영상 파일을 골라 주세요.',
  noAudio: '이 동영상에는 소리가 없습니다. 소리가 있는 동영상을 골라 주세요.',
  unknownCodec:
    '이 동영상의 코덱은 다룰 수 없습니다 (MPEG-4 Part 2·WMV 같은 예전 코덱). H.264·H.265·VP9·AV1 동영상을 골라 주세요.',
  unknownAudioCodec:
    '이 동영상의 소리 코덱은 다룰 수 없습니다. AAC·MP3·Opus 같은 소리가 든 동영상을 골라 주세요.',
  /** 파일 이름 막대의 정보 */
  meta: (duration: string, size: string) => `${duration} · ${size}`,
  noSound: '소리 없음',
  /** WebCodecs가 없어 다시 인코딩하는 일을 못 할 때 */
  noWebCodecs:
    '이 브라우저는 동영상을 다시 저장하는 기능(WebCodecs)이 없습니다. 최신 크롬·엣지·파이어폭스(컴퓨터)·Safari에서 열어 주세요.',
  cannotDecode: (codec: string) =>
    `이 브라우저는 이 동영상의 화면 코덱(${codec})을 풀지 못합니다. 다른 브라우저(크롬·엣지)에서 열어 보세요.`,
  cannotDecodeAudio: (codec: string) =>
    `이 브라우저는 이 동영상의 소리 코덱(${codec})을 풀지 못합니다.`,
  previewFailed:
    '이 브라우저에서는 미리보기를 재생할 수 없습니다. 처리는 그대로 됩니다 (시간은 숫자로 적을 수 있습니다).',
  progress: (percent: number) => `처리하는 중… ${percent}%`,
  remaining: (time: string) => ` · 남은 시간 약 ${time}`,
  starting: '준비하는 중…',
  cancel: '그만두기',
  canceled: '그만두었습니다.',
  download: '받기',
  failed: {
    unreadable: '이 파일을 동영상으로 읽지 못했습니다. 다른 파일을 골라 주세요.',
    noTrack: '이 일에 필요한 트랙(화면·소리)이 이 파일에 없습니다.',
    decode: '이 브라우저가 이 동영상의 코덱을 풀지 못했습니다. 크롬·엣지에서 해 보세요.',
    encode:
      '이 브라우저가 이 크기·형식으로 다시 저장하지 못했습니다. 해상도를 낮추거나 다른 브라우저에서 해 보세요.',
    copy: '다시 인코딩 없이는 옮길 수 없는 파일입니다. 다른 방법(정확하게·WAV)을 골라 주세요.',
    memory:
      '처리하다 멈췄습니다. 기기의 메모리가 모자랐을 수 있습니다. 다른 탭을 닫거나 더 짧게 나눠 해 보세요.',
    failed: '처리하지 못했습니다. 다시 해 보거나 다른 방법을 골라 주세요.',
  } satisfies Record<VideoFailure, string>,
};

const en: typeof ko = {
  choose: 'Choose a video file',
  opening: 'Opening the video…',
  otherFile: 'Other video',
  cannotOpen:
    'This file cannot be opened as a video. Make sure it is an MP4, MOV, WebM or MKV video, or choose another file.',
  noVideo: 'This file has no picture (video track). Please choose a video file.',
  noAudio: 'This video has no sound. Please choose a video with sound.',
  unknownCodec:
    'The codec of this video is not supported (older codecs such as MPEG-4 Part 2 or WMV). Please choose an H.264, H.265, VP9 or AV1 video.',
  unknownAudioCodec:
    'The audio codec of this video is not supported. Please choose a video with sound such as AAC, MP3 or Opus.',
  meta: (duration: string, size: string) => `${duration} · ${size}`,
  noSound: 'No sound',
  noWebCodecs:
    'This browser cannot re-encode video (no WebCodecs). Please open this page in a recent Chrome, Edge, Firefox (desktop) or Safari.',
  cannotDecode: (codec: string) =>
    `This browser cannot decode the video codec of this file (${codec}). Try another browser such as Chrome or Edge.`,
  cannotDecodeAudio: (codec: string) =>
    `This browser cannot decode the audio codec of this file (${codec}).`,
  previewFailed:
    'This browser cannot play a preview of this video. Processing still works (you can type the times).',
  progress: (percent: number) => `Processing… ${percent}%`,
  remaining: (time: string) => ` · about ${time} left`,
  starting: 'Getting ready…',
  cancel: 'Stop',
  canceled: 'Stopped.',
  download: 'Download',
  failed: {
    unreadable: 'This file could not be read as a video. Please choose another file.',
    noTrack: 'This file does not have the track (picture or sound) this needs.',
    decode: 'This browser could not decode the codec of this video. Try Chrome or Edge.',
    encode:
      'This browser could not save at this size or format. Try a lower resolution or another browser.',
    copy: 'This file cannot be moved over without re-encoding. Please choose another option (Precise or WAV).',
    memory:
      'Processing stopped, possibly because the device ran out of memory. Close other tabs or try a shorter part.',
    failed: 'Processing failed. Please try again or choose another option.',
  },
};

export const VIDEO_MESSAGES: Record<Locale, typeof ko> = { ko, en };
