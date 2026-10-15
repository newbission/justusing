import { defineTool } from '../../types';

export default defineTool({
  status: 'soon',
  section: 'view',
  icon: ['M4 20h4L19 9l-4-4L4 16v4Z', 'M13.5 6.5l4 4'],
  text: {
    ko: {
      name: 'PDF 편집',
      title: 'PDF 편집 - 텍스트·이미지·서명 추가',
      description: 'PDF에 텍스트, 이미지, 서명을 추가합니다. 파일은 기기를 떠나지 않습니다.',
    },
    en: {
      name: 'Edit PDF',
      title: 'Edit PDF - Add text, images and signatures',
      description: 'Add text, images and signatures to a PDF. Your file never leaves your device.',
    },
  },
  related: ['pdf/view', 'pdf/merge'],
});
