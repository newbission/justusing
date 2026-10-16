import { defineContent } from '../../types';

export default defineContent({
  ko: {
    howTo: [
      '"PDF 파일 선택" 버튼을 누르거나 가릴 PDF를 화면으로 끌어다 놓습니다.',
      '쪽 위에서 가릴 곳을 끌어 검은 상자를 그립니다. ‹ › 버튼으로 쪽을 넘깁니다.',
      '이름·전화번호처럼 여러 번 나오는 글자는 "찾아서 가리기"에 적고 "모두 찾아 가리기"를 누릅니다.',
      '상자를 눌러 고르고 끌어 옮기거나, "마지막 것 지우기"·Delete 키로 지웁니다.',
      '"가리고 저장"을 누르고, 완료되면 "다운로드"를 누릅니다.',
    ],
    faq: [
      {
        q: '그냥 검은 상자를 덮는 것과 무엇이 다른가요?',
        a: 'PDF 편집 프로그램에서 검은 사각형만 덮으면 밑의 글자는 파일에 그대로 남아, 복사하거나 상자를 치우면 다시 보입니다. 이 도구는 가린 쪽을 그림으로 다시 그려 가린 자리를 칠하고, 원래 쪽의 글자·그림은 새 파일에 넣지 않습니다. 그래서 가린 글자를 되살릴 수 없습니다.',
      },
      {
        q: '가린 쪽의 다른 글자는 어떻게 되나요?',
        a: '가린 쪽은 쪽 전체가 그림이 되므로, 그 쪽의 다른 글자도 고르거나 찾을 수 없게 됩니다. 보기에는 그대로입니다. 가리지 않은 쪽은 원래대로 글자를 고르고 찾을 수 있습니다. 가린 쪽에서도 글자를 찾고 싶다면 결과를 "PDF 글자 인식"에 넣으세요.',
      },
      {
        q: '"찾아서 가리기"가 못 찾는 글자가 있어요.',
        a: '스캔한 쪽은 글자가 그림이라 찾을 수 없습니다. 또 PDF가 글자를 줄 단위로 나눠 저장해 두었기 때문에, 줄이 바뀌는 곳에 걸친 말은 찾지 못합니다. 찾은 말은 글자 폭을 어림해 넉넉하게 가리므로 옆 글자가 조금 함께 가려질 수 있습니다. 찾은 뒤에도 쪽마다 빠진 곳이 없는지 확인하고, 빠진 곳은 직접 그려 가리세요.',
      },
      {
        q: '결과에서 빠지는 것이 있나요?',
        a: '가린 글자가 다른 곳으로 새지 않도록 책갈피, 링크, 양식(입력 칸), 문서 정보(제목·작성자 등), 첨부 파일은 넣지 않습니다. 양식에 적힌 값과 메모·서명처럼 인쇄되는 주석은 보이는 모습 그대로 쪽에 그려 넣습니다.',
      },
      {
        q: '파일이 커졌어요.',
        a: '가린 쪽은 쪽 전체를 그림으로 넣기 때문에 글자로 된 쪽보다 커집니다. 가린 쪽이 많으면 결과를 "PDF 압축"으로 줄일 수 있습니다.',
      },
    ],
  },
  en: {
    howTo: [
      'Click "Choose PDF file" or drag the PDF you want to redact onto the screen.',
      'Drag on the page to draw black boxes over what you want to remove. Use the ‹ › buttons to change pages.',
      'For words that appear many times, such as a name or phone number, type them in "Find and redact" and click "Redact all matches".',
      'Click a box to select it and drag to move it, or remove it with "Delete the last one" or the Delete key.',
      'Click "Redact and save", then "Download" when it is done.',
    ],
    faq: [
      {
        q: 'How is this different from drawing a black box?',
        a: 'A black rectangle drawn in a PDF editor leaves the text underneath in the file, so it can be copied or revealed by moving the box. This tool redraws each redacted page as an image with the boxes painted in, and does not put the original text or images of that page in the new file. The covered text cannot be recovered.',
      },
      {
        q: 'What happens to other text on a redacted page?',
        a: 'A redacted page becomes a single image, so the rest of its text can no longer be selected or searched, though it looks the same. Pages without redactions keep their text. To make redacted pages searchable again, run the result through "OCR PDF".',
      },
      {
        q: 'Find and redact missed some text.',
        a: 'Text on scanned pages is part of an image and cannot be found. Words that break across lines are also missed, because PDFs store text line by line. Matches are covered with some margin, because character widths are estimated, so neighboring characters may be partly covered too. After finding, check every page and draw boxes over anything that was missed.',
      },
      {
        q: 'Is anything left out of the result?',
        a: 'So that redacted text does not leak elsewhere, bookmarks, links, form fields, document information (title, author and so on) and attachments are not kept. Filled-in form values and printable comments or signatures are drawn onto the page as they look.',
      },
      {
        q: 'The file got bigger.',
        a: 'Redacted pages are stored as full-page images, which are larger than text. If many pages are redacted, shrink the result with "Compress PDF".',
      },
    ],
  },
});
