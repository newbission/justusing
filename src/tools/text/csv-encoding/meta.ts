import { defineTool } from '../../types';

export default defineTool({
  status: 'live',
  section: 'encoding',
  icon: [
    'M3 5h11v14H3z',
    'M3 10h11',
    'M3 14.5h11',
    'M7.5 5v14',
    'M17 8.5h5',
    'M20 6.5l2 2-2 2',
    'M22 15.5h-5',
    'M19 13.5l-2 2 2 2',
  ],
  text: {
    ko: {
      name: 'CSV 한글 깨짐 고치기',
      summary: 'CSV를 엑셀에서 한글이 깨지지 않게 바꿉니다',
      title: 'CSV 한글 깨짐 고치기 - 엑셀용 UTF-8·CP949 변환, 업로드 없이',
      description:
        '엑셀에서 열면 한글이 깨지는 CSV 파일을 고칩니다. 원래 인코딩(UTF-8·CP949 등)을 알아내 미리보기로 보여 주고, 엑셀용 UTF-8(BOM)이나 CP949로 다시 저장합니다. 큰 파일과 여러 파일도 한 번에, 파일은 서버에 올라가지 않습니다.',
    },
    en: {
      name: 'Fix CSV Encoding',
      summary: 'Fix garbled text in CSV files for Excel',
      title: 'Fix CSV encoding - Convert to UTF-8 with BOM for Excel, in your browser',
      description:
        'Fix CSV files whose text shows up garbled in Excel. The original encoding (UTF-8, Windows-1252, CP949 and more) is detected and previewed, then saved as UTF-8 with BOM for Excel, plain UTF-8 or CP949. Works with large files and many files at once, and nothing is uploaded.',
    },
  },
  related: ['pdf/extract-text'],
  flow: { from: { kind: 'csv', mark: 'garbled' }, to: { kind: 'csv', mark: 'table' } },
});
