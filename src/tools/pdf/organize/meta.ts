import { defineTool } from '../../types';

export default defineTool({
  status: 'live',
  section: 'pages',
  icon: ['M4 4h6v6H4z', 'M14 4h6v6h-6z', 'M4 14h6v6H4z', 'M14 14h6v6h-6z'],
  text: {
    ko: {
      name: 'PDF 페이지 정리',
      title: 'PDF 페이지 정리 - 순서 변경·페이지 삭제',
      description: 'PDF 페이지 순서를 바꾸거나 필요 없는 페이지를 삭제합니다.',
    },
    en: {
      name: 'Organize PDF',
      title: 'Organize PDF - Reorder and delete PDF pages',
      description: 'Change the order of PDF pages or delete the pages you do not need.',
    },
  },
  related: ['pdf/rotate', 'pdf/merge'],
});
