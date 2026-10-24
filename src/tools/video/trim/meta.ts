import { defineTool } from '../../types';

export default defineTool({
  status: 'live',
  section: 'edit',
  icon: ['M3 4h18v11H3z', 'M10 7.5v4l3.5-2z', 'M3 19.5h18', 'M7 17.5v4', 'M17 17.5v4'],
  text: {
    ko: {
      name: '동영상 자르기',
      summary: '앞뒤를 잘라 원하는 구간만 남깁니다',
      title: '동영상 자르기 - MP4 앞뒤 자르기, 화질 그대로 빠르게, 업로드 없이',
      description:
        '동영상의 앞뒤를 잘라 원하는 구간만 남깁니다. 다시 인코딩하지 않아 화질 그대로 몇 초 만에 자르거나, 고른 장면에서 정확히 자를 수 있습니다. MP4·MOV·WebM·MKV, 동영상은 서버에 올라가지 않습니다.',
    },
    en: {
      name: 'Trim Video',
      summary: 'Cut the start and end to keep one part',
      title: 'Trim video - Cut MP4 start and end fast without losing quality, in your browser',
      description:
        'Cut the start and end of a video to keep just the part you want. Trim in seconds without re-encoding and without losing quality, or cut precisely at the frame you choose. Works with MP4, MOV, WebM and MKV, and your video is never uploaded.',
    },
  },
  flow: { from: { kind: 'mp4', mark: 'video' }, to: { kind: 'mp4', mark: 'trim' } },
});
