import { defineContent } from '../../types';

export default defineContent({
  ko: {
    howTo: [
      '"PDF 파일 선택" 버튼을 누르거나 나눌 PDF를 화면으로 끌어다 놓습니다.',
      '나누는 방법을 고릅니다. "범위로 나누기"는 1-3, 4-6, 7처럼 쉼표로 구분한 범위마다 파일 하나를 만들고, "한 장씩 나누기"는 모든 쪽을 따로 만들고, "고른 페이지만"은 누른 페이지만 모아 파일 하나를 만듭니다.',
      '쪽 격자에서 각 쪽이 몇 번째 파일로 가는지 확인한 뒤 "PDF 나누기"를 누릅니다.',
      '완료되면 "다운로드"를 누릅니다. 결과가 여러 개면 ZIP 파일 하나로 받습니다.',
    ],
    faq: [
      {
        q: '범위는 어떻게 입력하나요?',
        a: '쉼표로 구분한 범위마다 파일 하나가 됩니다. 1-3은 1~3쪽, 7은 7쪽 한 장, 5-는 5쪽부터 끝까지, -3은 처음부터 3쪽까지입니다. 1~3처럼 물결표를 써도 되고, 범위끼리 겹쳐도 됩니다.',
      },
      {
        q: '나눈 파일이 여러 개면 어떻게 받나요?',
        a: 'ZIP 파일 하나로 묶어서 받습니다. 압축을 풀면 "원래이름_1-3.pdf"처럼 범위가 붙은 PDF들이 나옵니다. 결과가 하나면 PDF로 바로 받습니다.',
      },
      {
        q: '암호가 걸린 PDF도 나눌 수 있나요?',
        a: '네. 파일을 열 때 암호를 입력하면 됩니다. 나눈 파일에는 암호가 걸리지 않으니 보관에 주의하세요. 입력한 암호는 이 기기 안에서만 쓰입니다.',
      },
      {
        q: '나누면 화질이 떨어지나요?',
        a: '아니요. 페이지를 다시 그리지 않고 원본 PDF의 내용을 그대로 옮겨 담기 때문에 글자·이미지 품질이 그대로입니다.',
      },
    ],
  },
  en: {
    howTo: [
      'Click "Choose PDF file" or drag the PDF you want to split onto the page.',
      'Choose how to split. "Split by range" makes one file for each comma-separated range such as 1-3, 4-6, 7. "Split every page" makes a separate file for each page. "Selected pages only" collects the pages you click into one file.',
      'In the page grid, check which file each page goes to, then click "Split PDF".',
      'When it is done, click "Download". If there are several results, you get a single ZIP file.',
    ],
    faq: [
      {
        q: 'How do I enter ranges?',
        a: 'Each comma-separated range becomes one file. 1-3 means pages 1 to 3, 7 means page 7 only, 5- means page 5 to the end, and -3 means from the first page to page 3. You can also use ~ (1~3), and ranges may overlap.',
      },
      {
        q: 'How do I get the files if there are several?',
        a: 'They are bundled into a single ZIP file. Unzip it to find PDFs named with their range, such as "name_1-3.pdf". If there is only one result, you get the PDF directly.',
      },
      {
        q: 'Can I split password-protected PDFs?',
        a: 'Yes. Enter the password when you open the file. The split files have no password, so keep them somewhere safe. The password is only used on this device.',
      },
      {
        q: 'Does splitting reduce quality?',
        a: 'No. Pages are not redrawn. The content of the original PDF is copied as is, so text and images keep their quality.',
      },
    ],
  },
});
