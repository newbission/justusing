import { defineContent } from '../../types';

export default defineContent({
  ko: {
    uses: [
      {
        title: '매번 묻는 암호 없애기',
        text: '급여명세서나 카드 명세서처럼 열 때마다 암호를 묻는 PDF를, 암호를 한 번 넣어 암호 없는 파일로 저장해 둡니다. 암호를 모르는 파일은 풀 수 없습니다.',
      },
      {
        title: '인쇄·복사 제한 풀기',
        text: '내가 받은 안내 자료가 인쇄나 글자 복사를 막아 두어 쓰기 불편할 때, 열 때 암호를 묻지 않는 PDF라면 암호 없이 제한을 풉니다. 다룰 권리가 있는 파일에만 쓰세요.',
      },
      {
        title: '다른 도구로 다루기 전에',
        text: '암호가 걸린 PDF를 다른 프로그램에 올리거나 다른 사람과 나눌 때 암호를 따로 알려 주기 번거롭다면 먼저 풀어 둡니다. 내용과 화질은 그대로입니다.',
      },
    ],
    howTo: [
      '"PDF 파일 선택" 버튼을 누르거나 암호를 풀 PDF를 화면으로 끌어다 놓습니다.',
      '암호를 묻는 PDF면 암호를 입력하고 "열기"를 누릅니다. 인쇄·복사 제한만 걸린 PDF는 암호 없이 바로 열립니다.',
      '"암호 해제"를 누릅니다.',
      '완료되면 "다운로드"를 누릅니다. 받은 PDF는 암호 없이 열리고 인쇄·복사 제한도 없습니다.',
    ],
    faq: [
      {
        q: '암호를 모르는 PDF도 풀 수 있나요?',
        a: '아니요. 열 때 암호를 묻는 PDF는 그 암호를 알아야 풀 수 있습니다. 암호를 알아내는 기능은 없습니다. 열 때 암호를 묻지 않고 인쇄·복사만 막아 둔 PDF는 암호 없이 제한을 풀 수 있습니다.',
      },
      {
        q: '입력한 암호는 어디에 저장되나요?',
        a: '어디에도 저장되지 않습니다. 암호는 이 기기 안에서 파일을 여는 데만 쓰이고, 페이지를 닫으면 사라집니다.',
      },
      {
        q: '내용이 바뀌거나 화질이 떨어지나요?',
        a: '아니요. 암호만 걷어 내고 쪽·글자·이미지는 원본 그대로 저장합니다.',
      },
      {
        q: '다른 사람의 PDF도 풀어도 되나요?',
        a: '내 파일이거나 다룰 권리가 있는 파일에만 쓰세요. 제한을 건 사람의 뜻이나 저작권을 어기는 데 쓰면 안 됩니다.',
      },
    ],
  },
  en: {
    uses: [
      {
        title: 'Stop typing the password every time',
        text: 'Pay slips and card statements often ask for a password each time you open them. Enter it once and save a copy without a password. A password you do not know cannot be removed.',
      },
      {
        title: 'Remove print and copy restrictions',
        text: 'If a PDF you received blocks printing or copying text but opens without a password, remove those restrictions. Only use it on files you have the right to handle.',
      },
      {
        title: 'Before sharing or further editing',
        text: 'Unlock a protected PDF before sending it to someone or opening it in another program, so you do not have to pass the password along. Content and quality stay the same.',
      },
    ],
    howTo: [
      'Click "Choose PDF file" or drag the PDF you want to unlock onto the screen.',
      'If the PDF asks for a password, enter it and click "Open". A PDF that only restricts printing or copying opens without a password.',
      'Click "Unlock PDF".',
      'When it is done, click "Download". The new PDF opens without a password and has no printing or copying restrictions.',
    ],
    faq: [
      {
        q: 'Can I unlock a PDF if I do not know the password?',
        a: 'No. A PDF that asks for a password when opened can only be unlocked with that password. There is no feature for guessing passwords. A PDF that opens without a password but blocks printing or copying can have those restrictions removed.',
      },
      {
        q: 'Where is the password I enter stored?',
        a: 'Nowhere. The password is only used on this device to open the file, and it is gone when you close the page.',
      },
      {
        q: 'Will the content change or lose quality?',
        a: 'No. Only the protection is removed. Pages, text and images are saved exactly as they were.',
      },
      {
        q: "Can I unlock someone else's PDF?",
        a: 'Only use this on files you own or have the right to handle. Do not use it to go against the wishes of the person who set the restrictions or to infringe copyright.',
      },
    ],
  },
});
