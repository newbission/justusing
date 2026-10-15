import { defineTool } from '../../types';

export default defineTool({
  status: 'live',
  section: 'edit',
  icon: ['M3 20h18', 'M4 16c3-6 5-9 7-9 2 0 0 6 2 6s2-3 4-3 2 2 3 2'],
  text: {
    ko: {
      name: 'PDF 서명 넣기',
      title: 'PDF 서명 넣기 - 직접 그린 서명을 PDF에, 업로드 없이',
      description:
        '화면에 그린 서명이나 서명 이미지를 PDF 원하는 자리에 넣습니다. 서명과 파일은 브라우저 밖으로 나가지 않습니다.',
    },
    en: {
      name: 'Sign PDF',
      title: 'Sign PDF - Add your handwritten signature to a PDF in your browser',
      description:
        'Draw your signature or upload a signature image and place it anywhere on a PDF. Your signature and file never leave your browser.',
    },
  },
  related: ['pdf/add-image', 'pdf/protect'],
});
