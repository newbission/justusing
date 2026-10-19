import { defineContent } from '../../types';

export default defineContent({
  ko: {
    uses: [
      {
        title: '개인정보가 담긴 서류 보내기',
        text: '주민등록번호나 계좌번호가 적힌 서류를 메일로 보낼 때 열기 암호를 걸어 둡니다. 암호는 메일과 따로 문자나 전화로 알려 주면 더 안전합니다.',
      },
      {
        title: '급여명세서·인사 자료 공유',
        text: '급여나 평가처럼 아무나 보면 안 되는 회사 문서를 공유 폴더나 메신저에 올리기 전에 암호를 걸어, 암호를 아는 사람만 열게 합니다.',
      },
      {
        title: '예전 암호 바꾸기',
        text: '이미 암호가 걸린 PDF를 지금 암호로 연 뒤 새 암호를 걸어 저장합니다. 담당자가 바뀌어 예전 암호를 더 쓰지 않을 때 씁니다.',
      },
    ],
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
    uses: [
      {
        title: 'Email a document with personal details',
        text: 'Add an open password before emailing a document that shows ID or account numbers. Sharing the password separately, by text or phone, keeps it safer.',
      },
      {
        title: 'Share payroll or HR files',
        text: 'Before putting pay slips, reviews or other confidential files in a shared folder or chat, add a password so only people who know it can open them.',
      },
      {
        title: 'Change an old password',
        text: 'Open a protected PDF with its current password and save it with a new one. Useful when the old password has been shared too widely.',
      },
    ],
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
