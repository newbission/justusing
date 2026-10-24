import { defineContent } from '../../types';

export default defineContent({
  ko: {
    uses: [
      {
        title: '메일·메신저 용량 제한에 맞추기',
        text: '첨부 용량 제한(예: 25MB)이나 메신저의 동영상 크기 제한에 걸릴 때 목표 용량을 적어 그 안으로 줄입니다. 해상도를 720p로 낮추면 대부분 한 번에 들어갑니다.',
      },
      {
        title: '휴대폰 4K 영상을 가볍게',
        text: '최근 휴대폰은 1초에 수 MB씩 4K로 찍어 몇 분짜리 영상도 GB가 됩니다. 휴대폰·노트북 화면으로 볼 영상은 1080p나 720p로 줄여도 차이가 거의 보이지 않고 용량은 몇 분의 일이 됩니다.',
      },
      {
        title: '과제·업무 제출 파일 줄이기',
        text: '발표 녹화나 과제 영상을 제출 시스템의 용량 제한에 맞춥니다. 화면 녹화처럼 움직임이 적은 영상은 화질을 낮음으로 해도 글자가 잘 읽히는지 미리보기로 확인하세요.',
      },
    ],
    howTo: [
      '"동영상 파일 선택" 버튼을 누르거나 동영상을 화면으로 끌어다 놓습니다.',
      '해상도(원래 크기·1080p·720p·480p)를 고르고, 화질(높음·보통·낮음)을 고르거나 목표 용량을 MB로 적습니다. 막대에 예상 용량이 보입니다.',
      '"줄이기"를 누르고 기다립니다. 동영상 길이만큼 걸릴 수 있고, 그만두려면 "그만두기"를 누릅니다.',
      '줄어든 용량을 확인하고 "받기"를 누릅니다.',
    ],
    faq: [
      {
        q: '어떻게 용량이 줄어드나요?',
        a: '동영상 용량은 대부분 1초에 쓰는 데이터 양(비트레이트)으로 정해집니다. 이 도구는 화면을 브라우저의 동영상 인코더(WebCodecs)로 다시 저장하면서 해상도를 낮추고 비트레이트를 줄입니다. 해상도를 절반으로 줄이면 화소 수가 4분의 1이 되어 같은 화질에 필요한 데이터도 크게 줍니다.',
      },
      {
        q: '목표 용량에 정확히 맞나요?',
        a: '용량을 길이로 나눠 비트레이트를 정하므로 대체로 가깝지만, 인코더가 장면에 따라 데이터를 더 쓰거나 덜 써서 조금 넘거나 모자랄 수 있습니다. 제한이 있다면 10% 정도 작게 적으세요. 결과가 원본보다 작아지지 않으면 받지 않게 알립니다.',
      },
      {
        q: '어떤 형식으로 저장되나요?',
        a: '화면은 H.264, 그릇은 MP4로 저장해 휴대폰·컴퓨터·메신저 어디서나 열립니다. 이 브라우저가 H.264로 저장하지 못하면 VP9·WebM으로 저장하고 미리 알립니다. 소리는 되도록 다시 인코딩하지 않고 그대로 옮깁니다.',
      },
      {
        q: '어떤 브라우저에서 되나요?',
        a: '다시 저장하려면 브라우저에 든 WebCodecs가 필요합니다. 크롬·엣지(94 이상)와 Safari(16.4 이상), 파이어폭스(130 이상, 컴퓨터)에서 됩니다. 기기가 그 크기를 저장하지 못하면(예: 일부 휴대폰의 4K) 그 해상도를 고를 수 없게 표시합니다. 휴대폰보다 컴퓨터가 훨씬 빠릅니다.',
      },
      {
        q: '시간은 얼마나 걸리나요?',
        a: '모든 장면을 풀고 다시 저장하므로 기기 성능에 따라 동영상 길이의 몇 분의 일에서 몇 배까지 걸립니다. 진행률과 남은 시간을 보여 주며, 해상도를 낮출수록 빨라집니다. 다른 탭에 가 있어도 계속되지만 기기가 잠들면 멈출 수 있습니다.',
      },
      {
        q: '동영상이 서버로 올라가나요?',
        a: '아니요. 동영상을 읽고 다시 저장하는 모든 과정이 이 브라우저 안에서 이루어집니다. 그래서 큰 동영상도 올리는 시간 없이 바로 시작합니다.',
      },
    ],
  },
  en: {
    uses: [
      {
        title: 'Fit email and chat app limits',
        text: 'When an attachment limit (such as 25 MB) or a chat app video limit gets in the way, enter a target size and shrink the video to fit. Lowering the resolution to 720p usually does it in one go.',
      },
      {
        title: 'Lighten 4K phone videos',
        text: 'Recent phones record 4K at several MB per second, so a few minutes can reach gigabytes. For viewing on phones and laptops, 1080p or 720p looks almost the same and takes a fraction of the space.',
      },
      {
        title: 'Shrink files for school or work',
        text: 'Fit a presentation recording or assignment video under a submission limit. For screen recordings with little motion, check in the preview that text is still readable even at low quality.',
      },
    ],
    howTo: [
      'Click "Choose a video file" or drag a video onto the page.',
      'Choose a resolution (original, 1080p, 720p or 480p), then choose a quality (high, medium or low) or enter a target size in MB. The bar shows the expected size.',
      'Click "Compress" and wait. It can take about as long as the video, and you can click "Stop" to cancel.',
      'Check how much smaller it got and click "Download".',
    ],
    faq: [
      {
        q: 'How does it make videos smaller?',
        a: 'Video size is mostly set by how much data is used per second (the bitrate). This tool saves the picture again with the video encoder built into your browser (WebCodecs), lowering the resolution and bitrate. Halving the resolution leaves a quarter of the pixels, so far less data is needed for the same quality.',
      },
      {
        q: 'Will it match the target size exactly?',
        a: 'The bitrate is set by dividing the size by the length, so it usually comes close, but the encoder uses more or less data depending on the scene, so it may land a little above or below. If you have a hard limit, aim about 10% lower. If the result is not smaller than the original, you are told instead of getting the file.',
      },
      {
        q: 'What format is it saved in?',
        a: 'The picture is saved as H.264 in an MP4 file, which opens on phones, computers and chat apps. If this browser cannot save H.264, it saves VP9 in WebM and tells you beforehand. The sound is moved over without re-encoding whenever possible.',
      },
      {
        q: 'Which browsers does it work in?',
        a: 'Re-encoding needs the WebCodecs built into the browser. It works in Chrome and Edge 94+, Safari 16.4+ and Firefox 130+ on desktop. If the device cannot save a size (for example 4K on some phones), that resolution is marked and cannot be chosen. Computers are much faster than phones.',
      },
      {
        q: 'How long does it take?',
        a: 'Every frame is decoded and saved again, so it takes from a fraction of the video length to several times longer depending on the device. Progress and time left are shown, and lower resolutions are faster. It keeps going in another tab, but it may pause if the device goes to sleep.',
      },
      {
        q: 'Is my video uploaded?',
        a: 'No. Reading and saving the video both happen in this browser, so even large videos start right away with no upload time.',
      },
    ],
  },
});
