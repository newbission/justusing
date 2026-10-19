import { defineTool } from '../../types';

export default defineTool({
  status: 'live',
  section: 'security',
  icon: ['M6 11h12v9H6z', 'M8.5 11V8a3.5 3.5 0 0 1 7 0v3', 'M12 14.5v2'],
  text: {
    ko: {
      name: 'PDF 암호 걸기',
      title: 'PDF 암호 걸기 - 열 때 암호를 묻는 PDF로, 업로드 없이',
      description:
        'PDF에 열기 암호를 걸어 암호를 아는 사람만 열 수 있게 합니다. 파일과 암호는 브라우저 밖으로 나가지 않습니다.',
    },
    en: {
      name: 'Protect PDF',
      title: 'Protect PDF - Add a password to a PDF in your browser',
      description:
        'Add an open password so only people who know it can open the PDF. Your file and password never leave your browser.',
    },
  },
  related: ['pdf/unlock', 'pdf/merge'],
  flow: { from: { kind: 'pdf' }, to: { kind: 'pdf', mark: 'lock' } },
});
