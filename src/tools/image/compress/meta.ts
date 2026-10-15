import { defineTool } from '../../types';

export default defineTool({
  status: 'live',
  section: 'optimize',
  icon: ['M3 5h18v14H3z', 'M3 16l5-5 4 4', 'M17 7v6', 'M14.5 10.5 17 13l2.5-2.5'],
  text: {
    ko: {
      name: '이미지 압축',
      title: '이미지 압축 - JPG·PNG 용량 줄이기, 업로드 없이 브라우저에서',
      description:
        'JPG·PNG·WebP 이미지의 용량을 줄입니다. 여러 장을 한 번에 줄이고 ZIP으로 받을 수 있습니다. 이미지는 서버에 올라가지 않고 브라우저 안에서 처리됩니다.',
    },
    en: {
      name: 'Compress Image',
      title: 'Compress images - Reduce JPG and PNG file size in your browser',
      description:
        'Make JPG, PNG and WebP images smaller. Compress many at once and download them as a ZIP. Your images are never uploaded; everything happens in your browser.',
    },
  },
  related: ['image/resize', 'pdf/compress'],
});
