import { defineTool } from '../../types';

export default defineTool({
  status: 'live',
  section: 'security',
  icon: ['M6 3h12v18H6z', 'M8.5 7h7v2.5h-7z', 'M8.5 12h7', 'M8.5 15.5h4.5v2.5H8.5z'],
  text: {
    ko: {
      name: 'PDF 가리기 (영구 삭제)',
      title: 'PDF 가리기 - 개인정보를 검게 칠하고 완전히 지우기, 업로드 없이',
      description:
        'PDF의 이름·주민번호·전화번호 같은 개인정보를 검은 상자로 가리고, 가린 글자를 파일에서 완전히 지웁니다. 글자를 찾아 한 번에 가릴 수도 있고, 파일은 서버에 올라가지 않습니다.',
    },
    en: {
      name: 'Redact PDF',
      title: 'Redact PDF - Black out and permanently remove text in your browser',
      description:
        'Cover names, ID numbers, phone numbers and other private information in a PDF with black boxes, and remove the covered text from the file for good. Find and redact all matches at once. Your file is never uploaded.',
    },
  },
  related: ['pdf/edit', 'pdf/protect'],
});
