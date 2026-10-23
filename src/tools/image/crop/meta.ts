import { defineTool } from '../../types';

export default defineTool({
  status: 'live',
  section: 'edit',
  icon: [
    'M7 3v12a2 2 0 0 0 2 2h12',
    'M3 7h10a2 2 0 0 1 2 2v12',
    'M16 3a5 5 0 0 1 5 5',
    'M21 4v4h-4',
  ],
  text: {
    ko: {
      name: '이미지 자르기·회전',
      title: '이미지 자르기·회전 - 사진 비율 자르기, 수평 맞추기, 업로드 없이',
      description:
        '사진을 1:1·4:5·16:9 같은 비율이나 원하는 크기로 자르고, 90°씩 돌리거나 뒤집고, 기운 수평을 바로잡습니다. 사진은 서버에 올라가지 않습니다.',
    },
    en: {
      name: 'Crop & Rotate Image',
      title: 'Crop and rotate images - Crop to 1:1 or 16:9 and straighten photos in your browser',
      description:
        'Crop photos to a ratio such as 1:1, 4:5 or 16:9 or to an exact size, rotate them by 90°, flip them and straighten a tilted horizon. Your images are never uploaded.',
    },
  },
  related: ['image/resize', 'image/id-photo'],
  flow: { from: { kind: 'jpg', mark: 'photo' }, to: { kind: 'jpg', mark: 'crop' } },
});
