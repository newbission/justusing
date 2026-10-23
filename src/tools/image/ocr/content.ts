import { defineContent } from '../../types';

export default defineContent({
  ko: {
    uses: [
      {
        title: '사진 찍은 서류의 글자 옮기기',
        text: '영수증·안내문·명함을 휴대폰으로 찍은 사진에서 글자를 뽑아, 다시 타자하지 않고 붙여 넣습니다. 이름·전화번호·금액처럼 짧은 글자를 옮길 때 특히 편합니다.',
      },
      {
        title: '화면 캡처 속 글자 복사',
        text: '글자를 고를 수 없는 앱 화면, 대화 캡처, 강의 화면 캡처에서 글자를 뽑습니다. 어두운 말풍선 속 밝은 글자처럼 바탕이 다른 곳도 따로 찾아 읽습니다.',
      },
      {
        title: '여러 장을 한 번에 텍스트로',
        text: '스캔한 이미지나 캡처를 여러 장 넣으면 장마다 읽어 나란히 보여 줍니다. "TXT 다운로드"를 누르면 장마다 파일 이름을 붙여 TXT 하나로 받습니다.',
      },
    ],
    howTo: [
      '"이미지 파일 선택" 버튼을 누르거나 이미지를 화면으로 끌어다 놓습니다. 여러 장을 한 번에 넣을 수 있습니다.',
      '인식할 언어(한국어·영어)를 고릅니다.',
      '처음 쓸 때는 "데이터 받기"로 글자 인식 데이터를 받습니다. 받기 전에 크기를 알려 드리고, PDF 글자 인식에서 이미 받았다면 다시 받지 않습니다.',
      '"글자 인식"을 누르고 기다립니다. 이미지마다 읽은 글자가 옆 칸에 나오고, 읽은 줄은 이미지 위에 상자로 표시됩니다.',
      '틀린 글자는 칸에서 바로 고친 뒤 "모두 복사"로 복사하거나 "TXT 다운로드"로 받습니다. 한 장만 복사하려면 그 이미지의 "복사"를 누릅니다.',
    ],
    faq: [
      {
        q: '어떤 이미지를 읽을 수 있나요?',
        a: 'JPG·PNG·WebP·GIF·BMP처럼 브라우저가 여는 이미지를 읽습니다. 아이폰 사진(HEIC)은 Safari에서만 열립니다. 사진·화면 캡처·스캔 이미지 속 인쇄된 글자와 화면 글자를 읽고, 한국어와 영어를 지원합니다.',
      },
      {
        q: '데이터를 왜 받아야 하나요?',
        a: '글자를 읽는 엔진과 언어 데이터가 필요합니다(한국어+영어 약 7MB). 이 사이트에서 받는 공개 파일이고, 처음 한 번 받으면 이 브라우저에 보관되어 다음부터 바로 씁니다. PDF 글자 인식과 같은 데이터라 둘 중 한 곳에서 받으면 됩니다. 다른 브라우저·기기, 시크릿 창에서는 다시 받아야 하고, 브라우저 데이터를 지우면 사라집니다.',
      },
      {
        q: '얼마나 정확한가요? 잘 읽지 못할 때는요?',
        a: '또렷한 인쇄물 사진과 화면 캡처는 대부분 정확히 읽습니다. 흐리거나 그림자·빛 반사가 있는 사진, 아주 작은 글자, 꾸민 글꼴, 칸이 촘촘한 표는 틀릴 수 있으니 중요한 내용은 확인하세요. 밝은 곳에서 정면으로, 글자가 화면을 채우도록 가까이 찍으면 훨씬 잘 읽습니다. 필요한 부분만 "이미지 자르기·회전"으로 잘라 넣어도 좋습니다.',
      },
      {
        q: '손글씨나 세로쓰기도 읽나요?',
        a: '인쇄된 글자를 읽는 엔진이라 손글씨는 거의 읽지 못합니다. 가로로 쓴 글만 읽고 세로쓰기는 지원하지 않습니다. 한자·일본어처럼 한국어·영어가 아닌 글자도 읽지 못합니다.',
      },
      {
        q: '기울어지거나 옆으로 누운 사진도 되나요?',
        a: '휴대폰 사진은 사진에 적힌 방향대로 세워 읽습니다. 20° 안쪽으로 기운 글자 줄은 바로 세워 읽고, 옆으로 눕거나 뒤집힌 이미지는 거의 읽지 못했을 때 돌려 가며 다시 읽어 시간이 조금 더 걸립니다. 비스듬히 찍어 종이가 사다리꼴로 보이는 것은 바로잡지 않으니 정면에서 찍어 주세요.',
      },
      {
        q: '글자를 찾을 수 있는 PDF로 만들 수 있나요?',
        a: '이 도구는 글자만 뽑습니다. 원래 모습을 그대로 둔 채 글자 찾기·복사가 되는 PDF가 필요하면 "이미지를 PDF로"로 PDF를 만든 뒤 "PDF 글자 인식 (OCR)"을 쓰세요.',
      },
      {
        q: '이미지가 정말 업로드되지 않나요?',
        a: '네. 받는 것은 인식 엔진과 언어 데이터뿐이고, 이미지와 읽은 글자는 이 기기 안에서만 다룹니다. 복사한 글자도 이 기기의 클립보드에만 들어갑니다. 인식 엔진은 Tesseract(Apache 2.0 허가서)를 씁니다.',
      },
    ],
  },
  en: {
    uses: [
      {
        title: 'Copy text from photographed papers',
        text: 'Pull the text out of a phone photo of a receipt, notice or business card and paste it instead of retyping. Handy for names, phone numbers and amounts.',
      },
      {
        title: 'Copy text from screenshots',
        text: 'Get the text from app screens that do not let you select it, chat screenshots or lecture slides. Light text on dark bubbles is found and read separately.',
      },
      {
        title: 'Turn many images into text at once',
        text: 'Add several scans or screenshots and each one is read and shown side by side. "Download TXT" saves them all in one TXT file, with each file name as a heading.',
      },
    ],
    howTo: [
      'Click "Choose image files" or drag images onto the screen. You can add several at once.',
      'Choose the languages to recognize (English, Korean).',
      'The first time, click "Download data" to get the text recognition data. You will see the size first, and if you already downloaded it for OCR PDF, it is not downloaded again.',
      'Click "Recognize text" and wait. The text of each image appears next to it, and the lines that were read are boxed on the image.',
      'Fix any mistakes right in the text box, then click "Copy all" or "Download TXT". To copy one image only, click its "Copy".',
    ],
    faq: [
      {
        q: 'Which images can it read?',
        a: 'Any image your browser can open, such as JPG, PNG, WebP, GIF and BMP. iPhone photos (HEIC) only open in Safari. It reads printed text and on-screen text in photos, screenshots and scans, in English and Korean.',
      },
      {
        q: 'Why do I need to download data?',
        a: 'Recognizing text needs an engine and language data (about 6 MB for English, 7 MB with Korean). These are public files from this site. Once downloaded they are kept in this browser, so they are ready next time. OCR PDF uses the same data, so downloading it in either tool is enough. Other browsers, devices and private windows need to download it again, and clearing browser data removes it.',
      },
      {
        q: 'How accurate is it, and what if it reads badly?',
        a: 'Sharp photos of printed text and screenshots are mostly read correctly. Blurry photos, shadows or glare, very small text, decorative fonts and dense tables may have mistakes, so check important content. Shooting in good light, straight on and close enough that the text fills the frame helps a lot. You can also crop to the part you need with "Crop & Rotate Image" first.',
      },
      {
        q: 'Can it read handwriting or vertical text?',
        a: 'The engine is made for printed text, so it reads very little handwriting. Only horizontal text is supported, not vertical writing. Scripts other than English and Korean, such as Chinese or Japanese, are not read.',
      },
      {
        q: 'What about tilted or sideways photos?',
        a: 'Phone photos are turned upright using the orientation saved in the photo. Text lines tilted up to 20° are straightened before reading. Sideways or upside-down images are turned and read again when almost nothing could be read, which takes a little longer. A page shot at an angle so it looks like a trapezoid is not corrected, so shoot straight on.',
      },
      {
        q: 'Can I get a searchable PDF?',
        a: 'This tool only extracts the text. For a PDF that keeps the original look and lets you search and copy the text, make a PDF with "Image to PDF" and then use "OCR PDF".',
      },
      {
        q: 'Are my images really not uploaded?',
        a: 'Yes. Only the recognition engine and language data are downloaded. Your images and the recognized text stay on this device, and copied text only goes to this device’s clipboard. The recognition engine is Tesseract (Apache License 2.0).',
      },
    ],
  },
});
