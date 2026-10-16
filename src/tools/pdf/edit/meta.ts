import { defineTool } from '../../types';

export default defineTool({
  status: 'live',
  section: 'edit',
  icon: ['M4 20h4L19 9l-4-4L4 16v4Z', 'M13.5 6.5l4 4'],
  text: {
    ko: {
      name: 'PDF 편집',
      title: 'PDF 편집 - 글자 넣기·흰색 가리기·형광펜, 업로드 없이',
      description:
        'PDF 쪽 위에 한글 글자를 넣고, 필요 없는 부분을 흰색으로 가리고, 형광펜을 칠합니다. 넣은 것은 옮기고 고칠 수 있으며 파일은 서버에 올라가지 않습니다.',
    },
    en: {
      name: 'Edit PDF',
      title: 'Edit PDF - Add text, white out and highlight in your browser',
      description:
        'Add text to PDF pages, cover parts with white and highlight. Move and edit what you add. Your file is never uploaded.',
    },
  },
  related: ['pdf/sign', 'pdf/add-image'],
});
