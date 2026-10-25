import { defineContent } from '../../types';

export default defineContent({
  ko: {
    uses: [
      {
        title: '쇼핑몰·중고 거래에 올릴 상품 사진',
        text: '탁자 위에서 찍은 상품 사진의 배경을 지우고 흰 배경 JPG로 받으면 상세 페이지처럼 깔끔해집니다. "물체에 맞춰 자르기"로 상품 둘레만 남길 수 있습니다.',
      },
      {
        title: '발표 자료·포스터에 넣을 사람·물건 그림',
        text: '사람이나 물건만 남긴 투명 PNG를 받아 PPT·한글·디자인 프로그램에서 다른 배경 위에 얹습니다. 글자나 색 배경과 겹쳐도 사진의 네모 테두리가 보이지 않습니다.',
      },
      {
        title: '반려동물 사진으로 스티커·프로필 만들기',
        text: '강아지·고양이를 눌러 남기고 배경을 투명하게 지운 뒤, 메신저 프로필이나 스티커 만들기 앱에 넣습니다. 털 끝이 잘리면 가장자리를 넓히거나 "되살리기"로 칠합니다.',
      },
    ],
    howTo: [
      '"사진 선택"을 누르거나 사진을 화면으로 끌어다 놓습니다. 남길 물체가 크게, 배경과 다른 색으로 나온 사진일수록 잘 나뉩니다.',
      '처음 쓸 때는 "데이터 받기"로 물체 나누기 데이터를 받습니다. 받기 전에 크기를 알려 드리고, 받은 데이터는 이 브라우저에 보관해 다음부터 바로 씁니다.',
      '사진 가운데의 물체를 저절로 남깁니다. 다른 물체도 남기려면 "물체 고르기"를 고른 채 그 물체를 누릅니다. 여러 번 누르면 누른 물체를 모두 남깁니다.',
      '배경이 남았으면 "지우개", 물체가 잘렸으면 "되살리기"를 고르고 그 부분을 칠합니다. 잘못했으면 "되돌리기"를 누릅니다.',
      '"가장자리"에서 좁히기·넓히기와 부드럽게를 조절하고, "배경"에서 "투명"·"흰색"·"다른 색"을 고릅니다.',
      '"PNG 다운로드"(색 배경이면 "JPG 다운로드")를 눌러 원본과 같은 크기로 받습니다.',
    ],
    faq: [
      {
        q: '사진이 서버로 올라가나요?',
        a: '아니요. 물체 나누기는 이 브라우저 안에서 돌아가는 인식 엔진(Google MediaPipe의 MagicTouch 모델)이 합니다. 처음에 받는 것은 사이트에 올려 둔 엔진과 모델 파일뿐이고, 사진은 이 기기 밖으로 나가지 않습니다.',
      },
      {
        q: '어떤 사진이 잘 되나요?',
        a: '남길 물체가 사진에서 크게 나오고 배경과 색·밝기가 다른 사진이 잘 됩니다. 사람·상품·동물·화분처럼 경계가 분명한 물체에 맞습니다. 물체가 아주 작거나 멀리 있으면 놓치기 쉽습니다. JPG·PNG·WebP 사진과 아이폰 사진(HEIC)을 열 수 있고, HEIC를 스스로 열지 못하는 크롬·엣지에서는 HEIC를 여는 프로그램(libheif, 약 0.5MB)을 우리 사이트에서 받아 이 기기에서 엽니다.',
      },
      {
        q: '머리카락이나 털 끝이 깔끔하지 않아요.',
        a: '이 도구는 가장자리를 화소 하나하나 투명도로 나누는 방식이 아니라, 물체와 배경의 경계를 찾는 방식이라 가는 머리카락·털 끝은 뭉개지거나 조금 잘릴 수 있습니다. "부드럽게"를 올리면 경계가 자연스러워지고, 잘린 부분은 "넓히기"나 "되살리기"로 채웁니다.',
      },
      {
        q: '유리컵이나 비치는 물체도 되나요?',
        a: '유리·비닐처럼 뒤가 비치는 물체는 배경이 그대로 보여 잘 나뉘지 않습니다. 결과에서도 반투명하게 남기지 못하고 남기거나 지우는 것 중 하나가 됩니다. 이런 물체는 흰 배경에서 찍는 것이 가장 확실합니다.',
      },
      {
        q: '결과 크기와 화질은 어떻게 되나요?',
        a: '원본과 같은 가로·세로로 저장합니다. 나누기는 줄인 사진으로 하고, 그 결과를 원본 크기로 늘려 원본 사진에 씌웁니다. 투명 배경은 PNG, 색 배경은 JPG(화질 92%)로 받습니다. "물체에 맞춰 자르기"를 고르면 남은 곳 둘레만 남깁니다.',
      },
      {
        q: '데이터는 얼마나 받나요?',
        a: '처음 한 번 인식 엔진(약 13MB)과 물체 나누기 모델(약 6MB)을 받습니다. 증명사진 도구에서 엔진을 받아 두었으면 모델만 받습니다. 받은 데이터는 이 브라우저에 보관되어 다음부터 바로 씁니다. 브라우저 설정에서 사이트 데이터를 지우면 다시 받아야 합니다.',
      },
    ],
  },
  en: {
    uses: [
      {
        title: 'Product photos for an online store or marketplace',
        text: 'Remove the background from a product shot on a table and download a JPG on white for a clean listing. "Crop to subject" keeps only the area around the product.',
      },
      {
        title: 'People and objects for slides and posters',
        text: 'Download a transparent PNG of just the person or object and place it on any background in slides or design apps. No rectangular photo edge shows over text or colored backgrounds.',
      },
      {
        title: 'Stickers and profile pictures of your pet',
        text: 'Click your dog or cat to keep it, make the background transparent, then use it as a profile picture or in a sticker app. If fur tips are cut off, grow the edge or paint them back with "Restore".',
      },
    ],
    howTo: [
      'Click "Choose photo" or drag a photo onto the page. It works best when the subject is large and differs in color from the background.',
      'The first time, click "Download data" to get the object separation data. The size is shown before downloading, and the data is kept in this browser for next time.',
      'The subject in the middle of the photo is kept automatically. To keep another subject, choose "Pick subject" and click it. Click several subjects to keep them all.',
      'If background remains, choose "Erase"; if part of the subject is cut off, choose "Restore", then paint over it. Click "Undo" to take back a step.',
      'Adjust shrink, grow and soften under "Edges", and pick "Transparent", "White" or "Other color" under "Background".',
      'Click "Download PNG" ("Download JPG" with a color background) to get the result at the original size.',
    ],
    faq: [
      {
        q: 'Is my photo uploaded to a server?',
        a: "No. The separation is done by a recognition engine running inside this browser (Google MediaPipe's MagicTouch model). The only downloads are the engine and model files hosted on this site; your photo never leaves this device.",
      },
      {
        q: 'Which photos work well?',
        a: 'Photos where the subject is large and differs in color or brightness from the background. It suits subjects with clear edges such as people, products, animals and plants. Very small or distant subjects are easy to miss. JPG, PNG and WebP photos and iPhone photos (HEIC) can be opened; Chrome and Edge, which cannot open HEIC on their own, download a HEIC reader (libheif, about 0.5 MB) from this site and open the photo on this device.',
      },
      {
        q: 'Hair and fur edges are not clean.',
        a: 'This tool finds the boundary between subject and background rather than computing a separate transparency for every hair, so fine hair and fur tips can be smoothed over or slightly cut. Raise "Soften" for a more natural edge, and fill cut parts with "Grow" or "Restore".',
      },
      {
        q: 'Does it work with glass or see-through objects?',
        a: 'See-through objects such as glass or plastic film show the background through them, so they do not separate well. The result cannot keep them semi-transparent either; each area is either kept or removed. For such objects, shooting on a white background is the most reliable.',
      },
      {
        q: 'What size and quality is the result?',
        a: 'It is saved at the same width and height as the original. The separation runs on a smaller copy, and the result is scaled up and applied to the original photo. A transparent background gives a PNG; a color background gives a JPG (92% quality). "Crop to subject" keeps only the area around what is kept.',
      },
      {
        q: 'How much data is downloaded?',
        a: 'The first time, the recognition engine (about 13 MB) and the object separation model (about 6 MB). If you already downloaded the engine in the ID photo tool, only the model is downloaded. The data is kept in this browser for next time; clearing site data in your browser settings means downloading it again.',
      },
    ],
  },
});
