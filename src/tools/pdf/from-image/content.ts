import { defineContent } from '../../types';

export default defineContent({
  ko: {
    uses: [
      {
        title: '찍은 서류 사진을 PDF로',
        text: '스캐너 없이 휴대폰으로 찍은 신분증 사본, 통장 사본, 영수증을 "PDF로 보내 주세요"라고 할 때 씁니다. 사진 방향 정보를 읽어 눕지 않게 넣습니다.',
      },
      {
        title: '여러 장을 한 문서로',
        text: '여러 장으로 찍은 계약서나 손으로 쓴 서류를 순서대로 놓고 한 장이 한 쪽인 PDF 하나로 만듭니다. A4를 고르면 인쇄하기 좋은 크기로 맞춰집니다.',
      },
      {
        title: '그림·캡처를 제출용 PDF로',
        text: '그림 과제, 화면 캡처, 디자인 시안처럼 이미지로 만든 결과물을 PDF로만 받는 곳에 낼 때 씁니다. "이미지에 맞춤"을 고르면 이미지 크기 그대로 한 쪽이 됩니다.',
      },
    ],
    howTo: [
      '"이미지 파일 선택" 버튼을 누르거나 PDF로 만들 이미지들을 화면으로 끌어다 놓습니다. 여러 장을 한 번에 고를 수 있고, "이미지 추가"로 더 넣을 수 있습니다.',
      '목록에서 줄을 끌거나 ↑ ↓ 버튼으로 순서를 정합니다. 위에서부터 한 장이 한 쪽이 됩니다. 넣지 않을 이미지는 × 버튼으로 뺍니다.',
      '쪽 크기("A4", "Letter", "이미지에 맞춤")와 여백("여백 없음", "여백 있음")을 고른 뒤 "PDF 만들기"를 누릅니다. 휴대폰에서는 "이미지에 맞춤"이 "맞춤"으로 짧게 보입니다.',
      '완료되면 "다운로드"를 누릅니다.',
    ],
    faq: [
      {
        q: '어떤 이미지를 넣을 수 있나요?',
        a: 'JPG와 PNG는 물론, WebP처럼 이 브라우저가 열 수 있는 이미지는 모두 넣을 수 있습니다. 열 수 없는 이미지는 목록에 "열 수 없는 이미지"로 표시되고 PDF에서 빠집니다.',
      },
      {
        q: '휴대폰으로 찍은 사진이 옆으로 눕지 않나요?',
        a: '눕지 않습니다. 휴대폰 사진에 저장된 방향 정보를 읽어 화면에 보이는 방향 그대로 넣습니다.',
      },
      {
        q: '화질이 떨어지나요?',
        a: 'JPG와 PNG는 다시 압축하지 않고 원본 그대로 PDF에 넣습니다. 다만 받는 사람에게 갈 필요 없는 사진 속 촬영 정보(위치·카메라 등 EXIF)와 설명은 빼고 넣습니다. 방향을 바로잡아야 하는 사진과 그 밖의 형식만 다시 저장하며, 이때도 눈에 띄는 화질 차이가 없도록 높은 화질로 저장합니다.',
      },
      {
        q: '쪽 크기는 어떻게 정해지나요?',
        a: '"A4"와 "Letter"는 그 종이 크기에 이미지를 비율 그대로 가운데에 맞춰 넣고, 가로로 긴 이미지는 종이도 가로로 놓습니다. 종이보다 작은 이미지는 키우지 않습니다. "이미지에 맞춤"은 쪽 크기를 이미지 크기와 똑같이 만듭니다.',
      },
      {
        q: '만든 PDF의 파일 이름은 어떻게 되나요?',
        a: '목록 맨 위 이미지의 이름을 따서 "사진이름.pdf"로 받습니다.',
      },
    ],
  },
  en: {
    uses: [
      {
        title: 'Turn document photos into a PDF',
        text: 'When you need to send a copy of an ID, a bank statement or a receipt as a PDF but have no scanner, take photos with your phone and convert them. Photo orientation is read, so pages are not sideways.',
      },
      {
        title: 'Make one document from several shots',
        text: 'Put photos of a multi-page contract or handwritten notes in order and turn them into one PDF, one image per page. Choose A4 or Letter to get a page size that prints well.',
      },
      {
        title: 'Submit artwork or screenshots as PDF',
        text: 'Use it when a class or client only accepts PDF but your work is in images, such as drawings, screenshots or design drafts. "Fit to image" makes each page the exact size of its image.',
      },
    ],
    howTo: [
      'Click "Choose image files" or drag the images you want onto the screen. You can pick several at once and add more with "Add images".',
      'Drag rows in the list or use the ↑ ↓ buttons to set the order. Each image becomes one page, from the top. Remove any image you do not want with the × button.',
      'Choose the page size ("A4", "Letter" or "Fit to image") and the margin ("No margin" or "Small margin"), then click "Create PDF". On small screens, "Fit to image" is labeled "Fit".',
      'When it is done, click "Download".',
    ],
    faq: [
      {
        q: 'Which images can I add?',
        a: 'JPG and PNG, plus any other format your browser can open, such as WebP. Images that cannot be opened are marked "This image cannot be opened" in the list and left out of the PDF.',
      },
      {
        q: 'Will photos taken on my phone end up sideways?',
        a: 'No. The orientation stored in the photo is read, so each image goes in the way it appears on screen.',
      },
      {
        q: 'Will the image quality drop?',
        a: 'JPG and PNG files are placed into the PDF as they are, without recompression. Shooting details stored in photos (location, camera and other EXIF data) and descriptions are left out, since recipients do not need them. Only photos that need their orientation fixed and other formats are saved again, at a high quality setting so the difference is not noticeable.',
      },
      {
        q: 'How is the page size decided?',
        a: '"A4" and "Letter" fit the image onto that paper size, centered and keeping its proportions, and wide images get a landscape page. Images smaller than the paper are not enlarged. "Fit to image" makes each page exactly the size of its image.',
      },
      {
        q: 'What is the PDF file named?',
        a: 'It is named after the first image in the list, like "photo.pdf".',
      },
    ],
  },
});
