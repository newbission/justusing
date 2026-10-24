import { defineTool } from '../../types';

export default defineTool({
  status: 'live',
  section: 'optimize',
  icon: [
    'M5 3h14v11H5z',
    'M10.5 6.5v4l3.5-2z',
    'M2 19.5h6',
    'M6 17.5l2 2-2 2',
    'M22 19.5h-6',
    'M18 17.5l-2 2 2 2',
  ],
  text: {
    ko: {
      name: '동영상 용량 줄이기',
      summary: '해상도·화질을 낮춰 동영상 용량을 줄입니다',
      title: '동영상 용량 줄이기 - MP4 압축, 해상도·목표 용량 지정, 업로드 없이',
      description:
        '동영상의 해상도(1080p·720p·480p)와 화질을 낮추거나 목표 용량을 정해 H.264 MP4로 다시 저장합니다. 소리는 그대로 옮깁니다. 메일·메신저 용량 제한에 맞출 때, 동영상은 서버에 올라가지 않습니다.',
    },
    en: {
      name: 'Compress Video',
      summary: 'Make videos smaller by resolution or quality',
      title: 'Compress video - Reduce MP4 size by resolution or target size, in your browser',
      description:
        'Make a video smaller by lowering its resolution (1080p, 720p, 480p) and quality, or by setting a target size, and save it as H.264 MP4. The sound is kept as it is. Great for email and chat app limits, and your video is never uploaded.',
    },
  },
  related: ['video/trim'],
  flow: { from: { kind: 'mp4', mark: 'video' }, to: { kind: 'mp4', mark: 'video', small: true } },
});
