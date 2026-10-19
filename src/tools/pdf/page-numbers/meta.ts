import { defineTool } from '../../types';

export default defineTool({
  status: 'live',
  section: 'edit',
  icon: ['M6 3h12v18H6z', 'M10.5 9l-1 7', 'M14.5 9l-1 7', 'M8.5 11h7', 'M8 14h7'],
  text: {
    ko: {
      name: 'PDF 쪽 번호 넣기',
      title: 'PDF 쪽 번호 넣기 - 페이지 번호 매기기, 업로드 없이',
      description:
        'PDF의 모든 쪽에 원하는 위치와 모양으로 쪽 번호를 넣습니다. 모든 처리는 브라우저 안에서 이루어집니다.',
    },
    en: {
      name: 'Add Page Numbers',
      title: 'Add Page Numbers to PDF - Number PDF pages in your browser',
      description:
        'Add page numbers to every page of a PDF, in the position and style you choose. Everything happens inside your browser.',
    },
  },
  related: ['pdf/merge', 'pdf/organize'],
  flow: { from: { kind: 'pdf' }, to: { kind: 'pdf', mark: 'number' } },
});
