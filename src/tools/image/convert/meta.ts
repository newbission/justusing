import { defineTool } from '../../types';

export default defineTool({
  status: 'live',
  section: 'convert',
  icon: [
    'M4 4h7v7H4z',
    'M13 13h7v7h-7z',
    'M15 4h2a3 3 0 0 1 3 3v2',
    'M18 7l2 2 2-2',
    'M9 20H7a3 3 0 0 1-3-3v-2',
    'M6 17l-2-2-2 2',
  ],
  text: {
    ko: {
      name: '이미지 형식 변환',
      summary: 'JPG·PNG·WebP로 형식을 바꿉니다',
      title: '이미지 형식 변환 - PNG·JPG·WebP 바꾸기, 업로드 없이',
      description:
        '이미지를 JPG·PNG·WebP로 바꿉니다. WebP를 JPG로, PNG를 JPG로처럼 여러 장을 한 번에 바꾸고 ZIP으로 받을 수 있습니다. 이미지는 서버에 올라가지 않습니다.',
    },
    en: {
      name: 'Convert Image',
      summary: 'Convert images to JPG, PNG or WebP',
      title: 'Convert images - PNG, JPG and WebP converter in your browser',
      description:
        'Convert images to JPG, PNG or WebP, such as WebP to JPG or PNG to JPG. Convert many at once and download them as a ZIP. Your images are never uploaded.',
    },
  },
  related: ['image/compress', 'image/resize'],
  flow: { from: { kind: 'png' }, to: { kind: 'jpg' } },
});
