import { defineContent } from '../../types';

export default defineContent({
  ko: {
    howTo: [
      '"PDF 파일 선택" 버튼을 누르거나 PDF를 화면으로 끌어다 놓습니다.',
      'PDF 안의 사진을 찾아 바로 보여 줍니다. 아이콘·선 같은 아주 작은 그림은 빼고 보여 줍니다.',
      '사진 아래 "받기"로 하나씩 받거나, "모두 받기 (ZIP)"로 한 번에 받습니다.',
    ],
    faq: [
      {
        q: '"PDF를 이미지로"와 무엇이 다른가요?',
        a: '"PDF를 이미지로"는 쪽 전체를 한 장의 그림으로 찍습니다. 이 도구는 쪽 안에 들어 있는 사진 파일 자체를 꺼냅니다. 사진만 필요하거나 원래 크기·화질 그대로 받고 싶을 때 쓰세요.',
      },
      {
        q: '화질이 떨어지나요?',
        a: 'JPG로 들어 있는 사진은 파일 안의 바이트를 그대로 꺼내므로 화질이 그대로입니다(PDF가 정한 색 프로필은 JPG에 넣고, 투명도가 붙은 JPG는 PNG로 저장합니다). 그 밖의 사진은 화소를 풀어 PNG(무손실)로 저장합니다. 크기는 PDF에 들어 있는 원래 크기이며, 쪽에서 작게 보이던 사진도 원래 크기로 나옵니다.',
      },
      {
        q: '꺼내지 못한 그림이 있다고 나옵니다.',
        a: '스캔본에 쓰이는 흑백 팩스 형식(CCITT·JBIG2), 인쇄용 CMYK 화소와 투명도가 붙은 CMYK JPG, 16비트, Lab·별색 같은 특수한 색공간, 쪽 내용에 바로 써 넣은 그림은 꺼내지 못합니다. 그런 쪽은 "PDF를 이미지로"로 쪽 전체를 그림으로 받으세요. JPEG 2000 사진은 PDF에서와 같게 보일 때만 원본 그대로 .jp2(파일 형식에 따라 .jpx·.j2k)로 꺼내며, 브라우저에서는 미리 볼 수 없습니다.',
      },
      {
        q: '같은 사진이 여러 쪽에 있으면 어떻게 되나요?',
        a: '로고처럼 여러 쪽에 쓰인 같은 사진은 한 번만 꺼냅니다. 처음 나온 쪽 번호를 파일 이름에 붙입니다.',
      },
      {
        q: '사진이 잘리거나 돌아가 보여요.',
        a: 'PDF는 사진 일부만 보이게 가리거나 돌려서 쪽에 놓기도 합니다. 이 도구는 쪽에 놓인 모습이 아니라 파일 안의 원래 사진을 꺼내므로 쪽에서 보이던 모습과 다를 수 있습니다.',
      },
    ],
  },
  en: {
    howTo: [
      'Click "Choose PDF file" or drag a PDF onto the screen.',
      'The images inside the PDF are found and shown right away. Tiny images such as icons and lines are left out.',
      'Click "Download" under an image to save it, or "Download all (ZIP)" to get them all at once.',
    ],
    faq: [
      {
        q: 'How is this different from "PDF to Image"?',
        a: '"PDF to Image" takes a picture of each whole page. This tool pulls out the image files stored inside the pages. Use it when you only need the photos, at their original size and quality.',
      },
      {
        q: 'Is the quality reduced?',
        a: 'Images stored as JPG are extracted byte for byte, so the quality is unchanged (a color profile set by the PDF is added to the JPG, and JPGs with transparency are saved as PNG). Other images are decoded and saved as lossless PNG. You get the size stored in the PDF, even if the image looked small on the page.',
      },
      {
        q: 'It says some images could not be extracted.',
        a: 'Black-and-white fax formats (CCITT, JBIG2) used in scans, CMYK pixels for print and CMYK JPGs with transparency, 16-bit images, special color spaces such as Lab or spot colors, and images written directly into the page content cannot be extracted. For those pages, use "PDF to Image" to save the whole page. JPEG 2000 images are extracted as original .jp2 files (or .jpx/.j2k, depending on the format) only when they would look the same as in the PDF, and browsers cannot preview them.',
      },
      {
        q: 'What if the same image is on many pages?',
        a: 'An image used on many pages, such as a logo, is extracted once. The file name has the number of the first page it appears on.',
      },
      {
        q: 'The image looks cropped or rotated differently.',
        a: 'A PDF can show only part of an image, or rotate it, on the page. This tool extracts the original image stored in the file, so it may look different from how it appeared on the page.',
      },
    ],
  },
});
