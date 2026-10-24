/** 동영상 결과 파일 이름 */
import { baseName } from '../../frame/format';
import type { OutputContainer } from './types';

const EXTENSIONS: Record<OutputContainer, string> = {
  mp4: 'mp4',
  mov: 'mov',
  webm: 'webm',
  mkv: 'mkv',
  m4a: 'm4a',
  mp3: 'mp3',
  ogg: 'ogg',
  flac: 'flac',
  wav: 'wav',
};

/** '여행.mov' + '자름' + mp4 → '여행_자름.mp4' */
export function resultName(name: string, suffix: string, container: OutputContainer): string {
  return `${baseName(name)}_${suffix}.${EXTENSIONS[container]}`;
}

/** 줄어든 비율 (%) */
export function percentSaved(before: number, after: number): number {
  return Math.max(0, Math.round((1 - after / before) * 100));
}
