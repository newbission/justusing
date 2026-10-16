import { defineTool } from '../../types';

export default defineTool({
  status: 'live',
  section: 'edit',
  icon: ['M6 3h12v18H6z', 'M8.5 6.5h7', 'M8.5 17.5h4', 'M8.5 10.5h7', 'M8.5 13.5h7'],
  text: {
    ko: {
      name: 'PDF 머리말·꼬리말 넣기',
      title: 'PDF 머리말·꼬리말 넣기 - 쪽 위아래에 글자 넣기, 업로드 없이',
      description:
        'PDF의 모든 쪽 위·아래에 회사 이름, 문서 제목, "3 / 10" 같은 쪽 번호와 날짜를 넣습니다. 한글 글꼴을 고를 수 있고, 파일은 서버에 올라가지 않습니다.',
    },
    en: {
      name: 'Add Header and Footer to PDF',
      title: 'Add Header and Footer to PDF - Text at the top and bottom of every page',
      description:
        'Add a company name, document title, page numbers like "3 / 10" and the date to the top and bottom of every PDF page. Choose a font. Your file is never uploaded.',
    },
  },
  related: ['pdf/page-numbers', 'pdf/watermark'],
});
