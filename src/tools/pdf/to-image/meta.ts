import { defineTool } from '../../types';

export default defineTool({
  status: 'live',
  text: {
    ko: {
      name: 'PDF를 이미지로',
      title: 'PDF를 JPG·PNG 이미지로 변환 - 업로드 없이 브라우저에서',
      description:
        'PDF의 쪽을 JPG·PNG 이미지로 뽑습니다. 전체 또는 고른 쪽만, 화질을 골라 받습니다. 모든 처리는 브라우저 안에서 이루어집니다.',
    },
    en: {
      name: 'PDF to Image',
      title: 'PDF to JPG/PNG - Convert PDF pages to images in your browser',
      description:
        'Turn PDF pages into JPG or PNG images. Extract every page or only the ones you pick, in the quality you choose. Everything happens inside your browser.',
    },
  },
  related: ['pdf/split', 'pdf/view'],
});
