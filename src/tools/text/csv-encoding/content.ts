import { defineContent } from '../../types';

export default defineContent({
  ko: {
    uses: [
      {
        title: '받은 CSV가 엑셀에서 깨질 때',
        text: '쇼핑몰 관리자 화면이나 웹 서비스에서 내려받은 주문·회원 목록 CSV를 엑셀에서 두 번 눌러 열었더니 한글이 "媛쒖씤" 같은 글자로 나온다면, 엑셀용 UTF-8(BOM 포함)로 바꾸면 바로 열립니다.',
      },
      {
        title: '은행·관공서 CSV를 맥이나 구글 시트에서',
        text: '은행 거래내역이나 공공데이터처럼 CP949(EUC-KR)로 저장된 CSV는 맥 Numbers나 구글 시트에서 한글이 �로 보입니다. UTF-8로 바꾸면 어디서나 제대로 열립니다.',
      },
      {
        title: 'CP949만 받는 시스템에 올릴 때',
        text: '대량 등록 양식처럼 예전 시스템이 CP949 파일만 받는 경우가 있습니다. UTF-8 CSV를 CP949로 바꾸고, CP949에 없는 글자(이모지 등)가 어느 줄에 있는지 미리 확인합니다.',
      },
    ],
    howTo: [
      '"CSV 파일 선택" 버튼을 누르거나 CSV·TSV·TXT 파일을 화면으로 끌어다 놓습니다. 여러 개를 한 번에 넣을 수 있습니다.',
      '파일마다 원래 인코딩을 자동으로 알아내고, 미리보기에서 지금 열리는 모습과 바꾼 뒤의 모습을 함께 보여 줍니다. 글자가 바르게 보이지 않으면 원본 인코딩을 직접 고릅니다.',
      '저장 형식을 고릅니다. 엑셀에서 열 파일이면 "엑셀용 UTF-8 (BOM 포함)"을 그대로 두세요. 필요하면 줄바꿈도 고릅니다.',
      '"변환하기"를 누른 뒤 "다운로드"로 받습니다. 여러 파일은 ZIP 하나로 받습니다.',
    ],
    faq: [
      {
        q: '왜 엑셀에서만 한글이 깨지나요?',
        a: 'CSV 파일에는 어떤 인코딩으로 쓴 것인지 적는 자리가 없습니다. 한국어 윈도우의 엑셀은 표시(BOM)가 없는 CSV를 CP949로 읽기 때문에, UTF-8로 저장된 CSV의 한글이 엉뚱한 글자로 나옵니다. 파일 맨 앞에 UTF-8 표시(BOM)를 붙이면 엑셀도 UTF-8로 읽습니다.',
      },
      {
        q: '인코딩을 잘못 알아내면 어떻게 하나요?',
        a: '자동 판단은 파일의 바이트가 각 인코딩의 규칙에 맞는지와 한글이 얼마나 나오는지를 보고 정합니다. 미리보기의 "바꾼 뒤" 표에 글자가 바르게 보이지 않으면 원본 인코딩 목록에서 다른 것을 골라 보세요. 표가 바로 바뀝니다.',
      },
      {
        q: 'CP949로 저장하면 글자가 빠질 수 있나요?',
        a: 'CP949는 한글 11,172자와 영문·한자 일부만 담을 수 있어 이모지나 일부 외국 글자는 ?로 바뀝니다. 바뀐 글자 수와 처음 몇 개의 글자·줄 번호를 알려 드리니, 그대로 두어야 하면 UTF-8로 저장하세요.',
      },
      {
        q: '큰 파일도 되나요? 내용이 바뀌지는 않나요?',
        a: '파일을 조금씩 읽어 바꾸므로 수백 MB 파일도 화면이 멈추지 않습니다(기기 메모리에 따라 다름). 글자와 쉼표·따옴표는 그대로 두고 인코딩만 바꾸며, 줄바꿈은 고른 경우에만 바꿉니다.',
      },
    ],
  },
  en: {
    uses: [
      {
        title: 'An exported CSV looks garbled in Excel',
        text: 'You download an order or customer list as CSV from a store dashboard or web app, and Excel shows names like "JosÃ©" instead of "José". Save it as UTF-8 with BOM and it opens correctly with a double-click.',
      },
      {
        title: 'Older CSVs in Google Sheets or Numbers',
        text: 'CSVs saved by older software in Windows-1252 or another legacy encoding show � in Google Sheets and Numbers, which expect UTF-8. Convert them to UTF-8 and they open correctly everywhere.',
      },
      {
        title: 'Uploading to a system that needs a legacy encoding',
        text: 'Some older Korean systems only accept CP949 files. Convert a UTF-8 CSV to CP949 and see in advance which lines contain characters CP949 cannot hold, such as emoji.',
      },
    ],
    howTo: [
      'Click "Choose CSV files" or drag CSV, TSV or TXT files onto the screen. You can add several at once.',
      'The original encoding of each file is detected, and the preview shows how it opens now next to how it will look after converting. If the text does not look right, pick the original encoding yourself.',
      'Choose how to save it. For files you will open in Excel, keep "UTF-8 with BOM (for Excel)". Choose line breaks too if you need to.',
      'Click "Convert", then "Download". Several files come as one ZIP.',
    ],
    faq: [
      {
        q: 'Why does the text only look wrong in Excel?',
        a: 'A CSV file has no place to say which encoding it uses. Excel on Windows reads a CSV without a byte order mark (BOM) in the system code page, such as Windows-1252, so accented letters and non-Latin text in a UTF-8 CSV come out wrong. Adding the UTF-8 BOM at the start makes Excel read it as UTF-8.',
      },
      {
        q: 'What if the encoding is detected wrong?',
        a: 'Detection checks whether the bytes follow each encoding’s rules and what kind of characters appear. If the "After converting" table does not look right, pick another original encoding from the list and the table updates right away.',
      },
      {
        q: 'Can saving as CP949 lose characters?',
        a: 'CP949 holds Korean, English and some other characters only, so emoji and many other characters become ?. The tool tells you how many changed and shows the first few with their line numbers. Save as UTF-8 to keep them.',
      },
      {
        q: 'Does it work with large files? Does it change my data?',
        a: 'Files are read and converted piece by piece, so even files of hundreds of MB do not freeze the page (depending on your device’s memory). Only the encoding changes; text, commas and quotes stay as they are, and line breaks change only if you choose so.',
      },
    ],
  },
});
