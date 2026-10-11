import { defineTool } from '../../types';

export default defineTool({
  status: 'live',
  text: {
    ko: {
      name: 'PDF 나누기',
      title: 'PDF 나누기 - 페이지 범위별로 여러 파일로',
      description:
        '한 PDF를 페이지 범위별로 여러 파일로 나눕니다. 모든 처리는 브라우저 안에서 이루어집니다.',
    },
  },
  related: ['pdf/merge', 'pdf/organize'],
});
