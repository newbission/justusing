import { defineContent } from '../../types';

export default defineContent({
  ko: {
    uses: [
      {
        title: '강의·회의 녹화를 음성으로 듣기',
        text: '화면이 필요 없는 강의나 회의 녹화에서 소리만 뽑아 이동 중에 듣습니다. 동영상보다 용량이 훨씬 작아 휴대폰에 넣어 두기 좋습니다.',
      },
      {
        title: '받아쓰기·자막 작업용 음성 파일',
        text: '받아쓰기 앱이나 자막 프로그램이 음성 파일만 받을 때 씁니다. 편집 프로그램이 동영상 속 소리를 못 읽으면 어디서나 열리는 WAV로 저장하세요.',
      },
      {
        title: '찍어 둔 공연·연주를 음악 파일로',
        text: '휴대폰으로 찍은 공연이나 연습 영상의 소리만 음악 파일로 남깁니다. 원래 소리 그대로 꺼내면 다시 인코딩하지 않아 녹음된 음질 그대로입니다.',
      },
    ],
    howTo: [
      '"동영상 파일 선택" 버튼을 누르거나 동영상을 화면으로 끌어다 놓습니다.',
      '저장 형식을 고릅니다. 기본은 원래 소리 그대로(대개 M4A)이고, 필요하면 WAV나 M4A로 다시 저장합니다.',
      '"소리 뽑기"를 누르고, 끝나면 "받기"를 누릅니다.',
    ],
    faq: [
      {
        q: '음질이 떨어지나요?',
        a: '원래 소리 그대로를 고르면 동영상 안의 소리 데이터를 다시 인코딩하지 않고 그대로 꺼내므로 음질이 똑같습니다. 휴대폰·카메라 동영상의 소리는 대부분 AAC라 M4A 파일이 됩니다. WAV는 압축을 푼 것이라 음질은 같고 용량만 커지며, M4A로 다시 저장하면 아주 약간 손실이 생길 수 있습니다.',
      },
      {
        q: 'MP3로 받을 수 있나요?',
        a: '동영상에 든 소리가 MP3일 때만 MP3로 그대로 꺼냅니다. 브라우저에는 MP3로 새로 저장하는 기능(인코더)이 없어 AAC 소리를 MP3로 바꾸지는 않습니다. M4A는 아이폰·안드로이드·윈도우·맥 대부분의 플레이어에서 재생됩니다.',
      },
      {
        q: '어떤 형식으로 저장되나요?',
        a: '원래 소리 그대로는 소리 코덱에 맞는 형식으로 저장합니다: AAC → M4A, MP3 → MP3, Opus·Vorbis(WebM 동영상) → OGG, FLAC → FLAC. 그 밖의 코덱(AC-3 등)은 그대로 담을 형식이 없어 WAV나 M4A로 다시 저장합니다.',
      },
      {
        q: '어떤 브라우저에서 되나요?',
        a: '원래 소리 그대로 꺼내기는 데이터를 옮기기만 해서 대부분의 최신 브라우저에서 됩니다. WAV·M4A로 다시 저장하려면 브라우저에 든 WebCodecs의 소리 풀기·저장 기능이 필요합니다 (크롬·엣지 94 이상, 파이어폭스 130 이상, Safari는 26부터). 안 되는 형식은 고를 수 없게 하고 까닭을 보여 줍니다.',
      },
      {
        q: '동영상의 일부 구간 소리만 뽑을 수 있나요?',
        a: '이 도구는 소리 전체를 뽑습니다. 일부만 필요하면 동영상 자르기로 구간을 먼저 잘라(빠르게 자르기는 몇 초면 끝남) 그 파일에서 소리를 뽑으세요.',
      },
      {
        q: '동영상이 서버로 올라가나요?',
        a: '아니요. 동영상을 읽고 소리를 꺼내는 모든 과정이 이 브라우저 안에서 이루어집니다. 큰 동영상도 올리는 시간 없이 바로 처리됩니다.',
      },
    ],
  },
  en: {
    uses: [
      {
        title: 'Listen to lecture and meeting recordings',
        text: 'Take just the sound from a lecture or meeting recording where you do not need the picture, and listen on the go. It is far smaller than the video, so it is easy to keep on your phone.',
      },
      {
        title: 'Audio files for transcription and subtitles',
        text: 'Use it when a transcription app or subtitle program only accepts audio files. If an editing program cannot read the sound in a video, save it as WAV, which opens everywhere.',
      },
      {
        title: 'Turn a recorded performance into a music file',
        text: 'Keep just the sound of a concert or practice video you shot on your phone. Taking the original sound out as is means no re-encoding, so you keep the recorded quality.',
      },
    ],
    howTo: [
      'Click "Choose a video file" or drag a video onto the page.',
      'Choose a format. The default keeps the original sound as is (usually M4A); you can also save it again as WAV or M4A.',
      'Click "Extract audio", and when it is done, click "Download".',
    ],
    faq: [
      {
        q: 'Does the sound quality drop?',
        a: 'With the original sound as is, the sound data in the video is taken out without re-encoding, so the quality is exactly the same. Sound in phone and camera videos is mostly AAC, which becomes an M4A file. WAV is the decoded sound, so the quality is the same and only the size grows, while saving again as M4A may lose a tiny bit of quality.',
      },
      {
        q: 'Can I get an MP3?',
        a: 'Only when the sound in the video is already MP3, which is then taken out as is. Browsers have no built-in MP3 encoder, so AAC sound is not converted to MP3. M4A plays in most players on iPhone, Android, Windows and Mac.',
      },
      {
        q: 'What format is it saved in?',
        a: 'The original sound is saved in the format that matches its codec: AAC → M4A, MP3 → MP3, Opus and Vorbis (WebM videos) → OGG, FLAC → FLAC. Other codecs (such as AC-3) have no format to hold them as is, so they are saved again as WAV or M4A.',
      },
      {
        q: 'Which browsers does it work in?',
        a: 'Taking the original sound out only moves data, so it works in most modern browsers. Saving again as WAV or M4A needs the audio decoding and encoding of WebCodecs built into the browser (Chrome and Edge 94+, Firefox 130+, Safari 26+). Formats that cannot be made are disabled with the reason shown.',
      },
      {
        q: 'Can I extract the sound of just one part?',
        a: 'This tool extracts the whole sound. If you only need a part, cut it first with Trim Video (fast trimming takes seconds) and extract the sound from that file.',
      },
      {
        q: 'Is my video uploaded?',
        a: 'No. Reading the video and taking out the sound all happen in this browser, so even large videos are processed right away with no upload time.',
      },
    ],
  },
});
