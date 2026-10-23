import { defineTool } from '../../types';

export default defineTool({
  status: 'live',
  section: 'optimize',
  icon: ['M3 9V3h6', 'M3 3l7 7', 'M21 15v6h-6', 'M21 21l-7-7', 'M14 3h7v7', 'M3 14v7h7'],
  text: {
    ko: {
      name: '이미지 크기 조절',
      summary: '가로·세로를 비율이나 픽셀로 바꿉니다',
      title: '이미지 크기 조절 - 사진 해상도·픽셀 크기 바꾸기, 업로드 없이',
      description:
        '이미지의 가로·세로 크기를 비율(%)이나 픽셀로 바꿉니다. 여러 장을 한 번에 같은 크기로 맞추고 ZIP으로 받을 수 있습니다. 이미지는 서버에 올라가지 않습니다.',
    },
    en: {
      name: 'Resize Image',
      summary: 'Change width and height by % or pixels',
      title: 'Resize images - Change image width and height in your browser',
      description:
        'Change the width and height of images by percentage or in pixels. Resize many at once and download them as a ZIP. Your images are never uploaded.',
    },
  },
  related: ['image/compress', 'image/stitch', 'pdf/from-image'],
  flow: { from: { kind: 'jpg' }, to: { kind: 'jpg', small: true } },
});
