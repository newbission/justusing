import { defineContent } from '../../types';

export default defineContent({
  ko: {
    howTo: [
      '"PDF 파일 선택" 버튼을 누르거나 워터마크를 넣을 PDF를 화면으로 끌어다 놓습니다.',
      '"넣을 글자"에 워터마크 글자를 적습니다. 예: 대외비, 사본, 회사 이름.',
      '아래 글꼴 목록에서 글꼴을 고릅니다. 처음 쓰는 글꼴은 "받기"를 눌러 받습니다.',
      '배치(가운데 하나·쪽 전체에 반복), 기울기, 크기, 진하기, 색을 고르면 쪽 미리보기에 바로 보입니다.',
      '"워터마크 넣기"를 누르고, 완료되면 "다운로드"를 누릅니다.',
    ],
    faq: [
      {
        q: '글꼴을 왜 받아야 하나요?',
        a: 'PDF에 한글을 넣으려면 한글 글꼴 파일이 필요합니다. 글꼴은 이 사이트에서 받는 공개 파일이고(한 글꼴 0.1~2.3MB), 처음 한 번 받으면 이 브라우저에 보관되어 다음부터는 바로 씁니다. 다른 브라우저·기기, 시크릿 창에서는 다시 받아야 하고, 브라우저 데이터를 지우면 사라집니다.',
      },
      {
        q: '워터마크를 넣으면 PDF가 많이 커지나요?',
        a: '거의 커지지 않습니다. 글꼴 전체가 아니라 워터마크에 쓴 글자만 PDF에 넣기 때문입니다. 보통 수십 KB 안쪽으로 늘어납니다.',
      },
      {
        q: '내 글꼴을 쓸 수 있나요?',
        a: '네. 글꼴 목록 맨 아래 "내 글꼴 올리기"로 TTF·OTF·WOFF 글꼴을 고르면 됩니다. 올린 글꼴은 이 페이지에서만 쓰고 보관하지 않습니다. 회사 글꼴처럼 사용 허가가 필요한 글꼴은 PDF에 넣어도 되는지 먼저 확인하세요.',
      },
      {
        q: '워터마크를 나중에 지울 수 있나요?',
        a: '워터마크는 쪽 위에 글자로 넣어지므로 PDF 편집 프로그램으로 지우려면 지울 수도 있습니다. 쉽게 지우지 못하게 하려면 워터마크를 넣은 뒤 "PDF 암호 걸기"로 암호를 거는 방법도 있습니다. 원본 파일은 바뀌지 않으니 원본을 따로 보관하세요.',
      },
      {
        q: '"이 글꼴에 없는 글자"라고 나옵니다.',
        a: '고른 글꼴에 없는 글자(드문 한글, 한자, 이모지 등)가 있다는 뜻입니다. 검은고딕처럼 자주 쓰는 한글만 담긴 글꼴도 있으니 다른 글꼴을 고르세요. 글꼴 목록의 글꼴에는 한자가 들어 있지 않습니다.',
      },
    ],
  },
  en: {
    howTo: [
      'Click "Choose PDF file" or drag the PDF you want to watermark onto the screen.',
      'Type your watermark in "Watermark text", such as CONFIDENTIAL, COPY or your company name.',
      'Choose a font from the list below. Click "Download" for a font you have not used before.',
      'Choose the layout (once in the center or repeated across the page), angle, size, opacity and color. The page preview updates right away.',
      'Click "Add watermark", then "Download" when it is done.',
    ],
    faq: [
      {
        q: 'Why do I need to download a font?',
        a: 'Putting text into a PDF needs a font file. The fonts are public files from this site (0.1–2.3 MB each), and once downloaded they are kept in this browser so they are ready next time. Other browsers, devices and private windows need to download them again, and clearing browser data removes them.',
      },
      {
        q: 'Does the watermark make the PDF much bigger?',
        a: 'Hardly. Only the characters used in the watermark are embedded, not the whole font, so the file usually grows by a few dozen KB at most.',
      },
      {
        q: 'Can I use my own font?',
        a: 'Yes. Choose a TTF, OTF or WOFF font with "Upload my font" at the bottom of the font list. An uploaded font is only used on this page and is not kept. For licensed fonts, such as company fonts, check that embedding them in a PDF is allowed.',
      },
      {
        q: 'Can the watermark be removed later?',
        a: 'The watermark is added as text on the page, so someone with a PDF editor could remove it. To make that harder, add a password with "Protect PDF" afterwards. Your original file is not changed, so keep it separately.',
      },
      {
        q: 'It says the font does not have some characters.',
        a: 'The chosen font lacks some characters in your text, such as rare Korean syllables, Chinese characters or emoji. Some fonts, like Black Han Sans, include only common Korean syllables, so choose another font. The fonts in the list do not include Chinese characters.',
      },
    ],
  },
});
