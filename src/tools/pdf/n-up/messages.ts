/** PDF 모아찍기 도구 화면의 문구 (공통 문구는 src/frame/messages.ts) */
import type { Locale } from '../../../i18n/locales';
import type { NUpCount, PaperSize } from '../../../lib/pdf/modify';

const ko = {
  bar: '모아찍기',
  countGroup: '한 장에 넣을 쪽 수',
  counts: { 2: '2쪽', 4: '4쪽', 6: '6쪽', 9: '9쪽' } satisfies Record<NUpCount, string>,
  paperGroup: '종이',
  papers: { a4: 'A4', letter: 'Letter' } satisfies Record<PaperSize, string>,
  border: '쪽마다 테두리 선',
  preview: '첫 장 미리보기 (왼쪽 위부터 가로로 채웁니다)',
  sheetLabel: (from: number, to: number) => `첫 장: ${from}~${to}쪽`,
  ready: (pages: number, sheets: number) => `${pages}쪽을 ${sheets}장에 모읍니다.`,
  working: '모으는 중…',
  run: '모아찍기',
  failed: 'PDF를 만들지 못했습니다. 파일이 손상되었거나 기기의 메모리가 부족할 수 있습니다.',
  formFailed:
    '이 PDF의 양식 입력값 일부는 모양이 저장되어 있지 않아 옮길 수 없습니다. PDF 보기 프로그램에서 "인쇄 → PDF로 저장"으로 한 번 저장한 뒤 다시 해 보세요.',
  suffix: '모아찍기',
};

const en: typeof ko = {
  bar: 'N-up',
  countGroup: 'Pages per sheet',
  counts: { 2: '2 pages', 4: '4 pages', 6: '6 pages', 9: '9 pages' },
  paperGroup: 'Paper',
  papers: { a4: 'A4', letter: 'Letter' },
  border: 'Border around each page',
  preview: 'First sheet preview (filled left to right, top to bottom)',
  sheetLabel: (from: number, to: number) => `First sheet: pages ${from}–${to}`,
  ready: (pages: number, sheets: number) =>
    `Put ${pages} ${pages === 1 ? 'page' : 'pages'} on ${sheets} ${sheets === 1 ? 'sheet' : 'sheets'}.`,
  working: 'Combining…',
  run: 'Create N-up PDF',
  failed: 'Could not create the PDF. The file may be damaged, or your device may be low on memory.',
  formFailed:
    'Some form entries in this PDF have no saved appearance and cannot be moved. Save it once with "Print → Save as PDF" in your PDF viewer, then try again.',
  suffix: 'n-up',
};

export const MESSAGES: Record<Locale, typeof ko> = { ko, en };
