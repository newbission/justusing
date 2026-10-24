/**
 * 동영상 도구의 '시작 → 진행률 → 결과 받기' 상태 (세 도구가 같이 쓴다).
 * 결과는 설정과 함께 둔다. 설정을 바꾸면 도구가 key로 지난 결과를 가린다.
 */
import { pick } from '../../frame/locale';
import { VIDEO_MESSAGES } from './messages';
import { formatTime, remainingSeconds } from './time';
import { VideoError, runVideoJob, type RunningJob } from './video';
import type { VideoFailure, VideoJob, VideoResult } from './types';

const t = pick(VIDEO_MESSAGES);

export type JobState =
  | { kind: 'idle' }
  | { kind: 'working'; progress: number; startedAt: number; key: string }
  | { kind: 'done'; result: VideoResult; key: string }
  | { kind: 'failed'; reason: VideoFailure; key: string }
  | { kind: 'canceled' };

export class VideoJobRunner {
  state = $state.raw<JobState>({ kind: 'idle' });
  private running: RunningJob | undefined;
  /** 시작할 때마다 늘어난다. 그만두거나 새로 시작한 뒤 늦게 온 결과를 버린다 */
  private ticket = 0;

  get working() {
    return this.state.kind === 'working';
  }

  /** 지금 설정(key)의 결과 */
  resultFor(key: string): VideoResult | undefined {
    return this.state.kind === 'done' && this.state.key === key ? this.state.result : undefined;
  }

  failureFor(key: string): VideoFailure | undefined {
    return this.state.kind === 'failed' && this.state.key === key ? this.state.reason : undefined;
  }

  async start(file: Blob, job: VideoJob, key: string): Promise<VideoResult | undefined> {
    this.stop();
    const ticket = ++this.ticket;
    const startedAt = Date.now();
    this.state = { kind: 'working', progress: 0, startedAt, key };
    const running = runVideoJob(file, job, (progress) => {
      if (ticket === this.ticket) this.state = { kind: 'working', progress, startedAt, key };
    });
    this.running = running;
    try {
      const result = await running.result;
      if (ticket !== this.ticket) return undefined;
      this.state = { kind: 'done', result, key };
      return result;
    } catch (error) {
      if (ticket !== this.ticket) return undefined;
      this.state = {
        kind: 'failed',
        reason: error instanceof VideoError ? error.reason : 'failed',
        key,
      };
      return undefined;
    } finally {
      if (ticket === this.ticket) this.running = undefined;
    }
  }

  /** 그만두기 (진행 중이 아니면 아무것도 하지 않는다) */
  cancel() {
    if (this.state.kind !== 'working') return;
    this.stop();
    this.state = { kind: 'canceled' };
  }

  /** 다른 파일을 열었다: 하던 일을 그만두고 처음으로 */
  reset() {
    this.stop();
    this.state = { kind: 'idle' };
  }

  private stop() {
    this.ticket++;
    this.running?.cancel();
    this.running = undefined;
  }
}

/** 진행 중 안내 ('처리하는 중… 45% · 남은 시간 약 0:30') */
export function progressText(state: Extract<JobState, { kind: 'working' }>, now = Date.now()) {
  if (state.progress <= 0) return t.starting;
  const percent = Math.min(99, Math.floor(state.progress * 100));
  const left = remainingSeconds(state.progress, now - state.startedAt);
  return t.progress(percent) + (left === undefined ? '' : t.remaining(formatTime(left, 0)));
}
