import { defineContent } from '../../types';

export default defineContent({
  ko: {
    howTo: [
      '"PDF 파일 선택" 버튼을 누르거나 PDF 파일을 화면으로 끌어다 놓습니다. 여러 파일을 한 번에 열 수 있습니다.',
      '파일이 열리면 아래로 스크롤하며 페이지를 넘겨 봅니다. 위쪽 ‹ › 버튼으로 한 페이지씩 이동할 수도 있습니다.',
      '− / + 버튼으로 확대·축소하고, "폭 맞춤"을 누르면 화면 폭에 맞춰 다시 보여줍니다.',
      '여러 파일을 열었다면 왼쪽 목록(휴대폰은 위쪽 고르기 상자)에서 볼 파일을 고릅니다. 더 보려면 "파일 추가", 목록에서 빼려면 × 를 누릅니다.',
    ],
    faq: [
      {
        q: '프로그램을 설치하거나 회원가입을 해야 하나요?',
        a: '필요 없습니다. 크롬, 엣지, 사파리, 파이어폭스 같은 최신 브라우저만 있으면 PC와 휴대폰에서 바로 쓸 수 있습니다.',
      },
      {
        q: '여러 PDF를 한 번에 볼 수 있나요?',
        a: '네. 여러 파일을 한 번에 고르거나 끌어다 놓으면 목록에 쌓이고, 목록에서 눌러 바꿔 가며 볼 수 있습니다. 암호 PDF는 한 번 암호를 넣으면 다른 파일을 보다 돌아와도 다시 묻지 않습니다.',
      },
      {
        q: '암호가 걸린 PDF도 볼 수 있나요?',
        a: '네. 파일을 열면 암호 입력 칸이 나타납니다. 입력한 암호 역시 이 기기 안에서만 쓰이고 어디에도 저장되거나 전송되지 않습니다.',
      },
      {
        q: '한글 PDF가 깨지지 않나요?',
        a: '한글·한자 등 동아시아 문자를 위한 글자 정보를 함께 제공하므로 대부분의 한글 PDF가 정상적으로 보입니다. 다만 PDF 안에 글꼴이 빠져 있으면 비슷한 글꼴로 대신 보일 수 있습니다.',
      },
      {
        q: '용량이 큰 PDF도 열 수 있나요?',
        a: '네. 화면에 보이는 페이지만 그때그때 그리기 때문에 수백 쪽짜리 문서도 열 수 있습니다. 다만 파일 전체를 기기 메모리에 올리므로, 메모리가 적은 휴대폰에서는 아주 큰 파일이 느릴 수 있습니다.',
      },
      {
        q: 'PDF를 수정하거나 합칠 수 있나요?',
        a: '이 도구는 보기 전용입니다. 여러 PDF를 하나로 합치려면 PDF 합치기, 한 PDF를 여러 파일로 나누려면 PDF 나누기, 방향을 바로잡으려면 PDF 회전, 순서를 바꾸거나 쪽을 빼려면 PDF 페이지 정리 도구를 쓰세요.',
      },
    ],
  },
  en: {
    howTo: [
      'Click "Choose PDF files" or drag PDF files onto the page. You can open several files at once.',
      'Once a file opens, scroll down to flip through the pages. You can also use the ‹ › buttons at the top to move one page at a time.',
      'Use − / + to zoom out and in. "Fit width" fits the page to the width of the screen again.',
      'If you opened several files, pick the one to view from the list on the left (the drop-down at the top on phones). Use "Add files" to open more, or × to remove one from the list.',
    ],
    faq: [
      {
        q: 'Do I need to install anything or sign up?',
        a: 'No. All you need is a modern browser such as Chrome, Edge, Safari or Firefox, on a computer or a phone.',
      },
      {
        q: 'Can I view several PDFs at once?',
        a: 'Yes. Choose or drop several files and they are added to a list. Click a file in the list to switch to it. For a password-protected PDF, you only enter the password once, even if you switch to another file and come back.',
      },
      {
        q: 'Can I open password-protected PDFs?',
        a: 'Yes. A password box appears when you open the file. The password is only used on this device and is never stored or sent anywhere.',
      },
      {
        q: 'Will Korean, Chinese or Japanese text display correctly?',
        a: 'Yes, in most cases. Character data for East Asian scripts is included, so most PDFs display correctly. If a PDF does not include its fonts, a similar font may be used instead.',
      },
      {
        q: 'Can I open large PDFs?',
        a: "Yes. Only the pages on screen are drawn, so documents with hundreds of pages open fine. The whole file is loaded into your device's memory, though, so very large files may be slow on phones with little memory.",
      },
      {
        q: 'Can I edit or merge PDFs here?',
        a: 'This tool is for viewing only. Use Merge PDF to combine several PDFs into one, Split PDF to split one PDF into several files, Rotate PDF to fix page orientation, and Organize PDF to reorder or delete pages.',
      },
    ],
  },
});
