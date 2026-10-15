import { defineContent } from '../../types';

export default defineContent({
  ko: {
    howTo: [
      '"PDF 파일 선택" 버튼을 누르거나 자를 PDF를 화면으로 끌어다 놓습니다.',
      '쪽 위의 밝은 사각형이 남길 영역입니다. 모서리 동그라미를 끌어 크기를 정하고, 가운데를 끌어 자리를 옮깁니다. 키보드로는 화살표 키를 씁니다. ‹ › 버튼으로 쪽을 바꿉니다.',
      '"이 쪽만" 또는 "모든 쪽"을 고르고 "PDF 자르기"를 누릅니다. 다시 하려면 "처음대로"를 누릅니다.',
      '완료되면 "다운로드"를 누릅니다.',
    ],
    faq: [
      {
        q: '잘라 낸 부분은 지워지나요?',
        a: '아니요. PDF 자르기는 쪽에서 보이는 영역만 줄이는 것이라, 잘라 낸 부분의 내용은 파일 안에 그대로 남아 있습니다. 다른 프로그램으로 다시 보이게 할 수 있으니 개인정보를 지우는 용도로는 쓰지 마세요.',
      },
      {
        q: '화질이 떨어지나요?',
        a: '아니요. 쪽을 다시 그리지 않고 보이는 영역만 바꾸기 때문에 글자와 이미지는 원본 그대로입니다.',
      },
      {
        q: '쪽마다 다른 영역으로 자를 수 있나요?',
        a: '"이 쪽만"으로 한 쪽을 자른 뒤, 받은 PDF를 다시 열어 다른 쪽을 자르면 됩니다. "모든 쪽"은 모든 쪽에서 같은 비율의 영역을 남깁니다.',
      },
    ],
  },
  en: {
    howTo: [
      'Click "Choose PDF file" or drag the PDF you want to crop onto the screen.',
      'The bright rectangle on the page is the area to keep. Drag the corner circles to resize it and the middle to move it. With a keyboard, use the arrow keys. Use the ‹ › buttons to change pages.',
      'Choose "This page" or "All pages" and click "Crop PDF". Click "Reset" to start over.',
      'When it is done, click "Download".',
    ],
    faq: [
      {
        q: 'Are the cropped-out parts deleted?',
        a: 'No. Cropping a PDF only shrinks the visible area of the page, so the cropped-out content stays in the file. Other programs can show it again, so do not use this to remove personal information.',
      },
      {
        q: 'Will the quality drop?',
        a: 'No. The page is not redrawn; only its visible area changes, so text and images stay exactly as they were.',
      },
      {
        q: 'Can I crop each page differently?',
        a: 'Crop one page with "This page", then open the downloaded PDF and crop another page. "All pages" keeps the same relative area on every page.',
      },
    ],
  },
});
