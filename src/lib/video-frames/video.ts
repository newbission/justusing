/**
 * 고른 동영상을 브라우저 <video>로 열고, 원하는 시각의 장면을 canvas에 그린다 (동영상을 GIF로, 장면 캡처).
 *
 * 동영상 풀기는 브라우저가 한다 (ffmpeg.wasm 같은 큰 엔진을 받지 않는다). 그래서 이 브라우저가 재생하는
 * 형식만 열린다 (대개 MP4(H.264)·WebM, Safari는 HEVC·MOV도). 파일은 blob URL로만 열고 어디로도 보내지 않는다.
 */
import { END_MARGIN } from './times';

/** 열기를 기다리는 가장 긴 시간. 재생하지 못하는 형식은 오류 없이 멈춰 있는 브라우저가 있다 */
const OPEN_TIMEOUT = 20_000;
/** 한 장면을 찾아가기를 기다리는 가장 긴 시간 */
const SEEK_TIMEOUT = 15_000;

export class VideoOpenError extends Error {}
export class VideoSeekError extends Error {}

export interface OpenedVideo {
  /** blob URL (화면의 <video>도 같은 주소를 쓴다). 다 쓰면 close() */
  url: string;
  /** 보이는 방향의 가로·세로 */
  width: number;
  height: number;
  /** 초 */
  duration: number;
  close(): void;
}

/** 이벤트 하나를 기다린다. 오류 이벤트·시간 초과면 실패 */
function waitFor(
  video: HTMLVideoElement,
  event: string,
  timeout: number,
  fail: () => Error,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => done(fail()), timeout);
    const ok = () => done();
    const bad = () => done(fail());
    function done(error?: Error) {
      clearTimeout(timer);
      video.removeEventListener(event, ok);
      video.removeEventListener('error', bad);
      if (error) reject(error);
      else resolve();
    }
    video.addEventListener(event, ok);
    video.addEventListener('error', bad);
  });
}

/** 소리 없이, 화면에 보이지 않게 장면만 읽는 <video> */
function hiddenVideo(url: string): HTMLVideoElement {
  const video = document.createElement('video');
  video.muted = true;
  video.playsInline = true;
  video.preload = 'auto';
  // 화면 밖이라도 문서 안에 두어야 장면을 미리 읽는 브라우저가 있다 (style 속성이 아니라 스크립트로 정한다)
  Object.assign(video.style, {
    position: 'fixed',
    left: '-10px',
    top: '0',
    width: '1px',
    height: '1px',
    opacity: '0',
    pointerEvents: 'none',
  });
  video.setAttribute('aria-hidden', 'true');
  video.src = url;
  document.body.append(video);
  return video;
}

/**
 * 동영상을 연다. 첫 장면까지 풀어 봐서 이 브라우저가 재생하지 못하면 VideoOpenError
 * (소리만 있는 파일, 지원하지 않는 코덱, 깨진 파일)
 */
export async function openVideo(file: Blob): Promise<OpenedVideo> {
  const url = URL.createObjectURL(file);
  const video = hiddenVideo(url);
  const fail = () => new VideoOpenError('이 동영상을 열 수 없습니다');
  try {
    await waitFor(video, 'loadedmetadata', OPEN_TIMEOUT, fail);
    // MediaRecorder로 만든 WebM은 길이가 비어 있다(Infinity). 끝으로 찾아가면 브라우저가 길이를 알아낸다
    if (!Number.isFinite(video.duration)) {
      const known = waitFor(video, 'durationchange', OPEN_TIMEOUT, fail);
      video.currentTime = 1e9;
      await known;
      await seekVideo(video, 0);
    } else if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
      await waitFor(video, 'loadeddata', OPEN_TIMEOUT, fail);
    }
    const { videoWidth: width, videoHeight: height, duration } = video;
    if (!width || !height || !Number.isFinite(duration) || duration <= 0) throw fail();
    return {
      url,
      width,
      height,
      duration,
      close: () => URL.revokeObjectURL(url),
    };
  } catch {
    URL.revokeObjectURL(url);
    throw fail();
  } finally {
    video.removeAttribute('src');
    video.load();
    video.remove();
  }
}

/** video를 time초로 옮기고 그 장면이 준비될 때까지 기다린다 */
export async function seekVideo(video: HTMLVideoElement, time: number): Promise<void> {
  const target = Math.min(Math.max(0, time), Math.max(0, video.duration - END_MARGIN));
  const fail = () => new VideoSeekError('장면을 찾아가지 못했습니다');
  if (Math.abs(video.currentTime - target) < 1e-4 && !video.seeking) {
    if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
      await waitFor(video, 'loadeddata', SEEK_TIMEOUT, fail);
    }
    return;
  }
  const seeked = waitFor(video, 'seeked', SEEK_TIMEOUT, fail);
  video.currentTime = target;
  await seeked;
  if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
    await waitFor(video, 'canplay', SEEK_TIMEOUT, fail);
  }
}

/**
 * 장면 읽개: 화면과 따로 숨은 <video> 하나로 시각을 옮겨 가며 장면을 그린다.
 * 요청은 들어온 순서대로 하나씩 한다 (같은 <video>를 동시에 옮기지 않게)
 */
export class FrameReader {
  readonly #video: HTMLVideoElement;
  #queue: Promise<unknown> = Promise.resolve();
  readonly #canvas = document.createElement('canvas');
  readonly #ctx = this.#canvas.getContext('2d', { willReadFrequently: true })!;

  constructor(url: string) {
    this.#video = hiddenVideo(url);
  }

  #run<T>(job: () => Promise<T>): Promise<T> {
    const next = this.#queue.then(job);
    this.#queue = next.catch(() => undefined);
    return next;
  }

  /** time초 장면을 width × height로 줄여 RGBA 화소로 */
  pixels(time: number, width: number, height: number): Promise<ImageData> {
    return this.#run(async () => {
      await seekVideo(this.#video, time);
      this.#canvas.width = width;
      this.#canvas.height = height;
      this.#ctx.imageSmoothingQuality = 'high';
      this.#ctx.drawImage(this.#video, 0, 0, width, height);
      return this.#ctx.getImageData(0, 0, width, height);
    });
  }

  /** time초 장면을 원래 크기 그대로 ImageBitmap으로 (워커가 저장한다) */
  bitmap(time: number): Promise<ImageBitmap> {
    return this.#run(async () => {
      await seekVideo(this.#video, time);
      return captureBitmap(this.#video);
    });
  }

  close() {
    this.#video.removeAttribute('src');
    this.#video.load();
    this.#video.remove();
    this.#canvas.width = 0;
    this.#canvas.height = 0;
  }
}

/**
 * video가 지금 보여 주는 장면을 원래 크기로 ImageBitmap에 담는다.
 * canvas에 한 번 그려서 만든다 (createImageBitmap(video)를 받지 않는 브라우저가 있다)
 */
export async function captureBitmap(video: HTMLVideoElement): Promise<ImageBitmap> {
  const canvas = document.createElement('canvas');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  try {
    canvas.getContext('2d')!.drawImage(video, 0, 0);
    return await createImageBitmap(canvas);
  } finally {
    canvas.width = 0;
    canvas.height = 0;
  }
}
