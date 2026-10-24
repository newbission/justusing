import { defineContent } from '../../types';

export default defineContent({
  ko: {
    uses: [
      {
        title: '메신저·게시판에 올릴 움짤',
        text: '웃긴 장면이나 반응 짤처럼 몇 초짜리 장면만 잘라 GIF로 만듭니다. 소리 없이 저절로 반복되어 동영상을 올릴 수 없는 게시판·댓글에도 붙일 수 있습니다.',
      },
      {
        title: '사용법·버그를 보여 주는 화면 녹화',
        text: '앱을 쓰는 순서나 오류가 나는 모습을 녹화한 영상을 문서·이슈·메일에 바로 보이는 GIF로 바꿉니다. 배경이 멈춰 있는 화면은 바뀐 곳만 담아 용량이 작습니다.',
      },
      {
        title: '상품·작업 과정을 짧게 반복',
        text: '상품을 돌려 보는 모습, 요리·공예 과정의 한 동작을 짧게 반복하는 그림으로 만들어 상세 페이지나 블로그에 넣습니다. 움직이는 WebP를 고르면 같은 화질에 훨씬 작습니다.',
      },
    ],
    howTo: [
      '"동영상 파일 선택" 버튼을 누르거나 동영상을 화면으로 끌어다 놓습니다.',
      '동영상을 재생하다 원하는 곳에서 멈추고 "지금 위치를 시작으로"·"지금 위치를 끝으로"로 구간을 정합니다. 초를 숫자로 적어도 됩니다.',
      '형식·폭·초당 장면 수·색 수·반복을 고릅니다. 막대에 결과 크기와 예상 용량이 보입니다.',
      '"GIF 만들기"를 눌러 결과를 미리 보고, 마음에 들면 "GIF 받기"를 누릅니다.',
    ],
    faq: [
      {
        q: 'GIF는 왜 동영상보다 용량이 클까요?',
        a: 'GIF는 1987년에 나온 형식이라 장면마다 그림을 통째로(바뀐 곳만이라도) 담고, 동영상처럼 움직임을 예측해 줄이지 못합니다. 그래서 같은 길이의 MP4보다 몇 배에서 수십 배 큽니다. 폭을 줄이는 것이 가장 효과가 크고, 초당 장면 수와 구간 길이를 줄여도 그만큼 작아집니다. 움직이는 WebP를 고르면 GIF보다 훨씬 작습니다.',
      },
      {
        q: '예상 용량은 얼마나 맞나요?',
        a: '구간에서 장면 몇 개를 골라 실제로 저장해 보고 전체 장면 수만큼 늘려 어림합니다. 장면마다 움직임이 다르면 실제 결과와 차이가 날 수 있습니다. "GIF 만들기"를 누르면 실제 용량이 막대에 보이고, 받기 전에 결과를 미리 볼 수 있습니다.',
      },
      {
        q: '소리도 들어가나요?',
        a: '아니요. GIF와 움직이는 WebP는 소리를 담지 못합니다. 소리가 필요하면 동영상 그대로 올리세요.',
      },
      {
        q: '어떤 동영상을 열 수 있나요?',
        a: '이 브라우저가 재생하는 동영상이면 됩니다. MP4(H.264)와 WebM은 대부분의 브라우저에서 열리고, 아이폰으로 찍은 HEVC(MOV) 영상은 Safari나 HEVC를 지원하는 기기의 브라우저에서 열립니다. 열리지 않으면 다른 브라우저에서 해 보세요.',
      },
      {
        q: '왜 구간이 30초까지인가요?',
        a: 'GIF는 길이에 비례해 커져서 30초만 넘어도 수십 MB가 되기 쉽고, 대부분의 메신저·게시판에 올라가지 않습니다. 긴 장면은 여러 개로 나눠 만들거나 동영상 그대로 쓰는 편이 낫습니다.',
      },
      {
        q: '색 수와 디더링은 무엇인가요?',
        a: 'GIF는 한 파일에 256가지 색까지만 씁니다. 이 도구는 구간 곳곳의 장면을 보고 가장 잘 맞는 색들을 고릅니다. 색을 줄이면 작아지지만 하늘처럼 부드럽게 바뀌는 곳이 계단처럼 보이고, 디더링을 켜면 점 무늬로 그 사이를 메워 부드럽게 보입니다(용량은 조금 늘어남).',
      },
    ],
  },
  en: {
    uses: [
      {
        title: 'Reaction GIFs for chats and forums',
        text: 'Cut a few seconds from a funny scene or reaction and make a GIF. It loops silently on its own, so you can post it in forums and comments that do not accept videos.',
      },
      {
        title: 'Screen recordings of steps or bugs',
        text: 'Turn a recording of how to use an app, or of a bug happening, into a GIF that plays right inside documents, issues and emails. Screens with a still background stay small because only the changed parts are stored.',
      },
      {
        title: 'Short loops of products or steps',
        text: 'Make a short loop of a product turning around or one step of a recipe or craft for a product page or blog. Choose animated WebP for a much smaller file at the same quality.',
      },
    ],
    howTo: [
      'Click "Choose a video file" or drag a video onto the page.',
      'Play the video, pause where you want, and set the clip with "Set start here" and "Set end here". You can also type the seconds.',
      'Choose the format, width, frame rate, colors and looping. The bar shows the result size and the estimated file size.',
      'Click "Make GIF" to preview the result, then click "Download GIF" if you like it.',
    ],
    faq: [
      {
        q: 'Why is a GIF so much larger than the video?',
        a: 'GIF dates from 1987. It stores each frame as a picture (even if only the changed parts) and cannot predict motion the way video formats do, so it is several to dozens of times larger than an MP4 of the same length. Reducing the width helps the most; fewer frames per second and a shorter clip also shrink it. Animated WebP is much smaller than GIF.',
      },
      {
        q: 'How accurate is the estimated size?',
        a: 'The tool actually saves a few frames from the clip and scales that up to the full number of frames. If the amount of motion changes a lot during the clip, the real size can differ. After you click "Make GIF", the bar shows the real size and you can preview the result before downloading.',
      },
      {
        q: 'Is the sound kept?',
        a: 'No. GIF and animated WebP cannot contain sound. If you need sound, share the video itself.',
      },
      {
        q: 'Which videos can I open?',
        a: 'Any video your browser can play. MP4 (H.264) and WebM open in most browsers. HEVC (MOV) videos from iPhones open in Safari or in browsers on devices that support HEVC. If a video does not open, try another browser.',
      },
      {
        q: 'Why is the clip limited to 30 seconds?',
        a: 'GIFs grow with their length and easily reach dozens of megabytes past 30 seconds, which most messengers and forums do not accept. For longer scenes, make several GIFs or share the video itself.',
      },
      {
        q: 'What are colors and dithering?',
        a: 'A GIF can use only 256 colors. This tool looks at frames across the clip and picks the colors that fit best. Fewer colors make a smaller file, but smooth areas such as the sky show steps. Dithering fills the steps with a dot pattern so they look smooth (the file grows a little).',
      },
    ],
  },
});
