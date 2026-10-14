import { defineContent } from '../../types';

export default defineContent({
  ko: {
    howTo: [
      '"PDF 파일 선택" 버튼을 누르거나 돌릴 PDF를 화면으로 끌어다 놓습니다.',
      '쪽마다 ↺(왼쪽)·↻(오른쪽)를 눌러 90°씩 돌립니다. 모든 쪽을 한꺼번에 돌리려면 위쪽의 "전체 ↺"·"전체 ↻"를 누릅니다.',
      '돌린 쪽은 초록 테두리와 각도로 표시됩니다. 처음 상태로 돌아가려면 "되돌리기"를 누릅니다.',
      '"PDF 회전"을 누르고, 완료되면 "다운로드"로 받습니다.',
    ],
    faq: [
      {
        q: '돌리면 화질이 떨어지나요?',
        a: '아니요. 페이지를 다시 그리지 않고 PDF 안의 "방향" 정보만 바꾸기 때문에 글자·이미지 품질이 그대로입니다.',
      },
      {
        q: '스캔한 문서가 옆으로 누워 있어요. 한 번에 바로잡을 수 있나요?',
        a: '네. "전체 ↻"(또는 "전체 ↺")를 누르면 모든 쪽이 같은 방향으로 돌아갑니다. 일부만 누워 있다면 그 쪽만 따로 돌리면 됩니다.',
      },
      {
        q: '암호가 걸린 PDF도 돌릴 수 있나요?',
        a: '네. 파일을 열 때 암호를 입력하면 됩니다. 결과 파일에는 암호가 걸리지 않으니 보관에 주의하세요. 입력한 암호는 이 기기 안에서만 쓰입니다.',
      },
    ],
  },
  en: {
    howTo: [
      'Click "Choose PDF file" or drag the PDF you want to rotate onto the page.',
      'Click ↺ (left) or ↻ (right) on a page to rotate it by 90°. To rotate every page at once, use "All ↺" or "All ↻" at the top.',
      'Rotated pages are marked with a green border and their angle. Click "Reset" to go back to the original.',
      'Click "Rotate PDF". When it is done, click "Download".',
    ],
    faq: [
      {
        q: 'Does rotating reduce quality?',
        a: 'No. Pages are not redrawn. Only the orientation setting inside the PDF changes, so text and images keep their quality.',
      },
      {
        q: 'My scanned document is sideways. Can I fix it all at once?',
        a: 'Yes. Click "All ↻" (or "All ↺") to rotate every page in the same direction. If only some pages are sideways, rotate just those pages.',
      },
      {
        q: 'Can I rotate password-protected PDFs?',
        a: 'Yes. Enter the password when you open the file. The result has no password, so keep it somewhere safe. The password is only used on this device.',
      },
    ],
  },
});
