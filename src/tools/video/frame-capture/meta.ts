import { defineTool } from '../../types';

export default defineTool({
  status: 'live',
  section: 'convert',
  icon: ['M4 4h16v16H4z', 'M4 8h16', 'M4 16h16', 'M8 4v4', 'M16 16v4', 'M9.5 10.5v3l2.5-1.5z'],
  text: {
    ko: {
      name: '동영상 장면 캡처',
      summary: '동영상 장면을 JPG·PNG 사진으로 저장합니다',
      title: '동영상 장면 캡처 - 원하는 장면을 사진으로, 1초마다 여러 장, 업로드 없이',
      description:
        '동영상을 재생하며 원하는 장면을 원래 화질의 JPG·PNG로 저장하거나, 1초마다처럼 일정 간격으로 여러 장을 뽑아 ZIP으로 받습니다. 동영상은 서버에 올라가지 않습니다.',
    },
    en: {
      name: 'Video Frame Capture',
      summary: 'Save video frames as JPG or PNG images',
      title: 'Video frame capture - Save stills from a video in your browser',
      description:
        'Play a video and save the frame you want as a full-resolution JPG or PNG, or grab frames at a fixed interval such as every second and download them as a ZIP. Your video is never uploaded.',
    },
  },
  related: ['video/to-gif', 'image/crop'],
  flow: { from: { kind: 'mp4' }, to: { kind: 'jpg', count: 3 } },
});
