/** 동영상 소리 뽑기 화면의 문구 (동영상 공통 문구는 src/lib/video/messages.ts) */
import type { Locale } from '../../../i18n/locales';
import type { AudioJob } from '../../../lib/video/types';

type Target = AudioJob['target'];

const ko = {
  bar: '소리 뽑기',
  hint: '소리를 뽑을 동영상 한 개를 고르세요 · MP4·MOV·WebM·MKV · 동영상은 이 기기를 떠나지 않습니다',
  previewLabel: '미리보기',
  sourceTitle: '이 동영상의 소리',
  source: (codec: string, rate: string, channels: number) =>
    `${codec} · ${rate}kHz · ${channels === 1 ? '모노' : channels === 2 ? '스테레오' : `${channels}채널`}`,
  formatTitle: '저장 형식',
  formatGroup: '저장 형식',
  targets: {
    copy: (format: string) => `${format} (원래 소리 그대로)`,
    wav: 'WAV (압축 없음)',
    aac: 'M4A (AAC로 다시 저장)',
  },
  targetHelp: {
    copy: '동영상에 든 소리 데이터를 다시 인코딩하지 않고 그대로 꺼냅니다. 음질이 그대로이고 가장 빠르며 용량도 원래만큼입니다.',
    wav: '소리를 풀어 압축 없이 저장합니다. 거의 모든 편집 프로그램이 열지만 용량이 큽니다 (1분에 약 10MB).',
    aac: '휴대폰·음악 앱 어디서나 재생되는 M4A(AAC 192kbps)로 다시 저장합니다.',
  } satisfies Record<Target, string>,
  copyUnavailable:
    '이 소리 코덱은 그대로 담을 파일 형식이 없어 다시 저장해야 합니다 (WAV 또는 M4A).',
  wavUnavailable: (codec: string) =>
    `이 브라우저는 이 소리(${codec})를 풀지 못해 WAV로 저장할 수 없습니다.`,
  aacUnavailable: '이 브라우저는 AAC로 저장하지 못합니다.',
  nothing:
    '이 브라우저에서는 이 소리를 꺼낼 방법이 없습니다. 크롬·엣지·Safari 최신판(컴퓨터)에서 해 보세요.',
  ready: (format: string, size: string) => `${format}로 저장 · 예상 약 ${size}`,
  run: '소리 뽑기',
  done: (length: string, size: string, format: string) =>
    `뽑았습니다: ${length} · ${size} · ${format}`,
  suffix: '소리',
};

const en: typeof ko = {
  bar: 'Extract audio',
  hint: 'Pick one video to extract the sound from · MP4, MOV, WebM or MKV · Your video never leaves this device',
  previewLabel: 'Preview',
  sourceTitle: 'Sound in this video',
  source: (codec: string, rate: string, channels: number) =>
    `${codec} · ${rate} kHz · ${channels === 1 ? 'mono' : channels === 2 ? 'stereo' : `${channels} channels`}`,
  formatTitle: 'Format',
  formatGroup: 'Format',
  targets: {
    copy: (format: string) => `${format} (original sound as is)`,
    wav: 'WAV (uncompressed)',
    aac: 'M4A (re-encode as AAC)',
  },
  targetHelp: {
    copy: 'Takes the sound data out of the video without re-encoding. The quality stays the same, it is the fastest, and the size stays as it was.',
    wav: 'Decodes the sound and saves it without compression. Almost every editing program opens it, but it is large (about 10 MB per minute).',
    aac: 'Saves it again as M4A (AAC 192 kbps), which plays on phones and music apps everywhere.',
  },
  copyUnavailable:
    'There is no file format to hold this audio codec as is, so it has to be saved again (WAV or M4A).',
  wavUnavailable: (codec: string) =>
    `This browser cannot decode this sound (${codec}), so it cannot be saved as WAV.`,
  aacUnavailable: 'This browser cannot save AAC.',
  nothing:
    'This browser has no way to take out this sound. Try a recent Chrome, Edge or Safari on a computer.',
  ready: (format: string, size: string) => `Save as ${format} · about ${size}`,
  run: 'Extract audio',
  done: (length: string, size: string, format: string) => `Done: ${length} · ${size} · ${format}`,
  suffix: 'audio',
};

export const MESSAGES: Record<Locale, typeof ko> = { ko, en };
