/**
 * 동영상 처리 (video.ts가 처음 쓸 때 불러온다). 파일은 이 문서 안에서만 읽고, 결과는 Blob으로 돌려준다.
 *
 * 워커가 아니라 도구 화면(frame)에서 돈다: 격리 frame(출처 null) 안에서 blob URL로 띄운 워커는 안전한 문맥
 * (secure context)이 아니어서 WebCodecs(VideoDecoder 등)가 아예 없다 (크롬에서 확인, 2026-10-23).
 * 무거운 풀기·다시 저장하기는 브라우저가 WebCodecs 뒤에서 따로 돌리므로 화면이 멈추지 않는다.
 *
 * 그릇(MP4·MOV·WebM·MKV) 읽기·쓰기는 mediabunny가 하고, 풀기·다시 저장하기는 브라우저의 WebCodecs가 한다.
 * 파일은 통째로 읽지 않고 필요한 부분만 잘라 읽는다(BlobSource). 결과는 Blob 조각으로 모은다(BlobCollector).
 * 다시 인코딩하지 않는 일(빠르게 자르기, 소리 그대로 뽑기)은 WebCodecs가 없는 브라우저에서도 된다.
 */
import {
  BlobSource,
  Conversion,
  FlacOutputFormat,
  Input,
  MATROSKA,
  MkvOutputFormat,
  MovOutputFormat,
  MP4,
  Mp3OutputFormat,
  Mp4OutputFormat,
  OggOutputFormat,
  Output,
  QTFF,
  Quality,
  StreamTarget,
  WavOutputFormat,
  WEBM,
  WebMOutputFormat,
  canEncodeAudio,
  canEncodeVideo,
  getFirstEncodableVideoCodec,
  type ConversionAudioOptions,
  type ConversionOptions,
  type InputAudioTrack,
  type InputFormat,
  type OutputFormat,
} from 'mediabunny';
import { BlobCollector } from './blob-target';
import { AUDIO_BITRATE, EXTRACT_AAC_BITRATE, audioContainerFor, audioPlan } from './plan';
import { SHORT_SIDES, guessBitrate, scaledSize } from './sizes';
import type {
  AudioJob,
  CompressJob,
  Container,
  EncodeCodec,
  OutputContainer,
  TrimJob,
  VideoFailure,
  VideoInfo,
  VideoJob,
  VideoResult,
} from './types';

/** 읽는 그릇. 쓰지 않는 그릇(HLS·MP3·Ogg 등)의 읽기 코드는 번들에 넣지 않는다 */
const FORMATS = [MP4, QTFF, WEBM, MATROSKA];

export class VideoError extends Error {
  constructor(readonly reason: VideoFailure) {
    super(reason);
  }
}

/** 빠르게 자를 때 시작 앞으로 넓혀 담을 수 있는 가장 긴 길이 (초). Matroska 한계(32.767초)보다 넉넉히 작게 */
export const FAST_TRIM_MAX_LEAD = 10;

/** 비트레이트(bit/s)로 정한 화질. new Quality(숫자)는 비트레이트가 아니라 화질 단계(0~1)라 쓰지 않는다 */
function bitrate(value: number) {
  return new Quality({ bitrate: Math.max(1, Math.round(value)) });
}

function containerOf(format: InputFormat): Container {
  if (format === QTFF) return 'mov';
  if (format === WEBM) return 'webm';
  if (format === MATROSKA) return 'mkv';
  return 'mp4';
}

function outputFormat(container: OutputContainer): OutputFormat {
  switch (container) {
    case 'mp4':
    case 'm4a':
      // 앞쪽 목차(moov)를 끝에 둔다: 결과 전체를 메모리에 들고 있지 않아도 된다
      return new Mp4OutputFormat({ fastStart: false });
    case 'mov':
      return new MovOutputFormat({ fastStart: false });
    case 'webm':
      return new WebMOutputFormat();
    case 'mkv':
      return new MkvOutputFormat();
    case 'mp3':
      return new Mp3OutputFormat();
    case 'ogg':
      return new OggOutputFormat();
    case 'flac':
      return new FlacOutputFormat();
    case 'wav':
      return new WavOutputFormat();
  }
}

const MIME: Record<OutputContainer, string> = {
  mp4: 'video/mp4',
  mov: 'video/quicktime',
  webm: 'video/webm',
  mkv: 'video/x-matroska',
  m4a: 'audio/mp4',
  mp3: 'audio/mpeg',
  ogg: 'audio/ogg',
  flac: 'audio/flac',
  wav: 'audio/wav',
};

async function openInput(file: Blob) {
  const input = new Input({ source: new BlobSource(file), formats: FORMATS });
  let readable = false;
  try {
    readable = await input.canRead();
  } catch {
    readable = false;
  }
  if (!readable) throw new VideoError('unreadable');
  return input;
}

/** 파일의 그릇·길이·트랙·코덱과 이 브라우저가 다시 저장할 수 있는지 읽는다. 못 읽으면 VideoError */
export async function probe(file: Blob): Promise<VideoInfo> {
  const input = await openInput(file);
  try {
    const format = await input.getFormat();
    const videoTrack = await input.getPrimaryVideoTrack();
    const audioTrack = await input.getPrimaryAudioTrack();
    if (!videoTrack && !audioTrack) throw new VideoError('noTrack');
    const duration = await input.computeDuration();

    let video: VideoInfo['video'];
    const encodable: VideoInfo['encodable'] = {};
    const originalCodecs: EncodeCodec[] = [];
    if (videoTrack) {
      const stats = await videoTrack.computePacketStats(120);
      const width = await videoTrack.getDisplayWidth();
      const height = await videoTrack.getDisplayHeight();
      const codec = await videoTrack.getCodec();
      const frameRate = stats.averagePacketRate || 30;
      video = {
        codec,
        width,
        height,
        frameRate,
        canDecode: codec !== null && (await videoTrack.canDecode()),
      };
      for (const side of SHORT_SIDES) {
        const size = scaledSize(width, height, side);
        encodable[side] = (await getFirstEncodableVideoCodec(['avc', 'vp9'], {
          ...size,
          frameRate,
          quality: bitrate(guessBitrate(size.width, size.height, frameRate, 'medium')),
        })) as EncodeCodec | null;
      }
      const original = scaledSize(width, height, 0);
      for (const codec of ['avc', 'vp9'] as const) {
        const options = {
          ...original,
          frameRate,
          quality: bitrate(guessBitrate(original.width, original.height, frameRate, 'high')),
        };
        if (await canEncodeVideo(codec, options)) originalCodecs.push(codec);
      }
    }

    let audio: VideoInfo['audio'];
    let audioEncodable = { aac: false, opus: false };
    if (audioTrack) {
      const stats = await audioTrack.computePacketStats(200);
      const codec = await audioTrack.getCodec();
      const channels = await audioTrack.getNumberOfChannels();
      audio = {
        codec,
        sampleRate: await audioTrack.getSampleRate(),
        channels,
        bitrate: stats.averageBitrate,
        canDecode: codec !== null && (await audioTrack.canDecode()),
      };
      const stereo = Math.min(2, channels);
      audioEncodable = {
        aac: await canEncodeAudio('aac', { numberOfChannels: stereo, sampleRate: 48000 }),
        opus: await canEncodeAudio('opus', { numberOfChannels: stereo, sampleRate: 48000 }),
      };
    }

    return {
      container: containerOf(format),
      duration,
      size: file.size,
      video,
      audio,
      encodable,
      originalCodecs,
      audioEncodable,
    };
  } finally {
    input.dispose();
  }
}

/** 다시 저장할 소리 설정 (규칙은 plan.ts의 audioPlan) */
function audioFor(container: 'mp4' | 'webm') {
  return async (track: InputAudioTrack): Promise<ConversionAudioOptions> => {
    const channels = Math.min(2, await track.getNumberOfChannels());
    const options = { numberOfChannels: channels, sampleRate: 48000 };
    const plan = audioPlan(await track.getCodec(), container, {
      aac: await canEncodeAudio('aac', options),
      opus: await canEncodeAudio('opus', options),
    });
    if (plan === 'copy') return {};
    if (plan === 'drop') return { discard: true };
    return { codec: plan, quality: bitrate(AUDIO_BITRATE), numberOfChannels: channels };
  };
}

interface Plan {
  container: OutputContainer;
  options: Omit<ConversionOptions, 'input' | 'output'>;
  /** 이 트랙이 빠지면 실패다 (그때의 실패 이유) */
  needs: 'video' | 'audio';
}

async function planTrim(input: Input, job: TrimJob): Promise<Plan> {
  const container = containerOf(await input.getFormat());
  const track = await input.getPrimaryVideoTrack();
  // 정확하게: 그릇에 흔히 쓰는 코덱으로 (WebM은 VP9, 나머지는 H.264). 못 하면 mediabunny가 그릇에 맞는 다른 코덱을 고른다
  const preferred: EncodeCodec = container === 'webm' ? 'vp9' : 'avc';
  const codec =
    job.exact &&
    track &&
    (await canEncodeVideo(preferred, {
      width: await track.getDisplayWidth(),
      height: await track.getDisplayHeight(),
    }))
      ? preferred
      : undefined;
  return {
    container,
    needs: track ? 'video' : 'audio',
    options: {
      trim: { start: job.start, end: job.end },
      // 빠르게: 시작 앞의 가장 가까운 키프레임부터 옮기고 고른 시점부터 재생되게 적는다 (MP4·MOV는 편집 목록).
      // 키프레임이 너무 멀면 옮기지 않는다(실패 'copy' → 화면이 '정확하게'를 권한다). WebM·MKV는 32.767초 넘게 앞선
      // 블록을 담지 못해 말없이 버리고(풀 수 없는 파일이 됨), MP4·MOV도 숨긴 앞부분이 길게 파일에 남는다
      copy: job.exact
        ? { mode: 'preferred' }
        : { mode: 'forced', boundaryPolicy: 'expand', boundaryTolerance: FAST_TRIM_MAX_LEAD },
      video: job.exact ? { forceTranscode: true, codec, quality: new Quality('high') } : {},
      audio: {},
    },
  };
}

async function planCompress(input: Input, job: CompressJob): Promise<Plan> {
  const track = await input.getPrimaryVideoTrack();
  if (!track) throw new VideoError('noTrack');
  const size = scaledSize(
    await track.getDisplayWidth(),
    await track.getDisplayHeight(),
    job.shortSide,
  );
  const stats = await track.computePacketStats(120);
  const quality = bitrate(job.videoBitrate);
  const codec = await getFirstEncodableVideoCodec(['avc', 'vp9'], {
    ...size,
    frameRate: stats.averagePacketRate || 30,
    quality,
  });
  if (!codec) throw new VideoError('encode');
  const container = codec === 'avc' ? 'mp4' : 'webm';
  return {
    container,
    needs: 'video',
    options: {
      tracks: 'primary',
      video: { ...size, fit: 'fill', codec, quality, forceTranscode: true },
      audio: audioFor(container),
    },
  };
}

async function planAudio(input: Input, job: AudioJob): Promise<Plan> {
  const track = await input.getPrimaryAudioTrack();
  if (!track) throw new VideoError('noTrack');
  const common = { tracks: 'primary', video: { discard: true } } as const;
  if (job.target === 'wav') {
    return {
      container: 'wav',
      needs: 'audio',
      options: { ...common, audio: { codec: 'pcm-s16' } },
    };
  }
  if (job.target === 'aac') {
    const channels = Math.min(2, await track.getNumberOfChannels());
    return {
      container: 'm4a',
      needs: 'audio',
      options: {
        ...common,
        audio: { codec: 'aac', quality: bitrate(EXTRACT_AAC_BITRATE), numberOfChannels: channels },
      },
    };
  }
  const container = audioContainerFor(await track.getCodec());
  if (!container) throw new VideoError('copy');
  return {
    container,
    needs: 'audio',
    options: { ...common, copy: { mode: 'forced' }, audio: {} },
  };
}

/** 실패한 트랙의 까닭을 화면에 보일 이유로 */
function reasonOf(discard: string): VideoFailure {
  if (discard === 'undecodable_source_codec' || discard === 'unknown_source_codec') return 'decode';
  if (discard === 'no_encodable_target_codec') return 'encode';
  if (discard === 'cannot_copy') return 'copy';
  return 'failed';
}

export interface Running {
  /** 결과. 실패하거나 그만두면 VideoError */
  result: Promise<VideoResult>;
  cancel: () => void;
}

/** 일을 시작한다. 진행률(0~1)은 onProgress로 알린다 */
export function run(file: Blob, job: VideoJob, onProgress: (progress: number) => void): Running {
  let conversion: Conversion | undefined;
  let canceled = false;
  const result = (async () => {
    try {
      return await convert(file, job, onProgress, (started) => {
        conversion = started;
        return canceled;
      });
    } catch (error) {
      if (error instanceof VideoError) throw error;
      throw new VideoError(error instanceof RangeError ? 'memory' : 'failed');
    }
  })();
  return {
    result,
    cancel: () => {
      canceled = true;
      void conversion?.cancel().catch(() => undefined);
    },
  };
}

async function convert(
  file: Blob,
  job: VideoJob,
  onProgress: (progress: number) => void,
  /** 변환을 만들었다고 알린다. 그사이 그만두었으면 true */
  started: (conversion: Conversion) => boolean,
): Promise<VideoResult> {
  const input = await openInput(file);
  try {
    const plan =
      job.kind === 'trim'
        ? await planTrim(input, job)
        : job.kind === 'compress'
          ? await planCompress(input, job)
          : await planAudio(input, job);

    const collector = new BlobCollector();
    const output = new Output({
      format: outputFormat(plan.container),
      // 4MiB씩 모아 쓴다 (조각이 너무 잘게 나뉘지 않게)
      target: new StreamTarget(collector.writable, { chunked: true, chunkSize: 4 * 1024 * 1024 }),
    });
    const conversion = await Conversion.init({
      input,
      output,
      showWarnings: false,
      ...plan.options,
    });
    const needed = conversion.discardedTracks.find(
      (discarded) =>
        discarded.track.type === plan.needs && discarded.reason !== 'discarded_by_user',
    );
    if (needed) throw new VideoError(reasonOf(needed.reason));
    if (!conversion.isValid) throw new VideoError('failed');
    const hadAudio = (await input.getPrimaryAudioTrack()) !== null;
    const droppedAudio =
      plan.needs === 'video' &&
      hadAudio &&
      !conversion.utilizedTracks.some((track) => track.type === 'audio');

    let last = 0;
    conversion.onProgress = (progress) => {
      const now = Date.now();
      if (now - last < 200) return;
      last = now;
      onProgress(progress);
    };
    if (started(conversion)) throw new VideoError('failed');
    await conversion.execute();

    const blob = collector.toBlob(MIME[plan.container]);
    const expected = job.kind === 'trim' ? job.end - job.start : await input.computeDuration();
    const described = await describe(blob, plan.container, expected);
    return {
      ...described,
      // 빠르게 자른 MP4는 앞뒤 장면을 편집 목록으로 가린다. 다시 읽으면 가린 장면까지 세므로 고른 길이를 쓴다
      duration: job.kind === 'trim' ? expected : described.duration,
      blob,
      container: plan.container,
      droppedAudio,
    };
  } finally {
    input.dispose();
  }
}

/**
 * 만든 결과를 다시 읽어 길이·크기·코덱을 잰다 (화면에 보인다).
 * 소리 그릇(MP3·Ogg·FLAC·WAV)은 읽는 코드를 번들에 넣지 않으려고 다시 읽지 않고 원본에서 고른 길이를 쓴다
 */
async function describe(blob: Blob, container: OutputContainer, fallbackDuration: number) {
  if (!['mp4', 'mov', 'webm', 'mkv', 'm4a'].includes(container)) {
    return { duration: fallbackDuration };
  }
  const input = new Input({
    source: new BlobSource(blob),
    formats: [...FORMATS],
  });
  try {
    const video = await input.getPrimaryVideoTrack().catch(() => null);
    const audio = await input.getPrimaryAudioTrack().catch(() => null);
    return {
      duration: await input.computeDuration().catch(() => 0),
      width: await video?.getDisplayWidth(),
      height: await video?.getDisplayHeight(),
      videoCodec: await video?.getCodec(),
      audioCodec: await audio?.getCodec(),
    };
  } catch {
    return { duration: 0 };
  } finally {
    input.dispose();
  }
}
