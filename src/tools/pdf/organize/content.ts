import { defineContent } from '../../types';

export default defineContent({
  ko: {
    howTo: [
      '"PDF 파일 선택" 버튼을 누르거나 정리할 PDF를 화면으로 끌어다 놓습니다.',
      '쪽을 끌어서 옮기거나 ◀ ▶ 버튼으로 순서를 바꿉니다. 쪽 왼쪽 위의 번호가 결과 PDF에서의 순서입니다.',
      '필요 없는 쪽은 "제외"를 누릅니다. 흐리게 표시되고, "복구"를 누르면 다시 들어갑니다. 처음 상태로 돌아가려면 "되돌리기"를 누릅니다.',
      '"PDF 정리"를 누르고, 완료되면 "다운로드"로 받습니다.',
    ],
    faq: [
      {
        q: '원본 파일도 바뀌나요?',
        a: '아니요. 원본은 그대로 두고, 정리한 결과를 새 PDF 파일로 받습니다.',
      },
      {
        q: '정리하면 화질이 떨어지나요?',
        a: '아니요. 페이지를 다시 그리지 않고 원본 PDF의 내용을 그대로 옮겨 담기 때문에 글자·이미지 품질이 그대로입니다.',
      },
      {
        q: '여러 PDF의 페이지를 섞어서 정리하고 싶어요.',
        a: 'PDF 합치기 도구를 쓰세요. 여러 파일을 넣고 파일마다 페이지를 펼쳐 순서를 바꾸거나 뺀 뒤 하나로 합칠 수 있습니다.',
      },
      {
        q: '암호가 걸린 PDF도 정리할 수 있나요?',
        a: '네. 파일을 열 때 암호를 입력하면 됩니다. 결과 파일에는 암호가 걸리지 않으니 보관에 주의하세요. 입력한 암호는 이 기기 안에서만 쓰입니다.',
      },
    ],
  },
  en: {
    howTo: [
      'Click "Choose PDF file" or drag the PDF you want to organize onto the page.',
      'Drag pages or use the ◀ ▶ buttons to change the order. The number at the top left of each page is its position in the new PDF.',
      'Click "Exclude" on pages you do not need. They are dimmed, and "Restore" puts them back. Click "Reset" to go back to the original.',
      'Click "Organize PDF". When it is done, click "Download".',
    ],
    faq: [
      {
        q: 'Is my original file changed?',
        a: 'No. The original stays as it is, and you download the result as a new PDF file.',
      },
      {
        q: 'Does organizing reduce quality?',
        a: 'No. Pages are not redrawn. The content of the original PDF is copied as is, so text and images keep their quality.',
      },
      {
        q: 'I want to mix pages from several PDFs.',
        a: 'Use the Merge PDF tool. Add several files, show the pages of each file, reorder or leave out pages, and merge them into one.',
      },
      {
        q: 'Can I organize password-protected PDFs?',
        a: 'Yes. Enter the password when you open the file. The result has no password, so keep it somewhere safe. The password is only used on this device.',
      },
    ],
  },
});
