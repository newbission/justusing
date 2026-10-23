import { defineTool } from '../../types';

export default defineTool({
  status: 'live',
  section: 'pages',
  icon: ['M4 4h6v6H4z', 'M14 4h6v6h-6z', 'M4 14h6v6H4z', 'M14 14h6v6h-6z'],
  text: {
    ko: {
      name: 'PDF 페이지 정리',
      summary: '쪽 순서를 바꾸고 필요 없는 쪽을 뺍니다',
      title: 'PDF 페이지 정리 - 순서 바꾸기·페이지 삭제, 무료·업로드 없이',
      description:
        'PDF 페이지 썸네일을 끌어 순서를 바꾸고 필요 없는 페이지를 지운 뒤 새 PDF로 저장합니다. ◀ ▶ 버튼으로도 옮길 수 있습니다. 파일은 서버로 전송되지 않습니다.',
    },
    en: {
      name: 'Organize PDF',
      summary: 'Reorder pages or delete unwanted ones',
      title: 'Organize PDF - Reorder and delete pages, free and without uploading',
      description:
        'Drag PDF page thumbnails to change their order, delete the pages you do not need and save a new PDF. The ◀ ▶ buttons move pages too. Your file is never sent to a server.',
    },
  },
  related: ['pdf/rotate', 'pdf/merge'],
  flow: { from: { kind: 'pdf', count: 3 }, to: { kind: 'pdf', count: 3, mark: 'order' } },
});
