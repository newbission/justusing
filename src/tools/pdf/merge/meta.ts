import { defineTool } from '../../types';

export default defineTool({
  status: 'live',
  section: 'pages',
  icon: ['M4 4l8 7 8-7', 'M12 11v9', 'M8.5 16.5 12 20l3.5-3.5'],
  text: {
    ko: {
      name: 'PDF 합치기',
      summary: '여러 PDF를 원하는 순서로 하나로 합칩니다',
      title: 'PDF 합치기 - 업로드 없이 여러 PDF를 하나로',
      description:
        '여러 PDF 파일을 원하는 순서로 하나로 합칩니다. 파일은 서버로 전송되지 않습니다.',
    },
    en: {
      name: 'Merge PDF',
      summary: 'Combine several PDFs into one, in order',
      title: 'Merge PDF - Combine PDF files without uploading',
      description:
        'Combine several PDF files into one in the order you want. Your files are never sent to a server.',
    },
  },
  related: ['pdf/split', 'pdf/organize'],
  flow: { from: { kind: 'pdf', count: 3 }, to: { kind: 'pdf' } },
});
