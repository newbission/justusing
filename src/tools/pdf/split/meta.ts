import { defineTool } from '../../types';

export default defineTool({
  status: 'live',
  section: 'pages',
  icon: ['M12 4v7', 'M12 11 4 20', 'M12 11l8 9', 'M4 15v5h5', 'M20 15v5h-5'],
  text: {
    ko: {
      name: 'PDF 나누기',
      summary: '쪽 범위대로 여러 파일로 나눕니다',
      title: 'PDF 나누기 - 페이지 범위별·한 장씩 분리, 무료·업로드 없이',
      description:
        'PDF를 페이지 범위별로 나누거나, 한 장씩 따로 저장하거나, 고른 페이지만 뽑아 새 PDF로 만듭니다. 여러 파일은 ZIP 하나로 받습니다. 모든 처리는 브라우저 안에서 이루어집니다.',
    },
    en: {
      name: 'Split PDF',
      summary: 'Split one PDF into files by page range',
      title: 'Split PDF - Split by page range or extract pages, free and without uploading',
      description:
        'Split a PDF by page range, save every page as its own file, or extract only the pages you pick into a new PDF. Several files come as one ZIP. Everything happens inside your browser.',
    },
  },
  related: ['pdf/merge', 'pdf/organize'],
  flow: { from: { kind: 'pdf' }, to: { kind: 'pdf', count: 3 } },
});
