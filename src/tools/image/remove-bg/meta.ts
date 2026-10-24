import { defineTool } from '../../types';

export default defineTool({
  status: 'live',
  section: 'photo',
  // 네 귀퉁이만 남은 사진 틀 안의 사람 (배경을 지우고 사람만 남김)
  icon: [
    'M12 6a3 3 0 1 1 0 6 3 3 0 0 1 0-6',
    'M6.5 20v-.5a5.5 5.5 0 0 1 11 0v.5',
    'M3 7V3h4',
    'M17 3h4v4',
    'M21 17v4h-4',
    'M7 21H3v-4',
  ],
  text: {
    ko: {
      name: '이미지 배경 제거',
      summary: '사진 속 물체만 남기고 배경을 투명하게 지웁니다',
      title: '이미지 배경 제거 - 누끼 따기, 사진 배경 투명하게, 업로드 없이',
      description:
        '사진에서 사람·상품·동물만 남기고 배경을 지워 투명 PNG나 흰 배경 JPG로 받습니다. 누른 곳의 물체를 찾아 나누고, 지우개·되살리기 붓으로 고칩니다. 사진은 서버에 올라가지 않습니다.',
    },
    en: {
      name: 'Remove Image Background',
      summary: 'Cut out a subject on a transparent background',
      title: 'Remove image background - Cut out people and products in your browser',
      description:
        'Keep the person, product or pet in a photo and remove the background. Download a transparent PNG or a JPG on white. Click to pick the subject and fix edges with erase and restore brushes. Your photos are never uploaded.',
    },
  },
  related: ['image/id-photo', 'image/crop', 'image/compress'],
  flow: { from: { kind: 'jpg', mark: 'photo' }, to: { kind: 'png', mark: 'cutout' } },
});
