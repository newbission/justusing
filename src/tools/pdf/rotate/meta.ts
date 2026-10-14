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
      description: 'Rotate PDF pages that are sideways or upside down to the right direction.',
    },
  },
  related: ['pdf/organize', 'pdf/view'],
});
