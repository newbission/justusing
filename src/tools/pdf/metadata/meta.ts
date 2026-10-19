import { defineTool } from '../../types';

export default defineTool({
  status: 'live',
  section: 'security',
  icon: ['M6 3h8l4 4v14H6z', 'M14 3v4h4', 'M9 11h2', 'M13 11h2', 'M9 15h6', 'M9 18h4'],
  text: {
    ko: {
      name: 'PDF 문서 정보 고치기',
      title: 'PDF 문서 정보 고치기 - 제목·작성자 바꾸기, 숨은 정보 지우기',
      description:
        'PDF의 제목·작성자·주제·키워드를 고치거나, 작성자 이름·사용한 프로그램·만든 날짜처럼 파일에 숨어 있는 정보를 모두 지웁니다. 파일은 서버에 올라가지 않습니다.',
    },
    en: {
      name: 'Edit PDF Metadata',
      title: 'Edit PDF Metadata - Change title and author, remove hidden info',
      description:
        'Change the title, author, subject and keywords of a PDF, or remove hidden information such as the author name, apps used and creation date. Your file is never uploaded.',
    },
  },
  related: ['pdf/protect', 'pdf/unlock'],
  flow: { from: { kind: 'pdf', mark: 'info' }, to: { kind: 'pdf' } },
});
