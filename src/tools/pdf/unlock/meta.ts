import { defineTool } from '../../types';

export default defineTool({
  status: 'live',
  section: 'security',
  icon: ['M6 11h12v9H6z', 'M8.5 11V8a3.5 3.5 0 0 1 6.8-1.2'],
  text: {
    ko: {
      name: 'PDF 암호 해제',
      summary: '아는 암호를 풀고 인쇄·복사 제한을 없앱니다',
      title: 'PDF 암호 해제 - 암호·인쇄 제한 풀기, 업로드 없이',
      description:
        '암호를 아는 PDF의 암호와 인쇄·복사 제한을 풀어 암호 없는 PDF로 저장합니다. 모든 처리는 브라우저 안에서 이루어집니다.',
    },
    en: {
      name: 'Unlock PDF',
      summary: 'Remove a known password and print limits',
      title: 'Unlock PDF - Remove a PDF password and restrictions in your browser',
      description:
        'Remove the password and printing or copying restrictions from a PDF whose password you know. Everything happens inside your browser.',
    },
  },
  related: ['pdf/protect', 'pdf/merge'],
  flow: { from: { kind: 'pdf', mark: 'lock' }, to: { kind: 'pdf', mark: 'unlock' } },
});
