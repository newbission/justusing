/**
 * 동영상 도구가 화면과 처리 코드(engine.ts) 사이에 주고받는 것.
 * 파일 자체는 File(Blob)로 넘기고 처리 코드가 필요한 부분만 잘라 읽는다. 어디로도 보내지 않는다.
 */

/** 읽을 수 있는 그릇(컨테이너) */
export type Container = 'mp4' | 'mov' | 'webm' | 'mkv';

/** 결과 그릇. 소리만 뽑을 때는 소리 그릇도 쓴다 */
export type OutputContainer = Container | 'm4a' | 'mp3' | 'ogg' | 'flac' | 'wav';

export interface VideoTrackInfo {
  /** mediabunny 코덱 이름 (avc·hevc·vp9·av1·vp8·prores). 모르는 코덱이면 null */
  codec: string | null;
  /** 화면에 보이는 크기 (회전 반영) */
  width: number;
  height: number;
  /** 초당 장면 수 (앞부분으로 어림) */
  frameRate: number;
  /** 이 브라우저가 풀 수 있는지 (VideoDecoder.isConfigSupported) */
  canDecode: boolean;
}

export interface AudioTrackInfo {
  /** mediabunny 코덱 이름 (aac·opus·mp3·vorbis·flac·ac3·pcm-s16 …). 모르는 코덱이면 null */
  codec: string | null;
  sampleRate: number;
  channels: number;
  /** 평균 비트레이트 (bit/s, 앞부분으로 어림) */
  bitrate: number;
  canDecode: boolean;
}

/** 다시 저장할 때 쓸 수 있는 코덱. avc → MP4, vp9 → WebM */
export type EncodeCodec = 'avc' | 'vp9';

export interface VideoInfo {
  container: Container;
  /** 길이 (초) */
  duration: number;
  /** 파일 크기 (바이트) */
  size: number;
  video?: VideoTrackInfo;
  audio?: AudioTrackInfo;
  /** 높이(짧은 변) 후보마다 이 브라우저가 다시 저장할 수 있는 첫 코덱. 0은 원래 크기 */
  encodable: Record<number, EncodeCodec | null>;
  /** 소리를 다시 저장할 수 있는지 */
  audioEncodable: { aac: boolean; opus: boolean };
}

/** 자르기: 시작~끝(초). exact가 false면 다시 인코딩하지 않는다 */
export interface TrimJob {
  kind: 'trim';
  start: number;
  end: number;
  exact: boolean;
}

/** 용량 줄이기: 짧은 변(0은 원래 크기)과 동영상 비트레이트(bit/s) */
export interface CompressJob {
  kind: 'compress';
  shortSide: number;
  videoBitrate: number;
}

/** 소리 뽑기: copy는 원래 소리 그대로, wav는 풀어서, aac는 M4A로 다시 저장 */
export interface AudioJob {
  kind: 'audio';
  target: 'copy' | 'wav' | 'aac';
}

export type VideoJob = TrimJob | CompressJob | AudioJob;

/**
 * 실패 이유.
 * - unreadable: 동영상으로 읽지 못함 (지원하지 않는 그릇, 깨진 파일)
 * - noTrack: 할 일에 필요한 트랙이 없음 (예: 소리 없는 동영상에서 소리 뽑기)
 * - decode: 이 브라우저가 이 코덱을 풀지 못함
 * - encode: 이 브라우저가 다시 저장하지 못함
 * - copy: 다시 인코딩 없이 옮기지 못함
 * - memory: 메모리가 모자람
 * - failed: 그 밖의 오류
 */
export type VideoFailure =
  'unreadable' | 'noTrack' | 'decode' | 'encode' | 'copy' | 'memory' | 'failed';

export interface VideoResult {
  blob: Blob;
  container: OutputContainer;
  /** 결과를 다시 읽어 잰 길이 (초) */
  duration: number;
  width?: number;
  height?: number;
  videoCodec?: string | null;
  audioCodec?: string | null;
  /** 원본에 소리가 있었는데 결과에서 빠졌다 (이 브라우저가 그 소리를 옮기지도 다시 저장하지도 못함) */
  droppedAudio: boolean;
}
