import { defineTool } from '../../types';

export default defineTool({
  status: 'live',
  section: 'convert',
  icon: [
    'M3 5h12v14H3z',
    'M7.5 9v6l5-3z',
    'M18 8.5a3.5 3.5 0 0 1 0 7',
    'M19.5 13.5L18 15.5l1.8 1.5',
  ],
  text: {
    ko: {
      name: '동영상을 GIF로',
      summary: '동영상 구간을 GIF·움직이는 WebP로 만듭니다',
      title: '동영상 GIF 변환 - 움짤 만들기, 구간·크기·장면 수 고르기, 업로드 없이',
      description:
        '동영상의 원하는 구간을 GIF나 움직이는 WebP로 만듭니다. 폭·초당 장면 수·색 수·반복을 고르고 만들기 전에 용량을 어림해 보여 줍니다. 동영상은 서버에 올라가지 않습니다.',
    },
    en: {
      name: 'Video to GIF',
      summary: 'Turn a video clip into a GIF or animated WebP',
      title: 'Video to GIF converter - Make GIFs from video clips in your browser',
      description:
        'Turn any part of a video into a GIF or animated WebP. Choose the width, frame rate, colors and looping, and see the estimated file size before you make it. Your video is never uploaded.',
    },
  },
  related: ['video/frame-capture', 'image/compress'],
  flow: { from: { kind: 'mp4' }, to: { kind: 'gif' } },
});
