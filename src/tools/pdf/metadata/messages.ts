/** PDF 문서 정보 도구 화면의 문구 (공통 문구는 src/frame/messages.ts) */
import type { Locale } from '../../../i18n/locales';

const ko = {
  bar: '문서 정보',
  title: '제목',
  author: '작성자',
  subject: '주제',
  keywords: '키워드 (쉼표로 구분)',
  readOnlyGroup: '파일에 적힌 다른 정보',
  creator: '만든 프로그램',
  producer: 'PDF로 만든 프로그램',
  created: '만든 날짜',
  modified: '고친 날짜',
  empty: '(없음)',
  clear: '문서 정보 모두 지우기 (만든 프로그램·날짜까지)',
  clearNote:
    '작성자 이름, 회사, 사용한 프로그램, 만든 날짜처럼 파일에 숨어 있는 정보를 모두 지웁니다. 남에게 보내기 전에 쓰세요.',
  encryptedNote:
    '이 PDF에 걸린 암호와 인쇄·복사 제한은 저장한 파일에서 풀립니다. 다시 걸려면 저장한 뒤 "PDF 암호 걸기"를 쓰세요.',
  reading: '문서 정보를 읽는 중…',
  ready: '바꿀 정보를 고친 뒤 저장하세요.',
  working: '저장하는 중…',
  run: '저장',
  failed: 'PDF를 만들지 못했습니다. 파일이 손상되었을 수 있습니다.',
  suffix: '정보',
};

const en: typeof ko = {
  bar: 'Document info',
  title: 'Title',
  author: 'Author',
  subject: 'Subject',
  keywords: 'Keywords (comma separated)',
  readOnlyGroup: 'Other information in the file',
  creator: 'Created with',
  producer: 'PDF made with',
  created: 'Created',
  modified: 'Modified',
  empty: '(none)',
  clear: 'Remove all document info (including apps and dates)',
  clearNote:
    'Removes hidden information such as the author name, company, apps used and creation date. Use it before sending the file to others.',
  encryptedNote:
    'The password and print/copy restrictions on this PDF are removed in the saved file. To add them back, use "Protect PDF" after saving.',
  reading: 'Reading document info…',
  ready: 'Edit the information, then save.',
  working: 'Saving…',
  run: 'Save',
  failed: 'Could not create the PDF. The file may be damaged.',
  suffix: 'info',
};

export const MESSAGES: Record<Locale, typeof ko> = { ko, en };
