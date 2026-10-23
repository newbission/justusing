/** PDF 글자 인식(OCR) 도구 화면의 문구 (공통 문구는 src/frame/messages.ts) */
import type { Locale } from '../../../i18n/locales';

const ko = {
  bar: '글자 인식',
  skipText: '글자가 이미 있는 쪽은 건너뛰기',
  ready: (pages: number) => `${pages}쪽의 글자를 인식합니다.`,
  scanning: '글자가 있는 쪽을 찾는 중…',
  starting: '인식 엔진을 준비하는 중…',
  working: (done: number, total: number) => `글자 인식 중 ${done}/${total}쪽`,
  saving: 'PDF에 글자를 넣는 중…',
  nothing: '모든 쪽에 이미 글자가 있습니다. 다시 인식하려면 "건너뛰기"를 끄세요.',
  run: '글자 인식',
  done: (pages: number, characters: string) => `${pages}쪽에서 글자 ${characters}자를 읽었습니다.`,
  downloadPdf: 'PDF 다운로드',
  downloadText: 'TXT 다운로드',
  textLabel: '인식한 글자',
  pageMark: (n: number) => `--- ${n}쪽 ---`,
  failed:
    '글자를 인식하지 못했습니다. 기기의 메모리가 부족할 수 있습니다. 다른 앱을 닫고 다시 해 보세요.',
  suffix: '글자인식',
};

const en: typeof ko = {
  bar: 'OCR',
  skipText: 'Skip pages that already have text',
  ready: (pages: number) => `Recognize text on ${pages} ${pages === 1 ? 'page' : 'pages'}.`,
  scanning: 'Looking for pages that already have text…',
  starting: 'Starting the recognition engine…',
  working: (done: number, total: number) => `Recognizing text: page ${done} of ${total}`,
  saving: 'Adding text to the PDF…',
  nothing: 'Every page already has text. Turn off "Skip" to recognize them again.',
  run: 'Recognize text',
  done: (pages: number, characters: string) =>
    `Read ${characters} characters from ${pages} ${pages === 1 ? 'page' : 'pages'}.`,
  downloadPdf: 'Download PDF',
  downloadText: 'Download TXT',
  textLabel: 'Recognized text',
  pageMark: (n: number) => `--- Page ${n} ---`,
  failed:
    'Could not recognize the text. Your device may be low on memory. Close other apps and try again.',
  suffix: 'ocr',
};

export const MESSAGES: Record<Locale, typeof ko> = { ko, en };
