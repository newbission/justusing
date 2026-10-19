import { defineTool } from '../../types';

export default defineTool({
  status: 'live',
  section: 'convert',
  icon: ['M6 3h8l4 4v14H6z', 'M14 3v4h4', 'M8.5 17l2.5-2.5 1.5 1.5 1.5-1.5 1.5 1.5'],
  text: {
    ko: {
      name: '이미지를 PDF로',
      title: 'JPG·PNG 이미지를 PDF로 변환 - 업로드 없이 브라우저에서',
      description:
        'JPG·PNG 사진과 스캔 이미지를 원하는 순서대로 PDF 하나로 만듭니다. 모든 처리는 브라우저 안에서 이루어집니다.',
    },
    en: {
      name: 'Image to PDF',
      title: 'JPG/PNG to PDF - Convert images to a PDF in your browser',
      description:
        'Turn JPG and PNG photos or scans into one PDF, in the order you choose. Everything happens inside your browser.',
    },
  },
  related: ['pdf/to-image', 'pdf/merge'],
  flow: { from: { kind: 'jpg', count: 3 }, to: { kind: 'pdf' } },
});
