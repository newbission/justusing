/**
 * 도구 화면 공통 부품(src/frame/, src/lib/pdf/)의 문구. 도구별 문구는 각 도구 폴더의 messages.ts에 있다.
 * 쓰는 법: const t = pick(FRAME_MESSAGES);
 */
import type { Locale } from '../i18n/locales';

const ko = {
  drop: {
    title: '파일을 여기로 끌어다 놓거나',
    overlay: '여기에 파일을 놓으세요',
    overlayNote: '파일은 이 기기를 떠나지 않습니다',
  },
  pdf: {
    choose: 'PDF 파일 선택',
    chooseMany: 'PDF 파일 선택',
    stays: '파일은 이 기기를 떠나지 않습니다',
    pages: (count: number) => `${count}쪽`,
    otherFile: '다른 파일',
    opening: 'PDF를 여는 중…',
    passwordGroup: '암호가 걸린 PDF',
    passwordPrompt: '암호가 걸린 PDF입니다. 암호를 입력하세요.',
    passwordNote: '암호도 이 기기 안에서만 쓰이고 어디에도 전송되지 않습니다.',
    passwordLabel: 'PDF 암호',
    wrongPassword: '암호가 맞지 않습니다.',
    open: '열기',
    cancel: '취소',
    cannotOpen: 'PDF를 열 수 없습니다. 파일이 손상되었거나 PDF 파일이 아닐 수 있습니다.',
  },
  action: {
    download: '다운로드',
    unavailable: '지금은 사용할 수 없습니다.',
    done: (name: string, size: string) => `완료: ${name} · ${size}`,
    reset: '되돌리기',
  },
  pages: {
    gridLabel: (name: string) => `${name} 페이지 (결과 순서대로)`,
    original: (page: number) => `원래 ${page}쪽`,
    excluded: '제외됨',
    position: (n: number) => `${n}번째`,
    exclude: '제외',
    restore: '복구',
    earlier: (page: number) => `원래 ${page}쪽 앞으로`,
    later: (page: number) => `원래 ${page}쪽 뒤로`,
    toggle: (page: number, excluded: boolean) => `원래 ${page}쪽 ${excluded ? '복구' : '제외'}`,
    page: (n: number) => `${n}페이지`,
    pageShort: (n: number) => `${n}쪽`,
    selectGrid: '페이지',
  },
};

type FrameMessages = typeof ko;

const en: FrameMessages = {
  drop: {
    title: 'Drag and drop here, or',
    overlay: 'Drop your files here',
    overlayNote: 'Your files never leave this device',
  },
  pdf: {
    choose: 'Choose PDF file',
    chooseMany: 'Choose PDF files',
    stays: 'Your files never leave this device',
    pages: (count: number) => `${count} ${count === 1 ? 'page' : 'pages'}`,
    otherFile: 'Change file',
    opening: 'Opening the PDF…',
    passwordGroup: 'Password-protected PDF',
    passwordPrompt: 'This PDF is password-protected. Enter the password.',
    passwordNote: 'The password is only used on this device and is never sent anywhere.',
    passwordLabel: 'PDF password',
    wrongPassword: 'The password is incorrect.',
    open: 'Open',
    cancel: 'Cancel',
    cannotOpen: 'Could not open the PDF. The file may be damaged or may not be a PDF.',
  },
  action: {
    download: 'Download',
    unavailable: 'This is not available right now.',
    done: (name: string, size: string) => `Done: ${name} · ${size}`,
    reset: 'Reset',
  },
  pages: {
    gridLabel: (name: string) => `Pages of ${name} (in result order)`,
    original: (page: number) => `Original page ${page}`,
    excluded: 'excluded',
    position: (n: number) => `position ${n}`,
    exclude: 'Exclude',
    restore: 'Restore',
    earlier: (page: number) => `Move original page ${page} earlier`,
    later: (page: number) => `Move original page ${page} later`,
    toggle: (page: number, excluded: boolean) =>
      `${excluded ? 'Restore' : 'Exclude'} original page ${page}`,
    page: (n: number) => `Page ${n}`,
    pageShort: (n: number) => `Page ${n}`,
    selectGrid: 'Pages',
  },
};

export const FRAME_MESSAGES: Record<Locale, FrameMessages> = { ko, en };
