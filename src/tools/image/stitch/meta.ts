import { defineTool } from '../../types';

export default defineTool({
  status: 'live',
  section: 'edit',
  icon: ['M6 3h12v7H6z', 'M6 14h12v7H6z', 'M3 12h18'],
  text: {
    ko: {
      name: '이미지 이어 붙이기',
      summary: '캡처 여러 장을 긴 이미지 하나로 잇습니다',
      title: '이미지 이어 붙이기 - 긴 화면 캡처 합치기, 업로드 없이 브라우저에서',
      description:
        '화면 캡처 여러 장을 한 장의 긴 이미지로 이어 붙입니다. 겹친 부분과 장마다 되풀이되는 위·아래 막대를 찾아 지우고, 세로·가로 잇기, 폭 맞추기, 나누어 저장, PDF로 받기를 할 수 있습니다. 사진은 서버에 올라가지 않습니다.',
    },
    en: {
      name: 'Stitch Images',
      summary: 'Join screenshots into one long image',
      title: 'Stitch images - Combine screenshots into one long image in your browser',
      description:
        'Join several screenshots or photos into one long image. Overlapping parts and repeated top and bottom bars are found and removed, and you can stitch vertically or side by side, match widths, split the result or save it as a PDF. Your images are never uploaded.',
    },
  },
  related: ['image/resize', 'pdf/from-image'],
  flow: { from: { kind: 'png', count: 3, mark: 'lines' }, to: { kind: 'png', mark: 'stitch' } },
});
