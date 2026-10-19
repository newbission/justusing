import { defineTool } from '../../types';

export default defineTool({
  status: 'live',
  section: 'pages',
  icon: ['M6 2v16h16', 'M2 6h16v16'],
  text: {
    ko: {
      name: 'PDF 자르기',
      title: 'PDF 자르기 - 쪽 여백 잘라 내기, 업로드 없이',
      description:
        'PDF 쪽에서 남길 영역을 골라 여백이나 필요 없는 가장자리를 잘라 냅니다. 모든 처리는 브라우저 안에서 이루어집니다.',
    },
    en: {
      name: 'Crop PDF',
      title: 'Crop PDF - Trim the margins of PDF pages in your browser',
      description:
        'Choose the area to keep on a PDF page and trim away margins or unwanted edges. Everything happens inside your browser.',
    },
  },
  related: ['pdf/rotate', 'pdf/organize'],
  flow: { from: { kind: 'pdf' }, to: { kind: 'pdf', mark: 'crop' } },
});
