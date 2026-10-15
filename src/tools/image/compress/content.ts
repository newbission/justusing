import { defineContent } from '../../types';

export default defineContent({
  ko: {
    howTo: [
      '"이미지 파일 선택" 버튼을 누르거나 줄일 이미지를 화면으로 끌어다 놓습니다. 여러 장을 한 번에 넣을 수 있습니다.',
      '줄이는 정도를 고릅니다. 잘 모르겠으면 "보통"을 고르세요. 더 작게 만들려면 저장 형식을 "WebP로 바꾸기"로 고릅니다.',
      '"압축하기"를 누릅니다. 이미지마다 원래 크기와 줄어든 크기가 목록에 보입니다.',
      '한 장이면 "다운로드", 여러 장이면 "모두 받기"를 눌러 ZIP 하나로 받습니다. 목록의 ↓ 버튼으로 한 장씩 받을 수도 있습니다.',
    ],
    faq: [
      {
        q: '얼마나 줄어드나요?',
        a: '휴대폰 사진이나 카메라 사진(JPG)은 "보통"에서 보통 절반 이하로 줄어듭니다. 화면 캡처 같은 PNG는 색 수를 줄여 저장하므로 60~80% 줄어드는 경우가 많습니다. 이미 작게 저장된 이미지는 거의 줄지 않는데, 그럴 때는 원본을 그대로 둡니다.',
      },
      {
        q: '화질이 나빠지나요?',
        a: '"보통"은 화면으로 볼 때 차이를 알아보기 어려운 정도로 줄입니다. 확대해서 보거나 인쇄할 사진이면 "조금"을 고르세요. "조금"은 PNG의 색을 줄이지 않아 PNG 화질이 그대로입니다.',
      },
      {
        q: '가로·세로 크기도 줄어드나요?',
        a: '아니요. 크기는 그대로 두고 저장 방식만 바꿉니다. 큰 사진을 작은 크기로 바꾸면 용량이 훨씬 많이 줄어드니, 그럴 때는 이미지 크기 조절 도구를 함께 쓰세요.',
      },
      {
        q: '사진의 위치 정보도 남나요?',
        a: '아니요. 이미지를 다시 그려 저장하므로 촬영 위치·날짜·기기 같은 EXIF 정보는 결과 파일에 남지 않습니다. 휴대폰 사진의 회전 정보는 미리 적용해서 사진은 바로 선 채로 저장됩니다.',
      },
      {
        q: 'WebP는 무엇인가요?',
        a: '웹에서 많이 쓰는 이미지 형식으로, 같은 화질에서 JPG·PNG보다 작습니다. 요즘 브라우저와 대부분의 앱에서 열리지만 오래된 프로그램에서는 열리지 않을 수 있습니다. 어디에 쓸지 모르면 "원래 형식 그대로"를 고르세요.',
      },
      {
        q: '많은 이미지를 한 번에 줄여도 되나요?',
        a: '네. 기기의 CPU 수에 맞춰 여러 장을 동시에 줄이고, 그동안에도 화면은 멈추지 않습니다. 다만 휴대폰에서 아주 큰 사진을 수십 장 넣으면 메모리가 부족할 수 있으니 나눠서 줄이세요.',
      },
    ],
  },
  en: {
    howTo: [
      'Click "Choose image files" or drag the images onto the screen. You can add many at once.',
      'Choose how much to shrink. If you are not sure, choose "Balanced". For even smaller files, choose "Convert to WebP".',
      'Click "Compress images". The list shows the old and new size of each image.',
      'For one image, click "Download". For several, click "Download all" to get one ZIP. You can also download each image with its ↓ button.',
    ],
    faq: [
      {
        q: 'How much smaller will my images get?',
        a: 'Phone and camera photos (JPG) usually shrink to half or less with "Balanced". PNGs such as screenshots are saved with fewer colors and often shrink by 60–80%. Images that are already compact barely shrink, and in that case the original is kept.',
      },
      {
        q: 'Will the quality get worse?',
        a: '"Balanced" shrinks images to a point where the difference is hard to see on screen. For photos you will zoom into or print, choose "Less". "Less" does not reduce PNG colors, so PNG quality stays the same.',
      },
      {
        q: 'Does it change the width and height?',
        a: 'No. The size stays the same and only the way the image is saved changes. Making a large photo smaller in pixels saves much more, so use the resize tool for that.',
      },
      {
        q: 'Is the photo location kept?',
        a: 'No. The image is redrawn and saved again, so EXIF data such as location, date and device is not kept. Phone photo rotation is applied first, so photos stay upright.',
      },
      {
        q: 'What is WebP?',
        a: 'WebP is an image format widely used on the web. It is smaller than JPG or PNG at the same quality. Modern browsers and most apps open it, but some older programs cannot. If you are not sure where you will use it, choose "Same format".',
      },
      {
        q: 'Can I compress many images at once?',
        a: 'Yes. Several images are compressed at the same time, matched to the number of CPU cores, and the screen keeps responding. On a phone, dozens of very large photos may run out of memory, so compress them in smaller batches.',
      },
    ],
  },
});
