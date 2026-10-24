import { defineContent } from '../../types';

export default defineContent({
  ko: {
    uses: [
      {
        title: '영상 속 한 장면을 사진으로',
        text: '아이 영상·여행 영상에서 표정이 좋은 순간을 사진으로 남깁니다. 화면 캡처와 달리 재생 막대·자막 버튼 없이 동영상의 원래 크기 그대로 저장합니다.',
      },
      {
        title: '썸네일·블로그 글에 넣을 장면',
        text: '직접 찍은 영상에서 썸네일이나 글에 넣을 장면을 고릅니다. 1/30초 버튼으로 흔들림이 적은 장면을 한 장면씩 찾아 맞출 수 있습니다.',
      },
      {
        title: '강의·회의 녹화를 장면 모음으로',
        text: '화면이 넘어가는 강의·발표 녹화에서 5초나 10초마다 장면을 뽑아 ZIP으로 받습니다. 넘겨 보며 필요한 슬라이드만 고르거나 PDF로 묶을 수 있습니다.',
      },
    ],
    howTo: [
      '"동영상 파일 선택" 버튼을 누르거나 동영상을 화면으로 끌어다 놓습니다.',
      '재생하다 멈추거나 막대를 끌어 장면을 찾고, "1/30초 뒤로"·"1/30초 앞으로"로 한 장면씩 맞춥니다.',
      '저장 형식(JPG·PNG)을 고르고 "이 장면 받기"를 누릅니다.',
      '여러 장이 필요하면 받는 방식에서 "일정 간격으로 여러 장"을 고르고 간격과 구간을 정한 뒤 "ZIP으로 받기"를 누릅니다.',
    ],
    faq: [
      {
        q: '저장한 사진은 얼마나 선명한가요?',
        a: '동영상의 원래 크기(예: 1920 × 1080) 그대로 저장합니다. 다만 동영상은 장면 사이를 많이 압축하고 움직이는 장면은 흔들려 찍히므로, 같은 크기의 사진보다 덜 선명합니다. 움직임이 멈춘 순간을 고르면 가장 선명합니다.',
      },
      {
        q: '원하는 장면에 정확히 맞출 수 있나요?',
        a: '"1/30초 뒤로"·"1/30초 앞으로"로 옮기거나 위치를 0.01초 단위로 적을 수 있습니다. 초당 30장 동영상이면 한 번에 한 장면씩 옮겨 갑니다. 초당 60장 동영상은 두 장면씩 건너뛰므로 위치를 숫자로 적어 맞추세요.',
      },
      {
        q: '어떤 동영상을 열 수 있나요?',
        a: '이 브라우저가 재생하는 동영상이면 됩니다. MP4(H.264)와 WebM은 대부분의 브라우저에서 열리고, 아이폰으로 찍은 HEVC(MOV) 영상은 Safari나 HEVC를 지원하는 기기의 브라우저에서 열립니다.',
      },
      {
        q: '여러 장은 몇 장까지 뽑을 수 있나요?',
        a: '한 번에 200장까지입니다. 뽑은 장면을 모두 메모리에 모아 ZIP 하나로 묶기 때문입니다. 긴 영상은 간격을 늘리거나 구간을 나눠 여러 번 받으세요.',
      },
      {
        q: 'JPG와 PNG 중 무엇을 고를까요?',
        a: '보통은 JPG가 알맞습니다. 용량이 작고 어디서나 열립니다. 글자가 많은 화면 녹화나 다시 편집할 장면은 손실 없는 PNG가 깔끔하지만 용량이 몇 배 큽니다.',
      },
    ],
  },
  en: {
    uses: [
      {
        title: 'Turn a moment into a photo',
        text: 'Keep the best smile from a family or travel video as a photo. Unlike a screenshot, it is saved at the video’s original size without the play bar or caption buttons.',
      },
      {
        title: 'A frame for a thumbnail or blog post',
        text: 'Pick a frame from your own footage for a thumbnail or article. Use the 1/30 s buttons to step frame by frame to a sharp moment.',
      },
      {
        title: 'Slides from a lecture or meeting recording',
        text: 'Grab a frame every 5 or 10 seconds from a lecture or presentation recording and download them as a ZIP. Flip through them to keep only the slides you need, or combine them into a PDF.',
      },
    ],
    howTo: [
      'Click "Choose a video file" or drag a video onto the page.',
      'Play and pause or drag the bar to find a frame, then fine-tune it with "Back 1/30 s" and "Forward 1/30 s".',
      'Choose a format (JPG or PNG) and click "Download this frame".',
      'For many frames, choose "Frames at an interval" under What to save, set the interval and range, then click "Download as ZIP".',
    ],
    faq: [
      {
        q: 'How sharp are the saved images?',
        a: 'They are saved at the video’s original size (for example 1920 × 1080). Videos are heavily compressed and moving scenes are blurred, though, so frames are less sharp than photos of the same size. Pick a moment when the motion stops for the sharpest result.',
      },
      {
        q: 'Can I pick an exact frame?',
        a: 'Use "Back 1/30 s" and "Forward 1/30 s", or type the position in hundredths of a second. In a 30 fps video each step moves one frame. A 60 fps video skips two frames per step, so type the position to fine-tune it.',
      },
      {
        q: 'Which videos can I open?',
        a: 'Any video your browser can play. MP4 (H.264) and WebM open in most browsers. HEVC (MOV) videos from iPhones open in Safari or in browsers on devices that support HEVC.',
      },
      {
        q: 'How many frames can I grab at once?',
        a: 'Up to 200 at a time, because all the frames are kept in memory and packed into one ZIP. For long videos, use a longer interval or split the range and download several times.',
      },
      {
        q: 'Should I choose JPG or PNG?',
        a: 'JPG suits most cases: small files that open anywhere. PNG is lossless and cleaner for screen recordings with lots of text or frames you will edit further, but the files are several times larger.',
      },
    ],
  },
});
