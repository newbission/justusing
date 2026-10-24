/** 동영상 자르기 화면의 문구 (동영상 공통 문구는 src/lib/video/messages.ts) */
import type { Locale } from '../../../i18n/locales';

const ko = {
  bar: '자르기',
  hint: '자를 동영상 한 개를 고르세요 · MP4·MOV·WebM·MKV · 동영상은 이 기기를 떠나지 않습니다',
  previewLabel: '미리보기',
  timeline: '자를 구간',
  timelineHelp:
    '초록 구간이 남길 부분입니다. 양쪽 손잡이를 끌거나 방향키로 옮깁니다 (0.1초씩, Shift와 함께 1초씩). 막대를 누르면 그 위치로 갑니다.',
  startHandle: '시작',
  endHandle: '끝',
  setStart: '지금 위치를 시작으로',
  setEnd: '지금 위치를 끝으로',
  playRange: '고른 구간 재생',
  start: '시작',
  end: '끝',
  timeHelp: '분:초 또는 초로 적습니다 (예: 1:05.5, 65.5).',
  length: (time: string) => `남는 길이 ${time}`,
  modeTitle: '자르는 방법',
  modeGroup: '자르는 방법',
  modes: {
    fast: {
      label: '빠르게 (다시 인코딩 없음)',
      help: '화질이 그대로이고 몇 초면 끝납니다. 동영상은 몇 초마다 있는 키프레임부터 풀 수 있어서, 시작 앞의 가장 가까운 키프레임부터 담고 고른 시점부터 재생되게 표시합니다. 대부분의 플레이어는 고른 시점부터 보여 주지만, 일부 편집 프로그램은 그 앞 몇 장면을 보여 줄 수 있습니다.',
    },
    exact: {
      label: '정확하게 (다시 인코딩)',
      help: '고른 장면에서 정확히 시작하고 어느 프로그램에서나 같게 보입니다. 화면을 다시 저장하므로 동영상 길이만큼 시간이 걸리고 화질이 아주 조금 바뀔 수 있습니다. 소리는 다시 인코딩하지 않고 옮깁니다.',
    },
  },
  exactUnavailable: '이 브라우저에서는 다시 인코딩할 수 없어 빠르게 자르기만 됩니다.',
  ready: (start: string, end: string, length: string) => `${start} ~ ${end} (${length}) 남기기`,
  tooShort: '시작과 끝 사이가 너무 짧습니다. 0.1초 이상 남겨 주세요.',
  run: '자르기',
  done: (length: string, size: string) => `잘랐습니다: ${length} · ${size}`,
  droppedAudio: ' · 이 브라우저가 소리를 옮기지 못해 소리가 빠졌습니다',
  /** 결과 파일 이름 뒤에 붙는 말 */
  suffix: '자름',
};

const en: typeof ko = {
  bar: 'Trim',
  hint: 'Pick one video to trim · MP4, MOV, WebM or MKV · Your video never leaves this device',
  previewLabel: 'Preview',
  timeline: 'Part to keep',
  timelineHelp:
    'The green part is what you keep. Drag the handles on both sides or move them with the arrow keys (0.1 s, or 1 s with Shift). Click the bar to jump there.',
  startHandle: 'Start',
  endHandle: 'End',
  setStart: 'Set start here',
  setEnd: 'Set end here',
  playRange: 'Play selection',
  start: 'Start',
  end: 'End',
  timeHelp: 'Type minutes:seconds or seconds (for example 1:05.5 or 65.5).',
  length: (time: string) => `Length ${time}`,
  modeTitle: 'How to trim',
  modeGroup: 'How to trim',
  modes: {
    fast: {
      label: 'Fast (no re-encoding)',
      help: 'Keeps the original quality and takes seconds. Video can only be decoded from key frames, which come every few seconds, so the file starts at the nearest key frame before your start and is marked to play from your start. Most players start exactly there, but some editing programs may show a few frames before it.',
    },
    exact: {
      label: 'Precise (re-encode)',
      help: 'Starts exactly at the frame you chose and looks the same in every program. The picture is saved again, so it takes about as long as the video and the quality may change very slightly. The sound is moved over without re-encoding.',
    },
  },
  exactUnavailable: 'This browser cannot re-encode video, so only fast trimming is available.',
  ready: (start: string, end: string, length: string) => `Keep ${start} to ${end} (${length})`,
  tooShort: 'The part between start and end is too short. Keep at least 0.1 seconds.',
  run: 'Trim',
  done: (length: string, size: string) => `Trimmed: ${length} · ${size}`,
  droppedAudio: ' · The sound was removed because this browser could not move it over',
  suffix: 'trimmed',
};

export const MESSAGES: Record<Locale, typeof ko> = { ko, en };
