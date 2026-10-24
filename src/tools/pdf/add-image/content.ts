import { defineContent } from '../../types';

export default defineContent({
  ko: {
    uses: [
      {
        title: '문서에 회사 로고 넣기',
        text: '견적서나 안내문의 모든 쪽 같은 자리에 회사 로고를 넣습니다. 배경이 투명한 PNG 로고는 아래 글자를 가리지 않습니다.',
      },
      {
        title: '도장 이미지 찍기',
        text: '도장을 찍어 둔 이미지를 신청서나 확인서의 날인 칸에 맞춰 넣습니다. 끌어서 자리를 옮기고 크기를 칸에 맞출 수 있습니다.',
      },
      {
        title: '빈 곳에 사진 붙이기',
        text: '이력서 양식의 사진 칸이나 보고서의 빈 자리에 사진 한 장을 넣을 때 씁니다. "이 쪽만"을 고르면 지금 보는 쪽에만 들어갑니다.',
      },
    ],
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
        a: 'JPG와 PNG는 다시 압축하지 않고 원본 그대로 넣습니다. 사진 속 촬영 정보(위치·카메라 등 EXIF)와 설명은 빼고 넣습니다. 휴대폰 사진은 방향을 바로잡기 위해 높은 화질로 다시 저장합니다. 아이폰 사진(HEIC)은 PDF에 그대로 넣을 수 없어 높은 화질의 JPG로 바꿔 넣습니다. 크롬·엣지처럼 HEIC를 스스로 열지 못하는 브라우저에서는 HEIC를 여는 프로그램(libheif, 약 0.5MB)을 우리 사이트에서 받아 이 기기에서 엽니다.',
      },
      {
        q: '넣은 이미지를 나중에 옮기거나 지울 수 있나요?',
        a: '받은 PDF에서는 이미지가 쪽 내용의 일부가 되어 이 도구로 다시 옮기거나 지울 수 없습니다. 원본 PDF를 보관해 두고 다시 넣으세요.',
      },
    ],
  },
  en: {
    uses: [
      {
        title: 'Add your logo to documents',
        text: 'Put your company logo at the same spot on every page of a quote or notice. A PNG logo with a transparent background does not cover the text underneath.',
      },
      {
        title: 'Place a stamp or seal image',
        text: 'Place an image of your stamp or seal in the right box on an application or confirmation letter. Drag it into place and resize it to fit.',
      },
      {
        title: 'Insert a photo into a form',
        text: 'Use it to put a photo into the photo box of a resume template or an empty spot in a report. Choose "This page" to add it to the page you are viewing only.',
      },
    ],
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
        a: 'JPG and PNG files are added as they are, without recompression. Shooting details stored in photos (location, camera and other EXIF data) and descriptions are left out. Phone photos are saved again at high quality to fix their orientation. iPhone photos (HEIC) cannot go into a PDF as they are, so they are converted to a high-quality JPG. Browsers that cannot open HEIC on their own, such as Chrome and Edge, download a HEIC reader (libheif, about 0.5 MB) from this site and open the photo on this device.',
      },
      {
        q: 'Can I move or remove the image later?',
        a: 'In the downloaded PDF the image becomes part of the page, so this tool cannot move or remove it again. Keep the original PDF and add the image again if needed.',
      },
    ],
  },
});
