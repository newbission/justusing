/**
 * 용량 줄이기 계획: 소리를 어떻게 할지, 동영상 비트레이트, 예상 용량.
 * 화면(미리 알리기·예상 용량)과 처리 코드(engine.ts)가 같은 규칙을 쓴다.
 */
import { guessBitrate, minimumBitrate, scaledSize, type QualityLevel } from './sizes';
import type { VideoInfo } from './types';

/** 다시 저장한 소리의 비트레이트 (bit/s) */
export const AUDIO_BITRATE = 128_000;
/** 소리만 뽑아 M4A(AAC)로 다시 저장할 때의 비트레이트. 소리만 듣는 파일이라 넉넉히 */
export const EXTRACT_AAC_BITRATE = 192_000;

export type AudioPlan = 'copy' | 'aac' | 'opus' | 'drop';

/**
 * 결과 그릇에 소리를 담는 방법. 옮길 수 있으면 그대로 옮기고, 아니면 그 그릇의 흔한 코덱으로 다시 저장한다.
 * MP4: AAC·MP3는 옮기고, 그 밖은 AAC로 (못 하면 MP4에 들어가는 Opus·FLAC는 옮긴다). WebM: Opus·Vorbis는 옮기고 그 밖은 Opus로
 */
export function audioPlan(
  codec: string | null,
  container: 'mp4' | 'webm',
  encodable: { aac: boolean; opus: boolean },
): AudioPlan {
  if (container === 'mp4') {
    if (codec === 'aac' || codec === 'mp3') return 'copy';
    if (encodable.aac) return 'aac';
    return codec === 'opus' || codec === 'flac' ? 'copy' : 'drop';
  }
  if (codec === 'opus' || codec === 'vorbis') return 'copy';
  return encodable.opus ? 'opus' : 'drop';
}

/** 원래 소리를 다시 인코딩 없이 담을 그릇 (소리 뽑기). 없으면 다시 저장해야 한다 */
export function audioContainerFor(
  codec: string | null | undefined,
): 'm4a' | 'mp3' | 'ogg' | 'flac' | 'wav' | undefined {
  if (codec === 'aac') return 'm4a';
  if (codec === 'mp3') return 'mp3';
  if (codec === 'opus' || codec === 'vorbis') return 'ogg';
  if (codec === 'flac') return 'flac';
  if (codec?.startsWith('pcm-')) return 'wav';
  return undefined;
}

/** 원본 동영상(화면)의 비트레이트 어림: 파일 전체에서 소리를 뺀다 */
function sourceVideoBitrate(info: VideoInfo): number {
  const total = (info.size * 8) / Math.max(0.1, info.duration);
  return Math.max(0, total - (info.audio?.bitrate ?? 0));
}

export type CompressSetting =
  { mode: 'quality'; level: QualityLevel } | { mode: 'target'; /** 바이트 */ bytes: number };

export interface CompressPlan {
  width: number;
  height: number;
  /** 동영상 비트레이트 (bit/s). 목표 용량이 소리보다 작으면 0 */
  videoBitrate: number;
  audio: AudioPlan | 'none';
  /** 예상 결과 크기 (바이트) */
  estimate: number;
  /** 목표 용량 비트레이트가 볼 만한 화질의 하한보다 낮다 */
  tooLow: boolean;
}

export function compressPlan(
  info: VideoInfo,
  shortSide: number,
  container: 'mp4' | 'webm',
  setting: CompressSetting,
): CompressPlan {
  const video = info.video!;
  const size = scaledSize(video.width, video.height, shortSide);
  const audio = info.audio ? audioPlan(info.audio.codec, container, info.audioEncodable) : 'none';
  const audioBitrate =
    audio === 'copy'
      ? (info.audio?.bitrate ?? 0)
      : audio === 'none' || audio === 'drop'
        ? 0
        : AUDIO_BITRATE;
  const minimum = minimumBitrate(size.width, size.height);

  let videoBitrate: number;
  if (setting.mode === 'quality') {
    const guess = guessBitrate(size.width, size.height, video.frameRate, setting.level);
    // 원본보다 화소마다 비트를 더 쓰지 않는다 (이미 작게 저장된 영상이 커지지 않게)
    const pixels = (size.width * size.height) / (video.width * video.height);
    const cap = sourceVideoBitrate(info) * pixels * 0.9;
    videoBitrate = Math.round(Math.max(Math.min(guess, cap), Math.min(guess, minimum)));
  } else {
    // 그릇의 목차 등으로 3%쯤 남겨 둔다
    const bits = setting.bytes * 8 * 0.97;
    videoBitrate = Math.max(0, Math.round(bits / Math.max(0.1, info.duration) - audioBitrate));
  }
  const estimate = Math.round(((videoBitrate + audioBitrate) * info.duration) / 8 / 0.97);
  return {
    ...size,
    videoBitrate,
    audio,
    estimate,
    tooLow: setting.mode === 'target' && videoBitrate < minimum,
  };
}
