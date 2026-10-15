/** PDF 글자 추출 도구 화면의 문구 (공통 문구는 src/frame/messages.ts) */
import type { Locale } from '../../../i18n/locales';

const ko = {
  bar: '글자 추출',
  reading: (done: number, total: number) => `글자를 읽는 중… ${done}/${total}쪽`,
  found: (count: string) =>
    `글자 ${count}자를 찾았습니다. TXT 파일로 받거나 아래에서 골라 복사하세요.`,
  empty: '글자를 찾지 못했습니다. 스캔한 PDF처럼 글자가 그림으로 들어 있으면 뽑을 수 없습니다.',
  failed: '글자를 읽지 못했습니다. 파일이 손상되었을 수 있습니다.',
  download: 'TXT 다운로드',
  textLabel: '추출한 글자',
  /** 쪽 사이에 넣는 구분 줄 */
  pageMark: (page: number) => `--- ${page}쪽 ---`,
};

const en: typeof ko = {
  bar: 'Extract text',
  reading: (done: number, total: number) => `Reading text… page ${done} of ${total}`,
  found: (count: string) =>
    `Found ${count} characters. Download them as a TXT file or select and copy them below.`,
  empty:
    'No text was found. If the text is part of an image, as in a scanned PDF, it cannot be extracted.',
  failed: 'Could not read the text. The file may be damaged.',
  download: 'Download TXT',
  textLabel: 'Extracted text',
  pageMark: (page: number) => `--- Page ${page} ---`,
};

export const MESSAGES: Record<Locale, typeof ko> = { ko, en };
