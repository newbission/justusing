import { defineTool } from '../../types';

export default defineTool({
  status: 'live',
  section: 'optimize',
  icon: ['M7 3h7l4 4v14H7z', 'M12.5 9.5v5', 'M10 12.5l2.5 2.5 2.5-2.5', 'M10 18h5'],
  text: {
    ko: {
      name: 'PDF 압축',
      summary: '안의 사진을 다시 저장해 용량을 줄입니다',
      title: 'PDF 압축 - PDF 용량 줄이기, 업로드 없이 브라우저에서',
      description:
        'PDF 안의 사진을 다시 저장해 파일 용량을 줄입니다. 글자는 그대로 두고, 줄이는 정도를 고를 수 있습니다. 모든 처리는 브라우저 안에서 이루어집니다.',
    },
    en: {
      name: 'Compress PDF',
      summary: 'Shrink a PDF by re-saving its photos',
      title: 'Compress PDF - Reduce PDF file size in your browser',
      description:
        'Make a PDF smaller by re-saving the photos inside it. Text stays as it is, and you choose how much to shrink. Everything happens inside your browser.',
    },
  },
  related: ['pdf/from-image', 'pdf/split'],
  flow: { from: { kind: 'pdf', mark: 'image' }, to: { kind: 'pdf', mark: 'image', small: true } },
});
