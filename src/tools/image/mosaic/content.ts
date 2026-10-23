import { defineContent } from '../../types';

export default defineContent({
  ko: {
    uses: [
      {
        title: '중고거래·SNS에 올리기 전에',
        text: '물건 사진에 찍힌 택배 송장의 이름·주소, 자동차 번호판, 우편물의 집 주소를 가린 뒤 올립니다. 여러 곳을 그려 한 번에 가리고, 곳마다 가리는 방법을 다르게 고를 수 있습니다.',
      },
      {
        title: '화면 캡처 속 개인정보 가리기',
        text: '대화·주문 내역·이체 화면을 캡처해 보낼 때 이름·전화번호·계좌번호를 검게 칠합니다. 검게 칠한 곳은 원래 화소가 결과에 남지 않아 되살릴 수 없습니다.',
      },
      {
        title: '함께 찍힌 사람 얼굴 가리기',
        text: '여행·행사 사진에 모르는 사람이나 아이 얼굴이 찍혔을 때 타원 모양으로 모자이크하거나 흐립니다. 사진의 나머지 부분은 그대로 둡니다.',
      },
    ],
    howTo: [
      '"이미지 파일 선택" 버튼을 누르거나 사진을 화면으로 끌어다 놓습니다.',
      '사진 위를 끌어 가릴 곳을 그립니다. 여러 곳을 그릴 수 있고, 키보드로는 "가릴 곳 추가"를 누른 뒤 방향키로 옮깁니다.',
      '가리는 방법에서 모자이크·흐리게·검게 칠하기 중 하나를 고르고, 모자이크와 흐림은 세기를 정합니다. 꼭 감춰야 하는 정보는 "검게 칠하기"를 고르세요.',
      '저장 형식을 고른 뒤 "가린 이미지 받기"를 누릅니다.',
    ],
    faq: [
      {
        q: '모자이크나 흐림은 되살릴 수 있나요?',
        a: '그럴 수 있습니다. 흐림은 원래 화소를 부드럽게 섞은 것이라 글자는 프로그램으로 되살려 읽을 수 있고, 칸이 작은 모자이크도 글꼴과 글자 수를 알면 짐작할 수 있습니다. 번호판·전화번호·주민등록번호처럼 꼭 감춰야 하는 정보는 "검게 칠하기"를 고르세요. 가린 곳의 화소를 모두 검은색으로 바꿔 원래 내용이 결과에 남지 않습니다.',
      },
      {
        q: '받은 파일에 가린 내용이 남아 있지는 않나요?',
        a: '남지 않습니다. 사진을 원래 크기로 새로 그리고 가린 곳의 화소를 바꾼 뒤 저장하므로, 가린 곳은 바꾼 화소만 들어 있습니다. 원본 파일에 붙어 있던 미리보기 그림이나 촬영 정보(EXIF)도 결과에 옮기지 않습니다. 고른 원본 파일은 바뀌지 않으니 올릴 때 결과 파일을 고르세요.',
      },
      {
        q: '얼굴이나 번호판을 자동으로 찾아 주나요?',
        a: '지금은 직접 그려서 가립니다. 사진마다 가려야 할 곳이 달라 하나씩 확인하며 그리는 편이 빠뜨리지 않습니다. 얼굴이 많은 단체 사진은 "가릴 곳 추가"로 칸을 여러 개 만들어 옮기면 됩니다.',
      },
      {
        q: '모자이크 세기는 어떻게 정해지나요?',
        a: '세기를 높일수록 칸이 커집니다. 칸 크기는 가릴 곳의 짧은 변에 맞춰 정해지므로(세기 5면 짧은 변의 1/8), 가릴 곳을 키우거나 줄여도 칸 수는 비슷하게 유지됩니다. 고른 곳의 실제 칸 크기는 세기 막대 옆에 화소로 보입니다.',
      },
      {
        q: '가린 곳 밖의 화질은 떨어지나요?',
        a: 'PNG로 저장하면 가린 곳 밖은 원본 화소 그대로입니다. JPG·WebP는 다시 저장하므로 아주 조금 손실이 생길 수 있습니다(화질 92%로 저장).',
      },
      {
        q: '사진이 서버로 올라가나요?',
        a: '아니요. 사진을 열고, 가리고, 저장하는 모든 과정이 이 브라우저 안에서 이루어집니다. 가리려는 개인정보가 담긴 사진도 어디에도 전송되지 않습니다.',
      },
    ],
  },
  en: {
    uses: [
      {
        title: 'Before posting on marketplaces or social media',
        text: 'Hide the name and address on a shipping label, a license plate or the home address on mail before you post a photo. Mark several areas at once and choose a different way to hide each one.',
      },
      {
        title: 'Hide personal details in screenshots',
        text: 'Black out names, phone numbers and account numbers before you share a screenshot of a chat, an order or a bank transfer. No original pixels remain under a blacked-out area, so it cannot be recovered.',
      },
      {
        title: 'Hide faces of other people',
        text: 'If strangers or children appear in a travel or event photo, pixelate or blur their faces with an ellipse. The rest of the photo stays as it is.',
      },
    ],
    howTo: [
      'Click "Choose an image file" or drag a photo onto the page.',
      'Drag on the photo to mark an area to hide. You can mark several areas. With a keyboard, click "Add area" and move it with the arrow keys.',
      'Under How to hide, choose mosaic, blur or black out, and set the strength for mosaic and blur. Choose "Black out" for information that must stay hidden.',
      'Choose a format and click "Download image".',
    ],
    faq: [
      {
        q: 'Can mosaic or blur be undone?',
        a: 'It can. Blur only mixes the original pixels softly, so software can sometimes make blurred text readable again, and fine mosaic can be guessed if the font and number of characters are known. For information that must stay hidden, such as license plates, phone numbers or ID numbers, choose "Black out". It turns every pixel in the area black, so the original content does not remain in the result.',
      },
      {
        q: 'Does the downloaded file still contain what I hid?',
        a: 'No. The photo is redrawn at full size and the pixels in each area are replaced before saving, so the hidden areas contain only the new pixels. Embedded thumbnails and photo information (EXIF) from the original are not copied either. The original file you chose is not changed, so make sure to post the result file.',
      },
      {
        q: 'Does it find faces or license plates automatically?',
        a: 'For now you mark them yourself. What needs hiding differs in every photo, and checking each area as you mark it keeps you from missing one. For a group photo with many faces, add several areas with "Add area" and move them into place.',
      },
      {
        q: 'How is the mosaic strength decided?',
        a: 'Higher strength means bigger blocks. The block size follows the shorter side of the area (strength 5 is one eighth of it), so the number of blocks stays about the same when you resize the area. The actual block size of the selected area is shown in pixels next to the slider.',
      },
      {
        q: 'Does quality drop outside the hidden areas?',
        a: 'If you save as PNG, the pixels outside the areas are exactly the original. JPG and WebP are saved again, so they may lose a tiny bit of quality (saved at 92% quality).',
      },
      {
        q: 'Are my photos uploaded?',
        a: 'No. Opening, hiding and saving all happen in this browser. Photos with the personal details you want to hide are never sent anywhere.',
      },
    ],
  },
});
