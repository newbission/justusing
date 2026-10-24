import { defineTool } from '../../types';

export default defineTool({
  status: 'live',
  section: 'convert',
  icon: ['M4 8V4h4', 'M16 4h4v4', 'M20 16v4h-4', 'M8 20H4v-4', 'M8 8h8', 'M12 8v9'],
  text: {
    ko: {
      name: '이미지 글자 추출 (OCR)',
      summary: '사진·캡처 속 글자를 복사할 수 있게 뽑습니다',
      title: '이미지 글자 추출(OCR) - 사진·캡처 속 글자를 텍스트로, 업로드 없이',
      description:
        '사진, 화면 캡처, 스캔한 이미지 속 한국어·영어 글자를 읽어 복사하거나 TXT로 받습니다. 여러 장을 한 번에 읽고, 기울어진 사진은 바로 세워 읽습니다. 이미지는 서버에 올라가지 않습니다.',
    },
    en: {
      name: 'Image to Text (OCR)',
      summary: 'Copy text out of photos and screenshots',
      title: 'Image to Text (OCR) - Extract text from photos in your browser',
      description:
        'Read the English and Korean text in photos, screenshots and scanned images, then copy it or save it as TXT. Reads many images at once and straightens tilted photos. Your images are never uploaded.',
    },
  },
  related: ['pdf/ocr', 'image/crop', 'pdf/from-image'],
  flow: { from: { kind: 'jpg', count: 2, mark: 'scan' }, to: { kind: 'txt' } },
});
