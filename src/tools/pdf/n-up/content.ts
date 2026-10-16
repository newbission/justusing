import { defineContent } from '../../types';

export default defineContent({
  ko: {
    howTo: [
      '"PDF 파일 선택" 버튼을 누르거나 모아찍을 PDF를 화면으로 끌어다 놓습니다.',
      '한 장에 넣을 쪽 수(2쪽·4쪽·6쪽·9쪽)와 종이(A4·Letter)를 고릅니다. 쪽마다 테두리 선을 넣을 수도 있습니다.',
      '첫 장 미리보기에서 쪽이 놓이는 모양을 확인합니다. 왼쪽 위부터 가로로 채웁니다.',
      '"모아찍기"를 누르고, 완료되면 "다운로드"를 누릅니다.',
    ],
    faq: [
      {
        q: '모아찍기는 언제 쓰나요?',
        a: '강의 슬라이드나 긴 자료를 종이를 아껴 인쇄할 때 씁니다. 프린터 설정의 "한 면에 여러 쪽"과 같지만, 결과를 PDF로 저장해 두거나 다른 사람에게 보낼 수 있습니다.',
      },
      {
        q: '종이 방향은 어떻게 정해지나요?',
        a: '2쪽과 6쪽은 쪽이 옆으로 나란히 놓이도록 종이를 가로로 눕히고, 4쪽과 9쪽은 세로로 둡니다. 세로로 긴 문서를 모을 때 칸이 가장 크게 나오는 방향입니다.',
      },
      {
        q: '글자가 흐려지지 않나요?',
        a: '쪽을 그림으로 바꾸지 않고 원래 내용 그대로 줄여 넣기 때문에 확대하면 선명하게 보입니다. 글자를 고르거나 검색하는 것도 그대로 됩니다. 다만 9쪽처럼 많이 모으면 인쇄했을 때 글자가 작아집니다.',
      },
      {
        q: '쪽 크기나 방향이 서로 다른 PDF도 되나요?',
        a: '됩니다. 쪽마다 비율을 지키며 칸 안에 맞추고 가운데에 둡니다. 회전된 쪽은 화면에 보이는 방향 그대로 넣습니다.',
      },
      {
        q: '쪽 순서를 바꾸고 싶어요.',
        a: '먼저 "PDF 페이지 정리"에서 순서를 바꾸거나 필요 없는 쪽을 지운 뒤 모아찍기를 하세요.',
      },
    ],
  },
  en: {
    howTo: [
      'Click "Choose PDF file" or drag the PDF onto the screen.',
      'Choose how many pages go on each sheet (2, 4, 6 or 9) and the paper size (A4 or Letter). You can also add a border around each page.',
      'Check the first sheet preview. Pages are placed left to right, top to bottom.',
      'Click "Create N-up PDF", then "Download" when it is done.',
    ],
    faq: [
      {
        q: 'When is N-up useful?',
        a: 'It saves paper when printing slides or long handouts. It works like the "pages per sheet" printer setting, but you get a PDF you can keep or send to others.',
      },
      {
        q: 'How is the paper orientation chosen?',
        a: 'With 2 or 6 pages per sheet the paper is turned to landscape so pages sit side by side. With 4 or 9 it stays portrait. This gives the largest cells for portrait documents.',
      },
      {
        q: 'Will the text get blurry?',
        a: 'No. Pages are scaled down as they are, not turned into images, so they stay sharp when zoomed in, and text can still be selected and searched. With 9 pages per sheet, printed text will be small, though.',
      },
      {
        q: 'Does it work with pages of different sizes or orientations?',
        a: 'Yes. Each page is scaled to fit its cell, keeping its proportions, and centered. Rotated pages are placed the way they appear on screen.',
      },
      {
        q: 'I want to change the page order.',
        a: 'Reorder or delete pages with "Organize PDF" first, then make the N-up PDF.',
      },
    ],
  },
});
