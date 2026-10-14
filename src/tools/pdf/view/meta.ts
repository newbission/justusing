import { defineTool } from '../../types';

export default defineTool({
  status: 'live',
  text: {
    ko: {
      name: 'PDF 보기',
      title: 'PDF 보기 - 설치·업로드 없이 브라우저에서 열기',
      description: 'PDF 파일을 업로드하지 않고 브라우저에서 바로 열어 페이지를 넘겨 봅니다.',
    },
    en: {
      name: 'View PDF',
      title: 'View PDF - Open PDFs in your browser, no install or upload',
      description:
        'Open a PDF right in your browser and flip through its pages, without uploading it.',
    },
  },
  related: ['pdf/merge', 'pdf/split'],
});
