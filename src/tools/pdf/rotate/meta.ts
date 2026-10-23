import { defineTool } from '../../types';

export default defineTool({
  status: 'live',
  section: 'pages',
  icon: ['M20 12a8 8 0 1 1-8-8c2.2 0 4.3.9 5.9 2.4L20 8.5', 'M20 3.5v5h-5'],
  text: {
    ko: {
      name: 'PDF 회전',
      summary: '눕거나 뒤집힌 쪽을 바로 돌립니다',
      title: 'PDF 회전 - 페이지 방향 돌려서 저장, 무료·업로드 없이',
      description:
        '옆으로 눕거나 뒤집힌 PDF 페이지를 썸네일에서 한 쪽씩 또는 전체를 90°씩 돌려 저장합니다. 스캔한 문서의 방향을 바로잡을 때 좋습니다. 파일은 서버로 전송되지 않습니다.',
    },
    en: {
      name: 'Rotate PDF',
      summary: 'Turn sideways or upside-down pages',
      title: 'Rotate PDF - Rotate pages and save, free and without uploading',
      description:
        'Rotate sideways or upside-down PDF pages by 90°, one page at a time or all at once, from the thumbnails and save the result. Handy for fixing scanned documents. Your file is never sent to a server.',
    },
  },
  related: ['pdf/organize', 'pdf/view'],
  flow: { from: { kind: 'pdf' }, to: { kind: 'pdf', mark: 'rotate' } },
});
