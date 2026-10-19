import { defineContent } from '../../types';

export default defineContent({
  ko: {
    uses: [
      {
        title: '제출 서류를 한 파일로',
        text: '주민등록등본, 재직증명서, 원천징수영수증처럼 따로 받은 PDF를 "한 파일로 내 주세요"라는 곳이 많습니다. 내라는 순서대로 맞춰 하나로 합치면 받는 사람도 보기 편합니다.',
      },
      {
        title: '나눠 스캔한 문서를 한 부로',
        text: '스캐너가 쪽마다 따로 저장했거나 여러 번에 나눠 스캔한 계약서를 원래 순서대로 이어 붙입니다. 잘못 들어간 빈 쪽이나 표지는 빼고 합칠 수 있습니다.',
      },
      {
        title: '과제·포트폴리오 묶기',
        text: '여러 파일로 만든 과제나 포트폴리오를 파일 하나로 제출해야 할 때 씁니다. 암호가 걸린 PDF도 암호를 넣으면 함께 합칠 수 있습니다.',
      },
    ],
    howTo: [
      '"PDF 파일 선택" 버튼을 누르거나 합칠 PDF 파일들을 화면으로 끌어다 놓습니다. 여러 개를 한 번에 고를 수 있습니다.',
      '목록에서 순서를 확인합니다. 줄을 끌어서 옮기거나 ↑ ↓ 버튼으로 순서를 바꾸고, 잘못 넣은 파일은 × 로 뺍니다.',
      '파일 왼쪽의 ▸를 누르면 페이지가 펼쳐집니다. 페이지를 끌거나 ◀ ▶로 순서를 바꾸고, 필요 없는 페이지는 "제외"합니다.',
      '더 넣을 파일이 있으면 "파일 추가"를 누르거나 다시 끌어다 놓습니다.',
      '"미리보기"로 합쳐질 순서를 확인한 뒤 "PDF 합치기"를 누르고, 완료되면 "다운로드"로 받습니다.',
    ],
    faq: [
      {
        q: '몇 개까지, 얼마나 큰 파일까지 합칠 수 있나요?',
        a: '개수 제한은 없습니다. 다만 모든 파일을 기기 메모리에서 처리하므로, 메모리가 적은 휴대폰에서 수백 MB가 넘는 파일을 합치면 느리거나 실패할 수 있습니다. 그럴 때는 PC에서 해 보세요.',
      },
      {
        q: '암호가 걸린 PDF도 합칠 수 있나요?',
        a: '네. 목록에서 그 파일의 암호를 입력하면 합칠 수 있습니다. 합친 파일에는 암호가 걸리지 않으니 필요하면 따로 보관에 주의하세요. 입력한 암호는 이 기기 안에서만 쓰입니다.',
      },
      {
        q: '합치면 화질이 떨어지나요?',
        a: '아니요. 페이지를 다시 그리지 않고 원본 PDF의 내용을 그대로 옮겨 담기 때문에 글자·이미지 품질이 그대로입니다.',
      },
      {
        q: '일부 페이지만 합치거나 페이지 순서를 바꿀 수 있나요?',
        a: '네. 파일 왼쪽의 ▸를 눌러 페이지를 펼치면 파일 안에서 페이지 순서를 바꾸고 필요 없는 페이지를 뺄 수 있습니다. 뺀 페이지는 "복구"로 다시 넣을 수 있고, 원본 파일은 바뀌지 않습니다.',
      },
    ],
  },
  en: {
    uses: [
      {
        title: 'One file for an application',
        text: 'Many places ask for all your documents, such as certificates, statements, and forms, in a single file. Put them in the order they ask for and merge them so the reader can go through them easily.',
      },
      {
        title: 'Rejoin a document scanned in parts',
        text: 'If your scanner saved each page separately, or you scanned a contract in several batches, join the parts back in the original order. You can leave out blank pages or cover sheets as you merge.',
      },
      {
        title: 'Submit assignments or a portfolio',
        text: 'Use it when work made in several files has to be handed in as one. Password-protected PDFs can be merged too once you enter the password.',
      },
    ],
    howTo: [
      'Click "Choose PDF files" or drag the PDF files you want to merge onto the page. You can choose several at once.',
      'Check the order in the list. Drag a row or use the ↑ ↓ buttons to change the order, and remove a file you added by mistake with ×.',
      'Click ▸ to the left of a file to show its pages. Drag pages or use ◀ ▶ to reorder them, and "Exclude" the pages you do not need.',
      'To add more files, click "Add files" or drag them onto the page again.',
      'Check the merged order with "Preview", then click "Merge PDF". When it is done, click "Download".',
    ],
    faq: [
      {
        q: 'How many files, and how large, can I merge?',
        a: "There is no limit on the number of files. Everything is processed in your device's memory, though, so merging files of several hundred MB on a phone with little memory may be slow or fail. If that happens, try on a computer.",
      },
      {
        q: 'Can I merge password-protected PDFs?',
        a: 'Yes. Enter the password for that file in the list and it can be merged. The merged file has no password, so keep it somewhere safe if needed. The password is only used on this device.',
      },
      {
        q: 'Does merging reduce quality?',
        a: 'No. Pages are not redrawn. The content of the original PDFs is copied as is, so text and images keep their quality.',
      },
      {
        q: 'Can I merge only some pages, or change the page order?',
        a: 'Yes. Click ▸ to the left of a file to show its pages. You can reorder pages within the file and leave out the ones you do not need. Use "Restore" to put an excluded page back. Your original files are not changed.',
      },
    ],
  },
});
