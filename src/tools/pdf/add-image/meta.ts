import { defineTool } from '../../types';

export default defineTool({
  status: 'live',
  section: 'edit',
  icon: ['M3 6h12v12H3z', 'M3 15l4-4 3 3 2-2 3 3', 'M19 3v6', 'M16 6h6'],
  text: {
    ko: {
      name: 'PDF 이미지 넣기',
      summary: '로고·도장·사진을 원하는 자리에 넣습니다',
      title: 'PDF에 이미지 넣기 - 로고·도장·사진 삽입, 업로드 없이',
      description:
        'PDF 쪽 위 원하는 자리에 로고·도장·사진 같은 이미지를 넣습니다. 모든 처리는 브라우저 안에서 이루어집니다.',
    },
    en: {
      name: 'Add Image to PDF',
      summary: 'Place a logo, stamp or photo on a page',
      title: 'Add Image to PDF - Insert a logo, stamp or photo in your browser',
      description:
        'Place an image such as a logo, stamp or photo anywhere on a PDF page. Everything happens inside your browser.',
    },
  },
  related: ['pdf/sign', 'pdf/from-image'],
  flow: { from: { kind: 'pdf' }, to: { kind: 'pdf', mark: 'image' } },
});
