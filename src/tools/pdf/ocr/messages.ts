/** PDF 글자 인식(OCR) 도구 화면의 문구 (공통 문구는 src/frame/messages.ts) */
import type { Locale } from '../../../i18n/locales';
import type { OcrLang } from '../../../lib/ocr/ocr';

const ko = {
  bar: '글자 인식',
  langGroup: '인식할 언어',
  langs: { kor: '한국어', eng: '영어' } satisfies Record<OcrLang, string>,
  needLang: '언어를 하나 이상 골라 주세요.',
  skipText: '글자가 이미 있는 쪽은 건너뛰기',
  dataTitle: '글자 인식 데이터',
  dataSize: (size: string) => `처음 한 번 ${size}를 받습니다 (인식 엔진과 고른 언어 데이터).`,
  dataNote:
    '받은 데이터는 이 브라우저에만 보관되어 다음부터 바로 씁니다. 다른 브라우저·기기, 시크릿 창에서는 다시 받아야 하고, 브라우저 데이터를 지우면 사라집니다.',
  dataRemoved: '전에 받은 데이터가 브라우저에서 지워졌습니다. 다시 받아 주세요.',
  lowSpace: '브라우저 저장 공간이 부족해 보관하지 못할 수 있습니다.',
  download: (size: string) => `데이터 받기 (${size})`,
  downloading: (percent: number) => `데이터 받는 중 ${percent}%`,
  dataFailed: '데이터를 받지 못했습니다. 인터넷 연결을 확인하고 다시 받아 주세요.',
  dataReady: '글자 인식 데이터가 준비되었습니다.',
  checking: '데이터를 확인하는 중…',
  needData: '먼저 글자 인식 데이터를 받아 주세요.',
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
  langGroup: 'Languages to recognize',
  langs: { kor: 'Korean', eng: 'English' },
  needLang: 'Choose at least one language.',
  skipText: 'Skip pages that already have text',
  dataTitle: 'Text recognition data',
  dataSize: (size: string) =>
    `${size} is downloaded once (the recognition engine and the chosen language data).`,
  dataNote:
    'The data is kept in this browser, so it is ready next time. Other browsers, devices and private windows need to download it again, and clearing browser data removes it.',
  dataRemoved:
    'The data you downloaded before was removed from this browser. Please download it again.',
  lowSpace: 'Your browser may not have enough storage space to keep it.',
  download: (size: string) => `Download data (${size})`,
  downloading: (percent: number) => `Downloading data ${percent}%`,
  dataFailed: 'Could not download the data. Check your internet connection and try again.',
  dataReady: 'Text recognition data is ready.',
  checking: 'Checking data…',
  needData: 'Download the text recognition data first.',
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
