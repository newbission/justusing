import { defineTool } from '../../types';

export default defineTool({
  status: 'live',
  section: 'view',
  icon: ['M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z', 'M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z'],
  text: {
    ko: {
      name: 'PDF 보기',
      summary: '페이지를 넘기며 PDF를 바로 봅니다',
      title: 'PDF 보기 - 설치·업로드 없이 브라우저에서 열기',
      description: 'PDF 파일을 업로드하지 않고 브라우저에서 바로 열어 페이지를 넘겨 봅니다.',
    },
    en: {
      name: 'View PDF',
      summary: 'Open a PDF and flip through its pages',
      title: 'View PDF - Open PDFs in your browser, no install or upload',
      description:
        'Open a PDF right in your browser and flip through its pages, without uploading it.',
    },
  },
  related: ['pdf/merge', 'pdf/split'],
});
