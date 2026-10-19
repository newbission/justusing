import { defineTool } from '../../types';

export default defineTool({
  status: 'live',
  section: 'convert',
  icon: ['M4 8V4h4', 'M16 4h4v4', 'M20 16v4h-4', 'M8 20H4v-4', 'M8 9h8', 'M8 12h8', 'M8 15h5'],
  text: {
    ko: {
      name: 'PDF 글자 인식 (OCR)',
      title: 'PDF 글자 인식(OCR) - 스캔한 PDF를 검색·복사 가능하게, 업로드 없이',
      description:
        '스캔한 PDF나 사진으로 만든 PDF의 글자를 읽어, 글자를 찾고 복사할 수 있는 PDF와 TXT로 만듭니다. 한국어·영어를 지원하고 파일은 서버에 올라가지 않습니다.',
    },
    en: {
      name: 'OCR PDF',
      title: 'OCR PDF - Make scanned PDFs searchable in your browser',
      description:
        'Recognize the text in scanned PDFs and turn them into searchable, copyable PDFs and TXT files. Supports English and Korean, and your file is never uploaded.',
    },
  },
  related: ['pdf/extract-text', 'pdf/compress'],
  flow: { from: { kind: 'pdf', mark: 'scan' }, to: { kind: 'pdf', mark: 'text' } },
});
