import { defineTool } from '../../types';

export default defineTool({
  status: 'live',
  section: 'view',
  icon: ['M6 3h8l4 4v14H6z', 'M14 3v4h4', 'M9 12h6', 'M9 15h6', 'M9 18h4'],
  text: {
    ko: {
      name: 'PDF 글자 추출',
      title: 'PDF 글자 추출 - PDF를 텍스트(TXT)로, 업로드 없이',
      description:
        'PDF 안의 글자를 뽑아 TXT 파일로 받거나 복사합니다. 모든 처리는 브라우저 안에서 이루어집니다.',
    },
    en: {
      name: 'PDF to Text',
      title: 'PDF to Text - Extract text from a PDF to TXT in your browser',
      description:
        'Extract the text in a PDF and download it as a TXT file or copy it. Everything happens inside your browser.',
    },
  },
  related: ['pdf/view', 'pdf/to-image'],
  flow: { from: { kind: 'pdf' }, to: { kind: 'txt' } },
});
