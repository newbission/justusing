import { defineTool } from '../../types';

export default defineTool({
  status: 'live',
  section: 'edit',
  // 둥근 사진 틀 안에서 한쪽 귀퉁이만 잘게 나뉜 칸 (모자이크)
  icon: [
    'M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z',
    'M3 12h9V3',
    'M3 7.5h9',
    'M7.5 3v9',
    'M14 17l2.5-3 2.5 3',
  ],
  text: {
    ko: {
      name: '이미지 모자이크',
      summary: '얼굴·번호판을 모자이크·흐림·검게 칠해 가립니다',
      title: '이미지 모자이크 - 얼굴·번호판·개인정보 가리기, 업로드 없이',
      description:
        '사진 속 얼굴·자동차 번호판·전화번호를 모자이크·흐림·검게 칠하기로 가립니다. 여러 곳을 그려 한 번에 가리고, 사진은 서버에 올라가지 않습니다.',
    },
    en: {
      name: 'Pixelate & Blur Image',
      summary: 'Pixelate, blur or black out faces and plates',
      title: 'Pixelate image - Blur faces, license plates and personal info in your browser',
      description:
        'Hide faces, license plates and phone numbers in a photo with mosaic, blur or black boxes. Mark several areas at once. Your images are never uploaded.',
    },
  },
  related: ['pdf/redact', 'image/remove-location', 'image/crop'],
  flow: { from: { kind: 'jpg', mark: 'photo' }, to: { kind: 'jpg', mark: 'mosaic' } },
});
