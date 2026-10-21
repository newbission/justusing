import { defineContent } from '../../types';

export default defineContent({
  ko: {
    uses: [
      {
        title: '여권을 온라인으로 신청할 때',
        text: '정부24 여권 재발급은 사진 파일(413×531 픽셀, 500KB 이하)을 올려야 합니다. 집에서 흰 벽 앞에서 찍은 사진을 이 크기에 맞게 잘라 바로 올릴 파일로 받습니다.',
      },
      {
        title: '찍어 둔 증명사진 파일을 다시 맞출 때',
        text: '사진관에서 받은 원본 파일이 규격보다 크게 찍혔거나 조금 기울어져 있을 때, 얼굴을 다시 찾아 머리 길이 3.2~3.6cm에 맞춰 자르고 기울기를 바로잡습니다.',
      },
      {
        title: '입사 지원서·원서에 넣을 사진',
        text: '지원서 양식에 3.5×4.5 비율 사진을 넣어야 할 때 쓸 수 있습니다. 집 벽 앞에서 찍었다면 배경을 흰색이나 하늘색으로 바꾸고, 얼굴이 가운데 오도록 맞춘 JPG를 받아 양식에 붙입니다.',
      },
    ],
    howTo: [
      '"사진 선택"을 누르거나 사진을 화면으로 끌어다 놓습니다. 흰 배경 앞에서 정면을 보고 찍은 사진이 좋습니다.',
      '처음 쓸 때는 "데이터 받기"로 얼굴 찾기 데이터를 받습니다. 받기 전에 크기를 알려 드리고, 받지 않으면 칸을 직접 맞출 수 있습니다.',
      '얼굴을 찾으면 머리 끝이 점선에, 턱이 초록 띠 안에 오도록 저절로 자르고 기울기를 바로잡습니다. 사진을 끌거나 "크게"·"작게"와 방향 버튼으로 조금씩 고칩니다. 앞 카메라로 찍어 좌우가 뒤집혔으면 "좌우 반전"을 누릅니다.',
      '배경을 바꾸려면 "배경"에서 "흰색"·"연한 회색"·"하늘색"이나 "다른 색"을 고릅니다. 여권에 낼 사진은 "원래대로" 두세요.',
      '"확인할 것"에 적힌 내용을 살펴보고 "JPG 다운로드"를 눌러 413×531 JPG를 받습니다.',
    ],
    faq: [
      {
        q: '여권·주민등록증에 그대로 쓸 수 있나요?',
        a: '크기와 머리 길이는 외교부 여권 사진 기준(3.5×4.5cm, 정수리부터 턱까지 3.2~3.6cm)에 맞춥니다. 주민등록증도 여권 규격 사진을 받습니다. 다만 배경·조명·표정·안경 같은 다른 조건은 사진을 찍을 때 정해지므로, 받아 주는지는 접수하는 곳이 정합니다. 화면의 확인 결과는 참고용입니다.',
      },
      {
        q: '배경을 흰색으로 바꿀 수 있나요?',
        a: '네. "배경"에서 색을 고르면 사람과 배경을 이 기기 안에서 나눠 배경만 바꿉니다. 다만 여권 사진 규정은 배경을 지우거나 합성한 사진을 받지 않으므로, 여권에는 흰 벽 앞에서 찍은 원래 사진을 쓰세요. 지원서처럼 규정이 없는 곳에 쓰기 좋습니다. 얼굴은 어느 경우에도 고치지 않습니다.',
      },
      {
        q: '사진의 좌우가 뒤집혀 보여요.',
        a: '휴대폰 앞 카메라는 화면에 거울처럼 보여 주고, 저장할 때는 뒤집지 않거나(아이폰 기본) 뒤집어 저장하기도 합니다. 그래서 찍을 때 본 모습과 좌우가 달라 보일 수 있습니다. "좌우 반전"을 누르면 결과 사진의 좌우가 바뀝니다. 가르마나 점의 위치를 보고 실제 모습과 같은 쪽으로 맞추세요.',
      },
      {
        q: '얼굴 찾기 데이터는 무엇인가요?',
        a: '사진에서 눈·코·턱의 위치를 찾는 인식 엔진과 모델(Google MediaPipe)입니다. 처음 한 번 받아 이 브라우저에 보관하고 다음부터 바로 씁니다. 얼굴은 이 기기 안에서만 찾고, 사진이나 찾은 결과는 어디로도 보내지 않습니다.',
      },
      {
        q: '정수리 위치가 맞지 않아요.',
        a: '정수리는 이마 위로 올라가며 배경과 다른 색(머리카락)이 끝나는 곳으로 찾습니다. 배경이 고르지 않거나 머리카락이 배경과 비슷한 색이면 얼굴 비율로 어림하고 "확인할 것"에 알려 드립니다. 그럴 때는 "크게"·"작게"와 방향 버튼으로 머리 끝을 점선에 맞춰 주세요.',
      },
      {
        q: '인쇄해서 쓸 수도 있나요?',
        a: '받은 413×531 JPG는 3.5×4.5cm로 인쇄하면 300 DPI가 되어 인화에도 충분한 크기입니다. 사진관·인화 서비스에 맡길 때는 3.5×4.5cm 크기로 뽑아 달라고 하면 됩니다.',
      },
    ],
  },
  en: {
    uses: [
      {
        title: 'Applying for a Korean passport online',
        text: 'Online passport applications in Korea ask for a photo file of 413×531 pixels and at most 500 KB. Crop a photo taken in front of a white wall at home to that size and download a file ready to upload.',
      },
      {
        title: 'Refitting an ID photo file you already have',
        text: 'If the file from a photo studio is framed too large or slightly tilted, find the face again, crop it so the head is 32–36 mm long and straighten the tilt.',
      },
      {
        title: 'Photos for job and school applications',
        text: 'Use it when a form needs a photo in the 35×45 ratio. If you took it against a wall at home, change the background to white or sky blue, then download a JPG with the face centered and paste it into the form.',
      },
    ],
    howTo: [
      'Click "Choose photo" or drag a photo onto the screen. A photo taken facing the camera in front of a white background works best.',
      'The first time, use "Download data" to get the face finding data. You see its size before downloading, and you can fit the frame yourself without it.',
      'Once a face is found, the photo is cropped and straightened so the top of the head sits on the dashed line and the chin falls inside the green band. Drag the photo or use "Larger", "Smaller" and the direction buttons to fine-tune it. If the front camera left the photo mirrored, click "Flip horizontally".',
      'To change the background, choose "White", "Light gray", "Sky blue" or "Other color" under "Background". Keep "Original" for a passport photo.',
      'Read "Things to check" and click "Download JPG" to get a 413×531 JPG.',
    ],
    faq: [
      {
        q: 'Can I use it for a passport or ID card as is?',
        a: 'The size and head length follow the Korean passport photo rules (35×45 mm, 32–36 mm from the top of the head to the chin), which Korean resident ID cards also accept. Other conditions such as background, lighting, expression and glasses are set when the photo is taken, so the office you submit to decides whether it is accepted. The checks on screen are for reference.',
      },
      {
        q: 'Can it make the background white?',
        a: 'Yes. Choose a color under "Background" and you are separated from the background on this device, then only the background is changed. Passport photo rules do not accept photos with a removed or composited background, though, so use an original photo taken in front of a white wall for a passport. It suits forms without such rules, like job applications. Your face is never retouched.',
      },
      {
        q: 'My photo looks mirrored.',
        a: 'Phone front cameras show a mirror image on screen, then save it either unmirrored (the iPhone default) or mirrored. So the photo can look flipped compared with what you saw. Click "Flip horizontally" to flip the result. Check the side of your parting or a mole to match how you really look.',
      },
      {
        q: 'What is the face finding data?',
        a: 'It is a recognition engine and model (Google MediaPipe) that find the eyes, nose and chin in a photo. It is downloaded once and kept in this browser for next time. The face is found only on this device, and neither the photo nor the result is sent anywhere.',
      },
      {
        q: 'The top of the head is in the wrong place.',
        a: 'The top of the head is found by moving up from the forehead until the color that differs from the background (the hair) ends. If the background is uneven or the hair is close to the background color, it is estimated from the face proportions and noted under "Things to check". In that case, use "Larger", "Smaller" and the direction buttons to put the top of the head on the dashed line.',
      },
      {
        q: 'Can I print it?',
        a: 'Printed at 35×45 mm, the 413×531 JPG is 300 DPI, which is enough for photo prints. When ordering prints, ask for a 35×45 mm print.',
      },
    ],
  },
});
