import { defineTool } from '../../types';

export default defineTool({
  status: 'live',
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
