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
        text: '여행·행사 사진에 모르는 사람이나 아이 얼굴이 찍혔을 때 "얼굴 찾기"로 얼굴들을 한꺼번에 찾아 굵은 모자이크로 가립니다. 가리지 않을 얼굴은 빼고, 놓친 얼굴은 직접 그려 더합니다.',
      },
    ],
    howTo: [
      '"이미지 파일 선택" 버튼을 누르거나 사진을 화면으로 끌어다 놓습니다.',
      '사진 위를 끌어 가릴 곳을 그립니다. 여러 곳을 그릴 수 있고, 키보드로는 "가릴 곳 추가"를 누른 뒤 방향키로 옮깁니다.',
      '얼굴을 가리려면 "얼굴 찾기"를 누릅니다. 처음 한 번은 얼굴 찾기 데이터의 크기를 알려 주고 받을지 묻습니다. 찾은 얼굴이 가릴 곳으로 들어가면 사진을 살펴보고 놓친 얼굴은 직접 그리고, 가리지 않을 곳은 고른 뒤 지웁니다.',
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
        q: '얼굴을 자동으로 찾아 주나요?',
        a: '네. "얼굴 찾기"를 누르면 사진 속 얼굴들을 찾아 머리카락·귀까지 넉넉하게 덮는 타원으로 한꺼번에 넣습니다. 처음 넣을 때는 굵은 모자이크(세기 8)이고, 새로 그릴 곳을 "검게 칠하기"로 골라 두었으면 검게 칠합니다. 단체 사진의 작은 얼굴도 찾도록 사진을 여러 조각으로 나눠 살피지만, 옆모습·아래를 보는 얼굴·손이나 모자로 가려진 얼굴·아주 작은 얼굴은 놓칠 수 있습니다. 결과를 꼭 확인하고 놓친 얼굴은 직접 그려 더하세요. 번호판·글자는 찾지 않으니 직접 그려 가립니다.',
      },
      {
        q: '얼굴 찾기 데이터는 무엇이고 어디에 저장되나요?',
        a: '얼굴을 찾는 인식 엔진과 모델(Google MediaPipe, 처음 받을 때 약 14MB)입니다. "얼굴 찾기"를 처음 누를 때 크기를 알려 주고 받을지 물으며, 누르기 전에는 받지 않습니다. 받은 데이터는 이 브라우저에만 보관해 다음부터는 바로 찾습니다. 증명사진·배경 지우기에서 같은 엔진을 이미 받았으면 얼굴 찾기 모델(약 1MB)만 받습니다. 사진은 데이터를 받을 때도 찾을 때도 어디로도 보내지 않습니다.',
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
        text: 'If strangers or children appear in a travel or event photo, click "Find faces" to find all the faces at once and cover them with a coarse mosaic. Remove the ones you want to keep and draw any missed faces yourself.',
      },
    ],
    howTo: [
      'Click "Choose an image file" or drag a photo onto the page.',
      'Drag on the photo to mark an area to hide. You can mark several areas. With a keyboard, click "Add area" and move it with the arrow keys.',
      'To hide faces, click "Find faces". The first time, it shows the size of the face data and asks before downloading it. The faces it finds are added as areas to hide, so check the photo, draw any missed faces yourself and remove areas you do not want to hide.',
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
        q: 'Does it find faces automatically?',
        a: 'Yes. Click "Find faces" to find the faces in the photo and add them all at once as ellipses that generously cover hair and ears. They start as a coarse mosaic (strength 8), or black out if you chose "Black out" for the next area. It looks at the photo in several smaller pieces to catch small faces in group photos, but it can miss faces in profile, looking down, covered by a hand or hat, or very small. Always check the result and draw any missed faces yourself. It does not find license plates or text, so mark those yourself.',
      },
      {
        q: 'What is the face data, and where is it stored?',
        a: 'It is the recognition engine and model that find faces (Google MediaPipe, about 14MB the first time). The first time you click "Find faces", it shows the size and asks before downloading, and nothing is downloaded before you click. The data is kept only in this browser, so next time faces are found right away. If you already downloaded the same engine for ID photos or background removal, only the face model (about 1MB) is downloaded. Your photo is never sent anywhere, either while downloading the data or while finding faces.',
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
