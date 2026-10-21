import { defineTool } from '../../types';

export default defineTool({
  status: 'live',
  section: 'photo',
  icon: ['M5 3h14v18H5z', 'M12 7a3 3 0 1 1 0 6 3 3 0 0 1 0-6', 'M7.5 21v-1.5a4.5 4.5 0 0 1 9 0V21'],
  text: {
    ko: {
      name: '증명사진 만들기',
      title: '증명사진 만들기 - 여권·주민등록증 사진 규격 3.5×4.5 맞추기, 업로드 없이',
      description:
        '찍어 둔 사진에서 얼굴을 찾아 여권 사진 규격(3.5×4.5cm, 머리 길이 3.2~3.6cm)에 맞게 자르고 기울기를 바로잡습니다. 배경색도 바꿀 수 있고, 온라인 제출용 413×531 JPG로 받습니다. 사진은 서버에 올라가지 않습니다.',
    },
    en: {
      name: 'ID Photo Maker',
      title: 'ID photo maker - Crop a photo to 35×45 mm passport size in your browser',
      description:
        'Find the face in a photo and crop it to the Korean passport photo size (35×45 mm, head 32–36 mm), straightening any tilt. You can also change the background color. Download a 413×531 JPG for online applications. Your photo is never uploaded.',
    },
  },
  related: ['image/resize', 'image/compress', 'pdf/from-image'],
  flow: { from: { kind: 'jpg', mark: 'photo' }, to: { kind: 'jpg', mark: 'photo', small: true } },
});
