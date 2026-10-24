import { defineContent } from '../../types';

export default defineContent({
  ko: {
    uses: [
      {
        title: '저장한 WebP가 안 열릴 때',
        text: '웹에서 저장한 이미지가 WebP라 일부 문서 프로그램이나 오래된 사진 프로그램에 넣지 못할 때 JPG나 PNG로 바꿉니다. 여러 장을 한 번에 바꿀 수 있습니다.',
      },
      {
        title: 'JPG만 받는 제출처',
        text: '서류 제출 사이트가 JPG만 받는데 가진 것이 PNG 캡처나 다른 형식일 때 JPG로 바꿉니다. PNG의 투명한 부분은 흰색으로 채워집니다.',
      },
      {
        title: '아이폰 사진(HEIC)을 JPG로',
        text: '윈도우 PC로 옮긴 아이폰 사진(HEIC)이 열리지 않을 때 크롬·엣지에서도 JPG로 바꿀 수 있습니다. 다른 형식과 섞어 넣어도 됩니다.',
      },
    ],
    howTo: [
      '"이미지 파일 선택" 버튼을 누르거나 바꿀 이미지를 화면으로 끌어다 놓습니다. 여러 장을 한 번에 넣을 수 있습니다.',
      '바꿀 형식(JPG·PNG·WebP)을 고릅니다. 목록에서 이미지마다 "WEBP → JPG"처럼 바뀔 형식을 확인합니다.',
      '"변환하기"를 누릅니다.',
      '한 장이면 "다운로드", 여러 장이면 "모두 받기"를 눌러 ZIP 하나로 받습니다. 목록의 ↓ 버튼으로 한 장씩 받을 수도 있습니다.',
    ],
    faq: [
      {
        q: '어떤 형식을 바꿀 수 있나요?',
        a: 'JPG·PNG·WebP·GIF·BMP·AVIF처럼 지금 쓰는 브라우저가 열 수 있는 이미지와 아이폰 사진(HEIC·HEIF)을 바꿀 수 있습니다. 결과는 JPG·PNG·WebP 가운데 하나로 저장합니다. 읽지 못하는 파일은 목록에 "읽지 못하는 이미지"로 표시됩니다.',
      },
      {
        q: '아이폰 사진(HEIC)도 바꿀 수 있나요?',
        a: '네. Safari는 HEIC를 스스로 열고, 크롬·엣지·파이어폭스에서는 HEIC를 여는 프로그램(libheif, 약 0.5MB)을 우리 사이트에서 받아 브라우저 안에서 엽니다. 사진은 올라가지 않습니다. 라이브 포토처럼 여러 장이 든 파일은 사진 앱에 보이는 대표 사진 한 장만 바뀝니다. 아이폰 사진만 바꾼다면 HEIC 변환 도구가 더 알맞습니다.',
      },
      {
        q: 'PNG를 JPG로 바꾸면 투명한 부분은 어떻게 되나요?',
        a: 'JPG에는 투명이 없어 투명한 부분이 흰색으로 채워집니다. 투명을 남기려면 PNG나 WebP로 바꾸세요.',
      },
      {
        q: '화질이 떨어지나요?',
        a: 'PNG로 바꾸면 손실 없이 저장합니다. JPG·WebP는 높은 화질로 저장해 눈으로 보기에는 차이가 거의 없습니다. 다만 이미 JPG인 사진을 다시 JPG로 저장하는 것처럼 손실 형식끼리 바꿀 때는 아주 조금씩 손실이 생깁니다.',
      },
      {
        q: '움직이는 GIF도 바꿀 수 있나요?',
        a: '첫 장면만 한 장의 이미지로 바뀝니다. 움직임은 남지 않습니다.',
      },
    ],
  },
  en: {
    uses: [
      {
        title: 'A saved WebP will not open',
        text: 'Images saved from the web are often WebP, which some document editors and older photo apps cannot insert. Convert them to JPG or PNG, several at a time.',
      },
      {
        title: 'A site that only takes JPG',
        text: 'When an upload form accepts only JPG and you have a PNG screenshot or another format, convert it to JPG. Transparent areas are filled with white.',
      },
      {
        title: 'iPhone photos (HEIC) to JPG',
        text: 'When iPhone photos (HEIC) copied to a Windows PC will not open, convert them to JPG, even in Chrome or Edge. You can mix them with other formats.',
      },
    ],
    howTo: [
      'Click "Choose image files" or drag the images onto the screen. You can add many at once.',
      'Choose the format to convert to (JPG, PNG or WebP). The list shows each change, such as "WEBP → JPG".',
      'Click "Convert images".',
      'For one image, click "Download". For several, click "Download all" to get one ZIP. You can also download each image with its ↓ button.',
    ],
    faq: [
      {
        q: 'Which formats can I convert?',
        a: 'Any image your browser can open, such as JPG, PNG, WebP, GIF, BMP or AVIF, plus iPhone photos (HEIC and HEIF). The result is saved as JPG, PNG or WebP. Files that cannot be read are marked in the list.',
      },
      {
        q: 'Can I convert iPhone photos (HEIC)?',
        a: 'Yes. Safari opens HEIC by itself. In Chrome, Edge and Firefox, the page loads a HEIC reader (libheif, about 0.5 MB) from this site and opens the photo inside your browser. Your photos are not uploaded. A file holding several images, such as a Live Photo, becomes the one main photo shown in the Photos app. For iPhone photos only, the HEIC to JPG tool is a better fit.',
      },
      {
        q: 'What happens to transparency when converting PNG to JPG?',
        a: 'JPG has no transparency, so transparent areas are filled with white. To keep transparency, convert to PNG or WebP.',
      },
      {
        q: 'Will quality drop?',
        a: 'Converting to PNG is lossless. JPG and WebP are saved at high quality, so the difference is hardly visible. Converting between lossy formats, such as saving a JPG as JPG again, does lose a tiny bit each time.',
      },
      {
        q: 'Can I convert animated GIFs?',
        a: 'Only the first frame becomes a single image. The animation is not kept.',
      },
    ],
  },
});
