import { siteConfig } from '../../../site.config';
import { defineContent } from '../../types';

/** mediabunny 허가서·안내 (scripts/copy-mediabunny-notice.mjs가 만든다) */
const NOTICE = `${siteConfig.domain}/vendor/mediabunny/README.txt`;

export default defineContent({
  ko: {
    uses: [
      {
        title: '긴 영상에서 필요한 장면만',
        text: '회의·강의 녹화나 휴대폰으로 찍은 긴 영상에서 꼭 필요한 몇 분만 남겨 보냅니다. 앞의 준비 시간과 뒤의 정리 시간을 잘라 내면 받는 사람도 바로 본론을 봅니다.',
      },
      {
        title: '메신저·SNS 길이 제한에 맞추기',
        text: '올릴 곳의 길이 제한(예: 1분, 3분)에 맞춰 시작과 끝을 고릅니다. 빠르게 자르면 다시 인코딩하지 않아 화질이 그대로이고 몇 초면 끝납니다.',
      },
      {
        title: '화면 녹화의 앞뒤 정리',
        text: '화면 녹화를 시작하고 멈추느라 찍힌 앞뒤 몇 초를 지웁니다. 고른 장면에서 정확히 시작해야 하면 정확하게 자르기를 고르세요.',
      },
    ],
    howTo: [
      '"동영상 파일 선택" 버튼을 누르거나 동영상을 화면으로 끌어다 놓습니다.',
      '미리보기를 보며 막대의 양쪽 손잡이를 끌어 남길 구간을 고릅니다. 재생하다가 "지금 위치를 시작으로"·"지금 위치를 끝으로"를 누르거나 시간을 숫자로 적어도 됩니다.',
      '"고른 구간 재생"으로 확인하고, 자르는 방법(빠르게·정확하게)을 고릅니다.',
      '"자르기"를 누르고, 끝나면 "받기"를 누릅니다.',
    ],
    faq: [
      {
        q: '빠르게와 정확하게는 무엇이 다른가요?',
        a: '동영상은 몇 초마다 들어 있는 키프레임(통째로 저장된 장면)부터만 풀 수 있습니다. 빠르게는 다시 인코딩하지 않고 시작 앞의 가장 가까운 키프레임부터 담은 뒤, 고른 시점부터 재생되게 파일에 표시합니다(MP4·MOV의 편집 목록). 화질이 그대로이고 몇 초면 끝나며, 대부분의 플레이어는 고른 시점부터 보여 줍니다. 정확하게는 화면을 다시 인코딩해 고른 장면이 첫 장면이 되므로 어느 프로그램에서나 같게 보이지만, 동영상 길이만큼 시간이 걸립니다.',
      },
      {
        q: '빠르게 자른 동영상이 편집 프로그램에서 조금 앞에서 시작해요.',
        a: '편집 목록을 읽지 않는 프로그램은 앞의 키프레임부터(보통 몇 초 안) 보여 줍니다. WebM·MKV는 편집 목록 대신 음수 시각으로 적어 프로그램마다 다르게 보일 수 있습니다. 이럴 때는 정확하게 자르기를 쓰세요.',
      },
      {
        q: '"빠르게 자를 수 없습니다"라고 나와요.',
        a: '빠르게 자르기는 시작 앞 10초 안에 키프레임이 있어야 합니다. 화면 녹화처럼 키프레임이 아주 드문 동영상은 그보다 멀어서, 그대로 옮기면 숨긴 앞부분이 길게 남거나(MP4·MOV) 풀 수 없는 파일이 됩니다(WebM·MKV는 32초 넘게 앞선 장면을 담지 못함). 이럴 때는 정확하게 자르기를 고르세요.',
      },
      {
        q: '어떤 브라우저에서 되나요?',
        a: '빠르게 자르기는 파일 안의 데이터를 옮기기만 해서 대부분의 최신 브라우저에서 됩니다. 정확하게 자르기는 브라우저에 든 WebCodecs로 다시 인코딩하므로 크롬·엣지(94 이상), Safari(16.4 이상), 파이어폭스(130 이상, 컴퓨터)가 필요하고, 브라우저가 그 코덱을 풀고 저장할 수 있어야 합니다. 안 되면 화면에 미리 알리고 빠르게만 고를 수 있게 합니다. Safari는 MKV 미리보기를 재생하지 못하지만 자르기는 됩니다.',
      },
      {
        q: '어떤 파일을 열 수 있나요?',
        a: 'MP4·MOV(아이폰 영상 포함)·WebM·MKV입니다. 결과는 원래와 같은 형식으로 저장합니다. 정확하게 자르면 화면을 MP4·MOV·MKV는 H.264, WebM은 VP9으로 다시 저장합니다. AVI·WMV 같은 예전 형식은 열지 못합니다.',
      },
      {
        q: '아주 큰 동영상도 되나요?',
        a: '파일을 통째로 읽지 않고 필요한 부분만 잘라 읽으므로 수 GB 동영상도 열 수 있습니다. 결과는 브라우저 메모리에 모았다가 받으므로 결과가 아주 크면(휴대폰에서 수 GB) 기기 메모리가 모자랄 수 있습니다. 그럴 때는 여러 번에 나눠 자르세요.',
      },
      {
        q: '무엇을 내려받나요?',
        a: `동영상을 처음 열 때 동영상 파일을 읽고 쓰는 프로그램(mediabunny, 압축 전송 약 120KB)을 이 사이트에서 받습니다. 풀기·다시 저장하기는 브라우저에 든 기능(WebCodecs)이 하고, 동영상은 어디로도 올라가지 않습니다. mediabunny는 Mozilla Public License 2.0 오픈소스이며, 허가서와 소스 안내는 ${NOTICE}에 있습니다.`,
      },
      {
        q: '동영상이 서버로 올라가나요?',
        a: '아니요. 동영상을 열고 미리 보고 자르는 모든 과정이 이 브라우저 안에서 이루어집니다. 가족 영상이나 회사 녹화도 안심하고 쓸 수 있습니다.',
      },
    ],
  },
  en: {
    uses: [
      {
        title: 'Keep only the scenes you need',
        text: 'Keep just the few minutes that matter from a long meeting, lecture or phone recording before you send it. Cutting the setup at the start and the wrap-up at the end lets people get straight to the point.',
      },
      {
        title: 'Fit a length limit on chat apps and social media',
        text: 'Pick the start and end to fit the length limit of where you post, such as one or three minutes. Fast trimming does not re-encode, so the quality stays the same and it takes seconds.',
      },
      {
        title: 'Tidy up a screen recording',
        text: 'Remove the seconds at the start and end that were recorded while you started and stopped the recording. If it must start exactly at the frame you chose, pick precise trimming.',
      },
    ],
    howTo: [
      'Click "Choose a video file" or drag a video onto the page.',
      'Watch the preview and drag the handles on both sides of the bar to pick the part to keep. You can also click "Set start here" or "Set end here" while playing, or type the times.',
      'Check it with "Play selection" and choose how to trim (fast or precise).',
      'Click "Trim", and when it is done, click "Download".',
    ],
    faq: [
      {
        q: 'What is the difference between fast and precise?',
        a: 'Video can only be decoded from key frames (frames stored whole), which come every few seconds. Fast trimming does not re-encode: it keeps the data from the nearest key frame before your start and marks the file to play from your start (an edit list in MP4 and MOV). The quality stays the same, it takes seconds, and most players start exactly at your start. Precise trimming re-encodes the picture so the frame you chose becomes the first frame, which looks the same in every program but takes about as long as the video.',
      },
      {
        q: 'My fast-trimmed video starts a little early in an editing program.',
        a: 'Programs that ignore edit lists show the video from the earlier key frame (usually within a few seconds). WebM and MKV use negative timestamps instead of an edit list, which programs handle differently. In that case, use precise trimming.',
      },
      {
        q: 'It says the video cannot be trimmed fast.',
        a: 'Fast trimming needs a key frame within 10 seconds before your start. Videos with very rare key frames, such as screen recordings, have them farther apart; moving the data as is would either leave a long hidden part in the file (MP4, MOV) or make a file that cannot be played (WebM and MKV cannot hold frames more than 32 seconds before the start). In that case, choose precise trimming.',
      },
      {
        q: 'Which browsers does it work in?',
        a: 'Fast trimming only moves data inside the file, so it works in most modern browsers. Precise trimming re-encodes with the WebCodecs built into the browser, so it needs Chrome or Edge 94+, Safari 16.4+ or Firefox 130+ on desktop, and the browser must be able to decode and save that codec. If it cannot, the page tells you beforehand and lets you choose fast trimming only. Safari cannot play an MKV preview, but trimming still works.',
      },
      {
        q: 'Which files can I open?',
        a: 'MP4, MOV (including iPhone videos), WebM and MKV. The result is saved in the same format. Precise trimming saves the picture as H.264 in MP4, MOV and MKV and as VP9 in WebM. Older formats such as AVI and WMV cannot be opened.',
      },
      {
        q: 'Does it work with very large videos?',
        a: 'The file is not read all at once, only the parts that are needed, so even videos of several GB can be opened. The result is collected in the browser before you download it, so a very large result (several GB on a phone) may run out of memory. In that case, trim it in several parts.',
      },
      {
        q: 'What gets downloaded?',
        a: `When you first open a video, the page loads a program that reads and writes video files (mediabunny, about 120 KB compressed) from this site. Decoding and saving are done by the WebCodecs built into your browser, and your video is never uploaded. mediabunny is open source under the Mozilla Public License 2.0; the license text and source information are at ${NOTICE}.`,
      },
      {
        q: 'Is my video uploaded?',
        a: 'No. Opening, previewing and trimming all happen in this browser, so you can safely use family videos and work recordings.',
      },
    ],
  },
});
