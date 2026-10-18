import { defineContent } from '../../types';

export default defineContent({
  ko: {
    uses: [
      {
        title: '메신저로 문서 보여 주기',
        text: 'PDF를 메신저로 보내면 받는 사람이 파일을 따로 열어야 합니다. 쪽을 JPG로 바꿔 보내면 대화창에서 바로 보입니다.',
      },
      {
        title: '이미지만 받는 곳에 올리기',
        text: '증빙 서류를 이미지 파일로만 올리게 하는 사이트나 앱이 있습니다. 필요한 쪽만 "선택 추출"로 골라 JPG·PNG로 바꿔 올립니다.',
      },
      {
        title: '발표 자료에 쪽 붙이기',
        text: '보고서의 한 쪽이나 도표가 있는 쪽을 PPT나 문서에 그림으로 넣어야 할 때 씁니다. 인쇄할 자료라면 "고화질 (300 DPI)"을 고르세요.',
      },
    ],
    howTo: [
      '"PDF 파일 선택" 버튼을 누르거나 이미지로 만들 PDF를 화면으로 끌어다 놓습니다.',
      '"전체 추출"은 모든 쪽을, "선택 추출"은 누른 쪽만 이미지로 만듭니다. 휴대폰에서는 각각 "전체", "선택"으로 짧게 보입니다.',
      '이미지 형식(JPG·PNG)과 화질("보통 (150 DPI)", "고화질 (300 DPI)")을 고른 뒤 "이미지로 변환"을 누릅니다.',
      '완료되면 "다운로드"를 누릅니다. 이미지가 여러 장이면 ZIP 파일 하나로 받습니다.',
    ],
    faq: [
      {
        q: 'JPG와 PNG 중 무엇을 고르나요?',
        a: '메신저로 보내거나 문서에 붙일 때는 용량이 작은 JPG가 편합니다. 글자가 많은 쪽을 또렷하게 남기거나 이미지를 다시 편집할 때는 PNG가 좋습니다. PNG는 용량이 몇 배 커질 수 있습니다.',
      },
      {
        q: '화질은 어느 정도로 하나요?',
        a: '화면으로 보거나 공유할 때는 "보통 (150 DPI)"이면 충분합니다. 인쇄하거나 작은 글자를 확대해 볼 때는 "고화질 (300 DPI)"을 고르세요. 아주 큰 쪽은 기기가 감당할 수 있는 크기로 조금 줄여서 만듭니다.',
      },
      {
        q: '이미지 파일 이름은 어떻게 붙나요?',
        a: '"원래이름_1.jpg"처럼 원래 파일 이름 뒤에 쪽 번호가 붙습니다. 10쪽 이상이면 "_01"처럼 자릿수를 맞춰 이름 순서대로 놓입니다. 여러 장이면 "원래이름_이미지.zip" 하나로 묶어서 받고, 한 장이면 이미지로 바로 받습니다.',
      },
      {
        q: '암호가 걸린 PDF도 이미지로 만들 수 있나요?',
        a: '네. 파일을 열 때 암호를 입력하면 됩니다. 만든 이미지에는 암호가 없으니 보관에 주의하세요. 입력한 암호는 이 기기 안에서만 쓰입니다.',
      },
      {
        q: 'PDF 안에 든 사진만 원래 화질로 뽑을 수 있나요?',
        a: '아니요. 이 도구는 쪽 전체를 화면에 보이는 그대로 그려 이미지로 만듭니다. 사진만 원본 그대로 뽑으려면 "PDF 사진 꺼내기"를 쓰세요.',
      },
    ],
  },
  en: {
    uses: [
      {
        title: 'Show a document in a chat',
        text: 'Someone you send a PDF to in a chat app has to open the file separately. Turn the pages into JPGs and they show up right in the conversation.',
      },
      {
        title: 'Upload where only images are accepted',
        text: 'Some websites and apps only accept image files for supporting documents. Pick the pages you need with "Extract selected" and convert them to JPG or PNG.',
      },
      {
        title: 'Put a page into your slides',
        text: 'Use it when you need a page of a report, or a page with a chart, as a picture in slides or a document. For printing, choose "High (300 DPI)".',
      },
    ],
    howTo: [
      'Click "Choose PDF file" or drag the PDF you want to convert onto the screen.',
      '"Extract all" turns every page into an image, and "Extract selected" only the pages you click. On small screens, these options are labeled "All" and "Selected".',
      'Choose the image format (JPG or PNG) and the quality ("Standard (150 DPI)" or "High (300 DPI)"), then click "Convert to images".',
      'When it is done, click "Download". If there are several images, you get them as one ZIP file.',
    ],
    faq: [
      {
        q: 'Should I choose JPG or PNG?',
        a: 'JPG is handy for sending in a chat or pasting into a document because the files are small. PNG is better for keeping text-heavy pages crisp or for editing the image later. PNG files can be several times larger.',
      },
      {
        q: 'Which quality should I choose?',
        a: '"Standard (150 DPI)" is enough for viewing on screen or sharing. Choose "High (300 DPI)" for printing or for zooming in on small text. Very large pages are scaled down slightly to a size your device can handle.',
      },
      {
        q: 'How are the image files named?',
        a: 'Each image gets the original file name plus its page number, like "name_1.jpg". With 10 or more pages the numbers are zero-padded, like "_01", so they sort in order. Several images come as one "name_images.zip", and a single image downloads directly.',
      },
      {
        q: 'Can I convert a password-protected PDF?',
        a: 'Yes. Enter the password when you open the file. The images have no password, so store them carefully. The password you enter is only used on this device.',
      },
      {
        q: 'Can I extract just the photos inside a PDF at their original quality?',
        a: 'No. This tool draws each whole page as it appears on screen and saves it as an image. To pull out the embedded photos as they are, use "Extract Images from PDF".',
      },
    ],
  },
});
