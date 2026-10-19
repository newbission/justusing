import { defineTool } from '../../types';

export default defineTool({
  status: 'live',
  section: 'pages',
  icon: ['M4 3h16v18H4z', 'M7 6h4v5H7z', 'M13 6h4v5h-4z', 'M7 13h4v5H7z', 'M13 13h4v5h-4z'],
  text: {
    ko: {
      name: 'PDF 모아찍기 (한 장에 여러 쪽)',
      title: 'PDF 모아찍기 - 한 장에 2쪽·4쪽·6쪽·9쪽, 업로드 없이',
      description:
        'PDF 여러 쪽을 종이 한 장에 2쪽·4쪽·6쪽·9쪽씩 모아 새 PDF를 만듭니다. 강의 자료를 아껴 인쇄할 때 좋습니다. 파일은 서버에 올라가지 않습니다.',
    },
    en: {
      name: 'N-up PDF',
      title: 'N-up PDF - 2, 4, 6 or 9 pages per sheet in your browser',
      description:
        'Put 2, 4, 6 or 9 PDF pages on each sheet and save it as a new PDF, handy for printing slides and handouts on less paper. Your file is never uploaded.',
    },
  },
  related: ['pdf/organize', 'pdf/merge'],
  flow: { from: { kind: 'pdf', count: 3 }, to: { kind: 'pdf', mark: 'grid' } },
});
