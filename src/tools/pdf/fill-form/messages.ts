/** PDF 양식 채우기 도구 화면의 문구 (공통 문구는 src/frame/messages.ts) */
import type { Locale } from '../../../i18n/locales';

const ko = {
  bar: '양식 채우기',
  help: '쪽 위의 칸을 눌러 적거나 고르세요.',
  reading: '입력 칸을 찾는 중…',
  noFields:
    '이 PDF에는 채울 수 있는 입력 칸이 없습니다. 칸이 없는 서류에 글자를 넣으려면 "PDF 편집"을 쓰세요.',
  ready: (count: number) => `입력 칸 ${count}개`,
  changed: (count: number) => `${count}칸을 고쳤습니다.`,
  noChange: '아직 고친 칸이 없습니다.',
  flatten: '칸을 글자로 굳히기 (받는 사람이 고칠 수 없게)',
  fontNote: '한글처럼 기본 글꼴에 없는 글자를 적었습니다. 아래에서 글꼴을 받아 고르세요.',
  missing: (chars: string) => `고른 글꼴에 없는 글자가 있습니다: ${chars}`,
  needFont: '적은 글자를 쓰려면 아래에서 글꼴을 고르세요.',
  working: '저장하는 중…',
  run: '양식 저장',
  failed: 'PDF를 만들지 못했습니다. 파일이 손상되었거나 양식 구조가 특이할 수 있습니다.',
  readOnly: '읽기 전용',
  none: '(고르지 않음)',
  suffix: '작성',
};

const en: typeof ko = {
  bar: 'Fill form',
  help: 'Click a field on the page to type or choose.',
  reading: 'Looking for form fields…',
  noFields:
    'This PDF has no form fields to fill. To add text to a document without fields, use "Edit PDF".',
  ready: (count: number) => `${count} ${count === 1 ? 'field' : 'fields'}`,
  changed: (count: number) => `Changed ${count} ${count === 1 ? 'field' : 'fields'}.`,
  noChange: 'No fields changed yet.',
  flatten: 'Flatten fields into text (so others cannot change them)',
  fontNote:
    'You typed characters the built-in font does not have. Download and choose a font below.',
  missing: (chars: string) => `The chosen font does not have these characters: ${chars}`,
  needFont: 'Choose a font below to use the characters you typed.',
  working: 'Saving…',
  run: 'Save form',
  failed: 'Could not create the PDF. The file may be damaged, or the form may be unusual.',
  readOnly: 'Read-only',
  none: '(none)',
  suffix: 'filled',
};

export const MESSAGES: Record<Locale, typeof ko> = { ko, en };
