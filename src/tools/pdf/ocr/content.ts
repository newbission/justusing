import { defineContent } from '../../types';

export default defineContent({
  ko: {
    uses: [
      {
        title: '스캔한 서류에서 글자 찾기',
        text: '스캔해 둔 계약서나 공문은 그림이라 이름이나 금액을 검색해도 찾지 못합니다. 글자를 인식해 두면 PDF 보기 프로그램에서 원하는 낱말로 찾을 수 있습니다.',
      },
      {
        title: '종이 문서 내용을 복사해 쓰기',
        text: '인쇄물로만 받은 안내문이나 자료의 문장을 보고서에 옮겨야 할 때 다시 타자하지 않고 복사합니다. "TXT 다운로드"로 글자만 따로 받을 수도 있습니다.',
      },
      {
        title: '스캔 자료를 소리 내어 읽기',
        text: '스캔한 PDF는 화면 읽기 프로그램이 읽지 못합니다. 보이지 않는 글자를 겹쳐 넣으면 쪽 모습은 그대로 두고 소리 내어 읽기로 들을 수 있습니다. 한국어와 영어를 읽습니다.',
      },
    ],
    howTo: [
      '"PDF 파일 선택" 버튼을 누르거나 스캔한 PDF를 화면으로 끌어다 놓습니다.',
      '인식할 언어(한국어·영어)를 고릅니다.',
      '처음 쓸 때는 "데이터 받기"로 글자 인식 데이터를 받습니다. 받기 전에 크기를 알려 드립니다.',
      '"글자 인식"을 누르고 기다립니다. 쪽마다 진행 상황이 보입니다.',
      '완료되면 "PDF 다운로드"로 글자를 찾고 복사할 수 있는 PDF를, "TXT 다운로드"로 글자만 받습니다.',
    ],
    faq: [
      {
        q: '글자 인식(OCR)은 무엇인가요?',
        a: '스캔하거나 사진으로 만든 PDF는 쪽 전체가 그림이라 글자를 찾거나 복사할 수 없습니다. 글자 인식은 그림 속 글자를 읽어, 원래 쪽 위에 보이지 않는 글자를 겹쳐 넣습니다. 쪽 모습은 그대로이고, 글자 찾기·복사·소리 내어 읽기가 됩니다.',
      },
      {
        q: '데이터를 왜 받아야 하나요?',
        a: '글자를 읽는 엔진과 언어 데이터가 필요합니다(한국어+영어 약 7MB). 이 사이트에서 받는 공개 파일이고, 처음 한 번 받으면 이 브라우저에 보관되어 다음부터 바로 씁니다. 다른 브라우저·기기, 시크릿 창에서는 다시 받아야 하고, 브라우저 데이터를 지우면 사라집니다. 보관본이 지워지면 몰래 다시 받지 않고 다시 여쭙니다.',
      },
      {
        q: '얼마나 정확한가요?',
        a: '또렷하게 스캔한 인쇄물은 대부분 정확히 읽습니다. 흐리거나 기울어진 스캔, 손글씨, 아주 작은 글자, 표·도장이 겹친 곳은 틀릴 수 있습니다. 중요한 내용은 결과를 확인하세요. 원래 쪽 모습은 바뀌지 않으므로 틀린 글자가 화면에 보이지는 않습니다.',
      },
      {
        q: '오래 걸립니다.',
        a: '쪽마다 그림을 크게 그려 글자를 하나하나 읽기 때문에 쪽당 몇 초씩 걸립니다. 기기의 CPU 수에 맞춰 여러 쪽을 함께 읽습니다. 휴대폰에서는 더 오래 걸리고 메모리가 모자라면 멈출 수 있으니, 쪽이 많으면 PC에서 하세요.',
      },
      {
        q: '"글자가 이미 있는 쪽은 건너뛰기"는 무엇인가요?',
        a: '워드에서 만든 PDF처럼 이미 본문 글자를 고를 수 있는 쪽은 다시 읽지 않습니다. 스캔한 쪽에 쪽 번호나 워터마크 정도만 글자로 들어 있으면 다시 읽습니다. 스캔한 쪽과 섞인 PDF에서 시간을 아끼고, 글자가 두 겹으로 들어가는 것을 막습니다.',
      },
      {
        q: '파일이 정말 업로드되지 않나요?',
        a: '네. 받는 것은 인식 엔진과 언어 데이터뿐이고, PDF와 읽은 글자는 이 기기 안에서만 다룹니다. 인식 엔진은 Tesseract(Apache 2.0 허가서)를 씁니다.',
      },
    ],
  },
  en: {
    uses: [
      {
        title: 'Search a scanned document',
        text: 'A scanned contract or letter is just a picture, so searching for a name or amount finds nothing. After text recognition you can search it for any word in your PDF viewer.',
      },
      {
        title: 'Copy text from paper documents',
        text: 'When you need a passage from a printed handout or report, copy it instead of retyping it. "Download TXT" gives you the text alone.',
      },
      {
        title: 'Make scans readable aloud',
        text: 'Screen readers cannot read a scanned PDF. Adding invisible text keeps the page looking the same while read-aloud works. English and Korean are supported.',
      },
    ],
    howTo: [
      'Click "Choose PDF file" or drag your scanned PDF onto the screen.',
      'Choose the languages to recognize (English, Korean).',
      'The first time, click "Download data" to get the text recognition data. You will see the size before downloading.',
      'Click "Recognize text" and wait. Progress is shown page by page.',
      'When it is done, click "Download PDF" for a searchable, copyable PDF, or "Download TXT" for the text alone.',
    ],
    faq: [
      {
        q: 'What is OCR?',
        a: 'In a scanned or photographed PDF, each page is a picture, so you cannot search or copy the text. OCR (optical character recognition) reads the text in the picture and adds invisible text on top of the original page. The page looks the same, but you can search, copy and use read-aloud.',
      },
      {
        q: 'Why do I need to download data?',
        a: 'Recognizing text needs an engine and language data (about 6 MB for English, 7 MB with Korean). These are public files from this site. Once downloaded they are kept in this browser, so they are ready next time. Other browsers, devices and private windows need to download them again, and clearing browser data removes them. If the stored copy is removed, we ask again instead of downloading silently.',
      },
      {
        q: 'How accurate is it?',
        a: 'Clean scans of printed text are mostly read correctly. Blurry or skewed scans, handwriting, very small text and areas covered by tables or stamps may have mistakes, so check important content. The original page image is not changed, so mistakes are not visible on the page.',
      },
      {
        q: 'It takes a long time.',
        a: 'Each page is drawn at high resolution and read character by character, so it takes a few seconds per page. Several pages are read at once, depending on your CPU. Phones are slower and may stop if they run out of memory, so use a computer for long documents.',
      },
      {
        q: 'What does "Skip pages that already have text" do?',
        a: 'Pages whose body text can already be selected, such as PDFs saved from Word, are not read again. Scanned pages with only a page number or watermark as text are still read. This saves time on PDFs that mix scanned and digital pages, and avoids adding the text twice.',
      },
      {
        q: 'Is my file really not uploaded?',
        a: 'Yes. Only the recognition engine and language data are downloaded. Your PDF and the recognized text stay on this device. The recognition engine is Tesseract (Apache License 2.0).',
      },
    ],
  },
});
