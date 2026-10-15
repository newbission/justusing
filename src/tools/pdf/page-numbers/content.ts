import { defineContent } from '../../types';

export default defineContent({
  ko: {
    howTo: [
      '"PDF 파일 선택" 버튼을 누르거나 번호를 넣을 PDF를 화면으로 끌어다 놓습니다.',
      '번호 위치("아래 가운데", "아래 오른쪽", "위 오른쪽")와 모양("1", "1 / 10", "- 1 -")을 고릅니다.',
      '첫 쪽에 붙일 번호를 "시작 번호"에 입력합니다. 쪽 격자 아래에 각 쪽에 들어갈 번호가 보입니다.',
      '"쪽 번호 넣기"를 누르고, 완료되면 "다운로드"를 누릅니다.',
    ],
    faq: [
      {
        q: '표지에는 번호를 빼고 싶어요.',
        a: '먼저 "PDF 나누기"로 표지와 본문을 나눈 뒤 본문에만 번호를 넣고, "PDF 합치기"로 다시 합치세요. 본문이 2쪽부터 시작하게 하려면 "시작 번호"에 2를 넣으면 됩니다.',
      },
      {
        q: '옆으로 돌린 쪽에도 번호가 바로 보이나요?',
        a: '네. 쪽이 돌아가 있어도 화면에 보이는 방향을 기준으로 아래·위 자리에 똑바로 넣습니다.',
      },
      {
        q: '원본 내용이나 화질이 바뀌나요?',
        a: '아니요. 원본 쪽 위에 번호 글자만 더합니다. 글자와 이미지는 그대로입니다.',
      },
    ],
  },
  en: {
    howTo: [
      'Click "Choose PDF file" or drag the PDF you want to number onto the screen.',
      'Choose the position ("Bottom center", "Bottom right" or "Top right") and the style ("1", "1 / 10" or "- 1 -").',
      'Enter the number for the first page in "Start at". The label under each page in the grid shows the number it will get.',
      'Click "Add page numbers", then click "Download" when it is done.',
    ],
    faq: [
      {
        q: 'I do not want a number on the cover.',
        a: 'Use "Split PDF" to separate the cover from the rest, add numbers to the rest only, then put them back together with "Merge PDF". To start the body at 2, enter 2 in "Start at".',
      },
      {
        q: 'Do numbers appear upright on rotated pages?',
        a: 'Yes. Even on rotated pages, numbers are placed upright at the top or bottom as the page appears on screen.',
      },
      {
        q: 'Does the original content or quality change?',
        a: 'No. Only the number text is added on top of each page. Text and images stay as they were.',
      },
    ],
  },
});
