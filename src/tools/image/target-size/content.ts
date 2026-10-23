import { defineContent } from '../../types';

export default defineContent({
  ko: {
    uses: [
      {
        title: '"200KB 이하" 첨부 제한에 맞추기',
        text: '온라인 민원, 입사 지원서, 학교 과제 제출처럼 사진을 "200KB 이하", "1MB 이하"로 받는 곳이 많습니다. 목표 용량을 고르면 그 아래로 들어가게 화질과 크기를 알아서 맞춥니다.',
      },
      {
        title: '증빙 사진 여러 장을 같은 제한으로',
        text: '영수증·서류를 찍은 사진 여러 장을 "장당 500KB 이하"처럼 한꺼번에 맞추고 ZIP 하나로 받습니다. 이미 작은 사진은 다시 저장하지 않고 원본 그대로 넣습니다.',
      },
      {
        title: '크기는 정해져 있고 용량만 줄일 때',
        text: '증명사진처럼 가로·세로 픽셀이 정해진 사진은 "크기는 그대로, 화질만"을 고르면 픽셀 크기는 두고 화질만 낮춰 용량을 맞춥니다.',
      },
    ],
    howTo: [
      '"이미지 파일 선택" 버튼을 누르거나 줄일 사진을 화면으로 끌어다 놓습니다. 여러 장을 한 번에 넣을 수 있습니다.',
      '목표 용량을 고릅니다. 목록에 없으면 "직접 입력"을 고르고 숫자와 단위(KB·MB)를 적습니다.',
      '줄이는 방법과 저장 형식을 고릅니다. 잘 모르겠으면 그대로 두세요. 가로·세로 크기가 정해져 있으면 "크기는 그대로, 화질만"을 고릅니다.',
      '"용량 맞추기"를 누릅니다. 목록에 이미지마다 줄어든 용량과 쓴 화질, 가로·세로 크기가 보입니다.',
      '한 장이면 "다운로드", 여러 장이면 "모두 받기"를 눌러 ZIP 하나로 받습니다. 목록의 ↓ 버튼으로 한 장씩 받을 수도 있습니다.',
    ],
    faq: [
      {
        q: '어떻게 정한 용량에 맞추나요?',
        a: '화질 92%로 저장해 보고, 넘으면 화질을 낮춰 가며 목표 아래로 들어가는 가장 높은 화질을 찾습니다. "필요하면 크기도 줄이기"에서는 화질을 60%까지만 낮추고, 그래도 크면 가로·세로를 줄여 다시 찾습니다. 화질을 아주 낮추는 것보다 크기를 조금 줄이는 편이 더 깨끗하기 때문입니다.',
      },
      {
        q: '"크기는 그대로, 화질만"은 언제 고르나요?',
        a: '증명사진(413×531)처럼 가로·세로 픽셀이 정해져 있을 때 고릅니다. 화질을 10%까지 낮추므로 목표가 작으면 사진이 많이 거칠어질 수 있고, 그래도 넘으면 맞추지 못했다고 알려 줍니다. 크기 제한이 없으면 "필요하면 크기도 줄이기"가 더 보기 좋습니다.',
      },
      {
        q: '1KB는 몇 바이트로 계산하나요?',
        a: '1KB를 1,000바이트, 1MB를 1,000,000바이트로 계산합니다. 1,024바이트로 세는 곳보다 엄격해서 어느 쪽으로 재도 넘지 않습니다. 그래서 목록에는 결과가 목표보다 조금 작게(예: 200KB 목표에 195KB 이하) 보일 수 있습니다.',
      },
      {
        q: '이미 목표보다 작은 사진은 어떻게 되나요?',
        a: '다시 저장하지 않고 원본을 그대로 둡니다. 다시 저장하면 화질만 나빠지기 때문입니다. 다만 "JPG로 저장"을 골랐는데 원본이 PNG·WebP라면 JPG로 바꿔 저장합니다.',
      },
      {
        q: 'PNG나 투명한 이미지는 어떻게 되나요?',
        a: '"JPG로 저장"을 고르면 JPG로 바꾸고, JPG에는 투명이 없어 투명한 곳은 흰색이 됩니다(목록에 따로 알려 줍니다). "원래 형식 그대로"를 고르면 PNG는 쓰는 색의 수를 256색부터 차례로 줄여 맞추고 투명을 지킵니다. 사진은 PNG보다 JPG가 훨씬 작아 낮은 목표에는 JPG가 맞습니다.',
      },
      {
        q: '목표에 맞추지 못했다고 나와요.',
        a: '"크기는 그대로, 화질만"에서 큰 사진에 작은 목표를 주면 가장 낮은 화질로도 넘을 수 있습니다. 이때는 "필요하면 크기도 줄이기"를 고르세요. 크기를 줄여도 긴 변이 100픽셀보다 작아져야 하는 목표는 너무 작다고 알립니다.',
      },
      {
        q: '사진의 위치 정보도 남나요?',
        a: '다시 저장한 사진에는 촬영 위치·날짜·기기 같은 EXIF 정보가 남지 않습니다. 이미 목표 이하라 원본 그대로 둔 사진은 원본의 정보도 그대로이니, 위치를 지우려면 사진 위치 정보 지우기 도구를 함께 쓰세요.',
      },
    ],
  },
  en: {
    uses: [
      {
        title: 'Meet a "200 KB or less" upload limit',
        text: 'Online government forms, job applications and school submissions often accept photos only under 200 KB or 1 MB. Pick the target and the quality and size are adjusted so the file fits under it.',
      },
      {
        title: 'Fit many receipts or documents at once',
        text: 'Fit a batch of photos of receipts or documents to a limit like 500 KB each and download one ZIP. Photos already under the limit go in as they are, without being saved again.',
      },
      {
        title: 'Keep exact pixel dimensions',
        text: 'For photos with fixed dimensions, such as an ID photo, choose "Keep dimensions, lower quality only" to keep the width and height and lower only the quality to fit.',
      },
    ],
    howTo: [
      'Click "Choose image files" or drag the photos onto the screen. You can add many at once.',
      'Choose the target size. If it is not listed, choose "Custom" and enter a number and unit (KB or MB).',
      'Choose how to shrink and the format to save as. If you are not sure, leave them as they are. If the width and height are fixed, choose "Keep dimensions, lower quality only".',
      'Click "Fit to size". The list shows the new size, the quality used, and the width and height of each image.',
      'For one image, click "Download". For several, click "Download all" to get one ZIP. You can also download each image with its ↓ button.',
    ],
    faq: [
      {
        q: 'How does it hit the target size?',
        a: 'It tries quality 92% first, and if the file is too big it searches lower qualities for the highest one that fits. With "Also resize if needed", quality only goes down to 60%; if it is still too big, the width and height are reduced and the search runs again. A slightly smaller image looks cleaner than a very low quality one.',
      },
      {
        q: 'When should I keep the dimensions?',
        a: 'When the width and height are fixed, such as a 413×531 ID photo. Quality can go down to 10%, so a small target may make the photo look rough, and if it still does not fit you are told so. Without a size requirement, "Also resize if needed" looks better.',
      },
      {
        q: 'Is 1 KB 1,000 or 1,024 bytes?',
        a: '1 KB is counted as 1,000 bytes and 1 MB as 1,000,000 bytes. This is stricter than counting 1,024, so the file fits either way. That is why the list may show a result slightly below the target (for example, 195 KB or less for a 200 KB target).',
      },
      {
        q: 'What happens to photos already under the target?',
        a: 'They are kept as they are, because saving them again would only lower the quality. If you chose "Save as JPG" and the original is a PNG or WebP, it is converted to JPG.',
      },
      {
        q: 'What about PNGs and transparent images?',
        a: 'With "Save as JPG" they become JPG, which has no transparency, so transparent areas turn white (the list tells you). With "Same format", PNGs fit by using fewer colors (from 256 down) and keep their transparency. Photos are much smaller as JPG than PNG, so JPG suits small targets.',
      },
      {
        q: 'It says the image did not fit.',
        a: 'With "Keep dimensions, lower quality only", a large photo may stay above a small target even at the lowest quality. Choose "Also resize if needed" instead. If fitting would need the long side to be under 100 pixels, the target is reported as too small.',
      },
      {
        q: 'Is the photo location kept?',
        a: 'Photos that are saved again keep no EXIF data such as location, date or device. Photos kept as they are because they were already under the target keep the original data, so use the remove location tool if you need to strip it.',
      },
    ],
  },
});
