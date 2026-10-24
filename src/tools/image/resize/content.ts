import { defineContent } from '../../types';

export default defineContent({
  ko: {
    uses: [
      {
        title: '이력서·원서 사진 규격 맞추기',
        text: '원서 접수 사이트가 사진을 "300×400 픽셀"처럼 정해 둘 때 그 크기로 맞춥니다. "원래 비율 유지"를 끄면 정확히 그 크기가 되지만, 원래 비율과 다르면 늘어나 보일 수 있습니다.',
      },
      {
        title: '상품 사진 크기 맞추기',
        text: '쇼핑몰에 올릴 상품 사진 여러 장을 같은 가로 크기로 한 번에 맞춥니다. 크기가 고르면 상세 페이지가 깔끔해 보이고 용량도 줄어듭니다.',
      },
      {
        title: '너무 큰 휴대폰 사진 줄이기',
        text: '휴대폰으로 찍은 사진은 가로가 4000픽셀이 넘는 경우가 많아 게시판이나 메신저에 올리기에 큽니다. 50%처럼 비율로 줄이면 화면으로 보기에 충분하고 용량은 크게 줄어듭니다.',
      },
    ],
    howTo: [
      '"이미지 파일 선택" 버튼을 누르거나 크기를 바꿀 이미지를 화면으로 끌어다 놓습니다. 여러 장을 한 번에 넣을 수 있습니다.',
      '"비율로"를 고르면 원래 크기의 몇 %로 바꿀지 적습니다. "가로·세로 크기로"를 고르면 원하는 픽셀 크기를 적습니다.',
      '목록에서 이미지마다 바뀔 크기를 미리 확인하고 "크기 바꾸기"를 누릅니다.',
      '한 장이면 "다운로드", 여러 장이면 "모두 받기"를 눌러 ZIP 하나로 받습니다. 목록의 ↓ 버튼으로 한 장씩 받을 수도 있습니다.',
    ],
    faq: [
      {
        q: '"원래 비율 유지"는 어떻게 동작하나요?',
        a: '적은 가로·세로 칸 안에 이미지가 들어가도록, 모양을 바꾸지 않고 맞춥니다. 예를 들어 가로 1920, 세로 1920을 적으면 가로 사진은 가로가 1920으로, 세로 사진은 세로가 1920으로 바뀝니다. 한쪽만 적으면 그쪽 길이에 맞추고 다른 쪽은 비율대로 정해집니다.',
      },
      {
        q: '정확히 정한 크기로 만들 수도 있나요?',
        a: '네. "원래 비율 유지"를 끄고 가로와 세로를 모두 적으면 그 크기로 정확히 맞춥니다. 원래 비율과 다르면 이미지가 늘어나거나 눌려 보일 수 있습니다. 잘라 내지는 않습니다.',
      },
      {
        q: '크기를 줄이면 용량도 줄어드나요?',
        a: '네. 가로·세로를 절반으로 줄이면 화소 수가 4분의 1이 되어 용량도 크게 줄어듭니다. 용량을 더 줄이고 싶으면 크기를 바꾼 뒤 이미지 압축 도구를 함께 쓰세요.',
      },
      {
        q: '크게 키울 수도 있나요?',
        a: '네. 비율을 100%보다 크게(최대 400%) 적거나 원래보다 큰 픽셀 크기를 적으면 커집니다. 다만 없는 세부를 만들어 내지는 못하므로 크게 키울수록 흐릿해집니다.',
      },
      {
        q: '저장 형식과 화질은 어떻게 되나요?',
        a: '원래 형식(JPG·PNG·WebP)으로 저장합니다. 아이폰 사진(HEIC)은 브라우저가 HEIC로 저장하지 못해 JPG로 저장합니다. JPG·WebP는 높은 화질로 저장해 크기를 바꾼 것 말고는 눈에 띄는 차이가 없고, PNG는 화질 손실 없이 저장하며 투명한 부분도 그대로 남습니다. 휴대폰 사진의 회전 정보는 미리 적용하고, 위치 같은 EXIF 정보는 남기지 않습니다.',
      },
    ],
  },
  en: {
    uses: [
      {
        title: 'Match a required photo size',
        text: 'When an application site asks for a photo of exactly, say, 300 × 400 pixels, resize it to that. Turning off "Keep aspect ratio" gives the exact size, but the photo may look stretched if its shape differs.',
      },
      {
        title: 'Make product photos match',
        text: 'Give all the product photos for an online shop the same width in one go. Matching sizes make the page look tidy and the files smaller.',
      },
      {
        title: 'Shrink huge phone photos',
        text: 'Phone photos are often over 4000 pixels wide, more than a forum or chat needs. Scaling them to something like 50% keeps them sharp on screen and cuts the file size a lot.',
      },
    ],
    howTo: [
      'Click "Choose image files" or drag the images onto the screen. You can add many at once.',
      'Choose "By percentage" and enter a percentage of the original size, or choose "By width and height" and enter the size in pixels.',
      'Check the new size of each image in the list, then click "Resize images".',
      'For one image, click "Download". For several, click "Download all" to get one ZIP. You can also download each image with its ↓ button.',
    ],
    faq: [
      {
        q: 'How does "Keep aspect ratio" work?',
        a: 'The image is fitted inside the width and height you enter without changing its shape. For example, with 1920 by 1920, landscape photos become 1920 wide and portrait photos become 1920 tall. If you fill in just one side, the image is fitted to that side and the other side follows the ratio.',
      },
      {
        q: 'Can I make it an exact size?',
        a: 'Yes. Turn off "Keep aspect ratio" and enter both the width and the height to get exactly that size. If the shape differs from the original, the image may look stretched or squeezed. Nothing is cropped.',
      },
      {
        q: 'Does resizing make the file smaller?',
        a: 'Yes. Halving the width and height leaves a quarter of the pixels, so the file gets much smaller. To shrink it further, use the image compressor after resizing.',
      },
      {
        q: 'Can I make images bigger?',
        a: 'Yes. Enter more than 100% (up to 400%) or a larger pixel size. Enlarging cannot create detail that is not there, though, so the bigger it gets, the blurrier it looks.',
      },
      {
        q: 'What format and quality are used?',
        a: 'Images are saved in their original format (JPG, PNG or WebP). iPhone photos (HEIC) are saved as JPG, because browsers cannot save HEIC. JPG and WebP are saved at high quality, so there is no visible change besides the size. PNG is saved without loss, and transparent areas stay transparent. Phone photo rotation is applied first, and EXIF data such as location is not kept.',
      },
    ],
  },
});
