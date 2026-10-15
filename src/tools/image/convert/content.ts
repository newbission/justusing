import { defineContent } from '../../types';

export default defineContent({
  ko: {
    howTo: [
      '"이미지 파일 선택" 버튼을 누르거나 바꿀 이미지를 화면으로 끌어다 놓습니다. 여러 장을 한 번에 넣을 수 있습니다.',
      '바꿀 형식(JPG·PNG·WebP)을 고릅니다. 목록에서 이미지마다 "WEBP → JPG"처럼 바뀔 형식을 확인합니다.',
      '"변환하기"를 누릅니다.',
      '한 장이면 "다운로드", 여러 장이면 "모두 받기"를 눌러 ZIP 하나로 받습니다. 목록의 ↓ 버튼으로 한 장씩 받을 수도 있습니다.',
    ],
    faq: [
      {
        q: '어떤 형식을 바꿀 수 있나요?',
        a: 'JPG·PNG·WebP·GIF·BMP·AVIF처럼 지금 쓰는 브라우저가 열 수 있는 이미지는 모두 바꿀 수 있습니다. 결과는 JPG·PNG·WebP 가운데 하나로 저장합니다. 브라우저가 읽지 못하는 형식은 목록에 "읽지 못하는 형식"으로 표시됩니다.',
      },
      {
        q: '아이폰 사진(HEIC)도 바꿀 수 있나요?',
        a: 'Safari(아이폰·맥)에서는 HEIC를 열 수 있어 JPG로 바꿀 수 있습니다. 크롬·엣지 같은 다른 브라우저는 HEIC를 읽지 못해 지금은 바꿀 수 없습니다. 아이폰 설정 → 카메라 → 포맷에서 "높은 호환성"을 고르면 처음부터 JPG로 찍힙니다.',
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
    howTo: [
      'Click "Choose image files" or drag the images onto the screen. You can add many at once.',
      'Choose the format to convert to (JPG, PNG or WebP). The list shows each change, such as "WEBP → JPG".',
      'Click "Convert images".',
      'For one image, click "Download". For several, click "Download all" to get one ZIP. You can also download each image with its ↓ button.',
    ],
    faq: [
      {
        q: 'Which formats can I convert?',
        a: 'Any image your browser can open, such as JPG, PNG, WebP, GIF, BMP or AVIF. The result is saved as JPG, PNG or WebP. Formats your browser cannot read are marked as such in the list.',
      },
      {
        q: 'Can I convert iPhone photos (HEIC)?',
        a: 'Safari (on iPhone and Mac) can open HEIC, so you can convert it to JPG there. Other browsers such as Chrome and Edge cannot read HEIC, so it cannot be converted in them for now. On an iPhone, choosing Settings → Camera → Formats → "Most Compatible" takes photos as JPG from the start.',
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
