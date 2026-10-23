import { defineTool } from '../../types';

export default defineTool({
  status: 'live',
  section: 'optimize',
  // 바늘이 정한 눈금에서 멈춘 계기판 (정한 용량에 맞춘다)
  icon: [
    'M3 15a9 9 0 0 1 18 0',
    'M12 15l4.5-5.5',
    'M12 6v1.5',
    'M5.6 8.6l1.1 1.1',
    'M18.4 8.6l-1.1 1.1',
    'M3 18h18',
  ],
  text: {
    ko: {
      name: '이미지 용량 맞추기',
      summary: '사진을 200KB·1MB 이하로 맞춰 줄입니다',
      title: '이미지 용량 맞추기 - 사진 200KB·1MB 이하로 줄이기, 업로드 없이',
      description:
        '사진을 100KB·200KB·1MB처럼 정한 용량 이하로 줄입니다. 화질을 먼저 낮추고 그래도 크면 가로·세로를 줄입니다. 여러 장을 한 번에 맞추고 ZIP으로 받을 수 있습니다. 이미지는 서버에 올라가지 않습니다.',
    },
    en: {
      name: 'Compress to Target Size',
      summary: 'Shrink photos under a limit like 200 KB',
      title:
        'Compress image to 100KB, 200KB or 1MB - Fit photos under a size limit in your browser',
      description:
        'Shrink photos to a file size you choose, such as 100 KB, 200 KB or 1 MB. Quality is lowered first, and width and height only if needed. Fit many at once and download a ZIP. Your images are never uploaded.',
    },
  },
  related: ['image/compress', 'image/resize', 'image/id-photo'],
  flow: {
    from: { kind: 'jpg', count: 2, mark: 'photo' },
    to: { kind: 'jpg', count: 2, mark: 'photo', small: true },
  },
});
