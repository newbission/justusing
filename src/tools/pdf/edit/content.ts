import { defineContent } from '../../types';

export default defineContent({
  ko: {
    uses: [
      {
        title: '틀린 날짜·오타 고쳐 쓰기',
        text: '안내문이나 견적서의 날짜·오타를 "흰색으로 가리기"로 덮고 그 위에 "글자 넣기"로 고쳐 씁니다. 아래 글자는 파일에 남으므로 보이는 모습만 고치는 방법입니다.',
      },
      {
        title: '인쇄용 서류 빈칸에 적기',
        text: '입력 칸 없이 인쇄용으로 만든 신청서나 확인서에 이름·날짜를 원하는 자리에 적어 넣습니다. 한글 글꼴을 골라 쓸 수 있어 손으로 써서 스캔하지 않아도 됩니다.',
      },
      {
        title: '봐야 할 곳에 형광펜',
        text: '계약서나 자료를 넘길 때 꼭 읽어야 할 조항에 "형광펜"을 칠해 두면 받는 사람이 바로 찾습니다. 옆에 "글자 넣기"로 짧은 메모를 붙일 수도 있습니다.',
      },
    ],
    howTo: [
      '"PDF 파일 선택" 버튼을 누르거나 고칠 PDF를 화면으로 끌어다 놓습니다.',
      '위의 도구에서 "글자 넣기"를 고르고 쪽 위의 넣을 자리를 누른 뒤, 아래 칸에 글자를 적습니다. 처음이면 아래 글꼴 목록에서 글꼴을 받습니다.',
      '"흰색으로 가리기"나 "형광펜"을 고르고 쪽 위를 끌어 사각형을 그립니다.',
      '"고르기·옮기기"로 넣은 것을 눌러 끌어 옮기고, 아래에서 글자·크기·색을 고치거나 지웁니다. ‹ › 버튼으로 쪽을 바꿉니다.',
      '"편집한 PDF 만들기"를 누르고, 완료되면 "다운로드"를 누릅니다.',
    ],
    faq: [
      {
        q: '원래 있던 글자를 고칠 수 있나요?',
        a: 'PDF 안의 원래 글자를 직접 고치지는 못합니다. 대신 고칠 부분을 "흰색으로 가리기"로 덮고 그 위에 "글자 넣기"로 새 글자를 쓰면 고친 것처럼 만들 수 있습니다. 가린 자리에 넣은 글자는 흰 사각형 위에 그려집니다.',
      },
      {
        q: '흰색으로 가리면 아래 내용이 지워지나요?',
        a: '아니요. 흰 사각형을 위에 덮을 뿐이라 아래 글자는 파일에 그대로 남아, 복사하거나 검색하면 드러날 수 있습니다. 주민등록번호 같은 개인정보를 없애는 용도로는 쓰지 마세요.',
      },
      {
        q: '서명이나 도장도 넣을 수 있나요?',
        a: '서명은 "PDF 서명 넣기", 도장·로고 같은 이미지는 "PDF 이미지 넣기" 도구를 쓰세요. 이 도구는 글자·가리기·형광펜을 다룹니다.',
      },
      {
        q: '글꼴은 왜 받아야 하나요?',
        a: 'PDF에 한글을 넣으려면 글꼴 파일이 필요합니다. 글자를 넣을 때만 필요하고, 가리기·형광펜만 쓸 때는 받지 않아도 됩니다. 받은 글꼴은 이 브라우저에 보관되어 다음부터 바로 쓰고, PDF에는 쓴 글자만 들어가 파일이 거의 커지지 않습니다.',
      },
      {
        q: '키보드로도 옮길 수 있나요?',
        a: '네. 넣은 것을 Tab 키로 고른 뒤 화살표 키로 옮기고(Shift를 함께 누르면 크게), Delete 키로 지웁니다.',
      },
    ],
  },
  en: {
    uses: [
      {
        title: 'Fix a wrong date or typo',
        text: 'Cover the wrong date or typo with "White out" and write the correction on top with "Add text". The text underneath stays in the file, so this only changes how the page looks.',
      },
      {
        title: 'Fill in a print-only form',
        text: 'Type your name or a date anywhere on an application made only for printing, with no fields. No need to print it, write by hand and scan it back.',
      },
      {
        title: 'Highlight what matters',
        text: 'Mark the clauses someone must read in a contract or handout with "Highlight" so they find them right away. You can add a short note next to them with "Add text".',
      },
    ],
    howTo: [
      'Click "Choose PDF file" or drag the PDF you want to edit onto the screen.',
      'Choose "Add text" above, click where the text should go, and type it in the box below. The first time, download a font from the list below.',
      'Choose "White out" or "Highlight" and drag on the page to draw a rectangle.',
      'With "Select & move", click something you added and drag to move it. Edit its text, size and color, or delete it, below. Use ‹ › to change pages.',
      'Click "Create edited PDF", then "Download" when it is done.',
    ],
    faq: [
      {
        q: 'Can I change the text that is already in the PDF?',
        a: 'The original text cannot be edited directly. Instead, cover it with "White out" and write new text on top with "Add text". Text added over a white-out is drawn on top of it.',
      },
      {
        q: 'Does white out remove what is underneath?',
        a: 'No. It only places a white rectangle on top, so the text underneath stays in the file and can show up when copied or searched. Do not use it to remove personal information such as ID numbers.',
      },
      {
        q: 'Can I add a signature or a stamp?',
        a: 'Use "Sign PDF" for signatures and "Add Image to PDF" for stamps or logos. This tool handles text, white out and highlights.',
      },
      {
        q: 'Why do I need to download a font?',
        a: 'Text in a PDF needs a font file. It is only needed for adding text; white out and highlights work without it. Downloaded fonts are kept in this browser for next time, and only the characters you use are embedded, so the file barely grows.',
      },
      {
        q: 'Can I move things with the keyboard?',
        a: 'Yes. Select an item with Tab, move it with the arrow keys (hold Shift for bigger steps), and delete it with Delete.',
      },
    ],
  },
});
