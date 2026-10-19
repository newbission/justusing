import { defineContent } from '../../types';

export default defineContent({
  ko: {
    uses: [
      {
        title: '받은 서류에 서명해 돌려주기',
        text: '메일로 받은 동의서나 확인서에 출력·스캔 없이 서명을 넣어 바로 회신합니다. 서명 그림을 넣는 것이므로 공동인증서 같은 전자서명이 필요한 곳에는 맞지 않습니다.',
      },
      {
        title: '계약서 서명란 채우기',
        text: '근로계약서나 임대차 계약서처럼 상대가 서명 그림을 받아 주는 문서의 서명란에 서명을 끌어다 맞춥니다. 쪽을 넘겨 서명할 쪽을 고릅니다.',
      },
      {
        title: '종이에 한 서명을 그대로',
        text: '마우스로 그리기 어렵다면 종이에 한 서명을 휴대폰으로 찍어 "서명 이미지 올리기"로 씁니다. 배경이 투명한 PNG면 더 깔끔하게 들어갑니다.',
      },
    ],
    howTo: [
      '"PDF 파일 선택" 버튼을 누르거나 서명할 PDF를 화면으로 끌어다 놓습니다.',
      '흰 칸에 마우스나 손가락으로 서명을 그리고 "서명 완료"를 누릅니다. 잘못 그렸으면 "지우기"를 누릅니다. 종이 서명을 찍은 사진은 "서명 이미지 올리기"로 쓸 수 있습니다.',
      '쪽 위의 서명을 끌어 서명할 자리로 옮기고, 오른쪽 아래 동그라미를 끌어 크기를 맞춥니다. ‹ › 버튼으로 쪽을 바꿉니다.',
      '"서명 넣기"를 누르고, 완료되면 "다운로드"를 누릅니다.',
    ],
    faq: [
      {
        q: '이 서명은 법적 효력이 있나요?',
        a: '이 도구는 서명 그림을 PDF에 넣는 것으로, 공동인증서 같은 전자서명(디지털 서명)과는 다릅니다. 효력이 필요한 계약은 상대방이 받아들이는 방식인지 먼저 확인하세요.',
      },
      {
        q: '그린 서명이 저장되나요?',
        a: '아니요. 서명은 이 기기 안에서만 쓰이고 어디에도 저장·전송되지 않습니다. 페이지를 닫으면 사라집니다.',
      },
      {
        q: '서명 배경이 문서 글자를 가리지 않나요?',
        a: '그린 서명은 배경이 투명한 그림으로 들어가 아래 글자를 가리지 않습니다. 사진으로 올린 서명은 사진 배경이 함께 들어가니, 배경이 투명한 PNG를 쓰면 더 깔끔합니다.',
      },
      {
        q: '여러 쪽에 같은 서명을 넣을 수 있나요?',
        a: '"모든 쪽"을 고르면 모든 쪽의 같은 자리에 넣습니다. 쪽마다 다른 자리에 넣으려면 한 쪽씩 넣은 결과로 다시 하세요.',
      },
    ],
  },
  en: {
    uses: [
      {
        title: 'Sign and return a form',
        text: 'Add your signature to a consent form or confirmation you got by email and send it back without printing or scanning. This places an image of your signature; it is not a certificate-based digital signature.',
      },
      {
        title: 'Fill in a signature line',
        text: 'Drag your signature onto the signature line of a lease, an offer letter or another document where the other party accepts a signature image. Flip through pages to find the right one.',
      },
      {
        title: 'Use your handwritten signature',
        text: 'If drawing with a mouse is awkward, take a photo of your signature on paper and use "Upload signature image". A PNG with a transparent background looks cleanest.',
      },
    ],
    howTo: [
      'Click "Choose PDF file" or drag the PDF you want to sign onto the screen.',
      'Draw your signature in the white box with a mouse or your finger and click "Done". Click "Clear" to start over. To use a photo of a signature on paper, click "Upload signature image".',
      'Drag the signature on the page to where you want to sign, and drag the circle at its lower right to resize it. Use the ‹ › buttons to change pages.',
      'Click "Sign PDF", then click "Download" when it is done.',
    ],
    faq: [
      {
        q: 'Is this signature legally binding?',
        a: 'This tool places a picture of your signature on the PDF. It is not a certificate-based digital signature. If the signature must be legally valid, check first that the other party accepts this method.',
      },
      {
        q: 'Is my signature stored?',
        a: 'No. Your signature is only used on this device and is never stored or sent anywhere. It is gone when you close the page.',
      },
      {
        q: 'Will the signature background cover the text?',
        a: 'A drawn signature is added with a transparent background, so it does not cover the text underneath. An uploaded photo keeps its background, so a PNG with a transparent background looks cleaner.',
      },
      {
        q: 'Can I add the same signature to several pages?',
        a: 'Choose "All pages" to add it at the same spot on every page. To sign different spots on different pages, sign one page at a time and run the tool again on the result.',
      },
    ],
  },
});
