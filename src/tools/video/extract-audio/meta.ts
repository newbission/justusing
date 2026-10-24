import { defineTool } from '../../types';

export default defineTool({
  status: 'live',
  section: 'convert',
  icon: [
    'M3 3h12v9H3z',
    'M8 5.5v4l3-2z',
    'M16 19.5a2.5 2.5 0 1 0-5 0a2.5 2.5 0 1 0 5 0',
    'M16 19.5V10l5-1.5',
  ],
  text: {
    ko: {
      name: '동영상 소리 추출',
      summary: '동영상의 소리만 M4A·WAV 파일로 뽑습니다',
      title: '동영상 소리 추출 - MP4에서 음성만 M4A·WAV로, 음질 그대로, 업로드 없이',
      description:
        '동영상에서 소리만 꺼내 M4A·MP3 등 원래 형식 그대로(다시 인코딩 없이 음질 그대로) 또는 WAV·M4A로 저장합니다. 강의·회의 녹화의 음성만 들을 때, 동영상은 서버에 올라가지 않습니다.',
    },
    en: {
      name: 'Extract Audio from Video',
      summary: 'Save the sound of a video as M4A or WAV',
      title: 'Extract audio from video - Save MP4 sound as M4A or WAV without uploading',
      description:
        'Take the sound out of a video and save it in its original format such as M4A or MP3 (no re-encoding, same quality), or as WAV or M4A. Handy for listening to lectures and meetings, and your video is never uploaded.',
    },
  },
  related: ['video/trim', 'video/compress'],
  flow: { from: { kind: 'mp4', mark: 'video' }, to: { kind: 'm4a', mark: 'audio' } },
});
