import { defineContent } from '../../types';

export default defineContent({
  ko: {
    howTo: [
      '"PDF 파일 선택" 버튼을 누르거나 줄일 PDF를 화면으로 끌어다 놓습니다.',
      '줄이는 정도를 고릅니다. 잘 모르겠으면 "보통"을 고르세요.',
      '"압축하기"를 누릅니다. 사진이 많으면 시간이 걸리고, 진행 상황이 막대에 보입니다.',
      '완료되면 원래 크기와 줄어든 크기가 보입니다. "다운로드"를 누르세요. 더 줄이고 싶으면 "많이"를 골라 다시 압축합니다.',
    ],
    faq: [
      {
        q: '얼마나 줄어드나요?',
        a: '사진이 많은 PDF(스캔한 문서, 사진이 든 보고서)는 절반 이하로 줄어드는 경우가 많습니다. 글자만 있는 PDF는 이미 작게 저장돼 있어서 거의 줄지 않습니다. 원본보다 작아지지 않으면 받을 파일을 만들지 않고 알려 드립니다.',
      },
      {
        q: '글자가 흐려지나요?',
        a: '아니요. 글자와 선은 그대로 두고 PDF 안의 사진만 다시 저장합니다. 글자는 검색·복사도 그대로 됩니다. 다만 글자를 사진처럼 찍은 스캔본은 "많이"를 고르면 흐려질 수 있으니 "보통"부터 써 보세요.',
      },
      {
        q: '큰 파일은 오래 걸리나요?',
        a: '사진 수와 기기 성능에 따라 다릅니다. 기기의 CPU 수에 맞춰 사진 여러 장을 동시에 줄이고, 처리하는 동안에도 화면은 멈추지 않습니다. 휴대폰에서 수백 MB짜리 파일은 메모리가 부족할 수 있습니다.',
      },
      {
        q: '암호가 걸린 PDF도 줄일 수 있나요?',
        a: '암호를 알면 됩니다. 암호를 넣어 연 뒤 압축하면 결과 PDF에는 암호가 없습니다. 다시 걸려면 "PDF 암호 걸기"를 쓰세요.',
      },
    ],
  },
  en: {
    howTo: [
      'Click "Choose PDF file" or drag the PDF you want to shrink onto the screen.',
      'Choose how much to shrink. If you are not sure, choose "Balanced".',
      'Click "Compress PDF". PDFs with many photos take longer, and the bar shows the progress.',
      'When it is done, you see the old and new sizes. Click "Download". To shrink it further, choose "More" and compress again.',
    ],
    faq: [
      {
        q: 'How much smaller will my PDF get?',
        a: 'PDFs with many photos, such as scanned documents or reports with pictures, often shrink to half or less. PDFs with only text are usually stored compactly already and barely shrink. If the result is not smaller than the original, no file is created and you are told so.',
      },
      {
        q: 'Will the text get blurry?',
        a: 'No. Text and lines stay as they are, and only the photos inside the PDF are re-saved. You can still search and copy the text. Scanned pages, however, are photos of text, so "More" can make them blurry. Try "Balanced" first.',
      },
      {
        q: 'Do large files take a long time?',
        a: 'It depends on the number of photos and your device. Several photos are shrunk at once, matched to the number of CPU cores, and the screen keeps responding while it works. On a phone, files of several hundred MB may run out of memory.',
      },
      {
        q: 'Can I compress a password-protected PDF?',
        a: 'Yes, if you know the password. Open it with the password and compress it. The new PDF has no password, so use "Protect PDF" to add one again.',
      },
    ],
  },
});
