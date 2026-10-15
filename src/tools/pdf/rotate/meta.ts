import { defineTool } from '../../types';

export default defineTool({
  status: 'live',
  section: 'pages',
  icon: ['M20 12a8 8 0 1 1-8-8c2.2 0 4.3.9 5.9 2.4L20 8.5', 'M20 3.5v5h-5'],
  text: {
    ko: {
      name: 'PDF 회전',
      title: 'PDF 회전 - 페이지 방향 바로잡기',
      description: '옆으로 눕거나 뒤집힌 PDF 페이지를 원하는 방향으로 돌립니다.',
    },
    en: {
      name: 'Rotate PDF',
      title: 'Rotate PDF - Fix the orientation of PDF pages',
      description: 'Rotate sideways or upside-down PDF pages to the orientation you want.',
    },
  },
  related: ['pdf/organize', 'pdf/view'],
});
