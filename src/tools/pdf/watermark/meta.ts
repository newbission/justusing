import { defineTool } from '../../types';

export default defineTool({
  status: 'live',
  section: 'edit',
  icon: ['M6 3h12v18H6z', 'M8.5 16 15.5 8', 'M10 18.5l7-8', 'M7 13.5l7-8'],
  text: {
    ko: {
      name: 'PDF 워터마크 넣기',
      summary: '"대외비" 같은 글자를 모든 쪽에 넣습니다',
      title: 'PDF 워터마크 넣기 - 한글 글자 워터마크, 업로드 없이',
      description:
        'PDF의 모든 쪽에 "대외비", "사본" 같은 글자 워터마크를 넣습니다. 한글 글꼴을 고르고 크기·진하기·기울기를 미리 보며 정합니다. 파일은 서버에 올라가지 않습니다.',
    },
    en: {
      name: 'Add Watermark to PDF',
      summary: 'Stamp text like "COPY" on every page',
      title: 'Add Watermark to PDF - Text watermark in your browser',
      description:
        'Add a text watermark such as "CONFIDENTIAL" or "COPY" to every page of a PDF. Choose a font and preview the size, opacity and angle. Your file is never uploaded.',
    },
  },
  related: ['pdf/page-numbers', 'pdf/protect'],
  flow: { from: { kind: 'pdf' }, to: { kind: 'pdf', mark: 'watermark' } },
});
