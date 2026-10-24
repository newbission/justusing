import { defineContent } from '../../types';

export default defineContent({
  ko: {
    uses: [
      {
        title: '긴 대화·글을 캡처 한 장으로',
        text: '메신저 대화나 긴 글을 내려 가며 여러 장 캡처했다면 한 장으로 이어 보내거나 보관합니다. 장마다 겹친 부분과 위의 상태 표시줄·제목 막대, 아래 탭 막대는 찾아서 한 번만 남깁니다.',
      },
      {
        title: '상세페이지·안내 이미지 만들기',
        text: '쇼핑몰 상세페이지나 공지 이미지처럼 여러 장을 위아래로 이어야 할 때, 폭을 860px처럼 정해 맞추고 사진 사이 간격과 바탕색을 정해 한 장으로 만듭니다.',
      },
      {
        title: '비교 사진을 옆으로 나란히',
        text: '전후 사진이나 여러 제품 사진을 가로로 나란히 이어 한눈에 비교합니다. 높이를 맞춰 붙이므로 크기가 다른 사진도 가지런히 놓입니다.',
      },
    ],
    howTo: [
      '"이미지 파일 선택" 버튼을 누르거나 이미지를 화면으로 끌어다 놓습니다. 위에서부터 잇는 순서대로 목록에 들어가고, ↑·↓ 버튼으로 순서를 바꿀 수 있습니다.',
      '잇는 방향을 고릅니다. 세로로 이으면 화면 캡처의 겹친 부분을 자동으로 찾아 이음마다 잘라 낼 높이를 채웁니다. 미리보기를 보며 숫자를 고칠 수 있습니다.',
      '맞출 폭, 간격, 바탕색, 저장 형식(JPG·PNG·WebP·PDF)을 고릅니다. 너무 길면 "긴 결과를 나누어 저장"을 켭니다.',
      '"이어 붙이기"를 누른 뒤 "다운로드"로 받습니다. 나누어 저장했으면 "모두 받기"로 ZIP 하나에 받습니다.',
    ],
    faq: [
      {
        q: '겹친 부분은 어떻게 찾나요?',
        a: '두 캡처에서 같은 높이의 줄이 같으면 고정된 막대(상태 표시줄·제목 막대·탭 막대)로 보고, 위 캡처의 끝부분과 아래 캡처의 첫 부분이 같은 가장 긴 구간을 겹친 부분으로 봅니다. 시계처럼 장마다 바뀌는 곳은 건너뜁니다. 폭이 같은 이미지끼리만 찾고, 빈 화면만 겹쳐 보이면 겹침으로 보지 않습니다.',
      },
      {
        q: '자동으로 찾은 곳이 틀렸어요.',
        a: '목록의 이음마다 "위 사진 아래"와 "아래 사진 위"에서 잘라 낼 높이(px)가 있습니다. 숫자를 고치면 미리보기에 바로 보이고, "자동 값으로"를 누르면 찾은 값으로 돌아갑니다. 자동 지우기를 끄면 아무것도 자르지 않고 그대로 잇습니다.',
      },
      {
        q: '폭이 다른 이미지도 이을 수 있나요?',
        a: '네. 세로로 이을 때는 모두 같은 폭으로, 가로로 이을 때는 같은 높이로 맞춥니다. 가장 좁은(낮은) 이미지에 맞추면 큰 이미지를 줄이고, 가장 넓은 이미지나 직접 적은 크기에 맞추면 작은 이미지를 늘립니다. 늘린 이미지는 흐려질 수 있어 화면에 알려 드립니다.',
      },
      {
        q: '아주 긴 이미지도 만들 수 있나요?',
        a: 'PNG·JPG는 결과를 조금씩 그려 저장해서 아주 긴 이미지도 만들 수 있습니다. JPG는 한 장에 65,500px, WebP는 16,383px까지라 더 길면 PNG로 저장하거나 나누어 저장하세요. 나누어 저장하면 정한 높이 안에서 빈 줄을 찾아 잘라 글 줄이 반으로 잘리지 않게 합니다. 일부 사이트는 아주 긴 이미지를 줄여 보여 주므로 나누어 올리는 편이 읽기 쉽습니다.',
      },
      {
        q: 'PDF로 받으면 어떻게 되나요?',
        a: '세로로 이은 결과를 A4 비율의 쪽으로 나눠 PDF 하나로 만듭니다. 쪽을 나누는 곳도 빈 줄에서 고릅니다. 화면 캡처를 문서처럼 인쇄하거나 보낼 때 좋습니다.',
      },
      {
        q: '이미지가 서버로 올라가나요?',
        a: '아니요. 겹친 부분 찾기, 잇기, 저장 모두 이 브라우저 안에서 합니다. 대화나 개인 정보가 담긴 캡처도 안심하고 쓸 수 있습니다.',
      },
    ],
  },
  en: {
    uses: [
      {
        title: 'Turn a long chat or article into one image',
        text: 'If you took several screenshots while scrolling through a chat or a long page, join them into one image to send or keep. Overlapping parts and the status bar, title bar and tab bar that repeat on every shot are found and kept only once.',
      },
      {
        title: 'Make product detail or notice images',
        text: 'When several images need to be stacked, such as an online store detail page or a notice, set a width like 860px, add a gap and background color, and make one image.',
      },
      {
        title: 'Put photos side by side',
        text: 'Join before-and-after shots or product photos side by side to compare them at a glance. They are matched to the same height, so photos of different sizes line up neatly.',
      },
    ],
    howTo: [
      'Click "Choose image files" or drag images onto the page. They go into the list in order from the top, and you can change the order with the ↑ and ↓ buttons.',
      'Choose the direction. When stitching vertically, overlapping parts of screenshots are found automatically and the height to cut off is filled in at each seam. You can change the numbers while watching the preview.',
      'Choose the width, gap, background and format (JPG, PNG, WebP or PDF). If the result is very long, turn on "Split a long result into several images".',
      'Click "Stitch", then "Download". If you split the result, use "Download all" to get one ZIP file.',
    ],
    faq: [
      {
        q: 'How are overlapping parts found?',
        a: 'Rows that are the same at the same height in two screenshots are treated as fixed bars (status bar, title bar, tab bar). The longest stretch where the end of the upper shot matches the start of the lower shot is treated as the overlap. Parts that change on every shot, such as the clock, are skipped. Only images of the same width are checked, and a match of blank space alone does not count as an overlap.',
      },
      {
        q: 'The automatic result is wrong.',
        a: 'Each seam in the list shows how many pixels are cut off from the bottom of the upper image and the top of the lower image. Change the numbers and the preview updates right away, or click "Use automatic values" to go back. If you turn off automatic removal, nothing is cut off.',
      },
      {
        q: 'Can I stitch images of different sizes?',
        a: 'Yes. Images are matched to the same width when stitching vertically and to the same height when stitching horizontally. Matching the narrowest (shortest) image shrinks the larger ones, while matching the widest image or a custom size enlarges the smaller ones. Enlarged images may look blurry, so the tool tells you when that happens.',
      },
      {
        q: 'Can I make a very long image?',
        a: 'PNG and JPG results are drawn and saved bit by bit, so they can be very long. JPG allows up to 65,500px and WebP up to 16,383px in one image, so for longer results save as PNG or split them. When splitting, each cut is made at a blank line within the height you set so lines of text are not cut in half. Some sites shrink very long images, so splitting them often makes them easier to read.',
      },
      {
        q: 'What happens if I save as PDF?',
        a: 'The vertically stitched result is split into A4-shaped pages in one PDF, again cutting at blank lines. This is handy for printing or sending screenshots as a document.',
      },
      {
        q: 'Are my images uploaded?',
        a: 'No. Finding overlaps, stitching and saving all happen in this browser, so you can safely use screenshots of chats or personal information.',
      },
    ],
  },
});
