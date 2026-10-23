import { siteConfig } from '../../../site.config';
import { defineContent } from '../../types';

/** libheif 허가서·안내 (scripts/copy-libheif-notice.mjs가 만든다) */
const NOTICE = `${siteConfig.domain}/vendor/libheif/README.txt`;

export default defineContent({
  ko: {
    uses: [
      {
        title: '윈도우 PC에서 아이폰 사진이 안 열릴 때',
        text: '케이블이나 클라우드로 옮긴 아이폰 사진이 .HEIC라 윈도우 사진 앱이나 회사 프로그램에서 열리지 않을 때, 어디서나 열리는 JPG로 바꿉니다.',
      },
      {
        title: 'JPG만 받는 제출 사이트',
        text: '관공서·학교 제출이나 쇼핑몰 후기처럼 JPG·PNG만 올릴 수 있는 곳에 아이폰으로 찍은 사진을 올려야 할 때 씁니다.',
      },
      {
        title: '여행 사진을 한꺼번에',
        text: '아이폰에서 옮긴 사진 수십 장을 한 번에 넣어 JPG로 바꾸고 ZIP 하나로 받습니다. 세로로 찍은 사진도 바로 선 채로 저장됩니다.',
      },
    ],
    howTo: [
      '"이미지 파일 선택" 버튼을 누르거나 HEIC 사진을 화면으로 끌어다 놓습니다. 여러 장을 한 번에 넣을 수 있습니다.',
      '바꿀 형식을 고릅니다. 보통은 JPG를 고르면 됩니다.',
      '"변환하기"를 누릅니다.',
      '한 장이면 "다운로드", 여러 장이면 "모두 받기"를 눌러 ZIP 하나로 받습니다. 목록의 ↓ 버튼으로 한 장씩 받을 수도 있습니다.',
    ],
    faq: [
      {
        q: 'HEIC가 무엇인가요?',
        a: '아이폰·아이패드가 iOS 11(2017년)부터 기본으로 쓰는 사진 형식입니다. HEVC(H.265) 압축을 써서 같은 화질의 JPG보다 용량이 절반 정도로 작습니다. 다만 윈도우와 여러 웹사이트·프로그램이 아직 열지 못해 JPG로 바꿔야 할 때가 많습니다.',
      },
      {
        q: '아이폰에서 처음부터 JPG로 찍을 수 있나요?',
        a: '설정 → 카메라 → 포맷에서 "높은 호환성"을 고르면 다음부터 JPG로 찍힙니다. "고효율"이 HEIC입니다. 이미 찍은 사진은 바뀌지 않으니 이 도구로 바꾸세요.',
      },
      {
        q: 'PC로 옮길 때 저절로 JPG가 되게 할 수 있나요?',
        a: '설정 → 사진 → "Mac 또는 PC로 전송"에서 "자동"을 고르면 케이블로 옮길 때 호환되는 형식(JPG)으로 바꿔 옮깁니다. "원본 유지"를 고르면 HEIC 그대로 옮겨집니다. 메일이나 메신저로 보낼 때도 대개 JPG로 바뀌어 전달됩니다.',
      },
      {
        q: '촬영 날짜·위치 정보는 남나요?',
        a: '남지 않습니다. 사진을 다시 그려 저장하므로 위치(GPS)·찍은 날짜·기기 정보가 모두 빠집니다. 올리기에는 안전하지만, 사진 앱에서 찍은 날짜순으로 정리되지 않을 수 있습니다. 세로로 찍은 사진의 회전 정보는 미리 적용해 바로 선 사진으로 저장합니다.',
      },
      {
        q: '라이브 포토나 HDR 사진은 어떻게 되나요?',
        a: '라이브 포토의 움직임은 HEIC와 따로 된 영상 파일(MOV)이라, HEIC만 넣으면 멈춘 사진 한 장이 됩니다. 한 파일에 여러 장이 든 HEIC는 사진 앱에 보이는 대표 사진 한 장만 바뀝니다. HDR 사진의 추가 밝기 정보와 10비트 색은 남지 않고 일반 화면용 8비트 사진으로 저장되어, HDR 화면에서는 원본보다 덜 밝게 보일 수 있습니다.',
      },
      {
        q: '크롬에서도 되나요? 무엇을 내려받나요?',
        a: `네. Safari는 HEIC를 스스로 읽고, 크롬·엣지·파이어폭스에서는 HEIC를 여는 프로그램(libheif, 약 0.5MB)을 이 사이트에서 받아 브라우저 안에서 엽니다. 사진은 어디로도 올라가지 않습니다. libheif와 libde265는 GNU LGPL 3.0 오픈소스이며, 허가서와 소스 안내는 ${NOTICE}에 있습니다.`,
      },
    ],
  },
  en: {
    uses: [
      {
        title: 'iPhone photos will not open on Windows',
        text: 'When photos copied from an iPhone by cable or cloud are .HEIC files that the Windows Photos app or a work program cannot open, convert them to JPG, which opens everywhere.',
      },
      {
        title: 'Sites that only take JPG',
        text: 'Use it when you need to upload an iPhone photo to a place that accepts only JPG or PNG, such as a government or school form or a product review.',
      },
      {
        title: 'A whole trip at once',
        text: 'Add dozens of photos copied from an iPhone at once, convert them to JPG and download one ZIP. Photos taken upright stay upright.',
      },
    ],
    howTo: [
      'Click "Choose image files" or drag HEIC photos onto the screen. You can add many at once.',
      'Choose the format to convert to. JPG is usually the right choice.',
      'Click "Convert photos".',
      'For one photo, click "Download". For several, click "Download all" to get one ZIP. You can also download each photo with its ↓ button.',
    ],
    faq: [
      {
        q: 'What is HEIC?',
        a: 'It is the photo format iPhones and iPads use by default since iOS 11 (2017). It uses HEVC (H.265) compression, so files are about half the size of a JPG of the same quality. Windows and many websites and programs still cannot open it, so you often need to convert it to JPG.',
      },
      {
        q: 'Can my iPhone take JPG photos to begin with?',
        a: 'Choose Settings → Camera → Formats → "Most Compatible" and future photos are taken as JPG. "High Efficiency" is HEIC. Photos you already took do not change, so convert them with this tool.',
      },
      {
        q: 'Can photos become JPG automatically when I copy them to a PC?',
        a: 'Choose Settings → Photos → "Transfer to Mac or PC" → "Automatic" and photos copied by cable are converted to a compatible format (JPG). "Keep Originals" copies them as HEIC. Photos sent by email or a messenger are usually converted to JPG along the way too.',
      },
      {
        q: 'Are the date and location kept?',
        a: 'No. The photo is redrawn and saved, so the location (GPS), date taken and device information are all removed. That is safe for posting, but photo apps may no longer sort the photos by the date taken. The rotation of photos taken upright is applied, so they are saved standing up.',
      },
      {
        q: 'What happens to Live Photos and HDR photos?',
        a: 'The motion of a Live Photo is a separate video file (MOV), so converting the HEIC gives you the still photo. A HEIC file holding several images becomes the one main photo shown in the Photos app. The extra brightness data and 10-bit color of HDR photos are not kept; the photo is saved as a regular 8-bit photo and may look less bright than the original on an HDR screen.',
      },
      {
        q: 'Does it work in Chrome? What gets downloaded?',
        a: `Yes. Safari reads HEIC by itself. In Chrome, Edge and Firefox, the page loads a HEIC reader (libheif, about 0.5 MB) from this site and opens the photo inside your browser. Your photos are never uploaded. libheif and libde265 are open source under the GNU LGPL 3.0; the license text and source information are at ${NOTICE}.`,
      },
    ],
  },
});
