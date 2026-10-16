import { defineContent } from '../../types';

export default defineContent({
  ko: {
    howTo: [
      '"PDF 파일 선택" 버튼을 누르거나 PDF를 화면으로 끌어다 놓습니다.',
      '제목·작성자·주제·키워드 칸에 지금 적힌 정보가 나옵니다. 바꿀 것을 고칩니다. 칸을 비우면 그 정보를 지웁니다.',
      '숨은 정보를 모두 없애려면 "문서 정보 모두 지우기"를 켭니다.',
      '"저장"을 누르고, 완료되면 "다운로드"를 누릅니다.',
    ],
    faq: [
      {
        q: '문서 정보는 어디에 보이나요?',
        a: 'PDF 보기 프로그램의 "문서 속성"이나 "파일 정보"에서 볼 수 있고, 브라우저 탭에 제목으로 보이기도 합니다. 검색 엔진이 PDF를 보여 줄 때 제목을 쓰기도 해서, 홈페이지에 올릴 PDF는 제목을 알맞게 적어 두면 좋습니다.',
      },
      {
        q: '왜 숨은 정보를 지워야 하나요?',
        a: 'PDF에는 작성자 이름, 회사 이름, 사용한 프로그램, 만든 날짜와 고친 날짜가 들어 있는 경우가 많습니다. 본문에는 없는 정보라 모르고 보내기 쉽습니다. 외부에 보내는 문서는 "문서 정보 모두 지우기"로 지우고 보내세요.',
      },
      {
        q: '본문 내용도 바뀌나요?',
        a: '아니요. 문서 정보만 바꾸고 쪽 내용은 그대로 둡니다. 본문의 이름·번호를 지우려면 "PDF 가리기"를 쓰세요. 다만 파일을 새로 써서 저장하므로 전자 서명된 PDF는 서명이 더 이상 유효하지 않습니다 ("문서 정보 모두 지우기"를 고르면 서명 정보도 지웁니다).',
      },
      {
        q: '암호가 걸린 PDF도 되나요?',
        a: '네. 암호를 입력해 열고 문서 정보를 고칠 수 있습니다. 다만 저장한 파일에서는 암호와 인쇄·복사 제한이 풀립니다(화면에도 알려 드립니다). 보호가 필요하면 저장한 뒤 "PDF 암호 걸기"로 다시 거세요.',
      },
      {
        q: '저장했는데 다른 프로그램에서 예전 제목이 보여요.',
        a: 'PDF에는 문서 정보가 두 곳(Info와 XMP)에 들어 있을 수 있습니다. 이 도구는 예전 값이 남지 않게 XMP를 지우고 Info에 적습니다. 그래도 예전 제목이 보이면 그 프로그램이 파일 이름이나 저장해 둔 기록을 보여 주는 것일 수 있습니다. XMP에만 있던 저작권 정보와 PDF/A 표시도 함께 지워지므로, 보관용 PDF/A 파일이라면 원본을 따로 남겨 두세요.',
      },
    ],
  },
  en: {
    howTo: [
      'Click "Choose PDF file" or drag a PDF onto the screen.',
      'The current title, author, subject and keywords appear in the fields. Edit what you want to change. Leave a field empty to remove it.',
      'To remove all hidden information, turn on "Remove all document info".',
      'Click "Save", then "Download" when it is done.',
    ],
    faq: [
      {
        q: 'Where does document info show up?',
        a: 'In the "Document properties" of PDF viewers, and sometimes as the title of the browser tab. Search engines may show the title too, so give PDFs you publish on a website a proper title.',
      },
      {
        q: 'Why remove hidden information?',
        a: 'PDFs often contain the author name, company name, apps used, and creation and modification dates. Since this is not in the body text, it is easy to send without noticing. Remove it with "Remove all document info" before sending documents outside.',
      },
      {
        q: 'Does the content change?',
        a: 'No. Only the document info changes; the pages stay as they are. To remove names or numbers from the pages, use "Redact PDF". However, the file is rewritten when saved, so a digitally signed PDF loses its valid signature ("Remove all document info" also removes the signature information).',
      },
      {
        q: 'Does it work with password-protected PDFs?',
        a: 'Yes. Enter the password to open it and edit the document info. The saved file no longer has the password or print/copy restrictions (the tool tells you this too). If you need protection, add it again with "Protect PDF" after saving.',
      },
      {
        q: 'Another app still shows the old title.',
        a: 'PDFs can store document info in two places (Info and XMP). This tool removes the XMP copy so no old value is left and writes to Info. If an app still shows the old title, it may be showing the file name or its own history. Copyright details and the PDF/A marker that live only in XMP are removed too, so keep the original if it is an archival PDF/A file.',
      },
    ],
  },
});
