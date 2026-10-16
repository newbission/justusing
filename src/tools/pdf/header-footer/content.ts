import { defineContent } from '../../types';

export default defineContent({
  ko: {
    howTo: [
      '"PDF 파일 선택" 버튼을 누르거나 PDF를 화면으로 끌어다 놓습니다.',
      '"머리말 (쪽 위)"과 "꼬리말 (쪽 아래)"에 넣을 글자를 적고, 각각 왼쪽·가운데·오른쪽 정렬을 고릅니다. 하나만 적어도 됩니다.',
      '쪽 번호는 {쪽}, 전체 쪽 수는 {전체}, 오늘 날짜는 {날짜}라고 적으면 쪽마다 채워집니다. 예: "{쪽} / {전체}"',
      '아래 글꼴 목록에서 글꼴을 고르고(처음이면 "받기"), 크기와 색을 고릅니다. 표지에 넣고 싶지 않으면 "첫 쪽(표지)에는 넣지 않기"를 켭니다.',
      '쪽 미리보기로 확인한 뒤 "머리말·꼬리말 넣기"를 누르고, 완료되면 "다운로드"를 누릅니다.',
    ],
    faq: [
      {
        q: '쪽 번호 넣기 도구와 무엇이 다른가요?',
        a: '쪽 번호 넣기는 숫자만 빠르게 넣고 글꼴을 받을 필요가 없습니다. 머리말·꼬리말은 한글 글꼴로 회사 이름·문서 제목 같은 글자를 쪽 번호·날짜와 함께 위아래에 넣을 수 있습니다.',
      },
      {
        q: '표지를 빼면 쪽 번호는 몇부터 시작하나요?',
        a: '쪽 번호는 첫 쪽부터 세므로, 표지를 빼면 둘째 쪽에 "2"가 찍힙니다. 표지를 1쪽으로 치는 일반적인 문서 방식과 같습니다.',
      },
      {
        q: '날짜는 어떤 모양으로 들어가나요?',
        a: '이 기기의 오늘 날짜가 화면 언어에 맞는 모양으로 들어갑니다 (예: 2026. 10. 15.). 다른 날짜를 넣고 싶으면 {날짜} 대신 날짜를 직접 적으세요.',
      },
      {
        q: '원래 내용과 겹치지 않나요?',
        a: '머리말·꼬리말은 쪽 가장자리에서 약 10mm 안쪽에 들어갑니다. 원래 문서의 여백이 아주 좁으면 본문과 겹칠 수 있으니 미리보기로 확인하세요. 크기를 "작게"로 바꾸면 덜 겹칩니다.',
      },
      {
        q: '글꼴은 어떻게 받나요?',
        a: 'PDF에 한글을 넣으려면 글꼴이 필요합니다. 목록의 글꼴은 처음 한 번 받으면 이 브라우저에 보관되어 다음부터 바로 씁니다. PDF에는 쓴 글자만 들어가 파일이 거의 커지지 않습니다. 내 글꼴을 올려 쓸 수도 있습니다.',
      },
    ],
  },
  en: {
    howTo: [
      'Click "Choose PDF file" or drag the PDF onto the screen.',
      'Type the text for "Header (top of page)" and "Footer (bottom of page)", and choose left, center or right alignment for each. You can fill in just one.',
      'Write {page} for the page number, {total} for the number of pages and {date} for today, and they are filled in on each page. For example: "{page} / {total}"',
      'Choose a font from the list below (click "Download" the first time), then the size and color. To leave the cover blank, turn on "Skip the first page (cover)".',
      'Check the page preview, click "Add header and footer", then "Download" when it is done.',
    ],
    faq: [
      {
        q: 'How is this different from Add Page Numbers?',
        a: 'Add Page Numbers quickly adds numbers only, with no font to download. Header and footer lets you add text such as a company name or document title, together with page numbers and the date, using a font you choose.',
      },
      {
        q: 'If I skip the cover, where does numbering start?',
        a: 'Pages are counted from the first page, so with the cover skipped, the second page shows "2". This matches how most documents count the cover as page 1.',
      },
      {
        q: 'What does the date look like?',
        a: "Today's date on this device, in the format of the page language (for example, 10/15/2026). To use another date, type it directly instead of {date}.",
      },
      {
        q: 'Will it overlap the content?',
        a: 'Headers and footers are placed about 10 mm in from the page edge. If the document has very narrow margins they may overlap, so check the preview. Choosing "Small" helps.',
      },
      {
        q: 'How do fonts work?',
        a: 'Text in a PDF needs a font. A font from the list is downloaded once and kept in this browser for next time. Only the characters you use are embedded, so the file barely grows. You can also upload your own font.',
      },
    ],
  },
});
