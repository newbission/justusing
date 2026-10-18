/** PDF 가리기(영구 삭제) 도구 화면의 문구 (공통 문구는 src/frame/messages.ts) */
import type { Locale } from '../../../i18n/locales';

const ko = {
  bar: '가리기',
  help: '가릴 곳을 끌어서 검은 상자를 그리세요. 상자를 눌러 고르고 끌어 옮깁니다.',
  findLabel: '찾아서 가리기',
  findPlaceholder: '예: 홍길동, 010-1234-5678',
  find: '모두 찾아 가리기',
  found: (count: number) => `${count}곳을 찾아 가렸습니다.`,
  notFound: '찾는 글자가 없습니다. 스캔한 쪽은 글자를 찾을 수 없으니 직접 그려 가리세요.',
  finding: '찾는 중…',
  count: (boxes: number, pages: number) => `가릴 곳 ${boxes}개 (${pages}쪽)`,
  addCenter: '가운데에 상자 넣기',
  undo: '마지막 것 지우기',
  clear: '모두 지우기',
  box: (n: number) => `가릴 곳 ${n}`,
  keys: '키보드: 상자를 고른 뒤 화살표로 옮기고(Shift는 크게), Alt+화살표로 크기를 바꾸고, Delete로 지웁니다.',
  note: '가린 쪽은 그림으로 바뀌어, 가린 글자는 파일에서 완전히 지워집니다. 그 쪽의 다른 글자도 고르거나 찾을 수 없게 됩니다. 책갈피·링크·양식·문서 정보(작성자 등)는 결과에서 빠집니다.',
  needBoxes: '가릴 곳을 그리거나 찾아 주세요.',
  ready: (pages: number) => `${pages}쪽을 가려 새 PDF를 만듭니다.`,
  working: (done: number, total: number) => `가린 쪽 그리는 중 ${done}/${total}`,
  saving: '저장하는 중…',
  run: '가리고 저장',
  failed: 'PDF를 만들지 못했습니다. 파일이 손상되었거나 기기의 메모리가 부족할 수 있습니다.',
  annotationFailed:
    '이 PDF의 주석이나 양식 입력값 일부는 모양이 저장되어 있지 않아 옮길 수 없습니다. PDF 보기 프로그램에서 "인쇄 → PDF로 저장"으로 한 번 저장한 뒤 다시 해 보세요.',
  suffix: '가림',
};

const en: typeof ko = {
  bar: 'Redact',
  help: 'Drag to draw black boxes over what you want to remove. Click a box to select it and drag to move it.',
  findLabel: 'Find and redact',
  findPlaceholder: 'e.g. John Smith, 555-0123',
  find: 'Redact all matches',
  found: (count: number) => `Found and redacted ${count} ${count === 1 ? 'match' : 'matches'}.`,
  notFound: 'No matches. Text on scanned pages cannot be found, so draw boxes over it instead.',
  finding: 'Searching…',
  count: (boxes: number, pages: number) =>
    `${boxes} ${boxes === 1 ? 'box' : 'boxes'} on ${pages} ${pages === 1 ? 'page' : 'pages'}`,
  addCenter: 'Add a box in the center',
  undo: 'Delete the last one',
  clear: 'Delete all',
  box: (n: number) => `Redaction ${n}`,
  keys: 'Keyboard: select a box, then use the arrow keys to move it (Shift for bigger steps), Alt+arrow keys to resize it, and Delete to remove it.',
  note: 'Redacted pages become images, so the covered text is removed from the file completely. Other text on those pages can no longer be selected or searched. Bookmarks, links, forms and document information (such as the author) are not kept.',
  needBoxes: 'Draw or find what you want to redact.',
  ready: (pages: number) => `Redact ${pages} ${pages === 1 ? 'page' : 'pages'} and save a new PDF.`,
  working: (done: number, total: number) => `Drawing redacted pages ${done}/${total}`,
  saving: 'Saving…',
  run: 'Redact and save',
  failed: 'Could not create the PDF. The file may be damaged, or your device may be low on memory.',
  annotationFailed:
    'Some comments or form entries in this PDF have no saved appearance and cannot be moved. Save it once with "Print → Save as PDF" in your PDF viewer, then try again.',
  suffix: 'redacted',
};

export const MESSAGES: Record<Locale, typeof ko> = { ko, en };
