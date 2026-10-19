import { defineTool } from '../../types';

export default defineTool({
  status: 'live',
  section: 'edit',
  icon: ['M5 3h14v18H5z', 'M8 7h8v3H8z', 'M8 13h3v3H8z', 'M9 14.5l1 1 2-2', 'M13 14.5h3'],
  text: {
    ko: {
      name: 'PDF 양식 채우기',
      title: 'PDF 양식 채우기 - 입력 칸에 한글로 적고 저장, 업로드 없이',
      description:
        '신청서·계약서 PDF의 입력 칸에 글자를 적고, 체크 상자와 선택 상자를 고른 뒤 저장합니다. 한글도 쓸 수 있고, 받는 사람이 고칠 수 없게 굳힐 수도 있습니다. 파일은 서버에 올라가지 않습니다.',
    },
    en: {
      name: 'Fill PDF Form',
      title: 'Fill PDF Form - Type into form fields and save, in your browser',
      description:
        'Type into the fields of an application or contract PDF, tick checkboxes and pick options, then save. You can flatten the fields so others cannot change them. Your file is never uploaded.',
    },
  },
  related: ['pdf/sign', 'pdf/edit'],
  flow: { from: { kind: 'pdf' }, to: { kind: 'pdf', mark: 'form' } },
});
