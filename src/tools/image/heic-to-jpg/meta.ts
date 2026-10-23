import { defineTool } from '../../types';

export default defineTool({
  status: 'live',
  section: 'convert',
  icon: [
    'M5 2h6a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z',
    'M7 19h2',
    'M5 14l2-2.5 2 2 1-1 1 1',
    'M15 12h6',
    'M19 9.5l2.5 2.5-2.5 2.5',
  ],
  text: {
    ko: {
      name: 'HEIC JPG 변환',
      summary: '아이폰 HEIC 사진을 JPG로 바꿉니다',
      title: 'HEIC JPG 변환 - 아이폰 사진을 JPG로, 업로드 없이',
      description:
        '아이폰에서 찍은 HEIC·HEIF 사진을 JPG(또는 PNG·WebP)로 바꿉니다. 크롬·엣지·Safari 어디서나 여러 장을 한 번에 바꾸고 ZIP으로 받을 수 있습니다. 사진은 서버에 올라가지 않습니다.',
    },
    en: {
      name: 'HEIC to JPG',
      summary: 'Convert iPhone HEIC photos to JPG',
      title: 'HEIC to JPG - Convert iPhone photos in your browser, no upload',
      description:
        'Convert HEIC and HEIF photos from an iPhone to JPG, PNG or WebP. Works in Chrome, Edge and Safari, converts many photos at once and downloads them as a ZIP. Your photos are never uploaded.',
    },
  },
  related: ['image/convert', 'pdf/from-image', 'image/compress'],
  flow: { from: { kind: 'heic', count: 2 }, to: { kind: 'jpg', count: 2 } },
});
