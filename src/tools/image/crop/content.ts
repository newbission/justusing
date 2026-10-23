import { defineContent } from '../../types';

export default defineContent({
  ko: {
    uses: [
      {
        title: 'SNS·프로필에 맞는 비율로',
        text: '인스타그램 세로 게시물(4:5), 프로필 사진(1:1), 유튜브 썸네일(16:9)처럼 올릴 곳의 비율로 자릅니다. 비율을 고르면 그 비율을 지킨 채 남길 곳만 옮기면 됩니다.',
      },
      {
        title: '옆으로 누운 사진 바로 세우기',
        text: '휴대폰 사진이 어떤 사이트나 프로그램에서만 옆으로 누워 보이면, 사진 안의 방향 정보를 그곳이 읽지 않는 것입니다. 보이는 방향 그대로 다시 저장하면 어디서나 바로 보입니다. 90°씩 돌리거나 거울처럼 뒤집을 수도 있습니다.',
      },
      {
        title: '기운 수평선·서류 바로잡기',
        text: '바다·건물 사진의 수평이 기울었거나 서류를 비스듬히 찍었을 때 0.1° 단위로 돌려 맞춥니다. 화면의 3등분 선을 기준으로 맞추고, 필요 없는 가장자리는 함께 잘라 냅니다.',
      },
    ],
    howTo: [
      '"이미지 파일 선택" 버튼을 누르거나 사진을 화면으로 끌어다 놓습니다.',
      '필요하면 "왼쪽으로 90°"·"오른쪽으로 90°"로 돌리거나 뒤집고, 기울기 바로잡기 막대로 수평을 맞춥니다.',
      '비율을 고르고 밝은 칸을 끌어 남길 곳을 정합니다. 모서리의 점을 끌면 크기가 바뀌고, 폭·높이를 숫자로 적을 수도 있습니다.',
      '저장 형식을 고른 뒤 "자른 이미지 받기"를 누릅니다.',
    ],
    faq: [
      {
        q: '기울기를 바꾸면 왜 가장자리가 잘리나요?',
        a: '사진을 돌리면 네모난 틀의 귀퉁이에 빈 곳이 생깁니다. 빈 곳 없이 꽉 찬 사진이 되도록 돌린 만큼 사진을 키우기 때문에 가장자리가 조금 잘립니다. 많이 돌릴수록 더 많이 잘리니 꼭 필요한 만큼만 돌리세요.',
      },
      {
        q: '자르면 화질이 떨어지나요?',
        a: '자르기만 하면 남긴 부분의 화소는 그대로입니다. 다만 다시 저장하므로 JPG·WebP는 아주 조금 손실이 생길 수 있습니다(화질 92%로 저장). 손실이 없어야 하면 PNG로 저장하세요. 기울기를 바꾸면 화소를 새로 계산하므로 아주 약간 부드러워집니다.',
      },
      {
        q: '정확한 크기(예: 1080×1350)로 만들 수 있나요?',
        a: '이 도구는 원본에서 남길 영역을 고르므로 결과 크기는 고른 영역의 화소 수입니다. 비율을 4:5로 맞춰 자른 뒤 이미지 크기 조절 도구에서 1080×1350으로 바꾸면 정확한 크기가 됩니다.',
      },
      {
        q: '촬영 정보(EXIF)는 남나요?',
        a: '남지 않습니다. 사진을 다시 그려 저장하므로 촬영 위치·날짜·기기 같은 정보가 빠지고, 방향 정보 없이 보이는 방향 그대로 저장됩니다. 촬영 정보를 지키면서 위치만 지우려면 사진 위치 정보 지우기 도구를 쓰세요.',
      },
      {
        q: '여러 장을 한꺼번에 자를 수 있나요?',
        a: '사진마다 남길 곳이 달라서 한 장씩 자릅니다. 받은 뒤 "다른 이미지"를 눌러 다음 사진을 여세요. 여러 장의 크기만 같은 비율로 줄이려면 이미지 크기 조절 도구가 편합니다.',
      },
      {
        q: '사진이 서버로 올라가나요?',
        a: '아니요. 사진을 열고, 돌리고, 잘라 저장하는 모든 과정이 이 브라우저 안에서 이루어집니다. 개인 사진도 안심하고 쓸 수 있습니다.',
      },
    ],
  },
  en: {
    uses: [
      {
        title: 'Fit the ratio of social media and profiles',
        text: 'Crop to the ratio of where you post, such as Instagram portrait posts (4:5), profile pictures (1:1) or YouTube thumbnails (16:9). Once you pick a ratio, just move the box to the part you want to keep.',
      },
      {
        title: 'Fix photos that appear sideways',
        text: 'If a phone photo looks sideways only on some sites or programs, they are ignoring the orientation tag inside the photo. Saving it again the way it looks makes it appear upright everywhere. You can also rotate it by 90° or flip it like a mirror.',
      },
      {
        title: 'Straighten a tilted horizon or document',
        text: 'If the horizon in a sea or building photo is tilted, or you shot a document at an angle, turn it in 0.1° steps to level it. Use the grid lines as a guide and trim the edges you do not need at the same time.',
      },
    ],
    howTo: [
      'Click "Choose an image file" or drag a photo onto the page.',
      'If needed, turn it with "Rotate left 90°" or "Rotate right 90°", flip it, and level it with the Straighten slider.',
      'Pick an aspect ratio and drag the bright box to the part you want to keep. Drag the dots on the corners to resize it, or type the width and height.',
      'Choose a format and click "Download edited image".',
    ],
    faq: [
      {
        q: 'Why are the edges trimmed when I straighten?',
        a: 'Turning a photo leaves empty corners in the rectangular frame. The photo is enlarged by just enough to fill the frame, so the edges are trimmed slightly. The more you turn, the more is trimmed, so turn only as much as you need.',
      },
      {
        q: 'Does cropping reduce quality?',
        a: 'Cropping keeps the pixels of the part you keep. The image is saved again, though, so JPG and WebP may lose a tiny bit of quality (saved at 92% quality). Choose PNG if there must be no loss. Straightening recalculates the pixels, so the image becomes very slightly softer.',
      },
      {
        q: 'Can I make an exact size such as 1080×1350?',
        a: 'This tool picks the area to keep from the original, so the result has as many pixels as that area. Crop to 4:5, then change the size to 1080×1350 with the Resize Image tool to get the exact size.',
      },
      {
        q: 'Is the photo information (EXIF) kept?',
        a: 'No. The photo is redrawn, so information such as location, date and device is removed, and it is saved the way it looks without an orientation tag. To keep the photo information and remove only the location, use the Remove Photo Location tool.',
      },
      {
        q: 'Can I crop several photos at once?',
        a: 'Each photo needs its own area, so they are cropped one at a time. After downloading, click "Other image" to open the next one. To shrink many photos by the same ratio, the Resize Image tool is easier.',
      },
      {
        q: 'Are my photos uploaded?',
        a: 'No. Opening, rotating, cropping and saving all happen in this browser, so you can safely use personal photos.',
      },
    ],
  },
});
