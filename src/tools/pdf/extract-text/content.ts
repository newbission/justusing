import { defineContent } from '../../types';

export default defineContent({
  ko: {
    howTo: [
      '"PDF 파일 선택" 버튼을 누르거나 글자를 뽑을 PDF를 화면으로 끌어다 놓습니다.',
      '열자마자 모든 쪽의 글자를 읽어 아래 칸에 보여 줍니다. 필요한 부분만 골라 복사할 수 있습니다.',
      '파일로 받으려면 "TXT 다운로드"를 누릅니다. 쪽마다 "--- 1쪽 ---" 같은 구분 줄이 들어갑니다.',
    ],
    faq: [
      {
        q: '스캔한 PDF에서도 글자를 뽑을 수 있나요?',
        a: '아니요. 스캔한 PDF는 글자가 그림으로 들어 있어 뽑을 글자가 없습니다. 그림 속 글자를 읽는 기능(OCR)은 아직 없습니다.',
      },
      {
        q: '표나 여러 단으로 된 문서는 어떻게 나오나요?',
        a: 'PDF에 글자가 저장된 순서대로 이어 붙입니다. 표의 칸이나 단의 배치는 그대로 살리지 못해 순서가 섞일 수 있습니다.',
      },
      {
        q: '한글이 깨지지 않나요?',
        a: '한글도 그대로 뽑힙니다. 받은 TXT 파일은 UTF-8로 저장되어 메모장 등에서 바로 열립니다. 일부 PDF는 글자 정보가 빠져 있어 엉뚱한 글자로 나올 수 있습니다.',
      },
    ],
  },
  en: {
    howTo: [
      'Click "Choose PDF file" or drag the PDF you want to extract text from onto the screen.',
      'The text of every page is read right away and shown in the box below. You can select and copy just the part you need.',
      'To save it as a file, click "Download TXT". Each page starts with a line such as "--- Page 1 ---".',
    ],
    faq: [
      {
        q: 'Can I extract text from a scanned PDF?',
        a: 'No. In a scanned PDF the text is part of an image, so there is no text to extract. Reading text from images (OCR) is not available yet.',
      },
      {
        q: 'What happens with tables or multi-column documents?',
        a: 'Text is joined in the order it is stored in the PDF. Table cells and columns are not preserved, so the order may be mixed up.',
      },
      {
        q: 'Are non-English characters preserved?',
        a: 'Yes. The TXT file is saved as UTF-8 and opens directly in Notepad and other editors. Some PDFs lack character information, so a few characters may come out wrong.',
      },
    ],
  },
});
