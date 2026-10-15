import { defineContent } from '../../types';

export default defineContent({
  ko: {
    howTo: [
      '"PDF 파일 선택" 버튼을 누르거나 이미지를 넣을 PDF를 화면으로 끌어다 놓습니다.',
      '"이미지 선택"을 눌러 넣을 이미지를 고릅니다.',
      '쪽 위의 이미지를 끌어 자리를 옮기고, 오른쪽 아래 동그라미를 끌어 크기를 정합니다. ‹ › 버튼으로 쪽을 바꿉니다. 키보드로는 화살표 키로 옮기고 + - 키로 크기를 바꿉니다.',
      '"이 쪽만" 또는 "모든 쪽"을 고르고 "이미지 넣기"를 누른 뒤, 완료되면 "다운로드"를 누릅니다.',
    ],
    faq: [
      {
        q: '배경이 투명한 로고도 넣을 수 있나요?',
        a: '네. 배경이 투명한 PNG는 투명한 채로 들어가 아래 글자가 가려지지 않습니다. JPG는 투명한 부분이 없어 사각형 그대로 들어갑니다.',
      },
      {
        q: '모든 쪽에 같은 로고를 넣을 수 있나요?',
        a: '"모든 쪽"을 고르면 모든 쪽의 같은 자리에 넣습니다. 쪽 크기가 서로 달라도 쪽 크기에 맞춘 같은 비율 자리에, 이미지 비율은 그대로 넣습니다.',
      },
      {
        q: '이미지 화질이 떨어지나요?',
        a: 'JPG와 PNG는 다시 압축하지 않고 원본 그대로 넣습니다. 휴대폰 사진은 방향을 바로잡기 위해 높은 화질로 다시 저장합니다.',
      },
      {
        q: '넣은 이미지를 나중에 옮기거나 지울 수 있나요?',
        a: '받은 PDF에서는 이미지가 쪽 내용의 일부가 되어 이 도구로 다시 옮기거나 지울 수 없습니다. 원본 PDF를 보관해 두고 다시 넣으세요.',
      },
    ],
  },
  en: {
    howTo: [
      'Click "Choose PDF file" or drag the PDF you want to add an image to onto the screen.',
      'Click "Choose image" and pick the image to add.',
      'Drag the image on the page to move it, and drag the circle at its lower right to set its size. Use the ‹ › buttons to change pages. With a keyboard, use the arrow keys to move it and + or - to resize it.',
      'Choose "This page" or "All pages", click "Add image", then click "Download" when it is done.',
    ],
    faq: [
      {
        q: 'Can I add a logo with a transparent background?',
        a: 'Yes. A PNG with a transparent background stays transparent, so the text underneath is not covered. JPG has no transparency, so it goes in as a full rectangle.',
      },
      {
        q: 'Can I put the same logo on every page?',
        a: 'Choose "All pages" to add it at the same spot on every page. If the pages differ in size, it goes at the same relative spot on each page and keeps its proportions.',
      },
      {
        q: 'Will the image lose quality?',
        a: 'JPG and PNG files are added as they are, without recompression. Phone photos are saved again at high quality to fix their orientation.',
      },
      {
        q: 'Can I move or remove the image later?',
        a: 'In the downloaded PDF the image becomes part of the page, so this tool cannot move or remove it again. Keep the original PDF and add the image again if needed.',
      },
    ],
  },
});
