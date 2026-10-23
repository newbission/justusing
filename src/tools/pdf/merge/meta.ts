import { defineTool } from '../../types';

export default defineTool({
  status: 'live',
  section: 'pages',
  icon: ['M4 4l8 7 8-7', 'M12 11v9', 'M8.5 16.5 12 20l3.5-3.5'],
  text: {
    ko: {
      name: 'PDF 합치기',
      summary: '여러 PDF를 원하는 순서로 하나로 합칩니다',
      title: 'PDF 합치기 - 무료로 여러 PDF를 하나로, 업로드 없이',
      description:
        '여러 PDF 파일을 끌어서 순서를 정하고 하나로 합칩니다. 암호가 걸린 PDF도 암호를 넣어 합칠 수 있고, 가입·설치 없이 무료입니다. 파일은 서버로 전송되지 않습니다.',
    },
    en: {
      name: 'Merge PDF',
      summary: 'Combine several PDFs into one, in order',
      title: 'Merge PDF - Combine PDF files into one for free, without uploading',
      description:
        'Drag PDF files into the order you want and combine them into one. Password-protected PDFs work too once you enter the password. Free, with no sign-up or install, and your files are never sent to a server.',
    },
  },
  related: ['pdf/split', 'pdf/organize'],
  flow: { from: { kind: 'pdf', count: 3 }, to: { kind: 'pdf' } },
});
