/** PDF 보기 도구 화면의 문구 (공통 문구는 src/frame/messages.ts) */
import type { Locale } from '../../../i18n/locales';

const ko = {
  fileList: '올린 파일 목록',
  fileCount: (count: number) => `파일 ${count}개`,
  removeFile: (name: string) => `${name} 목록에서 빼기`,
  fileSelect: '볼 파일',
  removeCurrent: '보고 있는 파일을 목록에서 빼기',
  toolbar: 'PDF 보기 도구',
  previous: '이전 페이지',
  next: '다음 페이지',
  zoomOut: '축소',
  zoomIn: '확대',
  fitWidth: '폭 맞춤',
  fullscreen: '전체 화면',
  exitFullscreen: '전체 화면 끝내기',
  addFiles: '파일 추가',
  pageList: (name: string) => `${name} 페이지 목록`,
};

const en: typeof ko = {
  fileList: 'Opened files',
  fileCount: (count: number) => `${count} ${count === 1 ? 'file' : 'files'}`,
  removeFile: (name: string) => `Remove ${name} from the list`,
  fileSelect: 'File to view',
  removeCurrent: 'Remove the current file from the list',
  toolbar: 'PDF viewer tools',
  previous: 'Previous page',
  next: 'Next page',
  zoomOut: 'Zoom out',
  zoomIn: 'Zoom in',
  fitWidth: 'Fit width',
  fullscreen: 'Full screen',
  exitFullscreen: 'Exit full screen',
  addFiles: 'Add files',
  pageList: (name: string) => `Pages of ${name}`,
};

export const MESSAGES: Record<Locale, typeof ko> = { ko, en };
