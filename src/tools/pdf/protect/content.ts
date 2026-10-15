import { defineContent } from '../../types';

export default defineContent({
  ko: {
    howTo: [
      '"PDF 파일 선택" 버튼을 누르거나 암호를 걸 PDF를 화면으로 끌어다 놓습니다.',
      '"새 암호"와 "암호 확인"에 같은 암호를 입력합니다.',
      '"암호 걸기"를 누릅니다.',
      '완료되면 "다운로드"를 누릅니다. 받은 PDF는 열 때 암호를 묻습니다.',
    ],
    faq: [
      {
        q: '어떤 방식으로 암호를 거나요?',
        a: 'PDF 표준의 AES-256 암호화를 씁니다. Adobe Acrobat, 브라우저, 휴대폰의 PDF 보기 앱 등 대부분의 프로그램에서 암호를 넣고 열 수 있습니다.',
      },
      {
        q: '암호를 잊으면 어떻게 되나요?',
        a: '그 PDF는 열 수 없습니다. 암호는 어디에도 저장되지 않아 저희도 되찾아 드릴 수 없습니다. 원본 PDF를 따로 보관해 두세요.',
      },
      {
        q: '암호가 서버로 전송되나요?',
        a: '아니요. 파일과 암호 모두 이 기기 안에서만 처리되고 어디로도 전송되지 않습니다.',
      },
      {
        q: '이미 암호가 걸린 PDF의 암호를 바꿀 수 있나요?',
        a: '네. 파일을 열 때 지금 암호를 입력한 뒤 새 암호를 걸면 됩니다. 받은 PDF는 새 암호로만 열립니다.',
      },
    ],
  },
  en: {
    howTo: [
      'Click "Choose PDF file" or drag the PDF you want to protect onto the screen.',
      'Enter the same password in "New password" and "Confirm password".',
      'Click "Protect PDF".',
      'When it is done, click "Download". The new PDF asks for the password when opened.',
    ],
    faq: [
      {
        q: 'How is the PDF protected?',
        a: 'It uses AES-256 encryption from the PDF standard. Most programs, including Adobe Acrobat, browsers and phone PDF viewers, can open it once you enter the password.',
      },
      {
        q: 'What if I forget the password?',
        a: 'The PDF cannot be opened. The password is not stored anywhere, so we cannot recover it for you. Keep a copy of the original PDF.',
      },
      {
        q: 'Is my password sent to a server?',
        a: 'No. Both the file and the password are processed only on this device and are never sent anywhere.',
      },
      {
        q: 'Can I change the password of a PDF that is already protected?',
        a: 'Yes. Enter the current password when you open the file, then set a new one. The new PDF only opens with the new password.',
      },
    ],
  },
});
