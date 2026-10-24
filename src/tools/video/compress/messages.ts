/** 동영상 용량 줄이기 화면의 문구 (동영상 공통 문구는 src/lib/video/messages.ts) */
import type { Locale } from '../../../i18n/locales';
import type { QualityLevel } from '../../../lib/video/sizes';

const ko = {
  bar: '용량 줄이기',
  hint: '줄일 동영상 한 개를 고르세요 · MP4·MOV·WebM·MKV · 동영상은 이 기기를 떠나지 않습니다',
  previewLabel: '미리보기',
  sizeTitle: '해상도',
  sizeGroup: '해상도',
  original: '원래 크기',
  sizeHelp:
    '해상도를 낮추면 용량이 가장 많이 줄어듭니다. 휴대폰으로 보거나 메신저로 보낼 영상은 720p면 충분합니다.',
  cannotEncodeSize: '이 브라우저가 저장하지 못하는 크기',
  qualityTitle: '화질',
  modeGroup: '줄이는 방법',
  modes: { quality: '화질로 고르기', target: '목표 용량으로' },
  levelGroup: '화질',
  levels: {
    high: '높음',
    medium: '보통',
    low: '낮음',
  } satisfies Record<QualityLevel, string>,
  levelHelp: {
    high: '원본과 거의 구별되지 않습니다. 용량은 덜 줄어듭니다.',
    medium: '대부분의 영상에 알맞습니다. 빠른 움직임에서 조금 흐려질 수 있습니다.',
    low: '용량을 많이 줄입니다. 글자·세밀한 무늬가 뭉개질 수 있습니다.',
  } satisfies Record<QualityLevel, string>,
  targetLabel: '목표 용량 (MB)',
  targetHelp:
    '이 용량에 맞게 비트레이트를 정합니다. 인코더에 따라 조금 넘거나 모자랄 수 있으니 제한보다 10% 정도 작게 적으세요.',
  targetTooSmall: '이 용량으로는 화질이 많이 떨어집니다. 해상도를 낮추거나 용량을 늘려 보세요.',
  targetImpossible: '이 용량은 소리만으로도 넘칩니다. 더 크게 적어 주세요.',
  targetInvalid: '목표 용량을 MB 단위 숫자로 적어 주세요 (예: 25).',
  outputTitle: '저장 형식',
  outputMp4: '화면은 H.264, 그릇은 MP4로 저장합니다 (어디서나 열림).',
  outputWebm:
    '이 브라우저는 H.264로 저장하지 못해 VP9·WebM으로 저장합니다. 아이폰·일부 프로그램에서는 열리지 않을 수 있습니다.',
  outputNone:
    '이 브라우저는 동영상을 다시 저장하지 못합니다. 크롬·엣지·Safari 최신판(컴퓨터)에서 열어 주세요.',
  audioCopy: (codec: string) => `소리는 다시 인코딩하지 않고 그대로 옮깁니다 (${codec}).`,
  audioAac: '소리는 AAC로 다시 저장합니다.',
  audioOpus: '소리는 Opus로 다시 저장합니다.',
  audioDropped: '이 브라우저는 이 소리를 옮기거나 다시 저장하지 못해 소리가 빠집니다.',
  noAudio: '소리가 없는 동영상입니다.',
  estimate: (size: string, original: string) => `예상 약 ${size} (원본 ${original})`,
  estimateBigger: (original: string) =>
    `이 설정으로는 원본(${original})보다 작아지지 않습니다. 해상도나 화질을 낮춰 주세요.`,
  run: '줄이기',
  done: (before: string, after: string, percent: number, width: number, height: number) =>
    `${before} → ${after} (${percent}% 줄임) · ${width}×${height}`,
  noGain: (after: string) =>
    `결과(${after})가 원본보다 작아지지 않았습니다. 해상도나 화질을 더 낮춰 보세요.`,
  droppedAudio: ' · 소리가 빠졌습니다',
  suffix: '줄임',
};

const en: typeof ko = {
  bar: 'Compress',
  hint: 'Pick one video to compress · MP4, MOV, WebM or MKV · Your video never leaves this device',
  previewLabel: 'Preview',
  sizeTitle: 'Resolution',
  sizeGroup: 'Resolution',
  original: 'Original',
  sizeHelp:
    'Lowering the resolution saves the most space. 720p is plenty for videos watched on phones or sent through chat apps.',
  cannotEncodeSize: 'This browser cannot save this size',
  qualityTitle: 'Quality',
  modeGroup: 'How to compress',
  modes: { quality: 'By quality', target: 'By target size' },
  levelGroup: 'Quality',
  levels: { high: 'High', medium: 'Medium', low: 'Low' },
  levelHelp: {
    high: 'Hard to tell from the original. Saves less space.',
    medium: 'Suits most videos. Fast motion may get slightly blurry.',
    low: 'Saves a lot of space. Text and fine patterns may get smudged.',
  },
  targetLabel: 'Target size (MB)',
  targetHelp:
    'The bitrate is set to fit this size. The encoder may land a little above or below, so aim about 10% under your limit.',
  targetTooSmall:
    'The quality will drop a lot at this size. Lower the resolution or allow a larger size.',
  targetImpossible: 'The sound alone is larger than this. Please enter a larger size.',
  targetInvalid: 'Enter the target size as a number in MB (for example 25).',
  outputTitle: 'Format',
  outputMp4: 'The picture is saved as H.264 in an MP4 file (opens everywhere).',
  outputWebm:
    'This browser cannot save H.264, so it saves VP9 in a WebM file. It may not open on iPhones or in some programs.',
  outputNone:
    'This browser cannot re-encode video. Please open this page in a recent Chrome, Edge or Safari on a computer.',
  audioCopy: (codec: string) => `The sound is moved over without re-encoding (${codec}).`,
  audioAac: 'The sound is saved again as AAC.',
  audioOpus: 'The sound is saved again as Opus.',
  audioDropped: 'This browser cannot move over or re-encode this sound, so it will be removed.',
  noAudio: 'This video has no sound.',
  estimate: (size: string, original: string) => `About ${size} (original ${original})`,
  estimateBigger: (original: string) =>
    `These settings will not make it smaller than the original (${original}). Lower the resolution or quality.`,
  run: 'Compress',
  done: (before: string, after: string, percent: number, width: number, height: number) =>
    `${before} → ${after} (${percent}% smaller) · ${width}×${height}`,
  noGain: (after: string) =>
    `The result (${after}) is not smaller than the original. Try a lower resolution or quality.`,
  droppedAudio: ' · The sound was removed',
  suffix: 'compressed',
};

export const MESSAGES: Record<Locale, typeof ko> = { ko, en };
