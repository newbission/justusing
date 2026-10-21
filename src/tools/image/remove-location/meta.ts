import { defineTool } from '../../types';

export default defineTool({
  status: 'soon',
  section: 'photo',
  icon: [
    'M12 21c-4.5-5-7-8.2-7-11a7 7 0 0 1 14 0c0 2.8-2.5 6-7 11z',
    'M12 7.5a2.5 2.5 0 1 0 .01 0',
    'M4 4l16 16',
  ],
  text: {
    ko: {
      name: '사진 위치 정보 지우기',
      title: '사진 위치 정보 지우기 - EXIF·GPS 삭제, 업로드 없이 브라우저에서',
      description:
        '사진에 담긴 촬영 위치(GPS)와 찍은 날짜·기기 같은 EXIF 정보를 지웁니다. 사진을 다시 저장하지 않아 화질이 그대로이고, 여러 장을 한 번에 지울 수 있습니다. 사진은 서버에 올라가지 않습니다.',
    },
    en: {
      name: 'Remove Photo Location',
      title: 'Remove photo location - Delete EXIF and GPS data in your browser',
      description:
        'Remove the GPS location, date taken, device and other EXIF data from photos. The photo is not saved again, so the quality stays the same, and you can clean many at once. Your photos are never uploaded.',
    },
  },
  related: ['image/compress', 'pdf/metadata'],
  flow: { from: { kind: 'jpg', mark: 'location' }, to: { kind: 'jpg', mark: 'photo' } },
});
