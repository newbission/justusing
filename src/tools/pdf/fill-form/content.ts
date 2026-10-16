import { defineContent } from '../../types';

export default defineContent({
  ko: {
    howTo: [
      '"PDF 파일 선택" 버튼을 누르거나 입력 칸이 있는 PDF를 화면으로 끌어다 놓습니다.',
      '쪽 위의 입력 칸(연한 초록 칸)을 눌러 글자를 적거나, 체크 상자·선택 상자를 고릅니다. ‹ › 버튼으로 쪽을 넘깁니다.',
      '한글을 적었다면 아래 글꼴 목록에서 글꼴을 받아 고릅니다.',
      '받는 사람이 고칠 수 없게 하려면 "칸을 글자로 굳히기"를 켭니다.',
      '"양식 저장"을 누르고, 완료되면 "다운로드"를 누릅니다.',
    ],
    faq: [
      {
        q: '어떤 PDF를 채울 수 있나요?',
        a: '입력 칸(양식 필드)이 들어 있는 PDF입니다. 다른 PDF 프로그램에서 칸을 눌러 바로 적을 수 있는 신청서·계약서가 여기에 해당합니다. 칸이 없이 인쇄용으로만 만든 PDF는 "PDF 편집"에서 원하는 자리에 글자를 넣으세요.',
      },
      {
        q: '한글을 적으려면 왜 글꼴을 골라야 하나요?',
        a: 'PDF 입력 칸의 기본 글꼴에는 한글이 없어서, 그대로 저장하면 한글이 빠집니다. 고른 한글 글꼴에서 적은 글자만 골라 PDF에 넣습니다. 글꼴은 처음 한 번 받으면 이 브라우저에 보관됩니다.',
      },
      {
        q: '"칸을 글자로 굳히기"는 무엇인가요?',
        a: '입력 칸을 없애고 적은 내용을 쪽 위의 글자로 바꿉니다. 받는 사람이 값을 고칠 수 없고, 어떤 프로그램에서 열어도 똑같이 보입니다. 굳히면 다시 칸으로 되돌릴 수 없으니 원본을 따로 보관하세요.',
      },
      {
        q: '서명 칸은 어떻게 채우나요?',
        a: '서명 칸(전자서명 필드)은 인증서가 필요해 이 도구에서 채우지 않습니다. 손글씨 서명 그림을 넣으려면 "PDF 서명 넣기"를 쓰세요.',
      },
      {
        q: '저장한 PDF를 다른 프로그램에서 열었더니 글자가 달라 보여요.',
        a: '일부 PDF 프로그램은 입력 칸을 자기 글꼴로 다시 그립니다. 어디서나 똑같이 보이게 하려면 "칸을 글자로 굳히기"를 켜고 저장하세요.',
      },
    ],
  },
  en: {
    howTo: [
      'Click "Choose PDF file" or drag a PDF with form fields onto the screen.',
      'Click a field on the page (shaded light green) to type, or tick checkboxes and pick options. Use the ‹ › buttons to change pages.',
      'If you typed characters the built-in font lacks, such as Korean, download and choose a font from the list below.',
      'To stop others from changing the values, turn on "Flatten fields into text".',
      'Click "Save form", then "Download" when it is done.',
    ],
    faq: [
      {
        q: 'Which PDFs can I fill?',
        a: 'PDFs with form fields, the kind of application or contract you can click and type into in other PDF apps. For PDFs made only for printing, with no fields, use "Edit PDF" to place text where you want.',
      },
      {
        q: 'Why do I sometimes need to choose a font?',
        a: 'The built-in font for PDF fields covers Western European characters only, so other characters such as Korean would be dropped. When you type them, choose a font and only the characters you typed are embedded. A font is downloaded once and kept in this browser.',
      },
      {
        q: 'What does "Flatten fields into text" do?',
        a: 'It removes the fields and turns what you entered into regular text on the page. Others cannot change the values, and the page looks the same in every app. Flattening cannot be undone, so keep your original.',
      },
      {
        q: 'How do I fill a signature field?',
        a: 'Signature fields need a digital certificate, so this tool does not fill them. To add an image of your handwritten signature, use "Sign PDF".',
      },
      {
        q: 'The text looks different when I open the saved PDF in another app.',
        a: 'Some PDF apps redraw form fields with their own fonts. To make it look the same everywhere, turn on "Flatten fields into text" before saving.',
      },
    ],
  },
});
