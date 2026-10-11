import { defineTool } from '../../types';

export default defineTool({
  status: 'live',
  text: {
    ko: {
      name: 'PDF 페이지 정리',
      title: 'PDF 페이지 정리 - 순서 변경·페이지 삭제',
      description: 'PDF 페이지 순서를 바꾸거나 필요 없는 페이지를 삭제합니다.',
    },
  },
  related: ['pdf/rotate', 'pdf/merge'],
});
