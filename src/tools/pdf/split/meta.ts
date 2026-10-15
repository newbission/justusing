import { defineTool } from '../../types';

export default defineTool({
  status: 'live',
  section: 'pages',
  icon: ['M12 4v7', 'M12 11 4 20', 'M12 11l8 9', 'M4 15v5h5', 'M20 15v5h-5'],
  text: {
    ko: {
      name: 'PDF 나누기',
      title: 'PDF 나누기 - 페이지 범위별로 여러 파일로',
      description:
        '한 PDF를 페이지 범위별로 여러 파일로 나눕니다. 모든 처리는 브라우저 안에서 이루어집니다.',
    },
    en: {
      name: 'Split PDF',
      title: 'Split PDF - Split a PDF into several files by page range',
      description:
        'Split one PDF into several files by page range. Everything happens inside your browser.',
    },
  },
  related: ['pdf/merge', 'pdf/organize'],
});
