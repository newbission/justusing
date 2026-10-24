/**
 * 동영상 도구 공통: 파일 정보 읽기와 자르기·다시 저장·소리 뽑기 (화면 쪽 입구).
 * 처리 코드(engine.ts, mediabunny)는 처음 파일을 열 때 불러온다. 도구 페이지를 열기만 해서는 받지 않는다.
 * 파일은 어디로도 보내지 않는다.
 */
import type { VideoFailure, VideoInfo, VideoJob, VideoResult } from './types';

export type * from './types';

export class VideoError extends Error {
  constructor(readonly reason: VideoFailure) {
    super(reason);
  }
}

/**
 * 이 브라우저의 WebCodecs. 다시 인코딩하는 일(정확하게 자르기·용량 줄이기·WAV·M4A로 바꾸기)에만 필요하다.
 * 그릇만 바꾸는 일(빠르게 자르기, 소리 그대로 뽑기)은 없어도 된다.
 * (Safari 16.4~18은 동영상만 있고 소리 풀기·저장(AudioDecoder·AudioEncoder)은 Safari 26부터)
 */
export function webCodecs() {
  const has = (name: string) => typeof (globalThis as Record<string, unknown>)[name] === 'function';
  return {
    video: has('VideoDecoder') && has('VideoEncoder'),
    audioDecode: has('AudioDecoder'),
    audioEncode: has('AudioDecoder') && has('AudioEncoder'),
  };
}

let engine: Promise<typeof import('./engine')> | undefined;

function loadEngine() {
  return (engine ??= import('./engine').catch((error: unknown) => {
    engine = undefined;
    throw error;
  }));
}

/** 엔진이 던진 오류를 화면 쪽 VideoError로 (엔진은 따로 불러와 클래스가 다르다) */
function toError(error: unknown): VideoError {
  const reason = (error as { reason?: VideoFailure } | undefined)?.reason;
  return new VideoError(reason ?? 'failed');
}

/** 파일의 그릇·길이·트랙·코덱과 이 브라우저가 다시 저장할 수 있는지 읽는다. 못 읽으면 VideoError */
export async function probeVideo(file: Blob): Promise<VideoInfo> {
  try {
    return await (await loadEngine()).probe(file);
  } catch (error) {
    throw toError(error);
  }
}

export interface RunningJob {
  /** 결과. 실패하거나 그만두면 VideoError (그만둔 쪽은 결과를 보지 않는다) */
  result: Promise<VideoResult>;
  cancel: () => void;
}

/** 일을 시작한다. 진행률(0~1)은 onProgress로 알린다 */
export function runVideoJob(
  file: Blob,
  job: VideoJob,
  onProgress: (progress: number) => void,
): RunningJob {
  let cancel: (() => void) | undefined;
  let canceled = false;
  const result = loadEngine()
    .then((loaded) => {
      if (canceled) throw new VideoError('failed');
      const running = loaded.run(file, job, onProgress);
      cancel = running.cancel;
      return running.result;
    })
    .catch((error: unknown) => {
      throw toError(error);
    });
  return {
    result,
    cancel: () => {
      canceled = true;
      cancel?.();
    },
  };
}
