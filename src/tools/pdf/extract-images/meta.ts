import { defineTool } from '../../types';

export default defineTool({
  status: 'live',
  section: 'view',
  icon: ['M3 5h12v10H3z', 'M3 13l4-4 3 3 2-2 3 3', 'M9 19h12V9', 'M12 9h0'],
  text: {
    ko: {
      name: 'PDF 사진 꺼내기',
      title: 'PDF 사진 꺼내기 - PDF 안의 이미지를 원본 화질로, 업로드 없이',
      description:
        'PDF 안에 들어 있는 사진과 그림을 꺼내 JPG·PNG로 받습니다. JPG는 화질 손실 없이 원본 그대로 꺼내고, 여러 개는 ZIP으로 한 번에 받습니다. 파일은 서버에 올라가지 않습니다.',
    },
    en: {
      name: 'Extract Images from PDF',
      title: 'Extract Images from PDF - Original quality, in your browser',
      description:
        'Pull the photos and pictures out of a PDF as JPG or PNG files. JPGs come out without recompression, with no quality loss, and many images download as one ZIP. Your file is never uploaded.',
    },
  },
  related: ['pdf/to-image', 'pdf/extract-text'],
  flow: { from: { kind: 'pdf', mark: 'image' }, to: { kind: 'jpg', count: 3 } },
});
